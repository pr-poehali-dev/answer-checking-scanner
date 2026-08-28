"""
Генерация PDF-бланков ответов (компактный рукописный формат).

Формат бланка (без реперов и QR — читается через Yandex Vision OCR):
  • сверху 5 клеток для КОДА УЧЕНИКА (по одной цифре в клетке);
  • ниже пары «номер вопроса → пустая клетка», куда ученик от руки пишет
    русскую букву ответа (А, Б, В, Г, Д — по числу вариантов работы);
  • лишние вопросы ученик перечёркивает латинской Z — такие не засчитываются.

Бланк маленький, поэтому на лист A4 их помещается сразу несколько — сколько
влезет при данном количестве вопросов. Между бланками печатаются линии отреза.

Учитель может напечатать бланки заранее «на класс»: тогда код ученика уже
впечатан в клетки, а сверху подписано, чей это бланк.

POST / — { workId, workTitle, questionsCount, optionsCount(2-6),
           subject?, classLabel?, date?,
           students?: [{ code, name, classLabel }] }
-> { pdf_b64, filename, perSheet, sheets }
Если students пуст — печатается лист пустых бланков без кода.
"""
import json, base64, io, math, os

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}


def _reg():
    """Подбирает шрифт с кириллицей. Helvetica её не содержит, поэтому без
    подходящего TTF надписи на бланке превратились бы в квадраты."""
    pairs = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/freefont/FreeSans.ttf",
         "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
        ("/usr/share/fonts/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/opensans/OpenSans-Regular.ttf",
         "/usr/share/fonts/opensans/OpenSans-Bold.ttf"),
        ("/usr/share/fonts/noto/NotoSans-Regular.ttf",
         "/usr/share/fonts/noto/NotoSans-Bold.ttf"),
    ]
    for rp, bp in pairs:
        if os.path.exists(rp) and os.path.exists(bp):
            try:
                pdfmetrics.registerFont(TTFont("F",  rp))
                pdfmetrics.registerFont(TTFont("FB", bp))
                return "F", "FB"
            except Exception:
                pass
    return "Helvetica", "Helvetica-Bold"


REG, BOLD = _reg()

C_DARK  = HexColor("#1a1a2e")
C_BLUE  = HexColor("#1e3a5f")
C_GRAY  = HexColor("#8898aa")
C_LINE  = HexColor("#9fb3c8")
# Рамка клетки — светлее линий: не должна сливаться с рукописной буквой
C_BOX   = HexColor("#c3d0dd")
RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]

CODE_CELLS = 5          # длина кода ученика


def T(c, x, y, s, font, sz, color=C_DARK, align="left"):
    c.setFont(font, sz); c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, s)
    elif align == "right":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


def HL(c, x1, y, x2, lw=0.4, color=C_LINE):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1, y, x2, y)


def BOX(c, x, y, w, h, lw=0.5, color=C_BOX):
    """Клетка под рукописный символ.

    Рамка нужна: без неё распознавание теряет структуру бланка. Но она
    намеренно тонкая и светлая — так она не «прилипает» к букве внутри и не
    мешает ИИ её прочитать.
    """
    c.setStrokeColor(color); c.setFillColor(white); c.setLineWidth(lw)
    c.rect(x, y, w, h, stroke=1, fill=1)


# ─── Геометрия бланка ────────────────────────────────────────────────────────
# Размеры подобраны так, чтобы клетка была удобной для письма от руки и при
# этом хорошо читалась Vision OCR на фото с телефона.
# Клетка намеренно крупная: мелкие одиночные буквы распознаются заметно хуже,
# а лишнее место на листе всё равно есть — бланков помещается достаточно.
CELL      = 10.0 * mm    # сторона клетки для буквы/цифры
CELL_GAP  = 2.2 * mm     # зазор между парой «номер-клетка»
NUM_W     = 7.0 * mm     # ширина колонки с номером вопроса
PAIR_W    = NUM_W + CELL + CELL_GAP
ROW_H     = CELL + 2.4 * mm
PAD       = 3.5 * mm     # внутреннее поле бланка
HEAD_H    = 38.0 * mm    # шапка: заголовок, ФИО, код ученика, подсказка


def blank_columns(n_q: int) -> int:
    """Сколько колонок пар «номер-ответ» внутри одного бланка."""
    if n_q <= 8:
        return 1
    if n_q <= 24:
        return 2
    return 3


def blank_size(n_q: int) -> tuple:
    """Размер одного бланка (ширина, высота) в пунктах."""
    n_cols = blank_columns(n_q)
    n_rows = math.ceil(n_q / n_cols)
    # Ширина должна вместить и шапку с кодом (5 клеток), и колонки вопросов
    grid_w = n_cols * PAIR_W
    code_w = CODE_CELLS * (CELL + 1.6 * mm)
    bw = max(grid_w, code_w) + 2 * PAD
    bh = HEAD_H + n_rows * ROW_H + PAD
    return bw, bh


def sheet_grid(n_q: int) -> tuple:
    """Сколько бланков помещается на лист A4: (по горизонтали, по вертикали)."""
    pw, ph = A4
    margin = 8 * mm
    gap = 4 * mm
    bw, bh = blank_size(n_q)
    cols = max(1, int((pw - 2 * margin + gap) // (bw + gap)))
    rows = max(1, int((ph - 2 * margin + gap) // (bh + gap)))
    return cols, rows


def draw_blank(c, x0, y0, cfg):
    """Рисует один бланк, левый нижний угол — (x0, y0)."""
    n_q      = cfg["n_q"]
    opts     = cfg["opts"]
    work_id  = cfg["work_id"]
    subject  = cfg.get("subject", "")
    cls_lbl  = cfg.get("class_label", "")
    stu_name = cfg.get("student_name", "")
    stu_code = cfg.get("student_code", "")

    bw, bh = blank_size(n_q)
    n_cols = blank_columns(n_q)
    n_rows = math.ceil(n_q / n_cols)

    top = y0 + bh

    # ── Заголовок ────────────────────────────────────────────────────────────
    T(c, x0 + PAD, top - 4.2 * mm, "БЛАНК ОТВЕТОВ", BOLD, 7.5, C_BLUE)
    T(c, x0 + bw - PAD, top - 4.2 * mm, f"№{work_id}", REG, 5.5, C_GRAY, "right")
    HL(c, x0 + PAD, top - 5.6 * mm, x0 + bw - PAD, lw=0.5)

    # ── ФИО ученика ──────────────────────────────────────────────────────────
    name_y = top - 9.6 * mm
    if stu_name:
        # Бланк напечатан для конкретного ученика — подписываем, чей он
        T(c, x0 + PAD, name_y, stu_name[:34], BOLD, 6.5, C_DARK)
    else:
        T(c, x0 + PAD, name_y, "ФИО:", BOLD, 6, C_DARK)
        HL(c, x0 + PAD + 9 * mm, name_y - 0.6 * mm, x0 + bw - PAD, lw=0.5)

    sub_y = top - 13.2 * mm
    left_note = subject or ""
    if cls_lbl:
        left_note = f"{left_note} · {cls_lbl}" if left_note else cls_lbl
    if left_note:
        T(c, x0 + PAD, sub_y, left_note[:38], REG, 5.5, C_GRAY)

    # ── Код ученика: 5 клеток ────────────────────────────────────────────────
    code_y = top - 28.0 * mm
    code_step = CELL + 1.6 * mm
    T(c, x0 + PAD, code_y + CELL + 1.6 * mm, "КОД УЧЕНИКА", BOLD, 5.4, C_BLUE)
    for i in range(CODE_CELLS):
        cx = x0 + PAD + i * code_step
        BOX(c, cx, code_y, CELL, CELL, lw=0.6)
        if stu_code and i < len(stu_code):
            # Код уже впечатан — ученику ничего писать не нужно
            T(c, cx + CELL / 2, code_y + CELL * 0.28, stu_code[i], BOLD, 10, C_DARK, "center")

    # Подсказка по вариантам ответа и пропуску — печатной буквой в клетку
    hint = f"Впишите букву: {' '.join(opts)}   ·   лишние вопросы — Z"
    T(c, x0 + PAD, code_y - 3.0 * mm, hint, REG, 4.8, C_GRAY)

    # ── Сетка вопросов ───────────────────────────────────────────────────────
    grid_top = y0 + bh - HEAD_H
    for qi in range(n_q):
        ci = qi // n_rows
        ri = qi % n_rows
        px = x0 + PAD + ci * PAIR_W
        py = grid_top - (ri + 1) * ROW_H + (ROW_H - CELL) / 2

        # Номер вопроса — точка обязательна: по ней распознавание находит строку
        T(c, px + NUM_W - 1.4 * mm, py + CELL * 0.30, f"{qi + 1}.", BOLD, 7, C_DARK, "right")
        BOX(c, px + NUM_W, py, CELL, CELL)

    return bw, bh


def _cut_lines(c, positions, n_q):
    """Пунктирные линии отреза между бланками."""
    pw, ph = A4
    bw, bh = blank_size(n_q)
    xs = sorted({round(x, 2) for x, _ in positions})
    ys = sorted({round(y, 2) for _, y in positions})
    c.setStrokeColor(C_GRAY); c.setLineWidth(0.3); c.setDash(2, 4)
    gap = 4 * mm
    for x in xs[1:]:
        mx = x - gap / 2
        c.line(mx, 4 * mm, mx, ph - 4 * mm)
    for y in ys[:-1]:
        my = y + bh + gap / 2
        c.line(4 * mm, my, pw - 4 * mm, my)
    c.setDash()


def render_pdf(cfg: dict, students: list) -> tuple:
    """Раскладывает бланки по листам A4. Возвращает (pdf_bytes, per_sheet, sheets)."""
    n_q = cfg["n_q"]
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    pw, ph = A4
    margin = 8 * mm
    gap = 4 * mm
    bw, bh = blank_size(n_q)
    cols, rows = sheet_grid(n_q)
    per_sheet = cols * rows

    # Центрируем сетку бланков на листе
    total_w = cols * bw + (cols - 1) * gap
    total_h = rows * bh + (rows - 1) * gap
    x_start = (pw - total_w) / 2
    y_top = ph - (ph - total_h) / 2

    positions = []
    for r in range(rows):
        for k in range(cols):
            positions.append((x_start + k * (bw + gap), y_top - (r + 1) * bh - r * gap))

    items = students if students else [None] * per_sheet
    sheets = 0
    for i, stu in enumerate(items):
        slot = i % per_sheet
        if i > 0 and slot == 0:
            _cut_lines(c, positions, n_q)
            c.showPage()
            sheets += 1
        x, y = positions[slot]
        scfg = dict(cfg)
        if stu:
            scfg["student_name"] = stu.get("name", "")
            scfg["student_code"] = stu.get("code", "")
            if stu.get("classLabel"):
                scfg["class_label"] = stu.get("classLabel")
        draw_blank(c, x, y, scfg)

    _cut_lines(c, positions, n_q)
    c.showPage(); c.save()
    sheets += 1
    return buf.getvalue(), per_sheet, sheets


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """PDF-бланк: клетки для кода ученика и рукописных букв ответа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    work_id = str(body.get("workId", "000000"))[:10]
    title   = str(body.get("workTitle", "Бланк ответов"))[:60]
    n_q     = max(1, min(int(body.get("questionsCount", 20)), 80))
    n_opts  = max(2, min(int(body.get("optionsCount", 4)), 6))
    subject = str(body.get("subject", ""))[:40]
    cls_lbl = str(body.get("classLabel", ""))[:10]
    date_s  = str(body.get("date", ""))[:12]

    raw_students = body.get("students") or []
    students = []
    if isinstance(raw_students, list):
        for s in raw_students[:300]:
            code = str(s.get("code", "")).strip()[:CODE_CELLS]
            name = str(s.get("name", "")).strip()[:60]
            clbl = str(s.get("classLabel", "")).strip()[:10]
            if code and name:
                students.append({"code": code, "name": name, "classLabel": clbl})

    opts = RU_OPTS[:n_opts]
    cfg = {
        "n_q": n_q, "opts": opts, "work_id": work_id, "title": title,
        "subject": subject, "class_label": cls_lbl, "date": date_s,
    }

    pdf_bytes, per_sheet, sheets = render_pdf(cfg, students)
    suffix = f"_{len(students)}st" if students else ""
    return _resp(200, {
        "pdf_b64":        base64.b64encode(pdf_bytes).decode(),
        "filename":       f"blank_{work_id}_{n_q}q{suffix}.pdf",
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
        "studentsCount":  len(students),
        "perSheet":       per_sheet,
        "sheets":         sheets,
    })