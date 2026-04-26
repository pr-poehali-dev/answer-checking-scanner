"""
Распознавание отсканированного бланка ответов АОУСПТ через OpenCV.
POST / — { image: base64, questionsCount?: 40, answerKey?: "АБВГ123..." }
Возвращает: { studentCode, answers[], confidence[], analysis }

Алгоритм:
1. Декод PNG/JPEG → grayscale
2. Бинаризация (Otsu)
3. Поиск 4 чёрных квадратов-реперов по углам
4. Перспективное выравнивание (warpPerspective) → каноничный размер
5. Вырезаем 5 клеток кода + 40 клеток ответов по фиксированным координатам
6. Каждую клетку: бинаризация, центрирование символа, сравнение с шаблонами
7. Шаблоны: рендерим алфавит/цифры через PIL DejaVuSans Bold
"""
import json
import base64
import io
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
DIGITS = "0123456789"
ALL_CHARS = ALPHABET + DIGITS  # для ответов
DIGIT_CHARS = DIGITS  # для кода ученика

# Каноничный размер выровненного бланка (px)
CANVAS_W = 1200
CANVAS_H = 1700

# ── Шаблоны символов (рендерятся один раз при старте) ──
_FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
TEMPLATE_SIZE = 48  # 48x48 px


def _load_font(size: int):
    for p in _FONT_PATHS:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _render_template(ch: str, size: int = TEMPLATE_SIZE) -> np.ndarray:
    """Рендерит символ как чёрный на белом, затем бинаризует."""
    font = _load_font(int(size * 0.75))
    img = Image.new("L", (size, size), 255)
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), ch, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1]
    d.text((x, y), ch, fill=0, font=font)
    arr = np.array(img)
    _, binv = cv2.threshold(arr, 128, 255, cv2.THRESH_BINARY_INV)  # символ=255, фон=0
    return binv


# Кэш шаблонов
_TEMPLATES_ALL: dict[str, np.ndarray] = {}
_TEMPLATES_DIGIT: dict[str, np.ndarray] = {}


def _ensure_templates():
    if not _TEMPLATES_ALL:
        for ch in ALL_CHARS:
            _TEMPLATES_ALL[ch] = _render_template(ch)
        for ch in DIGIT_CHARS:
            _TEMPLATES_DIGIT[ch] = _render_template(ch)


# ── Геометрия бланка (в каноничных координатах) ──
# Должна совпадать с generate-blank/index.py (single-blank layout, 1 на A4)
# Бланк рисуется на A4 с margin 8mm, реперы 5mm в углах с inset 3mm
# При CANVAS_W x CANVAS_H координаты считаем относительно полной выровненной области (между реперами)

# После выравнивания: ширина и высота — между центрами 4 реперов
# Размещение клеток: код — сверху слева, ответы — 4 колонки x 10 строк

# Эти параметры подобраны под one-per-page бланк
CODE_CELLS = 5
ANS_COUNT = 40
ANS_COLS = 4
ANS_ROWS = 10

# Доли от ширины/высоты выровненного "поля внутри реперов"
CODE_X0 = 0.06    # отступ слева
CODE_Y0 = 0.10    # отступ сверху до клеток кода
CODE_CELL = 0.06  # размер клетки

ANS_X0 = 0.06
ANS_Y0 = 0.36
ANS_NUM_W = 0.04  # ширина под номер задания
ANS_CELL = 0.05   # размер клетки ответа
ANS_COL_W = 0.22  # ширина колонки (отступ между колонками)
ANS_ROW_H = 0.055 # высота строки


def _to_grayscale(img_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось декодировать изображение")
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _find_anchors(gray: np.ndarray) -> list[tuple[int, int]] | None:
    """
    Ищет 4 чёрных квадрата-репера по углам бланка.
    Возвращает центры в порядке: TL, TR, BR, BL.
    """
    h, w = gray.shape
    # Адаптивная бинаризация
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Ищем все контуры
    cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    img_area = h * w
    for c in cnts:
        area = cv2.contourArea(c)
        # Репер должен быть 0.05% .. 1% площади листа
        if area < img_area * 0.0003 or area > img_area * 0.01:
            continue
        x, y, ww, hh = cv2.boundingRect(c)
        if ww == 0 or hh == 0:
            continue
        ratio = ww / hh
        if ratio < 0.7 or ratio > 1.4:
            continue
        # Степень заполнения (квадрат должен быть почти полностью чёрным)
        fill = area / (ww * hh)
        if fill < 0.7:
            continue
        cx, cy = x + ww // 2, y + hh // 2
        candidates.append((cx, cy, area))

    if len(candidates) < 4:
        return None

    # Берём 4 наиболее "угловых": сортируем по позиции
    # TL = min(x+y), BR = max(x+y), TR = min(-x+y) -> max(x-y), BL = min(x-y)
    pts = candidates
    tl = min(pts, key=lambda p: p[0] + p[1])
    br = max(pts, key=lambda p: p[0] + p[1])
    tr = max(pts, key=lambda p: p[0] - p[1])
    bl = min(pts, key=lambda p: p[0] - p[1])
    # проверка на разные точки
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


def _extract_cell(canvas: np.ndarray, fx: float, fy: float, fsize: float) -> np.ndarray:
    """Вырезает квадратную клетку по долям координат канваса."""
    x = int(fx * CANVAS_W)
    y = int(fy * CANVAS_H)
    s = int(fsize * CANVAS_W)
    cell = canvas[y:y + s, x:x + s]
    return cell


def _is_empty_cell(cell: np.ndarray) -> bool:
    """Если в клетке почти нет тёмных пикселей — она пустая."""
    if cell.size == 0:
        return True
    _, bw = cv2.threshold(cell, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # Удаляем рамку клетки: берём внутренние 70%
    h, w = bw.shape
    inset = int(min(h, w) * 0.15)
    inner = bw[inset:h - inset, inset:w - inset]
    if inner.size == 0:
        return True
    fill_ratio = np.count_nonzero(inner) / inner.size
    return fill_ratio < 0.05


def _normalize_char(cell: np.ndarray) -> np.ndarray | None:
    """Бинаризует клетку, удаляет рамку, центрирует символ, ресайз до TEMPLATE_SIZE."""
    if cell.size == 0:
        return None
    _, bw = cv2.threshold(cell, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    h, w = bw.shape
    # Удаляем рамку
    inset = int(min(h, w) * 0.15)
    inner = bw[inset:h - inset, inset:w - inset]
    if inner.size == 0 or np.count_nonzero(inner) < 5:
        return None
    # Bounding box символа
    ys, xs = np.where(inner > 0)
    if len(xs) == 0:
        return None
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    char_img = inner[y0:y1 + 1, x0:x1 + 1]
    ch_h, ch_w = char_img.shape
    if ch_h < 4 or ch_w < 4:
        return None
    # Помещаем в квадрат с паддингом
    side = max(ch_h, ch_w)
    square = np.zeros((side, side), dtype=np.uint8)
    sy = (side - ch_h) // 2
    sx = (side - ch_w) // 2
    square[sy:sy + ch_h, sx:sx + ch_w] = char_img
    # Ресайз
    out = cv2.resize(square, (TEMPLATE_SIZE, TEMPLATE_SIZE), interpolation=cv2.INTER_AREA)
    _, out = cv2.threshold(out, 64, 255, cv2.THRESH_BINARY)
    return out


def _classify(norm: np.ndarray, templates: dict[str, np.ndarray]) -> tuple[str, float]:
    """Сравнивает с шаблонами по нормированной корреляции."""
    best_ch = ""
    best_score = -1.0
    for ch, tpl in templates.items():
        # Метод matchTemplate с CCOEFF_NORMED
        res = cv2.matchTemplate(norm, tpl, cv2.TM_CCOEFF_NORMED)
        score = float(res[0, 0])
        if score > best_score:
            best_score = score
            best_ch = ch
    return best_ch, max(0.0, best_score)


def _recognize_code(canvas: np.ndarray) -> tuple[str, list[float]]:
    code = ""
    confs = []
    for i in range(CODE_CELLS):
        cell = _extract_cell(canvas, CODE_X0 + i * CODE_CELL, CODE_Y0, CODE_CELL)
        if _is_empty_cell(cell):
            code += "?"
            confs.append(0.0)
            continue
        norm = _normalize_char(cell)
        if norm is None:
            code += "?"
            confs.append(0.0)
            continue
        ch, score = _classify(norm, _TEMPLATES_DIGIT)
        code += ch
        confs.append(score)
    return code, confs


def _recognize_answers(canvas: np.ndarray, count: int) -> tuple[list[str], list[float]]:
    answers = []
    confs = []
    per_col = (count + ANS_COLS - 1) // ANS_COLS
    for q in range(count):
        col = q // per_col
        row = q % per_col
        fx = ANS_X0 + col * ANS_COL_W + ANS_NUM_W
        fy = ANS_Y0 + row * ANS_ROW_H
        cell = _extract_cell(canvas, fx, fy, ANS_CELL)
        if _is_empty_cell(cell):
            answers.append("")
            confs.append(0.0)
            continue
        norm = _normalize_char(cell)
        if norm is None:
            answers.append("")
            confs.append(0.0)
            continue
        ch, score = _classify(norm, _TEMPLATES_ALL)
        answers.append(ch)
        confs.append(score)
    return answers, confs


def _analyze(answers: list[str], answer_key: str) -> dict:
    if not answer_key:
        return {"total": len(answers), "correct": 0, "wrong": 0, "details": []}
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
    """Распознавание заполненного бланка ответов."""
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

    # Очищаем data:image/...;base64,
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

    anchors = _find_anchors(gray)
    if anchors is None:
        return _resp(422, {"error": "Не найдены 4 репера на бланке. Убедитесь, что весь бланк попал в кадр и хорошо освещён.", "hint": "anchors_not_found"})

    canvas = _warp_to_canvas(gray, anchors)
    _ensure_templates()

    code, code_confs = _recognize_code(canvas)
    answers, ans_confs = _recognize_answers(canvas, questions)
    analysis = _analyze(answers, answer_key)

    avg_conf = round(float(np.mean([c for c in (code_confs + ans_confs) if c > 0]) if any(c > 0 for c in (code_confs + ans_confs)) else 0), 3)

    return _resp(200, {
        "studentCode": code,
        "codeConfidence": [round(c, 3) for c in code_confs],
        "answers": answers,
        "answersConfidence": [round(c, 3) for c in ans_confs],
        "averageConfidence": avg_conf,
        "questionsCount": questions,
        "analysis": analysis,
    })
