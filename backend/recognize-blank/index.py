"""
Распознавание бланка ответов через OpenCV.
POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
# v31: detect answer cells directly from contours, no geometry guessing
import json, base64, math
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


# ── Кластеризация по строкам ──────────────────────────────────────────────────
def _cluster_rows(items, tol):
    """items: список (cx, cy, ...). tol: макс. отклонение по Y для одной строки."""
    if not items:
        return []
    sorted_i = sorted(items, key=lambda i: i[1])
    rows = []
    for item in sorted_i:
        placed = False
        for row in rows:
            row_y = np.mean([it[1] for it in row])
            if abs(item[1] - row_y) <= tol:
                row.append(item)
                placed = True
                break
        if not placed:
            rows.append([item])
    rows = [sorted(r, key=lambda i: i[0]) for r in rows]
    rows.sort(key=lambda r: np.mean([i[1] for i in r]))
    return rows


# ── Поиск якорей (залитые чёрные квадраты) ───────────────────────────────────
def _find_anchors(gray):
    h, w = gray.shape
    min_s = int(min(h, w) * 0.008)
    max_s = int(min(h, w) * 0.090)
    seen = set()
    candidates = []
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh_list = []
    _, t1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    thresh_list.append(cv2.morphologyEx(t1, cv2.MORPH_CLOSE, k, iterations=2))
    for thr in [60, 80, 100, 130]:
        _, tf = cv2.threshold(gray, thr, 255, cv2.THRESH_BINARY_INV)
        thresh_list.append(cv2.morphologyEx(tf, cv2.MORPH_CLOSE, k, iterations=1))
    bl = cv2.GaussianBlur(gray, (3, 3), 0)
    for bs, C in [(25, 8), (35, 10)]:
        ta = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, bs, C)
        thresh_list.append(cv2.morphologyEx(ta, cv2.MORPH_CLOSE, k, iterations=2))
    for bw in thresh_list:
        cnts, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in cnts:
            x, y, cw, ch = cv2.boundingRect(cnt)
            side = (cw + ch) / 2
            if not (min_s < side < max_s):
                continue
            if not (0.40 < cw / max(ch, 1) < 2.5):
                continue
            fill = cv2.contourArea(cnt) / max(cw * ch, 1)
            if fill < 0.45:
                continue
            if float(np.mean(gray[y:y+ch, x:x+cw])) > 150:
                continue
            cx, cy_ = x + cw // 2, y + ch // 2
            key = (cx // 8, cy_ // 8)
            if key in seen:
                continue
            seen.add(key)
            candidates.append((cx, cy_, cw, ch, side))
    return candidates


def _select_corner_anchors(cands, img_w, img_h):
    if len(cands) < 2:
        return None
    med = float(np.median([c[4] for c in cands]))
    same = [c for c in cands if abs(c[4] - med) / max(med, 1) < 0.5] or cands
    same.sort(key=lambda c: c[0])
    left  = [c for c in same if c[0] < img_w * 0.40] or same[:len(same)//2]
    right = [c for c in same if c[0] > img_w * 0.60] or same[len(same)//2:]
    if not left or not right:
        return None
    lt = min(left,  key=lambda c: c[1])
    lb = max(left,  key=lambda c: c[1])
    rt = min(right, key=lambda c: c[1])
    rb = max(right, key=lambda c: c[1])
    has_l = lt[1] != lb[1]
    has_r = rt[1] != rb[1]
    if not has_l and has_r:
        lb = (lt[0], rb[1], lt[2], lt[3], lt[4])
    elif not has_r and has_l:
        rb = (rt[0], lb[1], rt[2], rt[3], rt[4])
    gh = abs(lb[1] - lt[1])
    gw = abs(rt[0] - lt[0])
    if gh < img_h * 0.05:
        ref_h = abs(rb[1] - rt[1]) if has_r else abs(lb[1] - lt[1])
        if ref_h > img_h * 0.05:
            lt = (lt[0], rt[1], lt[2], lt[3], lt[4])
            lb = (lt[0], rb[1], lt[2], lt[3], lt[4])
            gh = ref_h
        else:
            return None
    if gw < img_w * 0.25:
        return None
    return lt, rt, lb, rb


# ── Детектирование квадратов ответов прямо с изображения ─────────────────────
def _find_answer_cells(gray, zone_y0, zone_y1, options_count):
    """
    Ищем квадраты ответов (незалитые, с буквой внутри) в зоне zone_y0..zone_y1.
    Возвращает список (cx, cy, side) всех найденных квадратов.
    """
    zone = gray[zone_y0:zone_y1, :]
    h_z, w_z = zone.shape
    min_s = int(min(h_z, w_z) * 0.012)
    max_s = int(min(h_z, w_z) * 0.070)

    seen = set()
    cells = []
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))

    bl = cv2.GaussianBlur(zone, (3, 3), 0)
    thresh_list = []
    for bs, C in [(15, 4), (21, 6), (31, 8)]:
        t = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY_INV, bs, C)
        thresh_list.append(cv2.morphologyEx(t, cv2.MORPH_OPEN, k))
    for thr in [80, 110, 140]:
        _, tf = cv2.threshold(zone, thr, 255, cv2.THRESH_BINARY_INV)
        thresh_list.append(tf)

    for bw in thresh_list:
        cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in cnts:
            x, y, cw, ch = cv2.boundingRect(cnt)
            side = (cw + ch) / 2
            if not (min_s < side < max_s):
                continue
            ratio = cw / max(ch, 1)
            if not (0.55 < ratio < 1.8):
                continue
            # Квадрат ответа — незалитый (светлый внутри)
            roi = zone[y:y+ch, x:x+cw]
            mean_brightness = float(np.mean(roi))
            if mean_brightness < 80:   # слишком тёмный — якорь или закрашенный
                continue
            cx = x + cw // 2
            cy = y + zone_y0 + ch // 2
            key = (cx // 6, cy // 6)
            if key in seen:
                continue
            seen.add(key)
            cells.append((cx, cy, cw, ch, side))

    return cells


# ── Тёмность ROI ──────────────────────────────────────────────────────────────
def _darkness(gray, cx, cy, cw, ch) -> float:
    """Доля тёмных пикселей внутри ROI ячейки."""
    pad = max(2, int(min(cw, ch) * 0.10))
    x1 = max(0, cx - cw // 2 + pad)
    y1 = max(0, cy - ch // 2 + pad)
    x2 = min(gray.shape[1], cx + cw // 2 - pad)
    y2 = min(gray.shape[0], cy + ch // 2 - pad)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0
    _, bw = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return float(np.mean(bw > 0))


# ── Распознавание кружков кода ────────────────────────────────────────────────
def _find_circles(gray, zone_y0, zone_y1):
    """Ищем кружки 0-9 в зоне кода ученика."""
    zone = gray[zone_y0:zone_y1, :]
    h_z, w_z = zone.shape
    min_r = max(4, int(min(h_z, w_z) * 0.010))
    max_r = max(15, int(min(h_z, w_z) * 0.045))
    bl = cv2.GaussianBlur(zone, (5, 5), 1)
    circles = cv2.HoughCircles(bl, cv2.HOUGH_GRADIENT, dp=1.1,
                               minDist=int(min_r * 1.5),
                               param1=50, param2=15,
                               minRadius=min_r, maxRadius=max_r)
    if circles is None:
        return []
    return [(int(x), int(y) + zone_y0, int(r))
            for x, y, r in circles[0]]


# ── Главная функция ───────────────────────────────────────────────────────────
def _recognize(image_b64: str, questions_count: int, options_count: int) -> dict:
    img, gray = _load(image_b64)
    h, w = gray.shape
    opts = RU_OPTS[:options_count]

    # 1. Найти якоря
    ans_zone_h = int(h * 0.80)
    cands = _find_anchors(gray[:ans_zone_h, :])
    anchors = _select_corner_anchors(cands, w, ans_zone_h)
    if not anchors:
        cands = _find_anchors(gray)
        anchors = _select_corner_anchors(cands, w, h)

    dbg_anchors = len(cands)
    dbg_rows_dist = []

    if not anchors:
        return {
            "answers": [""] * questions_count,
            "confidences": [0.0] * questions_count,
            "code": "?????",
            "code_confs": [0.0] * 5,
            "squares_found": dbg_anchors,
            "answer_rows": 0,
            "code_rows": 0,
            "dbg_fills": [],
            "dbg_rows_dist": ["no_anchors"],
            "dbg_code": {},
        }

    tl, tr, bl_a, br = anchors
    grid_x0 = tl[0] + tl[2] // 2
    grid_x1 = tr[0] - tr[2] // 2
    grid_y0 = tl[1]
    grid_y1 = bl_a[1]
    grid_w  = grid_x1 - grid_x0
    grid_h  = grid_y1 - grid_y0

    # 2. Детектировать квадраты ответов напрямую
    raw_cells = _find_answer_cells(gray, grid_y0, grid_y1, options_count)

    # Фильтруем: оставляем только квадраты внутри X-диапазона сетки
    raw_cells = [c for c in raw_cells
                 if grid_x0 - 20 <= c[0] <= grid_x1 + 20]

    # Кластеризуем по строкам
    if raw_cells:
        med_side = float(np.median([c[4] for c in raw_cells]))
        row_tol  = med_side * 0.7
        rows_all = _cluster_rows(raw_cells, tol=row_tol)
        # Оставляем только строки с нужным числом ячеек
        answer_rows_cells = [r for r in rows_all if len(r) == options_count]

        # Если не хватает строк — смягчаем
        if len(answer_rows_cells) < questions_count // 2:
            answer_rows_cells = [r for r in rows_all
                                 if abs(len(r) - options_count) <= 1]
            answer_rows_cells = [r[:options_count] for r in answer_rows_cells]

        dbg_rows_dist = ["cells_detected", len(answer_rows_cells),
                         f"raw={len(raw_cells)}", f"grid={int(grid_w)}x{int(grid_h)}"]
    else:
        answer_rows_cells = []
        dbg_rows_dist = ["no_cells_found", f"grid={int(grid_w)}x{int(grid_h)}"]

    # Если детектор не нашёл достаточно строк — строим геометрическую сетку
    if len(answer_rows_cells) < questions_count * 0.5:
        n_blank_cols = 1 if questions_count <= 15 else (2 if questions_count <= 40 else 3)
        rows_per_col = math.ceil(questions_count / n_blank_cols)
        section_w    = grid_w / n_blank_cols
        # num_w/col_w из generate-blank: 7.5mm / ((bw-2*4mm)/n_cols)
        # bw_inner≈grid_w, col_w=grid_w/n_cols → num_frac≈7.5/(bw_mm/n_cols)
        # Используем фиксированное: квадраты занимают правые 85% колонки
        num_frac  = 0.15
        sq_area_w = section_w * (1 - num_frac)
        sq_step   = sq_area_w / options_count
        row_step  = grid_h / rows_per_col
        cell_w    = int(sq_step * 0.80)
        cell_h    = int(row_step * 0.70)
        answer_rows_cells = []
        for sec in range(n_blank_cols):
            sec_x0     = grid_x0 + sec * section_w
            sq_x_start = sec_x0 + section_w * num_frac + sq_step / 2
            for ri in range(rows_per_col):
                q_idx = sec * rows_per_col + ri
                if q_idx >= questions_count:
                    break
                cy_cell = grid_y0 + ri * row_step + row_step / 2
                row = [(int(sq_x_start + oi * sq_step), int(cy_cell),
                        cell_w, cell_h, sq_step)
                       for oi in range(options_count)]
                answer_rows_cells.append(row)
        dbg_rows_dist.append("fallback_geometry")

    answer_rows_cells = answer_rows_cells[:questions_count]

    # 3. Читаем ответы
    answers, confidences, dbg_fills = [], [], []
    for row_i, row in enumerate(answer_rows_cells):
        fills = [_darkness(gray, c[0], c[1], c[2], c[3]) for c in row]
        if not fills:
            answers.append(""); confidences.append(0.0); continue
        idx      = int(np.argmax(fills))
        max_f    = fills[idx]
        sorted_f = sorted(fills, reverse=True)
        second_f = sorted_f[1] if len(sorted_f) > 1 else 0.0
        gap      = max_f - second_f
        norm_gap = gap / max(max_f, 0.01)
        chosen   = opts[idx] if idx < len(opts) else "?"
        if row_i < 5:
            dbg_fills.append({"row": row_i,
                               "fills": [round(f, 4) for f in fills],
                               "max": round(max_f, 4),
                               "gap": round(gap, 4),
                               "norm_gap": round(norm_gap, 4),
                               "chosen": chosen})
        if max_f > 0.07 and norm_gap > 0.12:
            answers.append(opts[idx] if idx < len(opts) else "")
            confidences.append(round(min(0.99, norm_gap * 0.8 + 0.3), 2))
        else:
            answers.append(""); confidences.append(0.0)

    while len(answers) < questions_count:
        answers.append(""); confidences.append(0.0)

    # 4. Код ученика: кружки под сеткой ответов
    # Зона кода: от нижнего якоря до конца изображения (но не более 40% высоты)
    code_y0 = grid_y1
    code_y1 = min(h - 5, code_y0 + int(grid_h * 0.55))

    circles = _find_circles(gray, code_y0, code_y1)
    code = ""
    code_confs = []
    dbg_code: dict = {"circles_found": len(circles), "zone": [code_y0, code_y1]}

    if circles:
        cr_items = [(cx, cy, r, r * 2) for cx, cy, r in circles]
        med_r    = float(np.median([c[2] for c in circles]))
        row_tol  = med_r * 2.5
        cr_rows  = _cluster_rows(cr_items, tol=row_tol)
        # Берём строки с 8-12 кружками (0-9)
        code_rows = [r for r in cr_rows if 7 <= len(r) <= 13][:5]
        dbg_code["code_rows_found"] = len(code_rows)

        for row in code_rows:
            row10 = sorted(row, key=lambda i: i[0])[:10]
            # Для каждого кружка меряем тёмность (закрашенный = много тёмных пикселей)
            d_vals = []
            for cx, cy, r, _ in row10:
                r2 = max(2, int(r * 0.70))
                x1 = max(0, cx - r2); y1 = max(0, cy - r2)
                x2 = min(w, cx + r2); y2 = min(h, cy + r2)
                if x2 > x1 and y2 > y1:
                    roi = gray[y1:y2, x1:x2]
                    _, bw_r = cv2.threshold(roi, 0, 255,
                                            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                    d_vals.append(float(np.mean(bw_r > 0)))
                else:
                    d_vals.append(0.0)
            if not d_vals:
                code += "?"; code_confs.append(0.0); continue
            best_i  = int(np.argmax(d_vals))
            best_f  = d_vals[best_i]
            second  = sorted(d_vals, reverse=True)[1] if len(d_vals) > 1 else 0.0
            ng      = (best_f - second) / max(best_f, 0.01)
            if best_f > 0.08 and ng > 0.12:
                code += str(best_i)
                code_confs.append(round(min(0.99, ng * 0.8 + 0.3), 2))
            else:
                code += "?"; code_confs.append(0.0)
    else:
        dbg_code["code_rows_found"] = 0

    code = (code + "?????")[:5]
    code_confs = (code_confs + [0.0] * 5)[:5]

    return {
        "answers":       answers[:questions_count],
        "confidences":   confidences[:questions_count],
        "code":          code,
        "code_confs":    code_confs,
        "squares_found": dbg_anchors,
        "answer_rows":   len(answer_rows_cells),
        "code_rows":     len(code),
        "dbg_fills":     dbg_fills,
        "dbg_rows_dist": dbg_rows_dist,
        "dbg_code":      dbg_code,
    }


# ── Анализ ────────────────────────────────────────────────────────────────────
_LAT_TO_CYR = {"A": "А", "B": "Б", "C": "В", "D": "Г", "E": "Д", "F": "Е"}


def _normalize_key(answer_key: str) -> list:
    return [_LAT_TO_CYR.get(ch, ch) for ch in answer_key.strip().upper()]


def _analyze(answers: list, answer_key: str) -> dict:
    dbg_answers = [{"i": i, "val": repr(a), "hex": a.encode("utf-8").hex(),
                    "a_up": repr(a.upper()), "a_up_hex": a.upper().encode("utf-8").hex()}
                   for i, a in enumerate(answers[:5])]
    if not answer_key:
        return {"total": len(answers), "correct": 0, "wrong": 0, "percent": 0,
                "details": [], "_dbg": {"reason": "no_key", "answers": dbg_answers}}
    key = _normalize_key(answer_key)
    dbg_key_raw = repr("".join(key[:20]))
    dbg_key_hex = "".join(key[:5]).encode("utf-8").hex()
    details, correct = [], 0
    dbg_cmp = []
    for i, a in enumerate(answers):
        ka = key[i] if i < len(key) else ""
        ok = a.upper() == ka and ka != ""
        if ok:
            correct += 1
        details.append({"q": i + 1, "answer": a, "correct": ka, "ok": ok})
        if i < 3:
            dbg_cmp.append({
                "q": i + 1,
                "a_repr": repr(a), "a_hex": a.encode("utf-8").hex(),
                "a_up": repr(a.upper()), "a_up_hex": a.upper().encode("utf-8").hex(),
                "ka_repr": repr(ka), "ka_hex": ka.encode("utf-8").hex(),
                "eq": ok,
            })
    total   = len(answers)
    wrong   = total - correct
    percent = round(correct / total * 100) if total > 0 else 0
    return {
        "total": total, "correct": correct, "wrong": wrong, "percent": percent,
        "details": details,
        "_dbg": {
            "key_raw": dbg_key_raw, "key_hex": dbg_key_hex,
            "answers_raw": dbg_answers, "cmp": dbg_cmp,
        },
    }


# ── Handler ───────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    """Распознавание бланка ответов: находит якоря, детектирует квадраты, читает ответы и код ученика."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": CORS,
                "body": json.dumps({"error": "Метод не поддерживается"})}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            return {"statusCode": 400, "headers": CORS,
                    "body": json.dumps({"error": "Некорректный JSON"})}

    image_b64 = body.get("image") or body.get("image_b64") or ""
    if not image_b64:
        return {"statusCode": 400, "headers": CORS,
                "body": json.dumps({"error": "Поле image обязательно"})}

    try:
        questions_count = int(body.get("questionsCount") or body.get("questions_count") or 20)
        options_count   = int(body.get("optionsCount")   or body.get("options_count")   or 4)
        options_count   = max(2, min(options_count, 6))
        questions_count = max(1, min(questions_count, 60))
    except (TypeError, ValueError):
        questions_count, options_count = 20, 4

    answer_key = str(body.get("answerKey") or body.get("answer_key") or "").strip()

    try:
        result = _recognize(image_b64, questions_count, options_count)
    except (ValueError, base64.binascii.Error, Exception) as e:
        err_str = str(e)
        code = 400 if "padding" in err_str.lower() or "decode" in err_str.lower() else 422
        return {"statusCode": code, "headers": CORS,
                "body": json.dumps({"error": f"Ошибка распознавания: {e}"},
                                   ensure_ascii=False)}

    analysis = _analyze(result["answers"], answer_key)

    resp = {
        "studentCode":   result["code"],
        "codeConfs":     result["code_confs"],
        "answers":       result["answers"],
        "confidences":   result["confidences"],
        "squaresFound":  result["squares_found"],
        "answerRows":    result["answer_rows"],
        "_debug": {
            "ocr": {
                "anchorsFound": result["squares_found"],
                "answerRows":   result["answer_rows"],
                "answers5":     result["answers"][:5],
                "fills3":       result["dbg_fills"],
                "rowsDist":     result["dbg_rows_dist"],
                "code":         result["dbg_code"],
            },
            "analyze": analysis.get("_dbg", {}),
        },
    }
    if analysis:
        resp["analysis"] = {k: v for k, v in analysis.items() if k != "_dbg"}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(resp, ensure_ascii=False),
    }