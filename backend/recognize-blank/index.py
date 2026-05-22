"""
Распознавание бланка ответов через OpenCV.
POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
# v39: detector-based calibration for both answers grid and code circles
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
def _darkness(gray, cx, cy, cw, ch, thr_value: int = 100) -> float:
    """
    Средняя яркость инвертированная (1.0 = чёрное, 0.0 = белое).
    Берём ТОЛЬКО центральные 50% ячейки — без рамки квадрата и буквы-подписи.
    Используем ФИКСИРОВАННЫЙ порог (не Otsu) — чтобы пустые ячейки давали 0.
    """
    # Берём центральные 50% по обеим осям — это сердцевина крестика
    sz = int(min(cw, ch) * 0.50)
    sz = max(4, sz)
    x1 = max(0, cx - sz // 2)
    y1 = max(0, cy - sz // 2)
    x2 = min(gray.shape[1], cx + sz // 2)
    y2 = min(gray.shape[0], cy + sz // 2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0
    # Фиксированный порог: пиксель тёмнее thr_value → "чёрный"
    bw = (roi < thr_value).astype(np.uint8)
    return float(np.mean(bw))


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

    # Основной метод: геометрическая сетка + уточнение по детектированным квадратам
    n_blank_cols = 1 if questions_count <= 15 else (2 if questions_count <= 40 else 3)
    rows_per_col = math.ceil(questions_count / n_blank_cols)
    section_w    = grid_w / n_blank_cols
    row_step     = grid_h / rows_per_col

    # Калибровка по реальным детектированным квадратам, если они есть
    # Иначе используем пропорции из generate-blank
    sq_x_start_per_sec = []
    sq_step_calibrated = None
    cell_size_med      = None

    if len(raw_cells) >= 4:
        # Медианный размер квадрата
        cell_size_med = float(np.median([c[4] for c in raw_cells]))
        # Для каждой секции находим X-координаты квадратов в первой строке (q1, q11)
        # и берём шаг между ними
        for sec in range(n_blank_cols):
            sec_x0 = grid_x0 + sec * section_w
            sec_x1 = grid_x0 + (sec + 1) * section_w
            sec_cells = [c for c in raw_cells
                         if sec_x0 - cell_size_med <= c[0] <= sec_x1 + cell_size_med]
            if len(sec_cells) < options_count:
                sq_x_start_per_sec.append(None)
                continue
            # Кластеризуем по X, находим options_count наиболее частых X-позиций
            xs = sorted([c[0] for c in sec_cells])
            # Группируем близкие X
            x_clusters = []
            cluster_tol = cell_size_med * 0.6
            for x in xs:
                placed = False
                for cl in x_clusters:
                    if abs(np.mean(cl) - x) <= cluster_tol:
                        cl.append(x)
                        placed = True
                        break
                if not placed:
                    x_clusters.append([x])
            # Сортируем кластеры по числу элементов (самые частые = настоящие столбцы)
            x_clusters.sort(key=lambda cl: -len(cl))
            top_clusters = x_clusters[:options_count]
            if len(top_clusters) == options_count:
                col_xs = sorted([np.mean(cl) for cl in top_clusters])
                sq_x_start_per_sec.append(col_xs[0])
                if sq_step_calibrated is None and len(col_xs) >= 2:
                    sq_step_calibrated = float(np.median(np.diff(col_xs)))
            else:
                sq_x_start_per_sec.append(None)

    # Фоллбэк-пропорции если калибровка не удалась
    if sq_step_calibrated is None:
        num_frac  = 0.150
        sq_area_w = section_w * (1 - num_frac)
        sq_step_calibrated = sq_area_w / options_count
    if cell_size_med is None:
        cell_size_med = sq_step_calibrated * 0.55

    sq_step = sq_step_calibrated
    cell_w  = int(cell_size_med * 0.85)
    cell_h  = int(cell_size_med * 0.85)

    # Калибровка Y-координат строк по детектированным ячейкам
    row_ys_calibrated = None
    if len(raw_cells) >= rows_per_col:
        ys = sorted([c[1] for c in raw_cells])
        y_clusters = []
        y_tol = cell_size_med * 0.6
        for y in ys:
            placed = False
            for cl in y_clusters:
                if abs(np.mean(cl) - y) <= y_tol:
                    cl.append(y)
                    placed = True
                    break
            if not placed:
                y_clusters.append([y])
        # Сортируем по числу элементов и берём rows_per_col самых больших
        y_clusters.sort(key=lambda cl: -len(cl))
        top_y_clusters = y_clusters[:rows_per_col]
        if len(top_y_clusters) == rows_per_col:
            row_ys_calibrated = sorted([float(np.mean(cl)) for cl in top_y_clusters])

    answer_rows_cells = []
    for sec in range(n_blank_cols):
        sec_x0     = grid_x0 + sec * section_w
        sq_x_first = sq_x_start_per_sec[sec] if sec < len(sq_x_start_per_sec) and sq_x_start_per_sec[sec] is not None else (sec_x0 + section_w * 0.15 + sq_step / 2)
        for ri in range(rows_per_col):
            q_idx = sec * rows_per_col + ri
            if q_idx >= questions_count:
                break
            if row_ys_calibrated and ri < len(row_ys_calibrated):
                cy_cell = row_ys_calibrated[ri]
            else:
                cy_cell = grid_y0 + ri * row_step + row_step / 2
            row = [(int(sq_x_first + oi * sq_step), int(cy_cell),
                    cell_w, cell_h, sq_step)
                   for oi in range(options_count)]
            answer_rows_cells.append(row)

    # Координаты первой строки для отладки
    _r0 = answer_rows_cells[0] if answer_rows_cells else []
    _r0_coords = [(c[0], c[1]) for c in _r0]
    dbg_rows_dist = ["geometry_grid", len(answer_rows_cells),
                     f"raw={len(raw_cells)}", f"grid={int(grid_w)}x{int(grid_h)}",
                     f"sq_step={round(sq_step,1)}", f"row_step={round(row_step,1)}",
                     f"grid_x0={int(grid_x0)}", f"grid_y0={int(grid_y0)}",
                     f"sq_x_start={int(sq_x_start)}", f"cell_w={cell_w}",
                     f"row0_xy={_r0_coords}"]

    answer_rows_cells = answer_rows_cells[:questions_count]

    # 3. Адаптивный порог по медианной яркости фона зоны ответов
    # Помеченные крестики и заливки темнее ~80, фон бланка ~200, буквы ~120
    zone_pixels = gray[grid_y0:grid_y1, grid_x0:grid_x1]
    bg_median = float(np.median(zone_pixels))   # ≈ 200 для белого фона
    # Порог = середина между чёрным (0) и фоном
    thr_value = max(60, min(140, int(bg_median * 0.45)))

    # 4. Читаем ответы
    answers, confidences, dbg_fills = [], [], []
    for row_i, row in enumerate(answer_rows_cells):
        fills = [_darkness(gray, c[0], c[1], c[2], c[3], thr_value) for c in row]
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
                               "thr": thr_value,
                               "chosen": chosen})
        # Помеченный квадрат: ≥7% тёмных пикселей И либо абс. разрыв ≥2%, либо норм. разрыв ≥12%
        is_marked = max_f > 0.07 and (gap > 0.02 or norm_gap > 0.12)
        if is_marked:
            answers.append(opts[idx] if idx < len(opts) else "")
            confidences.append(round(min(0.99, norm_gap * 0.7 + gap * 2 + 0.2), 2))
        else:
            answers.append(""); confidences.append(0.0)

    while len(answers) < questions_count:
        answers.append(""); confidences.append(0.0)

    # 5. Код ученика: 4 ОТДЕЛЬНЫХ якоря вокруг зоны кода
    # Ищем якоря НИЖЕ нижних якорей сетки ответов
    code = ""
    code_confs = []
    code_zone_y0 = grid_y1 + int(grid_h * 0.03)   # отступ от сетки ответов
    code_zone_y1 = min(h - 2, grid_y1 + int(grid_h * 0.55))

    # Ищем якоря в зоне кода
    code_cands = _find_anchors(gray[code_zone_y0:code_zone_y1, :])
    # Корректируем Y координаты
    code_cands = [(cx, cy + code_zone_y0, cw, ch, sd) for cx, cy, cw, ch, sd in code_cands]
    code_anchors = _select_corner_anchors(code_cands, w, h - code_zone_y0)

    dbg_code: dict = {
        "code_zone": [code_zone_y0, code_zone_y1],
        "code_anchors_found": len(code_cands),
    }

    if code_anchors:
        c_tl, c_tr, c_bl, c_br = code_anchors
        # tuple структура: (cx, cy, cw, ch, side) — cx, cy это ЦЕНТР якоря
        # Правый край левого якоря = cx + cw/2; левый край правого = cx - cw/2
        c_inner_x0 = c_tl[0] + c_tl[2] // 2  # правый край левого якоря
        c_inner_x1 = c_tr[0] - c_tr[2] // 2  # левый край правого якоря
        c_y0 = c_tl[1]
        c_y1 = c_bl[1]
        c_w  = c_inner_x1 - c_inner_x0
        c_h  = c_y1 - c_y0

        # Ищем кружки детектором HoughCircles внутри зоны
        n_rows_code = 5
        n_cols_code = 10

        code_zone_img = gray[c_y0:c_y1, int(c_inner_x0):int(c_inner_x1)]
        detected_circles = _find_circles(code_zone_img, 0, code_zone_img.shape[0])
        # Корректируем координаты обратно в полное изображение
        detected_circles = [(cx + int(c_inner_x0), cy + c_y0, r) for cx, cy, r in detected_circles]

        # Если детектор нашёл достаточно кружков — калибруем сетку по ним
        if len(detected_circles) >= n_cols_code:
            # Берём X-координаты, кластеризуем
            r_med = float(np.median([c[2] for c in detected_circles]))
            xs = sorted([c[0] for c in detected_circles])
            x_cls_c = []
            for x in xs:
                placed = False
                for cl in x_cls_c:
                    if abs(np.mean(cl) - x) <= r_med * 1.2:
                        cl.append(x); placed = True; break
                if not placed:
                    x_cls_c.append([x])
            x_cls_c.sort(key=lambda cl: -len(cl))
            top_x = x_cls_c[:n_cols_code]
            if len(top_x) == n_cols_code:
                col_xs = sorted([float(np.mean(cl)) for cl in top_x])
                step_x = float(np.median(np.diff(col_xs)))
                # circ_x0 — это начало последовательности так, чтобы col_i=0 был col_xs[0]
                circ_x0 = col_xs[0] - step_x / 2
                circ_w  = step_x * n_cols_code
            else:
                num_frac_c = 0.125
                circ_x0 = c_inner_x0 + c_w * num_frac_c
                circ_w  = c_w * (1.0 - num_frac_c)
                step_x  = circ_w / n_cols_code
            # Y-калибровка
            ys_c = sorted([c[1] for c in detected_circles])
            y_cls_c = []
            for y in ys_c:
                placed = False
                for cl in y_cls_c:
                    if abs(np.mean(cl) - y) <= r_med * 1.2:
                        cl.append(y); placed = True; break
                if not placed:
                    y_cls_c.append([y])
            y_cls_c.sort(key=lambda cl: -len(cl))
            top_y = y_cls_c[:n_rows_code]
            if len(top_y) == n_rows_code:
                row_ys_c = sorted([float(np.mean(cl)) for cl in top_y])
                step_y = float(np.median(np.diff(row_ys_c)))
                circ_y_start = row_ys_c[0]
            else:
                step_y = c_h / n_rows_code if c_h > 0 else 40
                circ_y_start = c_y0 + step_y / 2
            r_est = max(3, int(r_med))
        else:
            # Фоллбэк — геометрия
            num_frac_c = 0.125
            circ_x0 = c_inner_x0 + c_w * num_frac_c
            circ_w  = c_w * (1.0 - num_frac_c)
            step_x  = circ_w / n_cols_code
            step_y  = c_h / n_rows_code if c_h > 0 else 40
            circ_y_start = c_y0 + step_y / 2
            r_est   = max(3, int(min(step_x, step_y) * 0.38))

        dbg_code["circ_x0"] = int(circ_x0)
        dbg_code["circ_y0"] = c_y0
        dbg_code["c_inner_x0"] = int(c_inner_x0)
        dbg_code["c_inner_x1"] = int(c_inner_x1)
        dbg_code["c_y0"] = c_y0
        dbg_code["c_y1"] = c_y1
        dbg_code["c_w"] = int(c_w)
        dbg_code["c_h"] = int(c_h)
        dbg_code["step_x"]  = round(step_x, 1)
        dbg_code["step_y"]  = round(step_y, 1)
        dbg_code["r_est"]   = r_est
        # Медиана всей зоны кода для диагностики
        full_code_zone = gray[c_y0:max(c_y0+1,c_y1), int(c_inner_x0):max(int(c_inner_x0)+1,int(c_inner_x1))]
        dbg_code["zone_median"] = round(float(np.median(full_code_zone)), 1) if full_code_zone.size > 0 else -1
        # Сэмпл пикселей первой строки (центры кружков)
        _first_row_pixels = []
        for col_i in range(min(5, n_cols_code)):
            cx_s = int(circ_x0 + col_i * (circ_w / n_cols_code) + circ_w / n_cols_code / 2)
            cy_s = int(c_y0 + step_y / 2)
            if 0 <= cy_s < h and 0 <= cx_s < w:
                _first_row_pixels.append(int(gray[cy_s, cx_s]))
        dbg_code["pixel_samples"] = _first_row_pixels

        # Для кружков: порог = 70% от медианы фона (фон ~138, кружки ~30-50)
        code_zone_pixels = gray[c_y0:c_y1, int(circ_x0):int(circ_x0 + circ_w)]
        code_bg = float(np.median(code_zone_pixels)) if code_zone_pixels.size > 0 else 160
        thr_code = max(60, min(160, int(code_bg * 0.70)))

        for row_i in range(n_rows_code):
            cy_c = int(circ_y_start + row_i * step_y)
            # Сначала собираем средние яркости центров кружков (не бинарные fills)
            raw_vals = []
            for col_i in range(n_cols_code):
                cx_c = int(circ_x0 + col_i * step_x + step_x / 2)
                rsz = max(3, int(r_est * 0.55))
                x1 = max(0, cx_c - rsz); y1 = max(0, cy_c - rsz)
                x2 = min(w, cx_c + rsz); y2 = min(h, cy_c + rsz)
                if x2 > x1 and y2 > y1:
                    roi = gray[y1:y2, x1:x2]
                    raw_vals.append(float(np.mean(roi)))
                else:
                    raw_vals.append(255.0)
            # Относительный метод: самый тёмный кружок в строке
            if not raw_vals:
                code += "?"; code_confs.append(0.0); continue
            min_v   = min(raw_vals)
            max_v   = max(raw_vals)
            row_bg  = max_v  # самый светлый = фон
            # Нормируем: 1.0 = самый тёмный (закрашен), 0.0 = фон
            d_vals  = [max(0.0, (row_bg - v) / max(row_bg - min_v, 1.0)) for v in raw_vals]
            best_i  = int(np.argmax(d_vals))
            best_f  = d_vals[best_i]
            sorted_d = sorted(d_vals, reverse=True)
            second  = sorted_d[1] if len(sorted_d) > 1 else 0.0
            gap_c   = best_f - second
            # Кружок закрашен если он значительно темнее остальных
            darkness_abs = row_bg - raw_vals[best_i]  # абс. разница яркостей
            if darkness_abs > 8 and gap_c > 0.20:
                code += str(best_i)
                code_confs.append(round(min(0.99, gap_c * 0.8 + 0.2), 2))
            else:
                code += "?"; code_confs.append(0.0)
            if row_i == 0:
                dbg_code["row0_fills"]    = [round(v, 3) for v in d_vals]
                dbg_code["row0_raw"]      = [round(v, 1) for v in raw_vals]
                dbg_code["row0_darkness"] = round(darkness_abs, 1)
                dbg_code["thr_code"]      = thr_code
    else:
        dbg_code["error"] = "no_code_anchors"

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

    try:
        questions_count = int(body.get("questionsCount") or body.get("questions_count") or 20)
        options_count   = int(body.get("optionsCount")   or body.get("options_count")   or 4)
        options_count   = max(2, min(options_count, 6))
        questions_count = max(1, min(questions_count, 60))
    except (TypeError, ValueError):
        questions_count, options_count = 20, 4

    answer_key = str(body.get("answerKey") or body.get("answer_key") or "").strip()

    # Режим reanalyze: нет изображения, но есть готовые answers
    if not image_b64:
        answers_list = body.get("answers") or []
        if not answers_list:
            return {"statusCode": 400, "headers": CORS,
                    "body": json.dumps({"error": "Поле image или answers обязательно"})}
        student_code = str(body.get("studentCode") or body.get("student_code") or "")
        analysis = _analyze(answers_list, answer_key)
        resp = {
            "studentCode": student_code,
            "answers": answers_list,
            "confidences": [],
            "squaresFound": 0,
            "answerRows": len(answers_list),
        }
        if analysis:
            resp["analysis"] = {k: v for k, v in analysis.items() if k != "_dbg"}
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps(resp, ensure_ascii=False)}

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