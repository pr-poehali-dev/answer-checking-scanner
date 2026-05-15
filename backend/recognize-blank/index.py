"""
Распознавание бланка ответов через OpenCV.
Ответы: крестик ✕ в квадрате. Код ученика: закрашенный кружок.

POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
# v23: grid-based detection
import json, base64
import numpy as np
import cv2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]


# ── Загрузка и нормализация ───────────────────────────────────────────────────
def _load(image_b64: str):
    img_bytes = base64.b64decode(image_b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось декодировать изображение")
    h, w = img.shape[:2]
    scale = 1800 / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    return img, gray


# ── Поиск всех прямоугольных контуров ────────────────────────────────────────
def _find_all_rects(gray, min_side, max_side):
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    rects = []
    seen = set()
    for block_size, C in [(15, 4), (21, 6), (11, 3)]:
        thresh = cv2.adaptiveThreshold(blurred, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block_size, C)
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k)
        contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            side = (cw + ch) / 2
            if not (min_side < side < max_side):
                continue
            ratio = cw / ch if ch > 0 else 0
            if not (0.45 < ratio < 2.2):
                continue
            area = cv2.contourArea(cnt)
            if area < min_side * min_side * 0.25:
                continue
            cx = x + cw // 2
            cy = y + ch // 2
            key = (cx // 6, cy // 6)
            if key in seen:
                continue
            seen.add(key)
            rects.append((cx, cy, int(cw), int(ch)))
    return rects


# ── Восстановление регулярной сетки по 1D-проекции ───────────────────────────
def _find_grid_centers(coords, expected_count, img_size):
    """
    По списку координат (x или y) находит expected_count регулярных позиций.
    Использует гистограмму + поиск пиков.
    """
    if not coords:
        return []
    coords = np.array(sorted(coords))
    # Гистограмма с размером бина ~2% от размера изображения
    bin_size = max(3, img_size // 80)
    bins = int(img_size / bin_size) + 1
    hist = np.zeros(bins, dtype=np.int32)
    for c in coords:
        b = int(c / bin_size)
        if 0 <= b < bins:
            hist[b] += 1

    # Сглаживаем
    hist = np.convolve(hist, [1, 2, 3, 2, 1], mode='same').astype(np.float32)

    # Находим пики
    peaks = []
    for i in range(1, len(hist) - 1):
        if hist[i] > hist[i - 1] and hist[i] >= hist[i + 1] and hist[i] > 0:
            peaks.append(i * bin_size + bin_size // 2)

    if not peaks:
        return []

    # Если пиков больше чем нужно — оставляем самые сильные
    if len(peaks) > expected_count * 2:
        peak_vals = [(hist[int(p / bin_size)], p) for p in peaks]
        peak_vals.sort(reverse=True)
        peaks = sorted([p for _, p in peak_vals[:expected_count * 2]])

    return peaks


# ── Кластеризация пиков в регулярные позиции ─────────────────────────────────
def _cluster_peaks(peaks, expected_n, img_size):
    """Из списка пиков выбираем expected_n наиболее регулярных."""
    if len(peaks) <= expected_n:
        return peaks
    # Берём наиболее равномерно распределённые
    # Простой жадный алгоритм: берём первый, потом ближайший к ожидаемому шагу
    best = None
    best_score = 1e9
    n = len(peaks)
    for start in range(n):
        subset = [peaks[start]]
        remaining = list(peaks[start + 1:])
        while len(subset) < expected_n and remaining:
            if len(subset) >= 2:
                step = (subset[-1] - subset[0]) / (len(subset) - 1)
                expected_next = subset[-1] + step
            else:
                expected_next = subset[-1] + img_size / expected_n
            closest = min(remaining, key=lambda p: abs(p - expected_next))
            subset.append(closest)
            remaining.remove(closest)
        if len(subset) == expected_n:
            diffs = [subset[i+1] - subset[i] for i in range(len(subset)-1)]
            score = np.std(diffs)
            if score < best_score:
                best_score = score
                best = subset[:]
    return sorted(best) if best else sorted(peaks[:expected_n])


# ── Оценка крестика в квадрате ────────────────────────────────────────────────
def _cross_score(gray, cx, cy, cell_w, cell_h) -> float:
    """
    Крестик ✕ занимает диагонали квадрата — детектируем через угловые зоны.
    Буква занимает только центр.
    """
    pad = max(2, int(min(cell_w, cell_h) * 0.10))
    x1 = max(0, cx - cell_w // 2 + pad)
    y1 = max(0, cy - cell_h // 2 + pad)
    x2 = min(gray.shape[1], cx + cell_w // 2 - pad)
    y2 = min(gray.shape[0], cy + cell_h // 2 - pad)
    if x2 <= x1 or y2 <= y1:
        return 0.0

    roi = gray[y1:y2, x1:x2]
    rh, rw = roi.shape
    if rh < 4 or rw < 4:
        return 0.0

    _, bw = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    c = max(2, int(min(rh, rw) * 0.28))
    corners = [bw[:c, :c], bw[:c, rw-c:], bw[rh-c:, :c], bw[rh-c:, rw-c:]]
    corner_fill = float(np.mean([np.mean(z > 0) for z in corners]))

    mc = max(1, int(min(rh, rw) * 0.22))
    cy_r, cx_r = rh // 2, rw // 2
    center = bw[max(0,cy_r-mc):cy_r+mc, max(0,cx_r-mc):cx_r+mc]
    center_fill = float(np.mean(center > 0)) if center.size > 0 else 0.0

    total_fill = float(np.mean(bw > 0))

    score = corner_fill * 0.55 + total_fill * 0.35 - center_fill * 0.15
    return float(np.clip(score, 0, 1))


# ── Кластеризация по строкам (для кружков кода) ───────────────────────────────
def _cluster_rows(items, tol_ratio=1.2):
    if not items:
        return []
    sorted_i = sorted(items, key=lambda i: i[1])
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


# ── Поиск кружков (код ученика) ───────────────────────────────────────────────
def _find_circles_in_zone(gray, y_start, y_end):
    zone = gray[y_start:y_end, :]
    blurred = cv2.GaussianBlur(zone, (5, 5), 1)
    h_z, w_z = zone.shape
    min_r = max(5, int(min(h_z, w_z) * 0.012))
    max_r = max(20, int(min(h_z, w_z) * 0.055))
    circles = cv2.HoughCircles(blurred, cv2.HOUGH_GRADIENT, dp=1.2,
                               minDist=int(min_r * 1.4), param1=55, param2=18,
                               minRadius=min_r, maxRadius=max_r)
    if circles is None:
        return []
    return [(int(x), int(y) + y_start, int(r)) for x, y, r in circles[0]]


def _circle_brightness(gray, cx, cy, r) -> float:
    h, w = gray.shape
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), max(1, int(r * 0.62)), 255, -1)
    pixels = gray[mask == 255]
    return float(np.mean(pixels)) if len(pixels) > 0 else 255.0


# ── Главная функция распознавания ─────────────────────────────────────────────
def _recognize(image_b64: str, questions_count: int, options_count: int) -> dict:
    img, gray = _load(image_b64)
    h, w = gray.shape
    opts = RU_OPTS[:options_count]

    # ── 1. Зона ответов (верхние 75%) ────────────────────────────────────────
    answer_zone_h = int(h * 0.75)
    gray_ans = gray[:answer_zone_h, :]
    zh, zw = gray_ans.shape

    # Оценочный размер квадрата: ~2-6% от короткой стороны
    min_side = int(min(zh, zw) * 0.015)
    max_side = int(min(zh, zw) * 0.090)

    # Находим все прямоугольные объекты нужного размера
    rects = _find_all_rects(gray_ans, min_side, max_side)

    # ── 2. Строим сетку по проекциям X и Y ───────────────────────────────────
    # Бланк: 2 колонки × 10 строк × options_count вариантов
    n_rows = questions_count  # всего вопросов (строк в сетке)
    n_cols = options_count    # вариантов в строке (А,Б,В,Г)

    # Бланк двухколоночный: левые 10 вопросов + правые 10 вопросов
    # По X ожидаем: options_count * 2 колонки квадратов (+ разрыв между половинами)
    # По Y ожидаем: questions_count / 2 строк (10 строк если 20 вопросов)
    rows_per_col = questions_count // 2  # 10 строк в каждой колонке бланка

    xs = [r[0] for r in rects]
    ys = [r[1] for r in rects]
    cell_w = int(np.median([r[2] for r in rects])) if rects else max_side // 2
    cell_h = int(np.median([r[3] for r in rects])) if rects else max_side // 2

    # Пики по Y = строки бланка
    y_peaks = _find_grid_centers(ys, rows_per_col, zh)
    # Пики по X = колонки вариантов (4 варианта × 2 секции = 8 позиций)
    x_peaks = _find_grid_centers(xs, n_cols * 2, zw)

    dbg_rows_dist = [len(y_peaks), len(x_peaks), len(rects)]

    answer_rows = []  # список строк, каждая = список (cx,cy,cw,ch) для вариантов

    if y_peaks and x_peaks:
        # Разбиваем X-пики на 2 секции (левая и правая колонка бланка)
        # Находим самый большой разрыв между X-пиками
        x_sorted = sorted(x_peaks)
        if len(x_sorted) >= 2:
            gaps = [(x_sorted[i+1] - x_sorted[i], i) for i in range(len(x_sorted)-1)]
            max_gap_idx = max(gaps, key=lambda g: g[0])[1]
            left_xs  = x_sorted[:max_gap_idx + 1]
            right_xs = x_sorted[max_gap_idx + 1:]
        else:
            left_xs  = x_sorted
            right_xs = []

        # Берём по n_cols позиций из каждой секции
        left_xs  = sorted(left_xs)[-n_cols:]   # последние n_cols (ближайшие к центру)
        right_xs = sorted(right_xs)[:n_cols]   # первые n_cols

        # Формируем строки: сначала левая колонка (вопросы 1-10), потом правая (11-20)
        for section_xs in [left_xs, right_xs]:
            if not section_xs:
                continue
            for yc in y_peaks[:rows_per_col]:
                row = []
                for xc in sorted(section_xs):
                    row.append((int(xc), int(yc), cell_w, cell_h))
                if len(row) >= 2:
                    answer_rows.append(row)

    # Fallback: если сетка не построилась — используем исходные rects
    if not answer_rows and rects:
        from collections import Counter
        sq_rows_raw = _cluster_rows(rects, tol_ratio=0.8)
        cnt = Counter(len(r) for r in sq_rows_raw)
        mode_n = cnt.most_common(1)[0][0] if cnt else n_cols
        for row in sq_rows_raw:
            n = len(row)
            if n == n_cols:
                answer_rows.append(row)
            elif abs(n - n_cols) == 1 and n >= 2:
                answer_rows.append(row[:n_cols])

    answer_rows = answer_rows[:questions_count]

    # ── 3. Оцениваем заполненность каждого варианта ───────────────────────────
    answers     = []
    confidences = []
    dbg_fills   = []

    for row_i, row in enumerate(answer_rows):
        fills = [_cross_score(gray, cx, cy, cw, ch) for cx, cy, cw, ch in row]
        if not fills:
            answers.append("")
            confidences.append(0.0)
            continue

        idx   = int(np.argmax(fills))
        max_f = fills[idx]
        sorted_f = sorted(fills, reverse=True)
        gap = sorted_f[0] - (sorted_f[1] if len(sorted_f) > 1 else 0)
        mean_others = (sum(fills) - max_f) / (len(fills) - 1) if len(fills) > 1 else 0
        relative_gap = max_f - mean_others

        chosen = opts[idx] if idx < len(opts) else "?"
        if row_i < 5:
            dbg_fills.append({"row": row_i, "fills": [round(f, 4) for f in fills],
                               "max": round(max_f, 4), "gap": round(gap, 4),
                               "rel_gap": round(relative_gap, 4), "chosen": chosen})

        if max_f > 0.10 and relative_gap > 0.04:
            answers.append(opts[idx] if idx < len(opts) else "")
            confidences.append(round(min(0.99, relative_gap / 0.25 + 0.35), 2))
        else:
            answers.append("")
            confidences.append(0.0)

    while len(answers) < questions_count:
        answers.append("")
        confidences.append(0.0)

    # ── 4. Код ученика (нижние ~35%) ─────────────────────────────────────────
    code_zone_start = int(h * 0.65)
    circles = _find_circles_in_zone(gray, code_zone_start, h)

    if len(circles) < 10:
        zone = gray[code_zone_start:, :]
        blurred2 = cv2.GaussianBlur(zone, (3, 3), 0)
        h_z, w_z = zone.shape
        min_r2 = max(4, int(min(h_z, w_z) * 0.008))
        max_r2 = max(25, int(min(h_z, w_z) * 0.06))
        c2 = cv2.HoughCircles(blurred2, cv2.HOUGH_GRADIENT, dp=1.0,
                               minDist=int(min_r2 * 1.2), param1=40, param2=14,
                               minRadius=min_r2, maxRadius=max_r2)
        if c2 is not None:
            circles = [(int(x), int(y) + code_zone_start, int(r)) for x, y, r in c2[0]]

    cr_rows_all = _cluster_rows([(cx, cy, r, r * 2) for cx, cy, r in circles], tol_ratio=1.2)
    cr_rows_all.sort(key=lambda row: np.mean([it[1] for it in row]))
    code_rows = [row for row in cr_rows_all if 7 <= len(row) <= 13][:5]

    code = ""
    code_confs = []
    for row in code_rows:
        row10 = sorted(row, key=lambda i: i[0])[:10]
        bright = [_circle_brightness(gray, cx, cy, r) for cx, cy, r, _ in row10]
        if not bright:
            code += "?"
            code_confs.append(0.0)
            continue
        idx = int(np.argmin(bright))
        spread = max(bright) - bright[idx]
        if spread > 18:
            code += str(idx)
            code_confs.append(round(min(0.99, spread / 80), 2))
        else:
            code += "?"
            code_confs.append(0.0)

    code = (code + "?????")[:5]
    code_confs = (code_confs + [0.0] * 5)[:5]

    return {
        "answers":       answers[:questions_count],
        "confidences":   confidences[:questions_count],
        "code":          code,
        "code_confs":    code_confs,
        "squares_found": len(rects),
        "answer_rows":   len(answer_rows),
        "code_rows":     len(code_rows),
        "dbg_fills":     dbg_fills,
        "dbg_rows_dist": dbg_rows_dist,
    }


# ── Анализ ────────────────────────────────────────────────────────────────────
_LAT_TO_CYR = {"A": "А", "B": "Б", "C": "В", "D": "Г", "E": "Д", "F": "Е"}


def _normalize_key(answer_key: str) -> list:
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
        if ok:
            correct += 1
        details.append({"q": i + 1, "student": a, "key": ka, "correct": ok})
        if i < 3:
            dbg.append({"q": i + 1,
                        "a_repr": repr(a), "a_hex": a.encode("utf-8").hex(),
                        "a_up": repr(a.upper()), "a_up_hex": a.upper().encode("utf-8").hex(),
                        "ka_repr": repr(ka), "ka_hex": ka.encode("utf-8").hex(),
                        "eq": a.upper() == ka})
    total = len(answers)
    return {
        "total": total, "correct": correct, "wrong": total - correct,
        "percent": round(correct / total * 100, 1) if total else 0,
        "details": details,
        "_dbg": {"cmp": dbg, "key_raw": repr(answer_key),
                 "key_hex": answer_key.encode("utf-8").hex()[:20],
                 "answers_raw": dbg_answers},
    }


# ── HTTP handler ──────────────────────────────────────────────────────────────
def _resp(status, body):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


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

    # Режим reanalyze
    if body.get("answers") and not body.get("image"):
        raw_answers = body["answers"]
        answer_key  = str(body.get("answerKey", ""))
        if not isinstance(raw_answers, list):
            return _resp(400, {"error": "answers должен быть массивом"})
        analysis = _analyze(raw_answers, answer_key)
        return _resp(200, {
            "studentCode": "", "codeConfidence": [],
            "answers": raw_answers, "answersConfidence": [],
            "averageConfidence": 0, "questionsCount": len(raw_answers),
            "analysis": analysis,
        })

    image_b64 = body.get("image", "")
    if not image_b64:
        return _resp(400, {"error": "Поле image обязательно"})

    try:
        raw = base64.b64decode(image_b64)
    except Exception:
        return _resp(400, {"error": "Некорректный base64"})

    arr   = np.frombuffer(raw, dtype=np.uint8)
    check = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if check is None:
        return _resp(400, {"error": "Не удалось прочитать изображение"})
    if check.shape[0] < 100 or check.shape[1] < 100:
        return _resp(422, {"error": "Изображение слишком маленькое.", "hint": "image_too_small"})

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
            "squaresFound": result["squares_found"],
            "answerRows":   result["answer_rows"],
            "answers5":     answers[:5],
            "fills3":       result.get("dbg_fills", []),
            "rowsDist":     result.get("dbg_rows_dist", []),
        }
    })
