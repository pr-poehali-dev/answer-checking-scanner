"""
Генерация PDF-бланка ответов.
Варианты: А/Б/В/Г (кириллица). Код ученика: 5 разрядов × 0-9 (горизонтально).
POST / — { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date? }
-> { pdf_b64, filename }
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

# ── Шрифт ────────────────────────────────────────────────────────────────────
def _reg():
    pairs = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/freefont/FreeSans.ttf",
         "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
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

# ── Цвета ────────────────────────────────────────────────────────────────────
C_DARK   = HexColor("#1a1a2e")   # шапка
C_BLUE   = HexColor("#1e3a5f")   # акцент / рамки
C_LIGHT  = HexColor("#f0f4f8")   # фон чётных строк
C_GRAY   = HexColor("#8898aa")   # подписи, буквы в кружках
C_LINE   = HexColor("#c8d6e5")   # разделители

RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]


# ── Утилиты ──────────────────────────────────────────────────────────────────
def txt(c, x, y, s, font, size, color=C_DARK, align="left"):
    c.setFont(font, size)
    c.setFillColor(color)
    {"left":   lambda: c.drawString(x, y, s),
     "center": lambda: c.drawCentredString(x, y, s),
     "right":  lambda: c.drawRightString(x, y, s)}[align]()


def hline(c, x1, y, x2, lw=0.4, color=C_LINE):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1, y, x2, y)


def circ(c, cx, cy, r, stroke=C_BLUE, fill=white, lw=0.7):
    c.setStrokeColor(stroke); c.setFillColor(fill)
    c.setLineWidth(lw); c.circle(cx, cy, r, stroke=1, fill=1)


# ── Расчёт высоты бланка ─────────────────────────────────────────────────────
def blank_height(n_q, n_opts, bw):
    P = 5 * mm
    HDR   = 8 * mm
    META  = 15 * mm
    SEP   = 1 * mm

    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    col_w  = (bw - 2*P) / n_cols
    num_w  = 10 * mm
    cell_w = min((col_w - num_w) / n_opts, 9 * mm)
    r      = min(cell_w * 0.38, 3.5 * mm)
    row_h  = r * 2 + 2.8 * mm
    n_rows = math.ceil(n_q / n_cols)
    GRID   = 6 * mm + n_rows * row_h   # заголовок + строки

    # Блок кода: заголовок(5мм) + шапка цифр(4мм) + 5 строк кружков
    cr      = 2.0 * mm
    gap_y   = cr * 2 + 1.2 * mm
    CODE    = 5 * mm + 4 * mm + 5 * gap_y + 2 * mm

    FOOT    = 5 * mm
    return HDR + META + SEP + GRID + SEP + CODE + SEP + FOOT


# ── Рисование бланка ─────────────────────────────────────────────────────────
def draw_blank(c, x0, y0, bw, bh, cfg):
    n_q     = cfg["n_q"]
    opts    = cfg["opts"]          # ["А","Б","В","Г"]
    n_opts  = len(opts)
    title   = cfg["title"]
    work_id = cfg["work_id"]
    subject = cfg.get("subject", "")
    cls_lbl = cfg.get("class_label", "")
    date_s  = cfg.get("date", "")

    P = 5 * mm   # внутренние горизонтальные отступы

    # ── Внешняя рамка ────────────────────────────────────────────────────────
    c.setStrokeColor(C_BLUE)
    c.setLineWidth(0.8)
    c.rect(x0, y0, bw, bh, stroke=1, fill=0)

    cur_y = y0 + bh   # движемся сверху вниз

    # ── Шапка ────────────────────────────────────────────────────────────────
    HDR = 8 * mm
    c.setFillColor(C_DARK)
    c.rect(x0, cur_y - HDR, bw, HDR, stroke=0, fill=1)
    txt(c, x0 + bw/2, cur_y - HDR + 2.8*mm, "БЛАНК ОТВЕТОВ", BOLD, 9.5, white, "center")
    txt(c, x0 + bw - P, cur_y - HDR + 2.8*mm, f"№ {work_id}", REG, 6.5, C_GRAY, "right")
    cur_y -= HDR

    # ── Поля ученика ─────────────────────────────────────────────────────────
    META = 15 * mm
    c.setFillColor(C_LIGHT)
    c.rect(x0, cur_y - META, bw, META, stroke=0, fill=1)

    fy1 = cur_y - 5 * mm
    fy2 = cur_y - 10.5 * mm

    # Строка 1: ФИО + Класс
    txt(c, x0 + P, fy1, "ФИО:", BOLD, 7, C_DARK)
    c.setStrokeColor(C_LINE); c.setLineWidth(0.5)
    c.line(x0 + P + 12*mm, fy1 - 0.3, x0 + bw*0.62, fy1 - 0.3)
    txt(c, x0 + bw*0.64, fy1, "Класс:", BOLD, 7, C_DARK)
    c.line(x0 + bw*0.64 + 13*mm, fy1 - 0.3, x0 + bw - P, fy1 - 0.3)
    if cls_lbl:
        txt(c, x0 + bw*0.64 + 14*mm, fy1, cls_lbl, REG, 7, C_DARK)

    # Строка 2: Предмет + Дата
    txt(c, x0 + P, fy2, "Предмет:", BOLD, 7, C_DARK)
    c.line(x0 + P + 19*mm, fy2 - 0.3, x0 + bw*0.56, fy2 - 0.3)
    txt(c, x0 + bw*0.58, fy2, "Дата:", BOLD, 7, C_DARK)
    c.line(x0 + bw*0.58 + 11*mm, fy2 - 0.3, x0 + bw - P, fy2 - 0.3)
    if subject:
        txt(c, x0 + P + 20*mm, fy2, subject, REG, 7, C_DARK)
    if date_s:
        txt(c, x0 + bw*0.58 + 12*mm, fy2, date_s, REG, 7, C_DARK)

    cur_y -= META

    hline(c, x0, cur_y, x0 + bw, lw=0.6, color=C_BLUE)
    cur_y -= 0.5 * mm

    # ── Сетка вопросов ───────────────────────────────────────────────────────
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    col_w  = (bw - 2*P) / n_cols
    num_w  = 10 * mm
    cell_w = min((col_w - num_w) / n_opts, 9 * mm)
    r      = min(cell_w * 0.38, 3.5 * mm)
    font_s = max(5, r * 1.5)
    row_h  = r * 2 + 2.8 * mm
    n_rows = math.ceil(n_q / n_cols)

    # Заголовки А Б В Г
    HDR_OPT = 5.5 * mm
    for ci in range(n_cols):
        cx0 = x0 + P + ci * col_w
        for oi, lbl in enumerate(opts):
            ox = cx0 + num_w + oi * cell_w + cell_w / 2
            txt(c, ox, cur_y - HDR_OPT + 1.8*mm, lbl, BOLD, 7, C_BLUE, "center")
    cur_y -= HDR_OPT
    hline(c, x0 + P, cur_y, x0 + bw - P, lw=0.4)
    cur_y -= 0.3 * mm

    # Строки вопросов — порядок: колонки идут слева направо, вопросы сверху вниз
    for qi in range(n_q):
        ci = qi % n_cols      # номер колонки
        ri = qi // n_cols     # строка внутри колонки

        rx = x0 + P + ci * col_w
        ry = cur_y - ri * row_h - row_h / 2

        # Чередующийся фон
        if ri % 2 == 0:
            c.setFillColor(C_LIGHT)
            c.rect(rx, ry - row_h/2, col_w, row_h, stroke=0, fill=1)

        # Разделитель колонок (вертикальная линия)
        if ci > 0:
            c.setStrokeColor(C_LINE)
            c.setLineWidth(0.3)
            c.line(rx, ry - row_h/2, rx, ry + row_h/2)

        # Номер вопроса
        txt(c, rx + num_w - 1.5*mm, ry - 2.3, f"{qi+1}.", BOLD, 7, C_DARK, "right")

        # Кружки с буквами
        for oi in range(n_opts):
            ox = rx + num_w + oi * cell_w + cell_w / 2
            circ(c, ox, ry, r)
            txt(c, ox, ry - r * 0.38, opts[oi], BOLD, font_s, C_GRAY, "center")

    cur_y -= n_rows * row_h + 1 * mm

    hline(c, x0, cur_y, x0 + bw, lw=0.6, color=C_BLUE)
    cur_y -= 3 * mm

    # ── Код ученика — горизонтально: 5 строк × 10 цифр ──────────────────────
    # Строка = разряд кода (1..5), столбец = цифра (0..9)
    CODE_ROWS = 5
    CODE_COLS = 10
    cr    = 2.0 * mm
    gap_x = cr * 2 + 1.0 * mm   # шаг цифр
    gap_y = cr * 2 + 1.2 * mm   # шаг разрядов

    txt(c, x0 + P, cur_y, "КОД УЧЕНИКА", BOLD, 6.5, C_DARK)
    hint_x = x0 + P + CODE_COLS * gap_x + 2*mm
    txt(c, hint_x, cur_y, "Закрасьте одну цифру в каждой строке", REG, 5, C_GRAY)
    cur_y -= 4 * mm

    # Заголовок: цифры 0-9
    for di in range(CODE_COLS):
        dx = x0 + P + di * gap_x + cr
        txt(c, dx, cur_y, str(di), BOLD, 5.5, C_BLUE, "center")
    cur_y -= 3.5 * mm

    # Кружки: 5 строк (разряды) × 10 столбцов (цифры)
    for row in range(CODE_ROWS):
        ry = cur_y - row * gap_y - cr
        for col in range(CODE_COLS):
            cx = x0 + P + col * gap_x + cr
            circ(c, cx, ry, cr, lw=0.6)
            txt(c, cx, ry - cr * 0.4, str(col), BOLD, 5, C_GRAY, "center")

    cur_y -= CODE_ROWS * gap_y + 2 * mm

    # ── Нижняя строка ────────────────────────────────────────────────────────
    hline(c, x0, cur_y, x0 + bw, lw=0.3, color=C_LINE)
    cur_y -= 3.5 * mm
    info = f"Вопросов: {n_q}   |   Вариантов: {n_opts} ({', '.join(opts)})   |   Заполнять чёрной ручкой"
    txt(c, x0 + P, cur_y, info, REG, 5.5, C_GRAY)
    txt(c, x0 + bw - P, cur_y, title, REG, 5.5, C_GRAY, "right")


# ── Рендер PDF ───────────────────────────────────────────────────────────────
def render_pdf(cfg: dict, per_page: int) -> bytes:
    buf = io.BytesIO()
    pw, ph = A4
    c = canvas.Canvas(buf, pagesize=A4)
    M = 7 * mm

    if per_page == 1:
        layouts = [(M, M, pw - 2*M, ph - 2*M)]
    elif per_page == 2:
        gap  = 6 * mm
        bh   = (ph - 2*M - gap) / 2
        layouts = [
            (M, M + bh + gap, pw - 2*M, bh),
            (M, M,            pw - 2*M, bh),
        ]
    else:  # 4
        gap  = 5 * mm
        bw2  = (pw - 2*M - gap) / 2
        bh2  = (ph - 2*M - gap) / 2
        layouts = [
            (M,           M + bh2 + gap, bw2, bh2),
            (M + bw2 + gap, M + bh2 + gap, bw2, bh2),
            (M,           M,              bw2, bh2),
            (M + bw2 + gap, M,            bw2, bh2),
        ]

    for (x, y, bw, bh) in layouts:
        draw_blank(c, x, y, bw, bh, cfg)

    # Линии разреза
    c.setStrokeColor(C_GRAY)
    c.setLineWidth(0.3)
    c.setDash(4, 6)
    if per_page == 2:
        mid_y = M + (ph - 2*M - 6*mm) / 2 + 6*mm / 2 + M / 2
        c.line(M/2, mid_y, pw - M/2, mid_y)
    elif per_page == 4:
        mid_x = pw / 2
        mid_y = ph / 2
        c.line(M/2, mid_y, pw - M/2, mid_y)
        c.line(mid_x, M/2, mid_x, ph - M/2)
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
    PDF-бланк: кружки А/Б/В/Г + код ученика 5×10 (горизонтально).
    POST { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date? }
    -> { pdf_b64, filename }
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
    cfg  = {
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