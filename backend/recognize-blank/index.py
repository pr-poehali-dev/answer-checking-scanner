"""
Распознавание бланка ответов через OpenCV. v2 — вертикальный порядок столбцов.
Ответы: крестик ✕ в квадрате (ищем квадраты, оцениваем наполненность).
Код ученика: закрашенный кружок в сетке 5×10 (нижняя зона бланка).

POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
import json, base64, math
import numpy as np
import cv2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

RU_OPTS = ["\u0410", "\u0411", "\u0412", "\u0413", "\u0414", "\u0415"]


# ── Загрузка и нормализация ───────────────────────────────────────────────────
def _load(image_b64: str):
    img_bytes = base64.b64decode(image_b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось декодировать изображение")
    h, w = img.shape[:2]
    # Нормируем до 1800px по длинной стороне
    scale = 1800 / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
    gray = clahe.apply(gray)
    return img, gray


# ── Поиск прямоугольников (квадратов ответов) ────────────────────────────────
def _find_squares(gray):
    """Ищем все квадраты/прямоугольники на изображении."""
    h, w = gray.shape
    min_side = int(min(h, w) * 0.010)
    max_side = int(min(h, w) * 0.080)

    squares = []
    seen = set()

    for block_size, C in [(11, 3), (19, 5), (31, 7)]:
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        thresh = cv2.adaptiveThreshold(blurred, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block_size, C)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        for mode in (cv2.RETR_LIST, cv2.RETR_EXTERNAL):
            contours, _ = cv2.findContours(thresh, mode, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                x, y, cw, ch = cv2.boundingRect(cnt)
                side = (cw + ch) / 2
                if not (min_side < side < max_side):
                    continue
                ratio = cw / ch if ch > 0 else 0
                if not (0.45 < ratio < 2.2):
                    continue
                # Проверяем что контур прямоугольный (площадь / bbox ≥ 0.5)
                area = cv2.contourArea(cnt)
                bbox_area = cw * ch
                if bbox_area == 0 or area / bbox_area < 0.4:
                    continue
                cx = x + cw // 2
                cy = y + ch // 2
                key = (cx // 5, cy // 5)
                if key in seen:
                    continue
                seen.add(key)
                squares.append((cx, cy, int(cw), int(ch)))

    return squares


# ── Оценка "крестика" в квадрате ─────────────────────────────────────────────
def _fill_ratio(gray, cx, cy, cw, ch) -> float:
    """
    Оценивает наличие крестика ✕ в квадрате.
    Крестик занимает углы квадрата, буква — только центр.
    Возвращает score: высокий = крестик, низкий = просто буква или пусто.
    """
    pad = max(1, int(min(cw, ch) * 0.08))
    x1 = max(0, cx - cw//2 + pad)
    y1 = max(0, cy - ch//2 + pad)
    x2 = min(gray.shape[1], cx + cw//2 - pad)
    y2 = min(gray.shape[0], cy + ch//2 - pad)
    if x2 <= x1 or y2 <= y1:
        return 0.0

    roi = gray[y1:y2, x1:x2]
    h, w = roi.shape
    if h < 4 or w < 4:
        return 0.0

    _, bw = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Угловые зоны (каждая ~25% стороны) — там где крестик
    corner = max(2, int(min(h, w) * 0.30))
    corners = [
        bw[:corner, :corner],
        bw[:corner, w-corner:],
        bw[h-corner:, :corner],
        bw[h-corner:, w-corner:],
    ]
    corner_fill = np.mean([np.mean(c > 0) for c in corners])

    # Центральная зона — там где буква
    mc = max(1, int(min(h, w) * 0.25))
    cy_r, cx_r = h//2, w//2
    center = bw[cy_r-mc:cy_r+mc, cx_r-mc:cx_r+mc]
    center_fill = float(np.mean(center > 0)) if center.size > 0 else 0.0

    # Общая заполненность
    total_fill = float(np.mean(bw > 0))

    # Крестик = высокий угловой fill + общий fill заметно выше центрального
    # Буква = центральный fill высокий, угловой — низкий
    cross_score = corner_fill * 0.6 + total_fill * 0.4 - center_fill * 0.2
    return float(np.clip(cross_score, 0, 1))


# ── Кластеризация по строкам ──────────────────────────────────────────────────
def _cluster_rows(items, tol_ratio=1.2):
    """Группируем элементы (cx,cy,...) по Y с допуском tol_ratio * медиана_высоты."""
    if not items:
        return []
    sorted_i = sorted(items, key=lambda i: i[1])
    # Медианный «размер» элемента
    sizes = [i[3] if len(i) > 3 else i[2] for i in items]
    tol = float(np.median(sizes)) * tol_ratio

    rows = []
    for item in sorted_i:
        cy = item[1]
        placed = False
        for row in rows:
            row_y = np.mean([it[1] for it in row])
            if abs(cy - row_y) <= tol:
                row.append(item)
                placed = True
                break
        if not placed:
            rows.append([item])

    rows = [sorted(r, key=lambda i: i[0]) for r in rows]
    rows.sort(key=lambda r: np.mean([i[1] for i in r]))
    return rows


# ── Поиск кружков (для кода ученика) ─────────────────────────────────────────
def _find_circles_in_zone(gray, y_start, y_end):
    """HoughCircles только в нижней зоне бланка."""
    zone = gray[y_start:y_end, :]
    blurred = cv2.GaussianBlur(zone, (5,5), 1)
    h_z, w_z = zone.shape
    min_r = max(5, int(min(h_z, w_z) * 0.012))
    max_r = max(20, int(min(h_z, w_z) * 0.055))

    circles = cv2.HoughCircles(blurred, cv2.HOUGH_GRADIENT, dp=1.2,
                               minDist=int(min_r*1.4), param1=55, param2=18,
                               minRadius=min_r, maxRadius=max_r)
    if circles is None:
        return []
    result = []
    for x, y, r in circles[0]:
        result.append((int(x), int(y) + y_start, int(r)))   # глобальные координаты
    return result


def _circle_brightness(gray, cx, cy, r) -> float:
    h, w = gray.shape
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), max(1, int(r*0.62)), 255, -1)
    pixels = gray[mask == 255]
    return float(np.mean(pixels)) if len(pixels) > 0 else 255.0


# ── Главная функция распознавания ─────────────────────────────────────────────
def _recognize(image_b64: str, questions_count: int, options_count: int) -> dict:
    img, gray = _load(image_b64)
    h, w = gray.shape
    opts = RU_OPTS[:options_count]

    # ── 1. Квадраты ответов (верхние 75% бланка) ─────────────────────────────
    answer_zone_h = int(h * 0.75)
    gray_answers  = gray[:answer_zone_h, :]

    squares = _find_squares(gray_answers)

    # Кластеризуем по строкам (каждая строка = один вопрос × options_count квадратов)
    sq_rows = _cluster_rows(squares, tol_ratio=1.0)

    # ── DEBUG: сколько квадратов в каждой строке ──────────────────────────────
    dbg_rows_dist = [len(r) for r in sq_rows]

    # Разбиваем длинные строки на группы по options_count квадратов
    # (бланк двухколоночный: в одной горизонтальной строке может быть 8 или 16 квадратов)
    def _split_row_by_x(row, n):
        """Разбивает строку квадратов на группы по n штук, кластеризуя по X."""
        if len(row) <= n:
            return [row]
        xs = [sq[0] for sq in row]
        gaps = sorted(range(1, len(xs)), key=lambda i: xs[i] - xs[i-1], reverse=True)
        # Находим k-1 наибольших разрывов где k = кол-во ожидаемых групп
        expected_groups = round(len(row) / n)
        split_points = sorted(gaps[:expected_groups - 1])
        groups, prev = [], 0
        for sp in split_points:
            groups.append(row[prev:sp])
            prev = sp
        groups.append(row[prev:])
        return [g for g in groups if len(g) >= 2]

    valid_rows = []
    for row in sq_rows:
        n = len(row)
        if n == options_count:
            valid_rows.append(row)
        elif abs(n - options_count) == 1 and n >= 2:
            valid_rows.append(row[:options_count])
        elif n > options_count and n % options_count == 0:
            valid_rows.extend(_split_row_by_x(row, options_count))
        elif n > options_count:
            sub = _split_row_by_x(row, options_count)
            for s in sub:
                if abs(len(s) - options_count) <= 1:
                    valid_rows.append(s[:options_count])

    # ── Перегруппировка: горизонтальные строки → вертикальные столбцы ────────
    # Бланк вертикальный: вопросы 1-10 в левом столбце, 11-20 в правом.
    # После кластеризации по Y строки упорядочены: [q1,q11], [q2,q12]...
    # Нужно разбить по X-позиции первого квадрата на группы столбцов,
    # внутри каждой группы отсортировать по Y → получим правильный порядок.

    if valid_rows:
        # Определяем число столбцов бланка по X-позициям первых квадратов
        first_xs = [row[0][0] for row in valid_rows]
        x_arr = sorted(set(first_xs))

        # Кластеризуем X-позиции в группы (столбцы бланка)
        # Медианный шаг между кластерами
        if len(x_arr) > 1:
            img_w = w
            # Простая кластеризация: разрыв > 10% ширины = новый столбец
            x_gap_threshold = img_w * 0.10
            col_groups = [[x_arr[0]]]
            for x in x_arr[1:]:
                if x - col_groups[-1][-1] > x_gap_threshold:
                    col_groups.append([x])
                else:
                    col_groups[-1].append(x)
            n_blank_cols = len(col_groups)
            col_centers  = [np.mean(g) for g in col_groups]

            # Назначаем каждую строку в столбец бланка
            col_buckets = [[] for _ in range(n_blank_cols)]
            for row in valid_rows:
                rx0 = row[0][0]
                ci  = int(np.argmin([abs(rx0 - cc) for cc in col_centers]))
                col_buckets[ci].append(row)

            # Внутри каждого столбца сортируем по Y
            for bucket in col_buckets:
                bucket.sort(key=lambda r: r[0][1])

            # Собираем в правильном вертикальном порядке
            answer_rows = []
            for bucket in col_buckets:
                answer_rows.extend(bucket)
        else:
            answer_rows = valid_rows

        answer_rows = answer_rows[:questions_count]
    else:
        answer_rows = []

    answers     = []
    confidences = []
    dbg_fills   = []

    for row_i, row in enumerate(answer_rows):
        fills = [_fill_ratio(gray, cx, cy, cw, ch) for cx, cy, cw, ch in row]
        max_f = max(fills)
        sorted_f = sorted(fills, reverse=True)
        gap = sorted_f[0] - (sorted_f[1] if len(sorted_f) > 1 else 0)
        idx = int(np.argmax(fills))
        chosen = opts[idx] if idx < len(opts) else "?"

        if row_i < 3:
            dbg_fills.append({"row": row_i, "fills": [round(f,4) for f in fills],
                               "max": round(max_f,4), "gap": round(gap,4), "chosen": chosen})

        # Относительный метод: выбираем максимальный если он выделяется среди остальных
        mean_others = (sum(fills) - max_f) / (len(fills) - 1) if len(fills) > 1 else 0
        relative_gap = max_f - mean_others  # насколько выделяется относительно среднего остальных

        if max_f > 0.15 and relative_gap > 0.05:
            answers.append(opts[idx] if idx < len(opts) else "")
            conf = min(0.99, relative_gap / 0.3 + 0.4)
            confidences.append(round(conf, 2))
        else:
            answers.append("")
            confidences.append(0.0)

    # Дополняем до questions_count
    while len(answers) < questions_count:
        answers.append("")
        confidences.append(0.0)

    # ── 2. Код ученика (нижние ~35% бланка, кружки) ──────────────────────────
    code_zone_start = int(h * 0.65)
    circles = _find_circles_in_zone(gray, code_zone_start, h)

    # Если кружков мало — ещё раз с меньшим порогом
    if len(circles) < 10:
        zone = gray[code_zone_start:, :]
        blurred2 = cv2.GaussianBlur(zone, (3,3), 0)
        h_z, w_z = zone.shape
        min_r2 = max(4, int(min(h_z, w_z) * 0.008))
        max_r2 = max(25, int(min(h_z, w_z) * 0.06))
        c2 = cv2.HoughCircles(blurred2, cv2.HOUGH_GRADIENT, dp=1.0,
                               minDist=int(min_r2*1.2), param1=40, param2=14,
                               minRadius=min_r2, maxRadius=max_r2)
        if c2 is not None:
            circles = [(int(x), int(y)+code_zone_start, int(r)) for x,y,r in c2[0]]

    # Кластеризуем по строкам, сортируем по Y
    cr_rows_all = _cluster_rows([(cx, cy, r, r*2) for cx, cy, r in circles], tol_ratio=1.2)
    cr_rows_all.sort(key=lambda row: np.mean([it[1] for it in row]))
    # Берём строки с ~10 кружками (код) — может быть 7-13
    code_rows = [row for row in cr_rows_all if 7 <= len(row) <= 13]
    code_rows = code_rows[:5]

    code       = ""
    code_confs = []

    for row in code_rows:
        # Берём первые 10 кружков отсортированных по X
        row10 = sorted(row, key=lambda i: i[0])[:10]
        bright = [_circle_brightness(gray, cx, cy, r) for cx, cy, r, _ in row10]
        if not bright:
            code += "?"
            code_confs.append(0.0)
            continue
        idx = int(np.argmin(bright))
        min_b  = bright[idx]
        max_b  = max(bright)
        spread = max_b - min_b
        if spread > 18:   # есть явно закрашенный
            code += str(idx)
            code_confs.append(round(min(0.99, spread / 80), 2))
        else:
            code += "?"
            code_confs.append(0.0)

    code       = (code + "?????")[:5]
    code_confs = (code_confs + [0.0]*5)[:5]

    return {
        "answers":          answers[:questions_count],
        "confidences":      confidences[:questions_count],
        "code":             code,
        "code_confs":       code_confs,
        "squares_found":    len(squares),
        "answer_rows":      len(answer_rows),
        "code_rows":        len(code_rows),
        "dbg_fills":        dbg_fills,
        "dbg_rows_dist":    dbg_rows_dist,
    }


# ── Анализ ────────────────────────────────────────────────────────────────────
# v20: cross detection via corner fill
_LAT_TO_CYR = {"A":"\u0410","B":"\u0411","C":"\u0412","D":"\u0413","E":"\u0414","F":"\u0415"}

def _normalize_key(answer_key: str) -> list:
    """Нормализует ключ: латинские A/B/C/D → кириллические А/Б/В/Г."""
    result = []
    for ch in answer_key.strip().upper():
        result.append(_LAT_TO_CYR.get(ch, ch))
    return result

def _analyze(answers: list, answer_key: str) -> dict:
    dbg_answers = [{"i": i, "val": repr(a), "hex": a.encode("utf-8").hex()} for i, a in enumerate(answers[:5])]
    if not answer_key:
        return {"total": len(answers), "correct": 0, "wrong": 0, "percent": 0, "details": [],
                "_dbg": {"reason": "no_key", "answers": dbg_answers}}
    key = _normalize_key(answer_key)
    details, correct = [], 0
    dbg = []
    for i, a in enumerate(answers):
        ka = key[i] if i < len(key) else ""
        ok = a.upper() == ka and ka != ""
        if ok: correct += 1
        details.append({"q": i+1, "student": a, "key": ka, "correct": ok})
        if i < 3:
            dbg.append({"q": i+1,
                        "a_repr": repr(a), "a_hex": a.encode("utf-8").hex(),
                        "a_up": repr(a.upper()), "a_up_hex": a.upper().encode("utf-8").hex(),
                        "ka_repr": repr(ka), "ka_hex": ka.encode("utf-8").hex(),
                        "eq": a.upper() == ka})
    total = len(answers)
    return {
        "total": total, "correct": correct, "wrong": total - correct,
        "percent": round(correct / total * 100, 1) if total else 0,
        "details": details,
        "_dbg": {"cmp": dbg, "key_raw": repr(answer_key), "key_hex": answer_key.encode("utf-8").hex()[:20],
                 "answers_raw": dbg_answers},
    }


def _resp(status: int, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    Распознавание бланка: крестики в квадратах (ответы) + закрашенные кружки (код).
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

    # Режим reanalyze: только пересчёт по готовым ответам без изображения
    if body.get("answers") and not body.get("image"):
        raw_answers = body["answers"]
        answer_key  = str(body.get("answerKey", ""))
        if not isinstance(raw_answers, list):
            return _resp(400, {"error": "answers должен быть массивом"})
        analysis = _analyze(raw_answers, answer_key)
        return _resp(200, {
            "studentCode":       body.get("studentCode", ""),
            "codeConfidence":    [],
            "answers":           raw_answers,
            "answersConfidence": [],
            "averageConfidence": 0,
            "questionsCount":    len(raw_answers),
            "analysis":          analysis,
        })

    image_b64 = body.get("image", "")
    if not image_b64:
        return _resp(400, {"error": "Не передано изображение (поле image)"})
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        raw = base64.b64decode(image_b64)
    except Exception:
        return _resp(400, {"error": "Некорректный base64"})

    arr   = np.frombuffer(raw, dtype=np.uint8)
    check = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if check is None:
        return _resp(400, {"error": "Не удалось прочитать изображение"})
    if check.shape[0] < 100 or check.shape[1] < 100:
        return _resp(422, {"error": "Изображение слишком маленькое. Сфотографируйте бланк целиком.", "hint": "image_too_small"})

    questions  = max(1, min(int(body.get("questionsCount", 20)), 80))
    options    = max(2, min(int(body.get("optionsCount",   4)),  6))
    answer_key = str(body.get("answerKey", ""))

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
            "squaresFound":   result["squares_found"],
            "answerRows":     result["answer_rows"],
            "answers5":       answers[:5],
            "fills3":         result.get("dbg_fills", []),
            "rowsDist":       result.get("dbg_rows_dist", []),
        }
    })