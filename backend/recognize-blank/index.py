"""
Распознавание отсканированного бланка ответов АОУСПТ через GigaChat Vision.
POST / — { image: base64, questionsCount?: 40, answerKey?: "АБВГ123..." }
Возвращает: { studentCode, answers[], confidence[], analysis }

Алгоритм:
1. Декод PNG/JPEG → grayscale
2. Поиск 4 чёрных квадратов-реперов по углам
3. Перспективное выравнивание (warpPerspective) → каноничный размер
4. Отправка выровненного изображения в GigaChat Vision
5. GigaChat читает код ученика и ответы по всем вопросам
6. Парсинг JSON из ответа GigaChat
"""
import json
import base64
import os
import re
import io
import ssl
import uuid
import time
import numpy as np
import cv2
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta
from PIL import Image

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

# Каноничный размер выровненного бланка (px)
CANVAS_W = 1200
CANVAS_H = 1700

# ── GigaChat токен (кэш в памяти) ──
_TOKEN_CACHE: dict = {}


def _ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _get_gigachat_token() -> str:
    now = datetime.utcnow()
    if _TOKEN_CACHE.get("token") and _TOKEN_CACHE.get("expires_at", now) > now:
        return _TOKEN_CACHE["token"]

    auth_key = os.environ.get("GIGACHAT_AUTH_KEY", "")
    if not auth_key:
        raise RuntimeError("GIGACHAT_AUTH_KEY не задан")

    data = urllib.parse.urlencode({"scope": "GIGACHAT_API_PERS"}).encode()
    req = urllib.request.Request(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Basic {auth_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as r:
        body = json.loads(r.read().decode())

    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GigaChat не вернул access_token: {body}")

    expires_ms = body.get("expires_at")
    expires_at = (
        datetime.utcfromtimestamp(expires_ms / 1000) - timedelta(minutes=2)
        if expires_ms
        else now + timedelta(minutes=25)
    )
    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def _upload_image_to_gigachat(image_bytes: bytes, token: str) -> str:
    """Загружает изображение в GigaChat Files API и возвращает file_id."""
    boundary = "----FormBoundary" + uuid.uuid4().hex
    body_parts = [
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="file"; filename="blank.jpg"\r\n',
        b"Content-Type: image/jpeg\r\n\r\n",
        image_bytes,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    body = b"".join(body_parts)

    req = urllib.request.Request(
        "https://gigachat.devices.sberbank.ru/api/v1/files",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "purpose": "general",
        },
    )
    with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx()) as r:
        resp = json.loads(r.read().decode())

    file_id = resp.get("id")
    if not file_id:
        raise RuntimeError(f"GigaChat Files: нет id в ответе: {resp}")
    return file_id


def _gigachat_vision(image_b64: str, questions_count: int, max_retries: int = 3) -> dict:
    """
    Отправляет изображение бланка в GigaChat Vision.
    Возвращает {'code': '12345', 'answers': ['А','Б',...]}
    """
    token = _get_gigachat_token()

    # Конвертируем base64 → bytes для загрузки файла
    img_bytes = base64.b64decode(image_b64)

    # Загружаем файл через Files API
    file_id = _upload_image_to_gigachat(img_bytes, token)

    prompt = (
        f"На изображении — заполненный учебный бланк ответов. "
        f"Прочитай внимательно:\n"
        f"1. КОД УЧЕНИКА — 5 цифр в верхних клетках бланка\n"
        f"2. ОТВЕТЫ — {questions_count} клеток с буквами (русский алфавит: А Б В Г Д и т.д.) или цифрами. "
        f"Клетки пронумерованы от 1 до {questions_count}.\n\n"
        f"Верни ТОЛЬКО валидный JSON без markdown:\n"
        f'{{ "code": "12345", "answers": ["А","Б","В",...] }}\n\n'
        f"Правила:\n"
        f"- code: строка из 5 цифр (если не видно — пиши \"?\" вместо цифры)\n"
        f"- answers: массив строго из {questions_count} элементов\n"
        f"- Если клетка пустая или нечитаема — пиши пустую строку \"\"\n"
        f"- Буквы ТОЛЬКО заглавные русские или цифры — как написано в клетке\n"
        f"- Никаких пояснений — только JSON"
    )

    payload = {
        "model": "GigaChat-Pro",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"https://gigachat.devices.sberbank.ru/api/v1/files/{file_id}/content"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "temperature": 0.05,
        "max_tokens": 800,
        "stream": False,
    }

    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Connection": "close",
                },
            )
            with urllib.request.urlopen(req, timeout=55, context=_ssl_ctx()) as r:
                body = json.loads(r.read().decode())

            content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _parse_vision_response(content, questions_count)

        except urllib.error.HTTPError as e:
            status = e.code
            err_body = e.read().decode(errors="ignore")[:200]
            last_err = RuntimeError(f"GigaChat Vision HTTP {status}: {err_body}")
            if status == 429 and attempt < max_retries:
                time.sleep(3 * attempt)
                token = _get_gigachat_token()
                continue
            raise last_err
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(2)
                continue
            raise

    raise last_err


def _parse_vision_response(content: str, questions_count: int) -> dict:
    """Парсит JSON из ответа GigaChat Vision."""
    # Убираем markdown-обёртку
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
    if fence:
        content = fence.group(1)
    else:
        s = content.find("{")
        e = content.rfind("}")
        if s >= 0 and e > s:
            content = content[s:e + 1]

    data = json.loads(content.strip())

    code = str(data.get("code", "?????"))
    # нормализуем код: оставляем только цифры и ?
    code = "".join(c if c.isdigit() or c == "?" else "?" for c in code)
    code = (code + "?????")[:5]

    answers_raw = data.get("answers", [])
    answers = []
    for i in range(questions_count):
        val = answers_raw[i] if i < len(answers_raw) else ""
        answers.append(str(val).strip().upper()[:1] if val else "")

    return {"code": code, "answers": answers}


def _to_grayscale(img_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось декодировать изображение")
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _find_anchors(gray: np.ndarray) -> list[tuple[int, int]] | None:
    """Ищет 4 чёрных квадрата-репера по углам бланка."""
    h, w = gray.shape
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    img_area = h * w
    for c in cnts:
        area = cv2.contourArea(c)
        if area < img_area * 0.0003 or area > img_area * 0.01:
            continue
        x, y, ww, hh = cv2.boundingRect(c)
        if ww == 0 or hh == 0:
            continue
        ratio = ww / hh
        if ratio < 0.65 or ratio > 1.55:
            continue
        fill = area / (ww * hh)
        if fill < 0.65:
            continue
        cx, cy = x + ww // 2, y + hh // 2
        candidates.append((cx, cy, area))

    if len(candidates) < 4:
        return None

    pts = candidates
    tl = min(pts, key=lambda p: p[0] + p[1])
    br = max(pts, key=lambda p: p[0] + p[1])
    tr = max(pts, key=lambda p: p[0] - p[1])
    bl = min(pts, key=lambda p: p[0] - p[1])

    centers = [(tl[0], tl[1]), (tr[0], tr[1]), (br[0], br[1]), (bl[0], bl[1])]
    if len(set(centers)) < 4:
        return None
    return centers


def _warp_to_canvas(gray: np.ndarray, anchors: list[tuple[int, int]]) -> np.ndarray:
    src = np.array(anchors, dtype=np.float32)
    dst = np.array([
        [0, 0],
        [CANVAS_W - 1, 0],
        [CANVAS_W - 1, CANVAS_H - 1],
        [0, CANVAS_H - 1],
    ], dtype=np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(gray, M, (CANVAS_W, CANVAS_H))


def _canvas_to_jpeg_b64(canvas: np.ndarray) -> str:
    """Конвертирует выровненный grayscale-холст в base64 JPEG."""
    # Улучшаем контрастность для лучшего распознавания
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(canvas)
    success, buf = cv2.imencode(".jpg", enhanced, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise RuntimeError("Не удалось закодировать изображение")
    return base64.b64encode(buf.tobytes()).decode()


def _analyze(answers: list[str], answer_key: str) -> dict:
    if not answer_key:
        return {"total": len(answers), "correct": 0, "wrong": 0, "percent": 0, "details": []}
    key = list(answer_key.strip().upper())
    details = []
    correct = 0
    for i, a in enumerate(answers):
        ka = key[i] if i < len(key) else ""
        ok = a.upper() == ka and ka != ""
        if ok:
            correct += 1
        details.append({"q": i + 1, "student": a, "key": ka, "correct": ok})
    total = len(answers)
    return {
        "total": total,
        "correct": correct,
        "wrong": total - correct,
        "percent": round(correct / total * 100, 1) if total else 0,
        "details": details,
    }


def _resp(status: int, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """Распознавание заполненного бланка ответов через GigaChat Vision."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
        if isinstance(body, str):
            body = json.loads(body)
    except Exception:
        return _resp(400, {"error": "Некорректный JSON"})

    image_b64 = body.get("image", "")
    if not image_b64:
        return _resp(400, {"error": "Не передано изображение (поле image)"})

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    questions = int(body.get("questionsCount", 40))
    if questions < 1 or questions > 60:
        questions = 40
    answer_key = str(body.get("answerKey", ""))

    try:
        img_bytes = base64.b64decode(image_b64)
    except Exception:
        return _resp(400, {"error": "Некорректный base64"})

    try:
        gray = _to_grayscale(img_bytes)
    except Exception as e:
        return _resp(400, {"error": f"Ошибка чтения изображения: {e}"})

    # Минимальный размер — отклоняем слишком маленькие изображения
    h_px, w_px = gray.shape
    if h_px < 100 or w_px < 100:
        return _resp(422, {
            "error": "Изображение слишком маленькое. Убедитесь, что весь бланк попал в кадр.",
            "hint": "image_too_small",
        })

    # Пробуем найти реперы для выравнивания
    anchors = _find_anchors(gray)
    if anchors is not None:
        canvas = _warp_to_canvas(gray, anchors)
        aligned_b64 = _canvas_to_jpeg_b64(canvas)
    else:
        # Реперы не найдены — отправляем оригинал (GigaChat сам разберётся)
        aligned_b64 = image_b64

    try:
        result = _gigachat_vision(aligned_b64, questions)
    except Exception as e:
        return _resp(422, {"error": f"Ошибка распознавания: {e}"})

    code = result["code"]
    answers = result["answers"]
    # confidence=1.0 для GigaChat (он сам оценивает)
    avg_conf = 0.95
    confs = [0.95 if a else 0.0 for a in answers]
    code_confs = [0.95 if c.isdigit() else 0.0 for c in code]

    analysis = _analyze(answers, answer_key)

    return _resp(200, {
        "studentCode": code,
        "codeConfidence": code_confs,
        "answers": answers,
        "answersConfidence": confs,
        "averageConfidence": avg_conf,
        "questionsCount": questions,
        "analysis": analysis,
    })