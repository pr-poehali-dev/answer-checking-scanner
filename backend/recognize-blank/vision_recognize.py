"""
Распознавание бланка ответов на базе Yandex Vision OCR.

Алгоритм (как читает человек):
  1. Vision OCR отдаёт координаты всего напечатанного текста;
  2. в самом верху находим ШАПКУ с буквами вариантов: А Б В Г Д — их X-центры
     задают колонки ответов (на бланке может быть 1–3 блока вопросов, тогда
     шапок тоже несколько — они на одной высоте, разделены по X);
  3. слева находим номера вопросов (1, 2, 3 …) — их Y-центры задают строки.
     Часть номеров OCR может не увидеть (тень, наклон) — недостающие строки
     достраиваем по равномерному шагу остальных;
  4. на пересечении строки и колонки смотрим, насколько клетка закрашена;
  5. самая тёмная клетка строки — ответ ученика. Поднимаемся от неё вверх
     к букве в шапке — это и есть буква ответа.

Сам OCR «крестики» не читает — закрашенность определяется по пикселям.
"""
import re
import numpy as np

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]

# OCR часто путает визуально одинаковые латиницу и кириллицу: А↔A, В↔B, Е↔E
_LAT_TO_RU = {"A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К",
              "M": "М", "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У"}


def _norm_letter(s: str) -> str:
    s = (s or "").strip().upper()
    return _LAT_TO_RU.get(s, s)


def _cluster(values: list, tol: float) -> list:
    """Группирует близкие координаты, возвращает центры групп."""
    if not values:
        return []
    vals = sorted(values)
    groups = [[vals[0]]]
    for v in vals[1:]:
        if v - groups[-1][-1] <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [float(np.mean(g)) for g in groups]


def blocks_count(questions_count: int) -> int:
    """Сколько колонок вопросов на бланке — правило генератора бланков."""
    return 1 if questions_count <= 15 else (2 if questions_count <= 40 else 3)


def find_columns_by_numbers(q_rows: dict, questions_count: int,
                            options_count: int, n_blocks: int,
                            header_xs: list) -> list:
    """X-центры колонок вариантов, отсчитанные от номеров вопросов.

    Буквы вариантов OCR видит плохо: в закрашенных кружках их не разобрать,
    а в пустых они слишком мелкие. Зато номера вопросов (1, 2, 3 …) читаются
    стабильно — и на бланке кружки всегда идут сразу правее номера с равным
    шагом. Поэтому колонки строим от номера:
        x_варианта_i = x_номера + отступ + i × шаг

    Шаг берём из шапки, если её удалось распознать, иначе — из расстояния
    между блоками вопросов (геометрия бланка фиксирована генератором).
    """
    rows_per_block = int(np.ceil(questions_count / n_blocks))

    # Левый край номеров в каждом блоке
    block_num_x = {}
    for q, (cx, _) in q_rows.items():
        b = (q - 1) // rows_per_block
        block_num_x.setdefault(b, []).append(cx)
    if not block_num_x:
        return []
    num_x = {b: float(np.median(xs)) for b, xs in block_num_x.items()}

    # Шаг между вариантами: берём из шапки (самый надёжный источник),
    # иначе — из расстояния между блоками, поделённого на число колонок.
    step = None
    if len(header_xs) >= 2:
        d = np.diff(sorted(header_xs))
        good = [v for v in d if v > 1]
        if good:
            step = float(np.median(good))
    if step is None and len(num_x) >= 2:
        bxs = sorted(num_x.values())
        block_gap = float(np.median(np.diff(bxs)))
        # В блоке: номер + options_count кружков, кружки занимают ~85% ширины
        step = block_gap * 0.85 / options_count
    if step is None:
        return []

    # Если шапка распозналась — её X это РЕАЛЬНЫЕ центры колонок, они точнее
    # любого расчёта от номера. Разбиваем их по блокам (левее/правее середины
    # между номерами блоков) и достраиваем недостающие колонки по шагу.
    blocks = []
    for b in range(n_blocks):
        if b not in num_x:
            blocks.append(None)
            continue
        # Колонки этого блока: X правее его номера, но левее номера следующего
        x_lo = num_x[b]
        x_hi = num_x.get(b + 1, float("inf"))
        mine = sorted(x for x in header_xs if x_lo < x < x_hi)
        if mine:
            # Опорная точка — первая реальная колонка. Её индекс определяем по
            # расстоянию от номера: между номером и «А» ровно один шаг.
            idx0 = int(round((mine[0] - (x_lo + step)) / step))
            idx0 = max(0, min(idx0, options_count - 1))
            x_first = mine[0] - idx0 * step
        else:
            x_first = x_lo + step
        blocks.append([x_first + i * step for i in range(options_count)])
    return blocks


def find_header_columns(words: list, options_count: int, img_w: int) -> list:
    """X-центры букв шапки (А Б В Г Д) — источник шага между вариантами.

    Возвращает плоский список X всех найденных букв вариантов.
    """
    opts = set(RU_OPTS[:options_count])
    xs = [w["cx"] for w in words
          if len(_norm_letter(w["text"])) == 1 and _norm_letter(w["text"]) in opts]
    if len(xs) < 2:
        return []
    return _cluster(sorted(xs), max(8.0, img_w * 0.015))


def find_question_rows(words: list, questions_count: int) -> dict:
    """Y-центры строк по напечатанным номерам вопросов. {номер: (cx, cy)}

    Номера вопросов на бланке всегда с точкой («1.», «2.») — по этому признаку
    отсекаем цифры из шапки, футера и подписей, которые иначе перекосили бы
    сетку строк. Если формат с точкой нигде не встретился (плохое качество
    печати) — принимаем и голые цифры.
    """
    def collect(require_dot: bool) -> dict:
        found = {}
        for w in words:
            txt = (w["text"] or "").strip()
            m = re.fullmatch(r"(\d{1,2})[.)]" if require_dot else r"(\d{1,2})[.)]?", txt)
            if not m:
                continue
            num = int(m.group(1))
            if not (1 <= num <= questions_count):
                continue
            prev = found.get(num)
            if prev is None or w["cx"] < prev[0]:   # при дубле берём самый левый
                found[num] = (w["cx"], w["cy"])
        return found

    strict = collect(True)
    # Нужна хотя бы половина номеров, иначе фолбэк на мягкий разбор
    return strict if len(strict) >= questions_count * 0.4 else collect(False)


def build_row_ys(q_rows: dict, questions_count: int, n_blocks: int) -> dict:
    """Достраивает Y для строк, чьи номера OCR не распознал.

    Вопросы на бланке идут по колонкам: 1..10 в первой, 11..20 во второй.
    Внутри блока строки идут с равным шагом, поэтому по нескольким найденным
    номерам восстанавливаем положение всех остальных.
    """
    rows_per_block = int(np.ceil(questions_count / n_blocks))
    result = {}
    for b in range(n_blocks):
        pts = []
        for q, (_, cy) in q_rows.items():
            if (q - 1) // rows_per_block == b:
                pts.append(((q - 1) % rows_per_block, cy))
        if not pts:
            continue
        if len(pts) == 1:
            r0, y0 = pts[0]
            result[(b, r0)] = y0
            continue

        # Отбрасываем выбросы: OCR иногда принимает за номер вопроса цифру из
        # шапки, футера или QR-зоны. Такая точка выпадает из общего ряда и
        # перекашивает всю сетку строк. Настоящие номера лежат на прямой:
        # шаг между соседними строками одинаковый, поэтому оцениваем шаг по
        # МЕДИАНЕ разностей (устойчива к выбросам) и оставляем только те точки,
        # что укладываются в эту прямую.
        pts = sorted(pts)
        rows_a = np.array([p[0] for p in pts], dtype=float)
        ys_a = np.array([p[1] for p in pts], dtype=float)
        if len(pts) >= 3:
            d_rows = np.diff(rows_a)
            d_ys = np.diff(ys_a)
            steps = [dy / dr for dy, dr in zip(d_ys, d_rows) if dr > 0]
            if steps:
                step = float(np.median(steps))
                # Опорная точка — медианная по остаткам (cy - row * step)
                offsets = ys_a - rows_a * step
                base = float(np.median(offsets))
                keep = np.abs(offsets - base) <= max(step * 0.6, 12.0)
                if keep.sum() >= 2:
                    rows_a, ys_a = rows_a[keep], ys_a[keep]

        # Линейная аппроксимация по очищенным точкам: cy = a * row + c
        a, c = np.polyfit(rows_a, ys_a, 1)
        for r in range(rows_per_block):
            result[(b, r)] = float(a * r + c)
    return result


def _cell_mean(gray, cx: float, cy: float, size: float) -> float:
    """Средняя яркость центра клетки (0 — чёрное, 255 — белое).

    Берём 55% центра: закрашивание попадает целиком, а тонкая рамка кружка и
    серая печатная буква у края — нет.
    """
    cx = int(round(cx)); cy = int(round(cy))
    sz = max(6, int(size * 0.55))
    x1 = max(0, cx - sz // 2); y1 = max(0, cy - sz // 2)
    x2 = min(gray.shape[1], cx + sz // 2); y2 = min(gray.shape[0], cy + sz // 2)
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 255.0
    return float(np.mean(roi))


def recognize_from_ocr(gray, words: list, questions_count: int,
                       options_count: int) -> dict:
    """Определяет ответы ученика по координатам OCR + закрашенности клеток."""
    h, w = gray.shape[:2]
    opts = RU_OPTS[:options_count]
    n_blocks = blocks_count(questions_count)
    rows_per_block = int(np.ceil(questions_count / n_blocks))

    q_rows = find_question_rows(words, questions_count)
    row_ys = build_row_ys(q_rows, questions_count, n_blocks)
    header_xs = find_header_columns(words, options_count, w)
    col_blocks = find_columns_by_numbers(q_rows, questions_count,
                                         options_count, n_blocks, header_xs)

    answers = [""] * questions_count
    confidences = [0.0] * questions_count

    dbg = {
        "blocks": [[round(x) for x in b] if b else None for b in col_blocks],
        "q_nums": {q: round(v[1]) for q, v in sorted(q_rows.items())},
        "header_xs": [round(x) for x in header_xs],
    }

    if not col_blocks or not row_ys:
        return {"answers": answers, "confidences": confidences,
                "rows_found": len(q_rows), "cols_found": 0, "dbg": dbg}

    # Размер клетки = шаг между колонками вариантов
    steps = []
    for cols in col_blocks:
        if cols and len(cols) >= 2:
            steps.extend(np.diff(sorted(cols)).tolist())
    cell_size = float(np.median(steps)) if steps else w * 0.03
    cell_size = max(10.0, min(cell_size, w * 0.08))

    sample_dbg = []
    for q in range(1, questions_count + 1):
        b = (q - 1) // rows_per_block
        r = (q - 1) % rows_per_block
        if b >= len(col_blocks) or not col_blocks[b]:
            continue
        cy = row_ys.get((b, r))
        if cy is None:
            continue
        cols = sorted(col_blocks[b])

        means = [_cell_mean(gray, x, cy, cell_size) for x in cols]
        darkest_i = int(np.argmin(means))
        darkest = means[darkest_i]
        others = [m for i, m in enumerate(means) if i != darkest_i]
        bg = float(np.median(others)) if others else 255.0

        # Клетка закрашена, если она СУЩЕСТВЕННО темнее остальных в своей
        # строке. Сравнение относительное — не зависит от освещения и теней.
        if bg > 0 and darkest < bg * 0.72 and darkest < 190:
            answers[q - 1] = opts[darkest_i]
            confidences[q - 1] = round(min(1.0, (bg - darkest) / max(bg, 1.0)), 3)

        if q <= 3:
            sample_dbg.append({"q": q, "cy": round(cy),
                               "means": [round(m) for m in means]})

    dbg["cell_size"] = round(cell_size, 1)
    dbg["sample"] = sample_dbg
    return {
        "answers": answers,
        "confidences": confidences,
        "rows_found": len(q_rows),
        "cols_found": sum(len(c) for c in col_blocks if c),
        "dbg": dbg,
    }