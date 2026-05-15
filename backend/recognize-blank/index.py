"""
Распознавание бланка ответов через OpenCV.
Алгоритм: находим 4 жирных якорных квадрата → вычисляем точную сетку ответов → распознаём крестики.

POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
# v24: anchor-based grid detection
import json, base64
import numpy as np
import cv2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]


# ── Загрузка ──────────────────────────────────────────────────────────────────
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


# ── Поиск якорных квадратов ───────────────────────────────────────────────────
def _find_anchors(gray):
    """Якоря — полностью залитые чёрные квадраты ~4-6мм."""
    h, w = gray.shape
    min_s = int(min(h, w) * 0.012)
    max_s = int(min(h, w) * 0.060)

    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, k, iterations=2)

    contours, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        side = (cw + ch) / 2
        if not (min_s < side < max_s):
            continue
        ratio = cw / ch if ch > 0 else 0
        if not (0.5 < ratio < 2.0):
            continue
        area = cv2.contourArea(cnt)
        fill = area / (cw * ch) if cw * ch > 0 else 0
        if fill < 0.65:
            continue
        roi = gray[y:y+ch, x:x+cw]
        if float(np.mean(roi)) > 100:
            continue
        cx = x + cw // 2
        cy = y + ch // 2
        candidates.append((cx, cy, cw, ch, side))

    return candidates


# ── Выбираем 4 угловых якоря ──────────────────────────────────────────────────
def _select_corner_anchors(candidates, img_w, img_h):
    if len(candidates) < 4:
        return None
    corners_target = [(0, 0), (img_w, 0), (0, img_h), (img_w, img_h)]
    selected = []
    used = set()
    for tx, ty in corners_target:
        best = min(
            [(i, c) for i, c in enumerate(candidates) if i not in used],
            key=lambda ic: (ic[1][0] - tx)**2 + (ic[1][1] - ty)**2,
            default=None
        )
        if best:
            used.add(best[0])
            selected.append(best[1])
    if len(selected) == 4:
        selected.sort(key=lambda p: (p[1], p[0]))
        top = sorted(selected[:2], key=lambda p: p[0])
        bot = sorted(selected[2:], key=lambda p: p[0])
        return top[0], top[1], bot[0], bot[1]
    return None


# ── Оценка крестика в ячейке ──────────────────────────────────────────────────
def _cross_score(gray, cx, cy, cell_w, cell_h) -> float:
    pad = max(2, int(min(cell_w, cell_h) * 0.10))
    x1 = max(0, int(cx - cell_w / 2 + pad))
    y1 = max(0, int(cy - cell_h / 2 + pad))
    x2 = min(gray.shape[1], int(cx + cell_w / 2 - pad))
    y2 = min(gray.shape[0], int(cy + cell_h / 2 - pad))
    if x2 <= x1 or y2 <= y1:
        return 0.0
    roi = gray[y1:y2, x1:x2]
    rh, rw = roi.shape
    if rh < 3 or rw < 3:
        return 0.0
    _, bw = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    c_size = max(2, int(min(rh, rw) * 0.28))
    corners = [bw[:c_size, :c_size], bw[:c_size, rw-c_size:],
               bw[rh-c_size:, :c_size], bw[rh-c_size:, rw-c_size:]]
    corner_fill = float(np.mean([np.mean(z > 0) for z in corners]))
    mc = max(1, int(min(rh, rw) * 0.22))
    cy_r, cx_r = rh // 2, rw // 2
    center = bw[max(0, cy_r-mc):cy_r+mc, max(0, cx_r-mc):cx_r+mc]
    center_fill = float(np.mean(center > 0)) if center.size > 0 else 0.0
    total_fill = float(np.mean(bw > 0))
    score = corner_fill * 0.55 + total_fill * 0.35 - center_fill * 0.15
    return float(np.clip(score, 0, 1))


# ── Кластеризация по строкам ──────────────────────────────────────────────────
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


# ── Поиск кружков ─────────────────────────────────────────────────────────────
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


# ── Fallback без якорей ───────────────────────────────────────────────────────
def _fallback_detect(gray, questions_count, options_count):
    h, w = gray.shape
    min_s = int(min(h, w) * 0.015)
    max_s = int(min(h, w) * 0.090)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    rects = []
    seen = set()
    for block_size, C in [(15, 4), (21, 6)]:
        thresh = cv2.adaptiveThreshold(blurred, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block_size, C)
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k)
        contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            side = (cw + ch) / 2
            if not (min_s < side < max_s):
                continue
            ratio = cw / ch if ch > 0 else 0
            if not (0.45 < ratio < 2.2):
                continue
            area = cv2.contourArea(cnt)
            if area < min_s * min_s * 0.25:
                continue
            cx = x + cw // 2
            cy = y + ch // 2
            key = (cx // 6, cy // 6)
            if key in seen:
                continue
            seen.add(key)
            rects.append((cx, cy, int(cw), int(ch)))
    if not rects:
        return []
    rows_raw = _cluster_rows(rects, tol_ratio=0.8)
    result = []
    for row in rows_raw:
        n = len(row)
        if n == options_count:
            result.append(row)
        elif abs(n - options_count) == 1 and n >= 2:
            result.append(row[:options_count])
    return result


# ── Главная функция ───────────────────────────────────────────────────────────
def _recognize(image_b64: str, questions_count: int, options_count: int) -> dict:
    img, gray = _load(image_b64)
    h, w = gray.shape
    opts = RU_OPTS[:options_count]

    answer_zone_h = int(h * 0.78)
    gray_ans = gray[:answer_zone_h, :]

    anchor_cands = _find_anchors(gray_ans)
    anchors = _select_corner_anchors(anchor_cands, w, answer_zone_h)

    dbg_anchors = len(anchor_cands)
    answer_rows = []
    dbg_rows_dist = []

    if anchors:
        tl, tr, bl, br = anchors
        # Якоря расположены СНАРУЖИ сетки (в полях бланка).
        # Сетка ответов находится между якорями, чуть внутрь от них.
        anchor_half = tl[2] // 2
        grid_x0 = tl[0] + anchor_half + 2   # правее левого якоря
        grid_x1 = tr[0] - anchor_half - 2   # левее правого якоря
        grid_y0 = tl[1]                     # Y верхних якорей = верх сетки
        grid_y1 = bl[1]                     # Y нижних якорей = низ сетки
        grid_w  = grid_x1 - grid_x0
        grid_h  = grid_y1 - grid_y0

        n_blank_cols = 1 if questions_count <= 15 else (2 if questions_count <= 40 else 3)
        rows_per_col = questions_count // n_blank_cols

        section_w = grid_w / n_blank_cols

        for sec in range(n_blank_cols):
            sec_x0 = grid_x0 + sec * section_w
            sq_area_w = section_w * 0.80
            sq_step = sq_area_w / options_count
            sq_x_start = sec_x0 + section_w * 0.20 + sq_step / 2

            row_step = grid_h / rows_per_col
            sq_y_start = grid_y0 + row_step / 2

            for ri in range(rows_per_col):
                row = []
                cy_cell = sq_y_start + ri * row_step
                for oi in range(options_count):
                    cx_cell = sq_x_start + oi * sq_step
                    row.append((int(cx_cell), int(cy_cell),
                                int(sq_step * 0.8), int(row_step * 0.75)))
                answer_rows.append(row)

        dbg_rows_dist = [f"anchors_ok", len(answer_rows),
                         f"grid={int(grid_w)}x{int(grid_h)}",
                         f"tl=({tl[0]},{tl[1]})", f"br=({br[0]},{br[1]})"]
    else:
        answer_rows = _fallback_detect(gray_ans, questions_count, options_count)
        dbg_rows_dist = [f"fallback", f"cands={dbg_anchors}", len(answer_rows)]

    answer_rows = answer_rows[:questions_count]

    answers     = []
    confidences = []
    dbg_fills   = []

    for row_i, row in enumerate(answer_rows):
        fills = [_cross_score(gray, cx, cy, cw, ch) for cx, cy, cw, ch in row]
        if not fills:
            answers.append("")
            confidences.append(0.0)
            continue
        idx      = int(np.argmax(fills))
        max_f    = fills[idx]
        sorted_f = sorted(fills, reverse=True)
        gap      = sorted_f[0] - (sorted_f[1] if len(sorted_f) > 1 else 0)
        mean_oth = (sum(fills) - max_f) / (len(fills) - 1) if len(fills) > 1 else 0
        rel_gap  = max_f - mean_oth
        chosen   = opts[idx] if idx < len(opts) else "?"
        if row_i < 5:
            dbg_fills.append({"row": row_i, "fills": [round(f, 4) for f in fills],
                               "max": round(max_f, 4), "gap": round(gap, 4),
                               "rel_gap": round(rel_gap, 4), "chosen": chosen})
        if max_f > 0.10 and rel_gap > 0.04:
            answers.append(opts[idx] if idx < len(opts) else "")
            confidences.append(round(min(0.99, rel_gap / 0.25 + 0.35), 2))
        else:
            answers.append("")
            confidences.append(0.0)

    while len(answers) < questions_count:
        answers.append("")
        confidences.append(0.0)

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
        "squares_found": dbg_anchors,
        "answer_rows":   len(answer_rows),
        "code_rows":     len(code_rows),
        "dbg_fills":     dbg_fills,
        "dbg_rows_dist": dbg_rows_dist,
    }


# ── Анализ ────────────────────────────────────────────────────────────────────
_LAT_TO_CYR = {"A": "А", "B": "Б", "C": "В", "D": "Г", "E": "Д", "F": "Е"}


def _normalize_key(answer_key: str) -> list:
    return [_LAT_TO_CYR.get(ch, ch) for ch in answer_key.strip().upper()]


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
            dbg.append({"q": i + 1, "a_repr": repr(a), "a_hex": a.encode("utf-8").hex(),
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


def _resp(status, body):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """
    Распознавание бланка: якоря → сетка → крестики + кружки кода.
    POST { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "..." }
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
            "anchorsFound": result["squares_found"],
            "answerRows":   result["answer_rows"],
            "answers5":     answers[:5],
            "fills3":       result.get("dbg_fills", []),
            "rowsDist":     result.get("dbg_rows_dist", []),
        }
    })