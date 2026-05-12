"""
Генерация PDF-бланка ответов.
Сетка: номер × варианты А/Б/В/Г (кириллица, кружки).
Код ученика: 5 разрядов × цифры 0-9 (кружки, как в ЕГЭ-бланке).
POST / — { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date? }
-> { pdf_b64, filename }
"""
import json, base64, io, math, os, urllib.request

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

# ── Шрифт с кириллицей ──────────────────────────────────────────────────────
_FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]

def _find_font(bold=False):
    keys = ["Bold", "bold", "-Bold", "-bold"] if bold else []
    for p in _FONT_PATHS:
        if not os.path.exists(p):
            continue
        b = bold and any(k in p for k in keys)
        if bold == b or not bold:
            return p
    return None

def _register_fonts():
    reg_path  = _find_font(False)
    bold_path = _find_font(True)
    if reg_path:
        try:
            pdfmetrics.registerFont(TTFont("CyrReg",  reg_path))
        except Exception:
            reg_path = None
    if bold_path:
        try:
            pdfmetrics.registerFont(TTFont("CyrBold", bold_path))
        except Exception:
            bold_path = None
    if reg_path:
        return "CyrReg", "CyrBold" if bold_path else "CyrReg"
    return "Helvetica", "Helvetica-Bold"

REG, BOLD = _register_fonts()

# ── Цвета ────────────────────────────────────────────────────────────────────
DARK   = HexColor("#1a1a2e")
ACCENT = HexColor("#1e3a5f")
LIGHT  = HexColor("#f0f4f8")
GRAY   = HexColor("#8898aa")
LINE   = HexColor("#c8d6e5")

RU_OPTS   = ["А", "Б", "В", "Г", "Д", "Е"]
CODE_DIGS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]


# ── Утилиты ──────────────────────────────────────────────────────────────────
def _txt(c, x, y, text, font, size, color=DARK, align="left"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _hline(c, x1, y, x2, lw=0.4, color=LINE):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1, y, x2, y)


def _circle(c, cx, cy, r, stroke_color=ACCENT, fill_color=white, lw=0.8):
    c.setStrokeColor(stroke_color)
    c.setFillColor(fill_color)
    c.setLineWidth(lw)
    c.circle(cx, cy, r, stroke=1, fill=1)


# ── Основной бланк ───────────────────────────────────────────────────────────
def draw_blank(c, x0, y0, bw, bh, cfg):
    n_q     = cfg["n_q"]
    opts    = cfg["opts"]
    n_opts  = len(opts)
    title   = cfg["title"]
    work_id = cfg["work_id"]
    subject = cfg.get("subject", "")
    cls_lbl = cfg.get("class_label", "")
    date_s  = cfg.get("date", "")

    P = 6 * mm

    # ── Внешняя рамка ────────────────────────────────────────────────────────
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.0)
    c.rect(x0, y0, bw, bh, stroke=1, fill=0)

    cur_y = y0 + bh

    # ── Шапка ────────────────────────────────────────────────────────────────
    HDR = 9 * mm
    c.setFillColor(DARK)
    c.rect(x0, cur_y - HDR, bw, HDR, stroke=0, fill=1)
    _txt(c, x0 + bw/2, cur_y - HDR + 3*mm, "БЛАНК ОТВЕТОВ", BOLD, 10, white, "center")
    _txt(c, x0 + bw - P, cur_y - HDR + 3*mm, f"№ {work_id}", REG, 7, GRAY, "right")
    cur_y -= HDR

    # ── Поля ученика ─────────────────────────────────────────────────────────
    META = 16 * mm
    c.setFillColor(LIGHT)
    c.rect(x0, cur_y - META, bw, META, stroke=0, fill=1)

    fy1 = cur_y - 5.5 * mm
    fy2 = cur_y - 11.5 * mm

    _txt(c, x0 + P, fy1, "ФИО:", BOLD, 7.5, DARK)
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    c.line(x0 + P + 14*mm, fy1 - 0.5, x0 + bw*0.60, fy1 - 0.5)
    _txt(c, x0 + bw*0.62, fy1, "Класс:", BOLD, 7.5, DARK)
    c.line(x0 + bw*0.62 + 15*mm, fy1 - 0.5, x0 + bw - P, fy1 - 0.5)
    if cls_lbl:
        _txt(c, x0 + bw*0.62 + 16*mm, fy1, cls_lbl, REG, 7.5, DARK)

    _txt(c, x0 + P, fy2, "Предмет:", BOLD, 7.5, DARK)
    c.line(x0 + P + 21*mm, fy2 - 0.5, x0 + bw*0.55, fy2 - 0.5)
    _txt(c, x0 + bw*0.57, fy2, "Дата:", BOLD, 7.5, DARK)
    c.line(x0 + bw*0.57 + 13*mm, fy2 - 0.5, x0 + bw - P, fy2 - 0.5)
    if subject:
        _txt(c, x0 + P + 22*mm, fy2, subject, REG, 7.5, DARK)
    if date_s:
        _txt(c, x0 + bw*0.57 + 14*mm, fy2, date_s, REG, 7.5, DARK)

    cur_y -= META

    _hline(c, x0, cur_y, x0 + bw, lw=0.6, color=ACCENT)
    cur_y -= 1 * mm

    # ── Сетка вопросов ───────────────────────────────────────────────────────
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    col_w  = (bw - 2*P) / n_cols
    num_w  = 9 * mm
    avail  = col_w - num_w - 2*mm
    cell_w = min(avail / n_opts, 9 * mm)
    r      = min(cell_w * 0.36, 3.5 * mm)
    font_s = max(5.5, r * 1.55)
    row_h  = max(r * 2 + 2.5*mm, 6.5 * mm)
    n_rows = math.ceil(n_q / n_cols)
    grid_h = n_rows * row_h + 3*mm

    # Заголовки вариантов
    hdr_h = 5.5 * mm
    for ci in range(n_cols):
        cx0 = x0 + P + ci * col_w
        for oi, lbl in enumerate(opts):
            ox = cx0 + num_w + oi * cell_w + cell_w / 2
            _txt(c, ox, cur_y - hdr_h + 1.5*mm, lbl, BOLD, 7.5, ACCENT, "center")
    cur_y -= hdr_h
    _hline(c, x0 + P, cur_y, x0 + bw - P, lw=0.4)
    cur_y -= 0.5 * mm

    # Строки вопросов
    for qi in range(n_q):
        ci = qi % n_cols
        ri = qi // n_cols
        rx = x0 + P + ci * col_w
        ry = cur_y - ri * row_h - row_h / 2

        if ri % 2 == 0:
            c.setFillColor(LIGHT)
            c.rect(rx, ry - row_h/2, col_w, row_h, stroke=0, fill=1)

        _txt(c, rx + num_w - 2*mm, ry - 2.5, f"{qi+1}.", BOLD, 7.5, DARK, "right")

        for oi in range(n_opts):
            ox = rx + num_w + oi * cell_w + cell_w / 2
            _circle(c, ox, ry, r)
            _txt(c, ox, ry - r * 0.4, opts[oi], BOLD, font_s, GRAY, "center")

    cur_y -= grid_h

    _hline(c, x0, cur_y, x0 + bw, lw=0.6, color=ACCENT)
    cur_y -= 3 * mm

    # ── Код ученика — горизонтальная сетка: 5 строк (разряды) × 10 цифр ────
    # Строка = один разряд кода; в строке 10 кружков (цифры 0-9)
    CODE_ROWS = 5    # разрядов
    CODE_COLS = 10   # цифры 0-9
    cr = 2.2 * mm   # радиус кружка
    c_gap_x = cr * 2 + 1.0 * mm   # шаг по горизонтали (цифры)
    c_gap_y = cr * 2 + 1.0 * mm   # шаг по вертикали (разряды)

    # Заголовок + подсказка
    _txt(c, x0 + P, cur_y, "КОД УЧЕНИКА", BOLD, 7, DARK)
    _txt(c, x0 + P + 28*mm, cur_y, "(закрасьте одну цифру в каждой строке)", REG, 5.5, GRAY)
    cur_y -= 4 * mm

    # Заголовок цифр сверху (0-9)
    for dig_i in range(CODE_COLS):
        dx = x0 + P + dig_i * c_gap_x + cr
        _txt(c, dx, cur_y, str(dig_i), BOLD, 5.5, ACCENT, "center")
    cur_y -= 3 * mm

    # Кружки: каждая строка — один разряд, каждый столбец — цифра 0-9
    for row in range(CODE_ROWS):
        label_x = x0 + P - 0.5*mm
        ry = cur_y - row * c_gap_y - cr
        # Метка разряда слева (необязательно, можно убрать)
        for dig_i in range(CODE_COLS):
            cx = x0 + P + dig_i * c_gap_x + cr
            _circle(c, cx, ry, cr)
            _txt(c, cx, ry - cr * 0.42, str(dig_i), BOLD, 5.5, GRAY, "center")

    cur_y -= CODE_ROWS * c_gap_y + 2 * mm

    # ── Подпись ──────────────────────────────────────────────────────────────
    _hline(c, x0, cur_y, x0 + bw, lw=0.4, color=LINE)
    cur_y -= 3.5 * mm
    info = f"Вопросов: {n_q}   |   Вариантов: {n_opts} ({', '.join(opts)})   |   Писать чёрной ручкой"
    _txt(c, x0 + P, cur_y, info, REG, 6, GRAY)
    _txt(c, x0 + bw - P, cur_y, title, REG, 6, GRAY, "right")


# ── Рендер PDF ───────────────────────────────────────────────────────────────
def render_pdf(cfg: dict, per_page: int) -> bytes:
    buf = io.BytesIO()
    pw, ph = A4
    c = canvas.Canvas(buf, pagesize=A4)
    M = 8 * mm

    if per_page == 1:
        layouts = [(M, M, pw - 2*M, ph - 2*M)]
    elif per_page == 2:
        bh = (ph - 3*M) / 2
        layouts = [
            (M, M + bh + M, pw - 2*M, bh),
            (M, M,          pw - 2*M, bh),
        ]
    else:
        bw2 = (pw - 3*M) / 2
        bh2 = (ph - 3*M) / 2
        layouts = [
            (M,           M + bh2 + M, bw2, bh2),
            (M + bw2 + M, M + bh2 + M, bw2, bh2),
            (M,           M,           bw2, bh2),
            (M + bw2 + M, M,           bw2, bh2),
        ]

    for (x, y, bw, bh) in layouts:
        draw_blank(c, x, y, bw, bh, cfg)

    c.setStrokeColor(GRAY)
    c.setLineWidth(0.35)
    c.setDash(4, 5)
    if per_page == 2:
        mid_y = M + (ph - 3*M)/2 + M/2
        c.line(M, mid_y, pw - M, mid_y)
    elif per_page == 4:
        c.line(pw/2, M, pw/2, ph - M)
        c.line(M, ph/2, pw - M, ph/2)
    c.setDash()

    c.showPage()
    c.save()
    return buf.getvalue()


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    PDF-бланк: кружки А/Б/В/Г + код ученика 5×10 кружков (цифры 0-9).
    POST { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date? }
    -> { pdf_b64, filename, questionsCount, optionsCount, options }
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    work_id  = str(body.get("workId",     "000000"))[:10]
    title    = str(body.get("workTitle",  "Бланк ответов"))[:60]
    n_q      = max(1, min(int(body.get("questionsCount", 20)), 80))
    n_opts   = max(2, min(int(body.get("optionsCount",   4)),  6))
    per_page = int(body.get("perPage", 1))
    if per_page not in (1, 2, 4):
        per_page = 1
    subject  = str(body.get("subject",    ""))[:40]
    cls_lbl  = str(body.get("classLabel", ""))[:10]
    date_s   = str(body.get("date",       ""))[:12]

    opts = RU_OPTS[:n_opts]

    cfg = {
        "n_q":         n_q,
        "opts":        opts,
        "work_id":     work_id,
        "title":       title,
        "subject":     subject,
        "class_label": cls_lbl,
        "date":        date_s,
    }

    pdf_bytes = render_pdf(cfg, per_page)
    return _resp(200, {
        "pdf_b64":        base64.b64encode(pdf_bytes).decode(),
        "filename":       f"blank_{work_id}_{n_q}q.pdf",
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
    })