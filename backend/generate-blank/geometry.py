"""
Общая геометрия бланка ответов «САОУ».

ВАЖНО: файл лежит в двух функциях (generate-blank и recognize-blank) в одинаковом
виде. Бланк рисуется по этим числам, а при распознавании по ним же вычисляются
координаты каждого кружка. Менять можно только в обоих местах сразу.

Все размеры — в миллиметрах. Начало координат бланка — его левый верхний угол,
ось Y направлена вниз.

Устройство бланка:
  • в углах — 4 чёрных квадрата-метки (левый верхний больше остальных — по нему
    программа понимает, где верх бланка, даже если фото перевёрнуто);
  • вверху — код ученика: 5 строк × 10 цифр (0–9), в каждой строке закрашивается
    один кружок. Для именных бланков код уже впечатан;
  • ниже — ответы: номер вопроса и ряд кружков с буквами А Б В Г Д Е.
    Ученик полностью закрашивает кружок с выбранным ответом.
"""
import math

SHEET_W, SHEET_H = 210.0, 297.0
SHEET_MARGIN = 5.0
SLOT_GAP = 4.0

OPT_LABELS = ["А", "Б", "В", "Г", "Д", "Е"]
CODE_LEN = 5
CODE_DIGITS = 10
MAX_Q = 80

BIG_MARK = 7.0
SMALL_MARK = 4.5
MARK_INSET = 2.0

PAD = 7.0
BUB_R = 2.3
PITCH_X = 6.6
ROW_H = 6.2
NUM_W = 8.0
COL_GAP = 1.0

CODE_R = 1.8
CODE_PX = 4.4
CODE_PY = 4.6
CODE_LABEL_W = 4.0

Y_TITLE = 8.3
Y_RULE = 10.0
Y_INFO = 13.0
Y_NAME = 18.0
Y_CODE_LABEL = 22.2
Y_DIGITS = 26.0
Y_CODE_ROW0 = 29.5
Y_HEAD_END = 52.5
BOTTOM_PAD = 7.0

INSTR_MIN_W = 26.0
INSTR_BELOW_H = 15.0

# (бланков на листе, колонок бланков, строк бланков)
LAYOUTS = [(4, 2, 2), (3, 3, 1), (2, 1, 2), (1, 1, 1)]


def slot_size(cols: int, rows: int) -> tuple:
    uw = SHEET_W - 2 * SHEET_MARGIN
    uh = SHEET_H - 2 * SHEET_MARGIN
    return (uw - SLOT_GAP * (cols - 1)) / cols, (uh - SLOT_GAP * (rows - 1)) / rows


def slot_rects(cols: int, rows: int) -> list:
    """Левые верхние углы бланков на листе: [(x, y, w, h)], слева направо, сверху вниз."""
    w, h = slot_size(cols, rows)
    return [(SHEET_MARGIN + c * (w + SLOT_GAP), SHEET_MARGIN + r * (h + SLOT_GAP), w, h)
            for r in range(rows) for c in range(cols)]


def marker_centers(w: float, h: float) -> dict:
    b, s, i = BIG_MARK, SMALL_MARK, MARK_INSET
    return {
        "tl": (i + b / 2, i + b / 2),
        "tr": (w - i - s / 2, i + s / 2),
        "bl": (i + s / 2, h - i - s / 2),
        "br": (w - i - s / 2, h - i - s / 2),
    }


def _inner_w(w: float) -> float:
    return w - 2 * PAD


def block_width(n_opts: int) -> float:
    return NUM_W + (n_opts - 1) * PITCH_X + 2 * BUB_R + COL_GAP


def instr_below(w: float) -> bool:
    code_w = CODE_LABEL_W + CODE_DIGITS * CODE_PX
    return _inner_w(w) - code_w - 3 < INSTR_MIN_W


def head_end(w: float) -> float:
    return Y_HEAD_END + (INSTR_BELOW_H if instr_below(w) else 0.0)


def question_columns(w: float, n_opts: int) -> int:
    return max(0, min(4, int(_inner_w(w) / block_width(n_opts) + 1e-6)))


def max_rows(w: float, h: float) -> int:
    return max(0, int((h - head_end(w) - BOTTOM_PAD) / ROW_H + 1e-6))


def fits(n_q: int, n_opts: int, cols_slots: int, rows_slots: int) -> bool:
    w, h = slot_size(cols_slots, rows_slots)
    qc = question_columns(w, n_opts)
    return qc >= 1 and qc * max_rows(w, h) >= n_q


def choose_layout(n_q: int, n_opts: int) -> tuple:
    """Берёт максимум бланков на лист, при котором все вопросы помещаются."""
    for per, cs, rs in LAYOUTS:
        if fits(n_q, n_opts, cs, rs):
            return per, cs, rs
    return LAYOUTS[-1]


def answer_bubbles(w: float, h: float, n_q: int, n_opts: int) -> list:
    """[(номер вопроса с 0, вариант с 0, x, y)] — центры кружков ответов."""
    qc = max(1, question_columns(w, n_opts))
    rows = math.ceil(n_q / qc)
    col_step = _inner_w(w) / qc
    y0 = head_end(w)
    out = []
    for q in range(n_q):
        c, r = divmod(q, rows)
        x_col = PAD + c * col_step
        cy = y0 + (r + 0.5) * ROW_H
        for j in range(n_opts):
            out.append((q, j, x_col + NUM_W + BUB_R + j * PITCH_X, cy))
    return out


def code_bubbles() -> list:
    """[(позиция 0..4, цифра 0..9, x, y)] — центры кружков кода ученика."""
    out = []
    for p in range(CODE_LEN):
        for d in range(CODE_DIGITS):
            out.append((p, d, PAD + CODE_LABEL_W + CODE_R + d * CODE_PX,
                        Y_CODE_ROW0 + p * CODE_PY))
    return out
