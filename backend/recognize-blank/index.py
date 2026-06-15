"""
Распознавание бланка ответов через OpenCV.
POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidence[], analysis }
"""
# v47: margin-based anchor selection + solid-square filter + x/y range debug
import json, base64, math
import numpy as np
import cv2
from template import build_answer_template, build_code_template


def _project(u, v, tl, tr, bl, br):
    """Билинейная проекция точки (u,v)∈[0,1]² на четырёхугольник якорей.
    tl,tr,bl,br — (x,y) пиксельные координаты якорей."""
    top_x = tl[0] + (tr[0] - tl[0]) * u
    top_y = tl[1] + (tr[1] - tl[1]) * u
    bot_x = bl[0] + (br[0] - bl[0]) * u
    bot_y = bl[1] + (br[1] - bl[1]) * u
    px = top_x + (bot_x - top_x) * v
    py = top_y + (bot_y - top_y) * v
    return int(round(px)), int(round(py))

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
def _find_anchors(gray, debug=None):
    h, w = gray.shape
    min_s = int(min(h, w) * 0.014)   # реперы 3.5–4.5 мм ≈ 18–23px при ширине ~1025
    max_s = int(min(h, w) * 0.075)
    seen = set()
    candidates = []
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh_list = []
    _, t1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    thresh_list.append(cv2.morphologyEx(t1, cv2.MORPH_CLOSE, k, iterations=1))
    for thr in [50, 70, 90, 110, 140]:
        _, tf = cv2.threshold(gray, thr, 255, cv2.THRESH_BINARY_INV)
        thresh_list.append(cv2.morphologyEx(tf, cv2.MORPH_CLOSE, k, iterations=1))
    bl = cv2.GaussianBlur(gray, (3, 3), 0)
    for bs, C in [(25, 8), (35, 10), (51, 12)]:
        ta = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, bs, C)
        thresh_list.append(cv2.morphologyEx(ta, cv2.MORPH_CLOSE, k, iterations=1))
    dark_sizes = []
    for bw in thresh_list:
        cnts, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in cnts:
            x, y, cw, ch = cv2.boundingRect(cnt)
            side = (cw + ch) / 2
            mean_b = float(np.mean(gray[y:y+ch, x:x+cw]))
            # Сбор статистики по всем тёмным пятнам (для отладки)
            if debug is not None and mean_b < 120 and side > min_s:
                dark_sizes.append(int(side))
            if not (min_s < side < max_s):
                continue
            if not (0.55 < cw / max(ch, 1) < 1.8):  # реперы ~квадратные
                continue
            fill = cv2.contourArea(cnt) / max(cw * ch, 1)
            if fill < 0.55:  # реперы — СПЛОШНЫЕ квадраты (высокая заливка)
                continue
            if mean_b > 150:
                continue
            cx, cy_ = x + cw // 2, y + ch // 2
            key = (cx // 8, cy_ // 8)
            if key in seen:
                continue
            seen.add(key)
            candidates.append((cx, cy_, cw, ch, side))
    if debug is not None:
        debug["min_s"] = min_s
        debug["max_s"] = max_s
        debug["dark_blobs"] = len(dark_sizes)
        debug["dark_sizes_sample"] = sorted(dark_sizes, reverse=True)[:20]
        debug["found"] = len(candidates)
        if candidates:
            debug["x_range"] = [min(c[0] for c in candidates), max(c[0] for c in candidates)]
            debug["y_range"] = [min(c[1] for c in candidates), max(c[1] for c in candidates)]
        debug["anchor_xy"] = [(c[0], c[1], int(c[4])) for c in candidates[:16]]
    return candidates


def _select_corner_anchors(cands, img_w, img_h, x_off=0, y_off=0,
                            min_w_frac=0.45, min_h_frac=0.10):
    """
    Выбираем 4 угловых репера у краёв листа. Реперы стоят в ЛЕВОМ и ПРАВОМ полях
    (≈2 мм от края), тогда как все клетки ответов — внутри сетки. Поэтому реперы
    отличаются крайним по X положением. Берём кандидатов с минимальным и
    максимальным X (левая/правая колонки полей), затем в каждой колонке —
    верхний и нижний. Возвращает (tl, tr, bl, br) по их ЦЕНТРАМ.
    """
    if len(cands) < 4:
        return None

    xs = sorted(c[0] for c in cands)
    x_lo, x_hi = xs[0], xs[-1]
    x_span = max(x_hi - x_lo, 1)
    if x_span < img_w * min_w_frac:
        return None  # все кандидаты в одной зоне — реперов по краям нет

    # Левая/правая «колонки полей»: кандидаты в пределах 22% размаха от краёв.
    xtol = max(x_span * 0.22, img_w * 0.06)
    left = sorted((c for c in cands if c[0] <= x_lo + xtol), key=lambda c: c[1])
    right = sorted((c for c in cands if c[0] >= x_hi - xtol), key=lambda c: c[1])
    if len(left) < 2 or len(right) < 2:
        return None

    # В каждой колонке: верхний (мин Y) и нижний (макс Y).
    lt, lb = left[0], left[-1]
    rt, rb = right[0], right[-1]

    # Высота рамки достаточная?
    gh = max(abs(lb[1] - lt[1]), abs(rb[1] - rt[1]))
    if gh < img_h * min_h_frac:
        return None
    # Верх должен быть заметно выше низа (защита от вырожденного случая).
    if (lt[1] >= lb[1] - 5) or (rt[1] >= rb[1] - 5):
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
    Доля ТЁМНЫХ пикселей (чернил ручки) внутри квадрата.
    cw/ch = РАЗМЕР КВАДРАТА (полный). Читаем 72% центра — крестик попадает почти
    целиком, но НЕ задеваем рамку и серую печатную букву-подпись (А/Б/В/Г) у края.
    Порог ФИКСИРОВАННЫЙ — серая буква (~120-150) не считается, только чернила (<thr).
    """
    sz = int(min(cw, ch) * 0.72)
    sz = max(10, sz)
    x1 = max(0, cx - sz // 2)
    y1 = max(0, cy - sz // 2)
    x2 = min(gray.shape[1], cx + sz // 2)
    y2 = min(gray.shape[0], cy + sz // 2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0
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

    dbg_find = {"img_hw": [h, w]}

    # ── 1. ЯКОРЯ ОТВЕТОВ — 4 крупных квадрата в верхних ~78% листа ────────────
    ans_zone_h = int(h * 0.78)
    cands_ans = _find_anchors(gray[:ans_zone_h, :], debug=dbg_find)
    anchors = _select_corner_anchors(cands_ans, w, ans_zone_h,
                                     min_w_frac=0.45, min_h_frac=0.15)
    if not anchors:
        cands_ans = _find_anchors(gray, debug=dbg_find)
        anchors = _select_corner_anchors(cands_ans, w, h,
                                         min_w_frac=0.40, min_h_frac=0.12)

    dbg_anchors = len(cands_ans)
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
            "dbg_rows_dist": ["no_anchors", f"cands={dbg_anchors}", dbg_find],
            "dbg_code": {},
        }

    # tl,tr,bl,br = ЦЕНТРЫ якорей ответов
    a_tl, a_tr, a_bl, a_br = anchors
    P_tl = (a_tl[0], a_tl[1]); P_tr = (a_tr[0], a_tr[1])
    P_bl = (a_bl[0], a_bl[1]); P_br = (a_br[0], a_br[1])

    # ── 2. ЭТАЛОННЫЙ ШАБЛОН клеток (u,v) → проекция на якоря ──────────────────
    rel_cells, rel_sq = build_answer_template(questions_count, options_count)
    # размер квадрата в пикселях (по ширине якорей)
    anchors_px_w = math.hypot(P_tr[0] - P_tl[0], P_tr[1] - P_tl[1])
    sq_px = max(10, int(rel_sq * anchors_px_w))

    # Собираем пиксельные центры клеток по вопросам
    cells_by_q = {}
    for (qi, oi, u, v) in rel_cells:
        px, py = _project(u, v, P_tl, P_tr, P_bl, P_br)
        cells_by_q.setdefault(qi, []).append((oi, px, py))

    # Порог тёмных пикселей: по фону зоны ответов
    gx0 = min(P_tl[0], P_bl[0]); gx1 = max(P_tr[0], P_br[0])
    gy0 = min(P_tl[1], P_tr[1]); gy1 = max(P_bl[1], P_br[1])
    gx0 = max(0, gx0); gy0 = max(0, gy0)
    gx1 = min(w, gx1); gy1 = min(h, gy1)
    zone_pixels = gray[gy0:gy1, gx0:gx1] if (gx1 > gx0 and gy1 > gy0) else gray
    bg_median = float(np.median(zone_pixels)) if zone_pixels.size else 200.0
    thr_value = max(60, min(140, int(bg_median * 0.55)))

    # ── 3. ЧИТАЕМ ОТВЕТЫ по шаблону ──────────────────────────────────────────
    answers, confidences, dbg_fills = [], [], []
    for qi in range(questions_count):
        row = sorted(cells_by_q.get(qi, []), key=lambda c: c[0])
        fills = [_darkness(gray, px, py, sq_px, sq_px, thr_value)
                 for (_, px, py) in row]
        if not fills:
            answers.append(""); confidences.append(0.0); continue
        idx = int(np.argmax(fills))
        max_f = fills[idx]
        sorted_f = sorted(fills, reverse=True)
        second_f = sorted_f[1] if len(sorted_f) > 1 else 0.0
        gap = max_f - second_f
        norm_gap = gap / max(max_f, 0.01)
        chosen = opts[idx] if idx < len(opts) else "?"
        if qi < 5:
            dbg_fills.append({"row": qi,
                              "fills": [round(f, 4) for f in fills],
                              "max": round(max_f, 4), "gap": round(gap, 4),
                              "norm_gap": round(norm_gap, 4),
                              "xy": [(px, py) for (_, px, py) in row],
                              "thr": thr_value, "chosen": chosen})
        is_marked = max_f > 0.07 and (gap > 0.03 or norm_gap > 0.18)
        if is_marked:
            answers.append(chosen)
            confidences.append(round(min(0.99, norm_gap * 0.7 + gap * 2 + 0.2), 2))
        else:
            answers.append(""); confidences.append(0.0)

    while len(answers) < questions_count:
        answers.append(""); confidences.append(0.0)

    dbg_corners = {"tl": P_tl, "tr": P_tr, "bl": P_bl, "br": P_br}
    dbg_rows_dist = ["template_grid", questions_count,
                     f"sq_px={sq_px}", f"anchors_px_w={int(anchors_px_w)}",
                     f"thr={thr_value}", f"corners={dbg_corners}",
                     f"find={dbg_find}"]

    # ── 4. КОД УЧЕНИКА по шаблону ────────────────────────────────────────────
    code, code_confs, dbg_code = _read_code_template(
        gray, h, w, P_bl, P_br, questions_count, options_count)

    return {
        "answers":       answers[:questions_count],
        "confidences":   confidences[:questions_count],
        "code":          code,
        "code_confs":    code_confs,
        "squares_found": len(cands_ans),
        "answer_rows":   questions_count,
        "code_rows":     len(code),
        "dbg_fills":     dbg_fills,
        "dbg_rows_dist": dbg_rows_dist,
        "dbg_code":      dbg_code,
    }


def _read_code_template(gray, h, w, ans_bl, ans_br, n_q, n_opts):
    """Читает код ученика по эталонному шаблону, калибруясь по 4 якорям зоны кода."""
    dbg_code: dict = {}
    # Зона поиска якорей кода — ниже нижних якорей ответов
    base_y = max(ans_bl[1], ans_br[1])
    code_zone_y0 = min(h - 2, base_y + int((h - base_y) * 0.02))
    code_zone_y1 = h - 1
    dbg_code["code_zone"] = [code_zone_y0, code_zone_y1]

    cands = _find_anchors(gray[code_zone_y0:code_zone_y1, :])
    cands = [(cx, cy + code_zone_y0, cw, ch, sd) for cx, cy, cw, ch, sd in cands]
    dbg_code["code_anchors_found"] = len(cands)
    zone_h = code_zone_y1 - code_zone_y0
    code_anchors = _select_corner_anchors(cands, w, zone_h,
                                          min_w_frac=0.45, min_h_frac=0.04)
    if not code_anchors:
        dbg_code["error"] = "no_code_anchors"
        return "?????", [0.0] * 5, dbg_code

    c_tl, c_tr, c_bl, c_br = code_anchors
    Ptl = (c_tl[0], c_tl[1]); Ptr = (c_tr[0], c_tr[1])
    Pbl = (c_bl[0], c_bl[1]); Pbr = (c_br[0], c_br[1])
    dbg_code["corners"] = {"tl": Ptl, "tr": Ptr, "bl": Pbl, "br": Pbr}

    rel_circ, rel_r = build_code_template(n_q, n_opts)
    aw = math.hypot(Ptr[0] - Ptl[0], Ptr[1] - Ptl[1])
    r_px = max(4, int(rel_r * aw))
    dbg_code["r_px"] = r_px

    # Проецируем кружки
    grid = {}  # row -> [(digit, px, py)]
    for (row, digit, u, v) in rel_circ:
        px, py = _project(u, v, Ptl, Ptr, Pbl, Pbr)
        grid.setdefault(row, []).append((digit, px, py))

    code = ""
    code_confs = []
    rows_minbright = []
    rows_pick = []
    for row in range(5):
        cells = sorted(grid.get(row, []), key=lambda c: c[0])
        vals = []
        for (digit, px, py) in cells:
            x1 = max(0, px - r_px); y1 = max(0, py - r_px)
            x2 = min(w, px + r_px); y2 = min(h, py + r_px)
            if x2 <= x1 or y2 <= y1:
                vals.append(255.0); continue
            roi = gray[y1:y2, x1:x2]
            roi_blur = cv2.blur(roi, (max(2, r_px // 2), max(2, r_px // 2)))
            vals.append(float(np.min(roi_blur)))
        if not vals:
            code += "?"; code_confs.append(0.0)
            rows_minbright.append(-1); rows_pick.append("?"); continue
        min_v = min(vals); max_v = max(vals)
        d_vals = [max(0.0, (max_v - v) / max(max_v - min_v, 1.0)) for v in vals]
        best_i = int(np.argmax(d_vals))
        sorted_d = sorted(d_vals, reverse=True)
        gap_c = sorted_d[0] - (sorted_d[1] if len(sorted_d) > 1 else 0.0)
        darkness_abs = max_v - vals[best_i]
        picked = "?"
        if vals[best_i] < 120 and darkness_abs > 22 and gap_c > 0.28:
            picked = str(best_i)
            code += picked
            code_confs.append(round(min(0.99, gap_c * 0.8 + 0.2), 2))
        else:
            code += "?"; code_confs.append(0.0)
        rows_minbright.append(round(min_v, 1))
        rows_pick.append(picked)
    dbg_code["rows_minbright"] = rows_minbright
    dbg_code["rows_pick"] = rows_pick
    code = (code + "?????")[:5]
    code_confs = (code_confs + [0.0] * 5)[:5]
    return code, code_confs, dbg_code


def _DEAD_CODE_REMOVED():
    return
    tl = tr = bl_a = br = None
    grid_x0 = 0
    grid_x1 = tr[0] - tr[2] // 2
    grid_y0 = tl[1]
    grid_y1 = bl_a[1]
    grid_w  = grid_x1 - grid_x0
    grid_h  = grid_y1 - grid_y0
    dbg_corners = {"tl": (tl[0], tl[1]), "tr": (tr[0], tr[1]),
                   "bl": (bl_a[0], bl_a[1]), "br": (br[0], br[1])}

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

    # Радиус привязки расчётной ячейки к реально найденному квадрату
    snap_r = sq_step * 0.6
    snapped_count = 0

    def _snap(cx_calc, cy_calc):
        """Возвращает (cx, cy, side) ближайшего детектированного квадрата или расчётные координаты."""
        nonlocal snapped_count
        best = None
        best_d = snap_r
        for c in raw_cells:
            d = math.hypot(c[0] - cx_calc, c[1] - cy_calc)
            if d < best_d:
                best_d = d
                best = c
        if best is not None:
            snapped_count += 1
            # best = (cx, cy, cw, ch, side) — берём реальный размер квадрата
            return best[0], best[1], best[4]
        return int(cx_calc), int(cy_calc), cell_size_med

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
            row = []
            for oi in range(options_count):
                cx_calc = sq_x_first + oi * sq_step
                cx_s, cy_s, side_s = _snap(cx_calc, cy_cell)
                # Передаём ПОЛНЫЙ размер квадрата — _darkness сам возьмёт 80% центра
                cw_read = max(10, int(side_s))
                row.append((int(cx_s), int(cy_s), cw_read, cw_read, sq_step))
            answer_rows_cells.append(row)

    # Координаты первой строки для отладки
    _r0 = answer_rows_cells[0] if answer_rows_cells else []
    _r0_coords = [(c[0], c[1]) for c in _r0]
    _sq_x_start_dbg = next((v for v in sq_x_start_per_sec if v is not None), None)
    _sq_x_start_dbg = int(_sq_x_start_dbg) if _sq_x_start_dbg is not None else -1
    dbg_rows_dist = ["geometry_grid", len(answer_rows_cells),
                     f"raw={len(raw_cells)}", f"grid={int(grid_w)}x{int(grid_h)}",
                     f"sq_step={round(sq_step,1)}", f"row_step={round(row_step,1)}",
                     f"grid_x0={int(grid_x0)}", f"grid_y0={int(grid_y0)}",
                     f"sq_x_start={_sq_x_start_dbg}", f"cell_w={cell_w}",
                     f"snapped={snapped_count}/{questions_count*options_count}",
                     f"corners={dbg_corners}",
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
        # Помеченный квадрат: ≥7% тёмных пикселей И заметный разрыв с остальными
        is_marked = max_f > 0.07 and (gap > 0.03 or norm_gap > 0.18)
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
                # col_centers_x — ЦЕНТРЫ колонок (по детектированным кружкам)
                col_centers_x = col_xs
                circ_x0 = col_xs[0] - step_x / 2
                circ_w  = step_x * n_cols_code
            else:
                num_frac_c = 0.125
                circ_x0 = c_inner_x0 + c_w * num_frac_c
                circ_w  = c_w * (1.0 - num_frac_c)
                step_x  = circ_w / n_cols_code
                col_centers_x = [circ_x0 + col_i * step_x + step_x / 2 for col_i in range(n_cols_code)]
            # Y-калибровка: строим РАВНОМЕРНУЮ сетку из 5 строк между крайними
            # детектированными кружками. Допуск кластера = радиус (строки кода
            # разнесены минимум на 2 радиуса, внутри строки кружки на одной Y).
            ys_c = sorted([c[1] for c in detected_circles])
            y_cls_c = []
            for y in ys_c:
                placed = False
                for cl in y_cls_c:
                    if abs(np.mean(cl) - y) <= r_med * 1.5:
                        cl.append(y); placed = True; break
                if not placed:
                    y_cls_c.append([y])
            # Кластеры с достаточным числом кружков = реальные строки
            real_rows = sorted([float(np.mean(cl)) for cl in y_cls_c if len(cl) >= 3])
            if len(real_rows) >= 2:
                y_top = real_rows[0]
                y_bot = real_rows[-1]
                # Если нашли не все 5 строк — экстраполируем равномерно по шагу
                if len(real_rows) >= n_rows_code:
                    row_centers_y = real_rows[:n_rows_code]
                else:
                    span = y_bot - y_top
                    # шаг по найденным крайним строкам (предполагаем равные интервалы)
                    est_step = span / (len(real_rows) - 1)
                    row_centers_y = [y_top + i * est_step for i in range(n_rows_code)]
                step_y = float(np.median(np.diff(row_centers_y))) if len(row_centers_y) > 1 else 40.0
                circ_y_start = row_centers_y[0]
            else:
                step_y = c_h / n_rows_code if c_h > 0 else 40
                circ_y_start = c_y0 + step_y / 2
                row_centers_y = [circ_y_start + ri * step_y for ri in range(n_rows_code)]
            r_est = max(3, int(r_med))
            dbg_code["y_clusters"] = len(y_cls_c)
            dbg_code["real_rows"] = len(real_rows)
        else:
            # Фоллбэк — геометрия
            num_frac_c = 0.125
            circ_x0 = c_inner_x0 + c_w * num_frac_c
            circ_w  = c_w * (1.0 - num_frac_c)
            step_x  = circ_w / n_cols_code
            step_y  = c_h / n_rows_code if c_h > 0 else 40
            circ_y_start = c_y0 + step_y / 2
            r_est   = max(3, int(min(step_x, step_y) * 0.38))
            col_centers_x = [circ_x0 + col_i * step_x + step_x / 2 for col_i in range(n_cols_code)]
            row_centers_y = [circ_y_start + ri * step_y for ri in range(n_rows_code)]

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
            cx_s = int(col_centers_x[col_i]) if col_i < len(col_centers_x) else int(circ_x0 + col_i * step_x + step_x / 2)
            cy_s = int(row_centers_y[0]) if row_centers_y else int(c_y0 + step_y / 2)
            if 0 <= cy_s < h and 0 <= cx_s < w:
                _first_row_pixels.append(int(gray[cy_s, cx_s]))
        dbg_code["pixel_samples"] = _first_row_pixels

        # Для кружков: порог = 70% от медианы фона (фон ~138, кружки ~30-50)
        code_zone_pixels = gray[c_y0:c_y1, int(circ_x0):int(circ_x0 + circ_w)]
        code_bg = float(np.median(code_zone_pixels)) if code_zone_pixels.size > 0 else 160
        thr_code = max(60, min(160, int(code_bg * 0.70)))

        # Окно поиска заливки: ищем самое тёмное пятно вокруг расчётного центра.
        # Это устойчиво к небольшому смещению сетки кружков.
        search_r = max(int(r_est * 0.9), int(min(step_x, step_y) * 0.40))
        read_r   = max(3, int(r_est * 0.6))
        all_rows_minbright = []
        all_rows_pick = []
        for row_i in range(n_rows_code):
            cy_c = int(row_centers_y[row_i]) if row_i < len(row_centers_y) else int(circ_y_start + row_i * step_y)
            raw_vals = []
            for col_i in range(n_cols_code):
                cx_c = int(col_centers_x[col_i]) if col_i < len(col_centers_x) else int(circ_x0 + col_i * step_x + step_x / 2)
                # Зона поиска вокруг центра
                sx1 = max(0, cx_c - search_r); sy1 = max(0, cy_c - search_r)
                sx2 = min(w, cx_c + search_r); sy2 = min(h, cy_c + search_r)
                if sx2 <= sx1 or sy2 <= sy1:
                    raw_vals.append(255.0); continue
                area = gray[sy1:sy2, sx1:sx2]
                # Сглаживаем, чтобы минимум брался по пятну, а не по одному пикселю
                area_blur = cv2.blur(area, (read_r, read_r))
                # Самое тёмное пятно в зоне поиска = яркость заливки (если есть)
                raw_vals.append(float(np.min(area_blur)))
            if not raw_vals:
                code += "?"; code_confs.append(0.0); continue
            min_v   = min(raw_vals)
            max_v   = max(raw_vals)
            row_bg  = max_v  # самый светлый = фон
            d_vals  = [max(0.0, (row_bg - v) / max(row_bg - min_v, 1.0)) for v in raw_vals]
            best_i  = int(np.argmax(d_vals))
            best_f  = d_vals[best_i]
            sorted_d = sorted(d_vals, reverse=True)
            second  = sorted_d[1] if len(sorted_d) > 1 else 0.0
            gap_c   = best_f - second
            # Закрашенный кружок: абсолютно тёмный (<110) И заметно темнее фона строки
            darkness_abs = row_bg - raw_vals[best_i]
            picked = "?"
            if raw_vals[best_i] < 120 and darkness_abs > 25 and gap_c > 0.30:
                picked = str(best_i)
                code += str(best_i)
                code_confs.append(round(min(0.99, gap_c * 0.8 + 0.2), 2))
            else:
                code += "?"; code_confs.append(0.0)
            all_rows_minbright.append(round(min_v, 1))
            all_rows_pick.append(picked)
            if row_i == 0:
                dbg_code["row0_fills"]    = [round(v, 3) for v in d_vals]
                dbg_code["row0_raw"]      = [round(v, 1) for v in raw_vals]
                dbg_code["row0_darkness"] = round(darkness_abs, 1)
                dbg_code["row0_minbright"] = round(raw_vals[best_i], 1)
                dbg_code["thr_code"]      = thr_code
        dbg_code["rows_minbright"] = all_rows_minbright
        dbg_code["rows_pick"] = all_rows_pick
        dbg_code["row_centers_y"] = [int(y) for y in row_centers_y]
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