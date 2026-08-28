"""
Распознавание бланка ответов на базе Yandex Vision OCR.

Идея: Vision OCR отдаёт координаты КАЖДОГО распознанного символа на листе.
На бланке напечатаны номера вопросов (1, 2, 3 …) и буквы вариантов (А Б В Г).
По ним восстанавливаем сетку клеток, а затем смотрим, какая клетка закрашена
ручкой — это уже пиксельный анализ (OCR «крестики» не читает).

Порядок работы:
  1. Vision OCR → слова с координатами;
  2. по буквам вариантов в шапке колонок определяем X-центры столбцов А/Б/В/Г;
  3. по номерам вопросов слева определяем Y-центры строк;
  4. на пересечении строк и столбцов считаем заполненность (доля тёмных
     пикселей) — самая тёмная клетка строки и есть ответ ученика;
  5. код ученика берём из QR (он уже есть в основном модуле) либо из текста OCR.
"""
import re
import numpy as np

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]

# Латиница/кириллица: OCR часто путает А↔A, В↔B, Е↔E — приводим к кириллице.
_LAT_TO_RU = {"A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К",
              "M": "М", "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У"}


def _norm_letter(s: str) -> str:
    s = (s or "").strip().upper()
    return _LAT_TO_RU.get(s, s)


def _cluster_1d(values: list, tol: float) -> list:
    """Группирует близкие координаты в кластеры, возвращает центры кластеров."""
    if not values:
        return []
    vals = sorted(values)
    clusters = [[vals[0]]]
    for v in vals[1:]:
        if v - clusters[-1][-1] <= tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [float(np.mean(c)) for c in clusters]


def find_option_columns(words: list, options_count: int, img_w: int) -> list:
    """X-центры столбцов вариантов ответа по напечатанным буквам А/Б/В/Г/Д.

    Бланк может быть в 1–3 колонки вопросов, в каждой свой набор букв —
    поэтому возвращаем ВСЕ найденные X, сгруппированные по колонкам бланка.
    """
    opts = set(RU_OPTS[:options_count])
    xs = []
    for w in words:
        letter = _norm_letter(w["text"])
        if len(letter) == 1 and letter in opts:
            xs.append(w["cx"])
    if not xs:
        return []
    # Ширина буквы ~ 1.5% листа — кластеризуем с этим допуском
    tol = max(8.0, img_w * 0.012)
    return _cluster_1d(xs, tol)


def find_question_rows(words: list, questions_count: int, img_h: int) -> dict:
    """Y-центры строк вопросов по напечатанным номерам 1..N.

    Возвращает {номер_вопроса: (cx, cy)} — координаты самого номера,
    чтобы знать и строку (Y), и к какой колонке бланка вопрос относится (X).
    """
    found = {}
    for w in words:
        txt = (w["text"] or "").strip()
        m = re.fullmatch(r"(\d{1,2})[.)]?", txt)
        if not m:
            continue
        num = int(m.group(1))
        if not (1 <= num <= questions_count):
            continue
        # Если номер встретился дважды (шум) — берём самый левый в своей строке
        prev = found.get(num)
        if prev is None or w["cx"] < prev[0]:
            found[num] = (w["cx"], w["cy"])
    return found


def _darkness(gray, cx: float, cy: float, size: float) -> float:
    """Доля тёмных пикселей (чернил) в центре клетки.

    Порог локальный — устойчив к теням и неравномерному свету телефона.
    Читаем 72% центра клетки, чтобы не задеть рамку и печатную букву.
    """
    cx = int(round(cx)); cy = int(round(cy))
    sz = max(8, int(size * 0.72))
    bg = max(sz + 6, int(sz * 1.8))
    bx1 = max(0, cx - bg // 2); by1 = max(0, cy - bg // 2)
    bx2 = min(gray.shape[1], cx + bg // 2); by2 = min(gray.shape[0], cy + bg // 2)
    patch = gray[by1:by2, bx1:bx2]
    if patch.size == 0:
        return 0.0
    bg_med = float(np.median(patch))
    dark_min = float(np.min(patch))
    local_thr = dark_min + (bg_med - dark_min) * 0.5
    local_thr = max(40.0, min(local_thr, bg_med - 15))
    x1 = max(0, cx - sz // 2); y1 = max(0, cy - sz // 2)
    x2 = min(gray.shape[1], cx + sz // 2); y2 = min(gray.shape[0], cy + sz // 2)
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0
    return float(np.mean(roi < local_thr))


def recognize_from_ocr(gray, words: list, questions_count: int,
                       options_count: int) -> dict:
    """Собирает ответы ученика по координатам из Vision OCR + анализу пикселей.

    gray — изображение в оттенках серого (numpy), words — слова от Vision OCR.
    Возвращает {"answers": [...], "confidences": [...], "rows_found": N,
                "cols_found": M}.
    """
    h, w = gray.shape[:2]
    opts = RU_OPTS[:options_count]

    col_xs = find_option_columns(words, options_count, w)
    q_rows = find_question_rows(words, questions_count, h)

    answers = [""] * questions_count
    confidences = [0.0] * questions_count

    if not col_xs or not q_rows:
        return {"answers": answers, "confidences": confidences,
                "rows_found": len(q_rows), "cols_found": len(col_xs)}

    # Шаг между столбцами вариантов = размер клетки (нужен для окна анализа)
    if len(col_xs) >= 2:
        diffs = np.diff(sorted(col_xs))
        # Берём медиану ТОЛЬКО по соседним столбцам одной колонки бланка:
        # большие разрывы — это переход к следующей колонке вопросов.
        small = [d for d in diffs if d < np.median(diffs) * 2]
        cell_size = float(np.median(small)) if small else float(np.median(diffs))
    else:
        cell_size = w * 0.03
    cell_size = max(10.0, min(cell_size, w * 0.08))

    for q in range(1, questions_count + 1):
        pos = q_rows.get(q)
        if pos is None:
            continue
        num_cx, num_cy = pos
        # Столбцы вариантов ЭТОГО вопроса — те, что правее его номера,
        # но в пределах одной колонки бланка (не уезжаем в соседнюю).
        band = [x for x in col_xs if num_cx < x < num_cx + cell_size * (options_count + 2)]
        band = sorted(band)[:options_count]
        if len(band) < options_count:
            continue

        fills = [_darkness(gray, x, num_cy, cell_size) for x in band]
        best_i = int(np.argmax(fills))
        best = fills[best_i]
        rest = sorted(fills, reverse=True)[1:]
        second = rest[0] if rest else 0.0

        # Клетка считается закрашенной, если заметно темнее остальных.
        # Пороги подобраны так же, как в OpenCV-движке: отсекаем фоновый шум
        # (~0.2) и случаи, когда ученик не ответил (все клетки светлые).
        if best >= 0.28 and (best - second) >= 0.10:
            answers[q - 1] = opts[best_i]
            confidences[q - 1] = round(min(1.0, best), 3)

    return {
        "answers": answers,
        "confidences": confidences,
        "rows_found": len(q_rows),
        "cols_found": len(col_xs),
    }
