"""
Распознавание бланка ответов через OpenCV (без ИИ).
Алгоритм:
1. Выравнивание и нормализация изображения
2. Поиск сетки кружков через HoughCircles
3. Кластеризация кружков по строкам и столбцам
4. Определение закрашенных по яркости внутри кружка
5. Сборка ответов А/Б/В/Г и кода ученика

POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
import json, base64, os, math
import numpy as np
import cv2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]

# ── Подготовка изображения ────────────────────────────────────────────────────
def _load_gray(image_b64: str):
    img_bytes = base64.b64decode(image_b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось декодировать изображение")
    # Масштаб: длинная сторона 1600px
    h, w = img.shape[:2]
    scale = 1600 / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # CLAHE для выравнивания контраста
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    gray = clahe.apply(gray)
    return img, gray


# ── Поиск всех кружков ────────────────────────────────────────────────────────
def _find_circles(gray):
    """Ищем все кружки через HoughCircles с широким диапазоном радиусов."""
    h, w = gray.shape
    blurred = cv2.GaussianBlur(gray, (5, 5), 1)
    # Минимальный радиус ~1% от короткой стороны, максимальный ~4%
    min_r = max(8,  int(min(h, w) * 0.010))
    max_r = max(30, int(min(h, w) * 0.040))

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=int(min_r * 1.5),
        param1=60,
        param2=22,
        minRadius=min_r,
        maxRadius=max_r,
    )
    if circles is None:
        return []
    return [(int(x), int(y), int(r)) for x, y, r in circles[0]]


# ── Яркость внутри кружка ─────────────────────────────────────────────────────
def _circle_brightness(gray, cx, cy, r) -> float:
    """Средняя яркость внутри кружка (0=чёрный, 255=белый)."""
    h, w = gray.shape
    mask = np.zeros((h, w), dtype=np.uint8)
    inner_r = max(1, int(r * 0.65))
    cv2.circle(mask, (cx, cy), inner_r, 255, -1)
    pixels = gray[mask == 255]
    return float(np.mean(pixels)) if len(pixels) > 0 else 255.0


def _is_filled(gray, cx, cy, r, threshold=160) -> tuple[bool, float]:
    bright = _circle_brightness(gray, cx, cy, r)
    return bright < threshold, bright


# ── Кластеризация кружков по строкам ─────────────────────────────────────────
def _cluster_rows(circles, tolerance_ratio=0.6):
    """Группируем кружки в строки по Y-координате."""
    if not circles:
        return []
    avg_r = np.median([r for _, _, r in circles])
    tol = avg_r * tolerance_ratio * 2

    sorted_c = sorted(circles, key=lambda c: c[1])
    rows = []
    for cx, cy, r in sorted_c:
        placed = False
        for row in rows:
            row_y = np.mean([c[1] for c in row])
            if abs(cy - row_y) <= tol:
                row.append((cx, cy, r))
                placed = True
                break
        if not placed:
            rows.append([(cx, cy, r)])

    # Сортируем каждую строку по X
    rows = [sorted(row, key=lambda c: c[0]) for row in rows]
    # Сортируем строки по Y
    rows.sort(key=lambda row: np.mean([c[1] for c in row]))
    return rows


# ── Определение порога закрашенности ─────────────────────────────────────────
def _adaptive_threshold(brightness_list: list[float]) -> float:
    """Автоматически подбираем порог между пустыми и закрашенными кружками."""
    if not brightness_list:
        return 160.0
    arr = np.array(brightness_list)
    # Если разброс маленький — все кружки пустые, порог не важен
    if arr.max() - arr.min() < 30:
        return arr.min() - 5
    # Kmeans на 2 кластера
    from scipy.cluster.vq import kmeans
    try:
        centers, _ = kmeans(arr.astype(float), 2)
        return float(sorted(centers).mean())  # середина между кластерами
    except Exception:
        return float(arr.mean())


# ── Основное распознавание ────────────────────────────────────────────────────
def _recognize(image_b64: str, questions_count: int, options_count: int) -> dict:
    img, gray = _load_gray(image_b64)
    h, w = gray.shape

    circles = _find_circles(gray)
    if len(circles) < questions_count:
        # Пробуем с менее строгими параметрами
        blurred = cv2.GaussianBlur(gray, (7,7), 1.5)
        min_r = max(6, int(min(h, w) * 0.008))
        max_r = max(35, int(min(h, w) * 0.045))
        c2 = cv2.HoughCircles(blurred, cv2.HOUGH_GRADIENT, dp=1.0,
                               minDist=int(min_r*1.3), param1=50, param2=18,
                               minRadius=min_r, maxRadius=max_r)
        if c2 is not None:
            circles = [(int(x), int(y), int(r)) for x, y, r in c2[0]]

    if not circles:
        raise ValueError("Кружки на бланке не найдены. Убедитесь, что фото чёткое и бланк занимает весь кадр.")

    rows = _cluster_rows(circles)

    # Собираем все яркости для адаптивного порога
    all_brightness = [_circle_brightness(gray, cx, cy, r) for cx, cy, r in circles]
    threshold = _adaptive_threshold(all_brightness)

    # ── Разделяем строки: ответы vs код ученика ──────────────────────────────
    # Строки с options_count кружков = вопросы
    # Строки с 10 кружками = код ученика (5 строк по 10)
    answer_rows = []
    code_rows = []

    for row in rows:
        n = len(row)
        if n == options_count:
            answer_rows.append(row)
        elif n == 10:
            code_rows.append(row)
        elif abs(n - options_count) <= 1 and n >= 2:
            # Почти верное число — берём первые options_count
            answer_rows.append(row[:options_count])

    # Ограничиваем количество строк ответов
    answer_rows = answer_rows[:questions_count]

    # ── Ответы А/Б/В/Г ───────────────────────────────────────────────────────
    opts = RU_OPTS[:options_count]
    answers = []
    confidences = []

    for i, row in enumerate(answer_rows):
        brightnesses = [_circle_brightness(gray, cx, cy, r) for cx, cy, r in row]
        filled_idx = int(np.argmin(brightnesses))
        min_b = brightnesses[filled_idx]
        max_b = max(brightnesses)

        if max_b - min_b > 25:   # есть явно закрашенный
            answers.append(opts[filled_idx] if filled_idx < len(opts) else "")
            conf = min(0.99, (max_b - min_b) / 150)
            confidences.append(round(conf, 2))
        else:
            answers.append("")   # не закрашен
            confidences.append(0.0)

    # Дополняем до questionsCount пустыми
    while len(answers) < questions_count:
        answers.append("")
        confidences.append(0.0)

    # ── Код ученика ───────────────────────────────────────────────────────────
    code = ""
    code_confs = []
    for row in code_rows[:5]:
        brightnesses = [_circle_brightness(gray, cx, cy, r) for cx, cy, r in row]
        filled_idx = int(np.argmin(brightnesses))
        min_b = brightnesses[filled_idx]
        max_b = max(brightnesses)
        if max_b - min_b > 20:
            code += str(filled_idx)
            code_confs.append(round(min(0.99, (max_b - min_b) / 120), 2))
        else:
            code += "?"
            code_confs.append(0.0)

    code = (code + "?????")[:5]
    code_confs = (code_confs + [0.0]*5)[:5]

    return {
        "answers": answers[:questions_count],
        "confidences": confidences[:questions_count],
        "code": code,
        "code_confs": code_confs,
        "circles_found": len(circles),
        "answer_rows_found": len(answer_rows),
    }


# ── Анализ ────────────────────────────────────────────────────────────────────
def _analyze(answers: list, answer_key: str) -> dict:
    if not answer_key:
        return {"total": len(answers), "correct": 0, "wrong": 0, "percent": 0, "details": []}
    key = list(answer_key.strip().upper())
    details, correct = [], 0
    for i, a in enumerate(answers):
        ka = key[i] if i < len(key) else ""
        ok = a.upper() == ka and ka != ""
        if ok: correct += 1
        details.append({"q": i+1, "student": a, "key": ka, "correct": ok})
    total = len(answers)
    return {
        "total": total, "correct": correct, "wrong": total - correct,
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
    """
    Распознавание бланка через OpenCV: HoughCircles + яркость.
    Работает без ИИ, < 1 секунды. Кружки А/Б/В/Г и код ученика 5×10.
    POST { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "..." }
    -> { studentCode, answers[], confidence[], analysis }
    """
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

    try:
        base64.b64decode(image_b64)
    except Exception:
        return _resp(400, {"error": "Некорректный base64"})

    questions    = max(1, min(int(body.get("questionsCount", 20)), 80))
    options      = max(2, min(int(body.get("optionsCount",   4)),  6))
    answer_key   = str(body.get("answerKey", ""))

    # Проверяем размер изображения
    try:
        arr = np.frombuffer(base64.b64decode(image_b64), dtype=np.uint8)
        check = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if check is None:
            return _resp(400, {"error": "Не удалось прочитать изображение"})
        h_px, w_px = check.shape
        if h_px < 100 or w_px < 100:
            return _resp(422, {
                "error": "Изображение слишком маленькое. Сфотографируйте бланк целиком.",
                "hint": "image_too_small",
            })
    except Exception as e:
        return _resp(400, {"error": f"Ошибка чтения изображения: {e}"})

    try:
        result = _recognize(image_b64, questions, options)
    except ValueError as e:
        return _resp(422, {"error": str(e)})
    except Exception as e:
        return _resp(422, {"error": f"Ошибка распознавания: {e}"})

    answers     = result["answers"]
    confidences = result["confidences"]
    code        = result["code"]
    code_confs  = result["code_confs"]
    analysis    = _analyze(answers, answer_key)
    avg_conf    = round(float(np.mean([c for c in confidences if c > 0] or [0])), 2)

    return _resp(200, {
        "studentCode":       code,
        "codeConfidence":    code_confs,
        "answers":           answers,
        "answersConfidence": confidences,
        "averageConfidence": avg_conf,
        "questionsCount":    questions,
        "analysis":          analysis,
        "debug": {
            "circlesFound":    result["circles_found"],
            "answerRowsFound": result["answer_rows_found"],
        }
    })
