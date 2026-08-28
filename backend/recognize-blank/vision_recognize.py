"""
Распознавание бланка ответов на базе Yandex Vision OCR (рукописный формат).

Бланк: сверху 5 клеток с кодом ученика, ниже пары «номер вопроса → клетка»,
в которую ученик ОТ РУКИ вписывает букву ответа (А, Б, В, Г, Д).

Vision OCR (модель handwritten) читает и печатный текст, и рукописный, отдавая
координаты каждого распознанного символа. Задача модуля — разложить эти
символы по смыслу:

  1. находим номера вопросов «1.», «2.» … — они задают строки;
  2. правее каждого номера ищем ОДИНОЧНУЮ букву — это ответ ученика;
  3. буква Z (латинская) означает «вопроса не было» — ответ не засчитывается;
  4. код ученика — 5 цифр в верхней части листа, выше строк с вопросами.

Принимаются ТОЛЬКО буквы из диапазона работы: если вариантов 4, засчитываются
А/Б/В/Г, а случайно прочитанная «Д» отбрасывается как ошибка распознавания.
"""
import re
import numpy as np

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]

# OCR легко путает визуально одинаковые латиницу и кириллицу — приводим к русским.
_LAT_TO_RU = {
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К", "M": "М",
    "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У",
}

# Частые ошибки чтения РУКОПИСНЫХ букв бланка.
# Ключ — что увидел OCR, значение — что имел в виду ученик.
_HANDWRITTEN_FIX = {
    # А
    "А": "А", "A": "А", "Л": "А", "^": "А",
    # Б
    "Б": "Б", "6": "Б",
    # В — латинская «B» выглядит как русская «В» (не «Б»)
    "В": "В", "B": "В", "Β": "В", "8": "В",
    # Г — узкий угол, распознаётся как похожие по форме символы.
    # «Е» и «П» сюда НЕ добавляем: они чаще оказываются другой буквой.
    "Г": "Г", "Т": "Г", "L": "Г", "F": "Г", "Ґ": "Г", "Г": "Г",
    # Д
    "Д": "Д", "D": "Д", "Ц": "Д",
    # Е (если работа на 6 вариантов)
    "Э": "Е",
}

# Многосимвольные ошибки чтения: OCR иногда «склеивает» рукописную букву
# с рамкой клетки и возвращает пару символов.
_MULTI_FIX = {
    "CO": "Г", "СО": "Г", "GO": "Г", "ГО": "Г",
    "TO": "Г", "ТО": "Г", "IO": "Г",
    "БО": "Б", "ВО": "В", "АО": "А",
}

# Пропуск вопроса: ученик ставит латинскую Z в лишние клетки.
# Кириллическая «З» — та же буква на вид. Цифры сюда добавлять НЕЛЬЗЯ:
# рукописная «Б» тоже читается как цифра, и ответы начнут теряться.
SKIP_MARKS = {"Z", "З", "ℤ"}


def _norm_char(s: str) -> str:
    s = (s or "").strip().upper()
    return _LAT_TO_RU.get(s, s)


# Символы, которые OCR подставляет вместо цифр кода ученика
_DIGIT_FIX = {"O": "0", "О": "0", "D": "0", "Q": "0",
              "I": "1", "L": "1", "|": "1",
              "Z": "2", "S": "5", "B": "8", "G": "6"}


def _digits_only(text: str) -> str:
    """Приводит фрагмент кода ученика к цифрам.

    Ноль часто распознаётся как буква «O», единица — как «I»: без замены
    последняя цифра кода просто терялась.
    """
    raw = (text or "").strip().upper()
    if not raw or len(raw) > 6:
        return ""
    out = "".join(_DIGIT_FIX.get(ch, ch) for ch in raw)
    return out if out.isdigit() else ""


def find_question_rows(words: list, questions_count: int) -> dict:
    """Номера вопросов: {номер: (x_левый, y_центр, x_правый)}.

    Номер на бланке всегда с точкой («1.», «2.») — по этому признаку отсекаем
    посторонние цифры (код ученика, номер работы, подписи).
    """
    def collect(require_dot: bool) -> dict:
        found = {}
        for w in words:
            txt = (w["text"] or "").strip()
            pat = r"(\d{1,2})\s*[.)]" if require_dot else r"(\d{1,2})\s*[.)]?"
            m = re.fullmatch(pat, txt)
            if not m:
                continue
            num = int(m.group(1))
            if not (1 <= num <= questions_count):
                continue
            prev = found.get(num)
            if prev is None or w["x0"] < prev[0]:
                found[num] = (w["x0"], w["cy"], w["x1"])
        return found

    strict = collect(True)
    if len(strict) >= max(2, questions_count * 0.3):
        return strict
    return collect(False)


def find_student_code(words: list, rows_top_y: float, code_len: int = 5) -> str:
    """Код ученика — цифры в шапке бланка, выше строк с вопросами.

    Клетки кода стоят в один ряд, поэтому собираем цифры с близким Y и
    выстраиваем их слева направо.
    """
    digits = []
    for w in words:
        txt = _digits_only(w["text"])
        if not txt:
            continue
        if rows_top_y and w["cy"] >= rows_top_y - 2:
            continue
        digits.append(dict(w, text=txt))
    if not digits:
        return ""

    digits.sort(key=lambda w: w["cy"])
    rows, current = [], [digits[0]]
    for w in digits[1:]:
        tol = max(8.0, (w["y1"] - w["y0"]) * 0.8)
        if abs(w["cy"] - current[-1]["cy"]) <= tol:
            current.append(w)
        else:
            rows.append(current)
            current = [w]
    rows.append(current)

    def row_score(row):
        """Ряд кода: цифры стоят в отдельных клетках — значит их несколько,
        они крупные и суммарно дают примерно длину кода. Номер работы
        («№000001») — это одно мелкое слово, поэтому проигрывает."""
        total = sum(len(w["text"]) for w in row)
        avg_h = float(np.mean([w["y1"] - w["y0"] for w in row])) or 1.0
        # Чем ближе к длине кода и чем крупнее шрифт — тем лучше
        return (abs(total - code_len), -len(row), -avg_h)

    best = sorted(rows, key=row_score)[0]
    best.sort(key=lambda w: w["cx"])
    code = re.sub(r"\D", "", "".join(w["text"] for w in best))
    return code[:code_len]


def _pick_answer(tokens: list, opts_set: set) -> tuple:
    """Из символов справа от номера выбирает букву ответа.

    Возвращает (буква, уверенность). Пустая строка — ответа нет либо ученик
    пометил вопрос как лишний (Z).
    """
    for t in tokens:
        raw = (t["text"] or "").strip().upper()
        if not raw:
            continue
        if raw in SKIP_MARKS or _norm_char(raw) in SKIP_MARKS:
            return "", 0.0
        if len(raw) != 1:
            continue
        ch = _HANDWRITTEN_FIX.get(raw) or _norm_char(raw)
        if ch in opts_set:
            return ch, 1.0
    return "", 0.0


def _norm_answer(raw: str, opts_set: set):
    """Приводит распознанный символ к букве ответа.

    Возвращает (буква, это_пропуск). Буква пустая — символ не подошёл.
    """
    raw = (raw or "").strip().upper()
    if not raw:
        return "", False
    if raw in SKIP_MARKS or _norm_char(raw) in SKIP_MARKS:
        return "", True
    if len(raw) == 1:
        ch = _HANDWRITTEN_FIX.get(raw) or _norm_char(raw)
    else:
        ch = _MULTI_FIX.get(raw, "")
    return (ch, False) if ch in opts_set else ("", False)


def answers_from_lines(lines: list, questions_count: int, opts_set: set) -> dict:
    """Разбирает строки бланка по шаблону «номер вопроса → буква ответа».

    Строка на бланке выглядит как «1.  А   11.  Д»: сразу за номером вопроса
    идёт ответ ученика. Такой разбор устойчив к наклону фото и неточным
    координатам, потому что опирается на порядок слов внутри строки.

    Возвращает {номер вопроса: буква}. Пропуск (Z) даёт пустую строку.
    """
    found = {}
    for items in lines:
        # Разворачиваем строку в плоский список токенов: «11.» и «Д» могли
        # склеиться в одно слово, поэтому дополнительно режем по пробелам.
        tokens = []
        for w in items:
            for part in re.split(r"\s+", (w["text"] or "").strip()):
                if part:
                    tokens.append(part)

        i = 0
        while i < len(tokens):
            m = re.fullmatch(r"(\d{1,2})\s*[.)]", tokens[i])
            if not m:
                i += 1
                continue
            q = int(m.group(1))
            if not (1 <= q <= questions_count) or q in found:
                i += 1
                continue
            # Ответ — первый подходящий символ после номера, но не дальше
            # следующего номера вопроса
            j = i + 1
            while j < len(tokens) and not re.fullmatch(r"\d{1,2}\s*[.)]", tokens[j]):
                ch, is_skip = _norm_answer(tokens[j], opts_set)
                if is_skip:
                    found[q] = ""
                    break
                if ch:
                    found[q] = ch
                    break
                j += 1
            i += 1
    return found


def _build_grid(q_rows: dict, questions_count: int, n_cols: int,
                rows_per_col: int, line_h: float) -> dict:
    """Восстанавливает координаты клетки ответа для КАЖДОГО вопроса.

    OCR распознаёт лишь часть номеров, но бланк печатается по строгой сетке:
    внутри колонки строки идут с одинаковым шагом, а колонки равномерно
    смещены вправо. Поэтому по нескольким найденным номерам достраиваем
    положение всех остальных клеток.

    Возвращает {номер вопроса: (x центра клетки ответа, y строки)}.
    """
    if not q_rows:
        return {}

    # Раскладываем найденные номера по колонкам бланка
    per_col = {}
    for q, (x0, cy, x1) in q_rows.items():
        col = (q - 1) // rows_per_col
        row = (q - 1) % rows_per_col
        per_col.setdefault(col, []).append((row, x0, cy, x1))

    # Шаг строки — общий для всего бланка, оцениваем по самой полной колонке
    steps = []
    for pts in per_col.values():
        pts.sort()
        for (r1, _, y1, _), (r2, _, y2, _) in zip(pts, pts[1:]):
            if r2 > r1:
                steps.append((y2 - y1) / (r2 - r1))
    step = float(np.median(steps)) if steps else line_h * 2.2
    if step <= 0:
        step = line_h * 2.2

    # Смещение между колонками — по разнице X у известных колонок
    col_x = {}
    for col, pts in per_col.items():
        col_x[col] = float(np.median([x1 for _, _, _, x1 in pts]))
    if len(col_x) >= 2:
        keys = sorted(col_x)
        dx = float(np.median([(col_x[b] - col_x[a]) / (b - a)
                              for a, b in zip(keys, keys[1:])]))
    else:
        dx = 0.0

    grid = {}
    for col in range(n_cols):
        pts = per_col.get(col)
        if pts:
            rows = np.array([p[0] for p in pts], dtype=float)
            ys = np.array([p[2] for p in pts], dtype=float)
            if len(pts) >= 2:
                a, b = np.polyfit(rows, ys, 1)
            else:
                a, b = step, ys[0] - rows[0] * step
            x_right = col_x[col]
        else:
            # Колонку OCR не увидел совсем — достраиваем от известной соседней
            if not col_x:
                continue
            base = min(col_x, key=lambda k: abs(k - col))
            ref = per_col[base]
            rows = np.array([p[0] for p in ref], dtype=float)
            ys = np.array([p[2] for p in ref], dtype=float)
            if len(ref) >= 2:
                a, b = np.polyfit(rows, ys, 1)
            else:
                a, b = step, ys[0] - rows[0] * step
            x_right = col_x[base] + dx * (col - base)

        for r in range(rows_per_col):
            q = col * rows_per_col + r + 1
            if q > questions_count:
                break
            # Центр клетки ответа — примерно на ширину клетки правее номера
            grid[q] = (x_right + line_h * 1.15, float(a * r + b))
    return grid


def recognize_from_ocr(gray, words: list, questions_count: int,
                       options_count: int, chars: list = None,
                       lines: list = None) -> dict:
    """Собирает ответы ученика и его код из распознанного текста.

    words — распознанные слова (по ним ищем номера вопросов и код ученика);
    chars — те же данные посимвольно (OCR склеивает буквы соседних колонок);
    lines — строки бланка: основной способ разбора «номер → буква».
    """
    letters_src = chars if chars else words
    opts = RU_OPTS[:options_count]
    opts_set = set(opts)

    q_rows = find_question_rows(words, questions_count)

    answers = [""] * questions_count
    confidences = [0.0] * questions_count
    dbg = {"q_nums": sorted(q_rows.keys()), "words": len(words)}

    # ── Способ 1 (основной): разбор строк «номер вопроса → буква ответа» ─────
    # Порядок слов внутри строки OCR сохраняет даже на кривом фото, поэтому
    # этот способ точнее сопоставления по координатам.
    from_lines = answers_from_lines(lines or [], questions_count, opts_set) if lines else {}
    for q, ch in from_lines.items():
        if ch:
            answers[q - 1] = ch
            confidences[q - 1] = 1.0
    dbg["by_lines"] = len(from_lines)

    if not q_rows:
        code = find_student_code(words, 0)
        return {"answers": answers, "confidences": confidences, "code": code,
                "rows_found": 0, "cols_found": 0, "dbg": dbg}

    heights = [w["y1"] - w["y0"] for w in words if w["y1"] > w["y0"]]
    line_h = float(np.median(heights)) if heights else 12.0

    # ── Восстанавливаем ПОЛНУЮ сетку бланка ──────────────────────────────────
    # OCR видит не все номера (часть сливается с рамкой клетки), поэтому по
    # найденным номерам достраиваем положение остальных: внутри колонки строки
    # идут с равным шагом, а колонки равномерно смещены по горизонтали.
    n_cols = 1 if questions_count <= 8 else (2 if questions_count <= 24 else 3)
    rows_per_col = int(np.ceil(questions_count / n_cols))

    grid = _build_grid(q_rows, questions_count, n_cols, rows_per_col, line_h)
    dbg["grid_rows"] = len(grid)

    if not grid:
        rows_top = min(cy for _, cy, _ in q_rows.values())
        code = find_student_code(words, rows_top)
        dbg["code"] = code
        return {"answers": answers, "confidences": confidences, "code": code,
                "rows_found": len(q_rows), "cols_found": 0, "dbg": dbg}

    # Все одиночные символы-кандидаты в ответы (буквы и метки пропуска)
    # Всё, что выше первой строки вопросов — это шапка бланка (в т.ч. подсказка
    # «Впишите букву: А Б В Г Д»). Её буквы не должны попасть в ответы.
    grid_top = min(y for _, y in grid.values())
    cand = []
    for w in letters_src:
        raw = (w["text"] or "").strip().upper()
        if not raw or len(raw) > 2:
            continue
        if w["cy"] < grid_top - line_h * 1.2:
            continue
        if raw in SKIP_MARKS or _norm_char(raw) in SKIP_MARKS:
            cand.append((w, "", True))       # пропуск вопроса
            continue
        if len(raw) == 1:
            ch = _HANDWRITTEN_FIX.get(raw) or _norm_char(raw)
        else:
            # Пара символов — вероятно, буква склеилась с рамкой клетки
            ch = _MULTI_FIX.get(raw, "")
        if ch in opts_set:
            cand.append((w, ch, False))

    # Каждую букву относим к ближайшей ячейке сетки: ответ стоит в клетке
    # СПРАВА от своего номера, поэтому сравниваем с ожидаемой точкой ответа.
    # Допуски считаем от РЕАЛЬНОГО шага строк бланка: line_h усредняется по
    # всему тексту (включая мелкие подписи) и для этого не годится.
    ys_sorted = sorted(y for _, y in grid.values())
    row_steps = [b - a for a, b in zip(ys_sorted, ys_sorted[1:]) if b - a > 1]
    row_step = float(np.median(row_steps)) if row_steps else line_h * 2.2
    y_tol = row_step * 0.45          # не залезаем в соседнюю строку

    # По горизонтали нельзя перепрыгнуть в соседнюю колонку бланка
    col_xs = sorted({round(x) for x, _ in grid.values()})
    col_gap = min(np.diff(col_xs)) if len(col_xs) > 1 else None
    x_tol = float(col_gap) * 0.42 if col_gap else max(row_step * 1.2, line_h * 3)

    # Калибровка по X: расчётный центр клетки — лишь оценка. Считаем типичное
    # смещение по строкам, где кандидат ровно один (значит, сомнений нет), и
    # сдвигаем всю сетку — так учитывается наклон и масштаб конкретного фото.
    offsets = []
    for _q, (ans_x, ans_y) in grid.items():
        same_row = [w for w, _, _ in cand if abs(w["cy"] - ans_y) <= y_tol]
        if len(same_row) == 1:
            offsets.append(same_row[0]["cx"] - ans_x)
    if len(offsets) >= 2:
        shift = float(np.median(offsets))
        if abs(shift) < x_tol:
            grid = {q: (x + shift, y) for q, (x, y) in grid.items()}
            dbg["x_shift"] = round(shift, 1)

    # Глобальное сопоставление: перебираем ВСЕ пары «клетка ↔ буква» от самой
    # близкой к самой далёкой. Иначе первый по счёту вопрос мог перехватить
    # букву, которая на самом деле относится к соседней колонке.
    pairs = []
    for q, (ans_x, ans_y) in grid.items():
        for i, (w, ch, is_skip) in enumerate(cand):
            dx = abs(w["cx"] - ans_x)
            dy = abs(w["cy"] - ans_y)
            if dy > y_tol or dx > x_tol:
                continue
            pairs.append((dy * 2.0 + dx, q, i, ch, is_skip))
    pairs.sort(key=lambda p: p[0])

    # Строчный разбор уже дал ответы — координатный лишь ДОПОЛНЯЕТ пропуски,
    # чтобы не перетереть более надёжный результат.
    used_cand, used_q = set(), set(from_lines.keys())
    for _, q, i, ch, is_skip in pairs:
        if q in used_q or i in used_cand:
            continue
        used_q.add(q); used_cand.add(i)
        if not is_skip and ch:
            answers[q - 1] = ch
            confidences[q - 1] = 0.8
    dbg["cand"] = [(c[1] or "Z", round(c[0]["cx"]), round(c[0]["cy"])) for c in cand]
    dbg["row_step"] = round(row_step, 1)
    dbg["grid"] = {q: (round(x), round(y)) for q, (x, y) in sorted(grid.items())}

    # Хвост из пропусков: если ученик пометил лишние вопросы буквой Z, они идут
    # подряд до конца работы. Одиночная «буква» внутри такого хвоста — это
    # неверно прочитанная Z, а не ответ: убираем её, чтобы не завышать оценку.
    skip_qs = set()
    for _d, q, i, _ch, is_skip in pairs:
        if is_skip and q in used_q and i in used_cand:
            skip_qs.add(q)
    if skip_qs:
        first_skip = min(skip_qs)
        tail = list(range(first_skip, questions_count + 1))
        # Хвост засчитываем, только если пропусков в нём заметно больше ответов
        skips_in_tail = len([q for q in tail if q in skip_qs])
        if skips_in_tail >= max(2, len(tail) * 0.6):
            for q in tail:
                answers[q - 1] = ""
                confidences[q - 1] = 0.0
        dbg["skip_from"] = first_skip

    rows_top = min(y for _, y in grid.values())
    code = find_student_code(words, rows_top)

    dbg["answers_found"] = sum(1 for a in answers if a)
    dbg["code"] = code
    return {
        "answers": answers,
        "confidences": confidences,
        "code": code,
        "rows_found": len(q_rows),
        "cols_found": 0,
        "dbg": dbg,
    }