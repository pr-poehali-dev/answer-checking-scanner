"""
Генерация PDF-бланка ответов. Адаптивный масштаб под perPage.
Варианты: А/Б/В/Г (кириллица). Код ученика: 5 строк × цифры 0-9.
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

C_DARK  = HexColor("#1a1a2e")
C_BLUE  = HexColor("#1e3a5f")
C_LIGHT = HexColor("#f0f4f8")
C_GRAY  = HexColor("#8898aa")
C_LINE  = HexColor("#c8d6e5")
RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]


def T(c, x, y, s, font, sz, color=C_DARK, align="left"):
    c.setFont(font, sz); c.setFillColor(color)
    if align == "center": c.drawCentredString(x, y, s)
    elif align == "right": c.drawRightString(x, y, s)
    else: c.drawString(x, y, s)

def HL(c, x1, y, x2, lw=0.4, color=C_LINE):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1, y, x2, y)

def VL(c, x, y1, y2, lw=0.3, color=C_LINE):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x, y1, x, y2)

def CR(c, cx, cy, r, stroke=C_BLUE, fill=white, lw=0.5):
    c.setStrokeColor(stroke); c.setFillColor(fill)
    c.setLineWidth(lw); c.circle(cx, cy, r, stroke=1, fill=1)


def draw_blank(c, x0, y0, bw, bh, cfg):
    n_q     = cfg["n_q"]
    opts    = cfg["opts"]
    n_opts  = len(opts)
    title   = cfg["title"]
    work_id = cfg["work_id"]
    subject = cfg.get("subject", "")
    cls_lbl = cfg.get("class_label", "")
    date_s  = cfg.get("date", "")
    sc      = cfg.get("scale", 1.0)

    def S(v): return v * sc

    P = S(4 * mm)

    # Рамка
    c.setStrokeColor(C_BLUE); c.setLineWidth(0.7)
    c.rect(x0, y0, bw, bh, stroke=1, fill=0)
    cur_y = y0 + bh

    # Шапка
    HDR = S(6.5 * mm)
    c.setFillColor(C_DARK)
    c.rect(x0, cur_y - HDR, bw, HDR, stroke=0, fill=1)
    T(c, x0+bw/2, cur_y-HDR+S(2*mm), "БЛАНК ОТВЕТОВ", BOLD, S(8.5), white, "center")
    T(c, x0+bw-P, cur_y-HDR+S(2*mm), f"№ {work_id}", REG, S(5.5), C_GRAY, "right")
    cur_y -= HDR

    # Поля ученика
    META = S(10.5 * mm)
    c.setFillColor(C_LIGHT)
    c.rect(x0, cur_y-META, bw, META, stroke=0, fill=1)
    fy1 = cur_y - S(3.2*mm)
    fy2 = cur_y - S(7.5*mm)

    T(c, x0+P, fy1, "ФИО:", BOLD, S(6.5), C_DARK)
    c.setStrokeColor(C_LINE); c.setLineWidth(0.5)
    c.line(x0+P+S(10*mm), fy1-0.3, x0+bw*0.61, fy1-0.3)
    T(c, x0+bw*0.63, fy1, "Класс:", BOLD, S(6.5), C_DARK)
    c.line(x0+bw*0.63+S(12*mm), fy1-0.3, x0+bw-P, fy1-0.3)
    if cls_lbl: T(c, x0+bw*0.63+S(13*mm), fy1, cls_lbl, REG, S(6.5), C_DARK)

    T(c, x0+P, fy2, "Предмет:", BOLD, S(6.5), C_DARK)
    c.line(x0+P+S(17*mm), fy2-0.3, x0+bw*0.55, fy2-0.3)
    T(c, x0+bw*0.57, fy2, "Дата:", BOLD, S(6.5), C_DARK)
    c.line(x0+bw*0.57+S(10*mm), fy2-0.3, x0+bw-P, fy2-0.3)
    if subject: T(c, x0+P+S(18*mm), fy2, subject, REG, S(6.5), C_DARK)
    if date_s:  T(c, x0+bw*0.57+S(11*mm), fy2, date_s, REG, S(6.5), C_DARK)

    cur_y -= META
    HL(c, x0, cur_y, x0+bw, lw=0.5, color=C_BLUE)
    cur_y -= S(0.5*mm)

    # Сетка вопросов
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    col_w  = (bw - 2*P) / n_cols
    num_w  = S(7.5*mm)
    cell_w = min((col_w - num_w) / n_opts, S(8*mm))
    r      = min(cell_w * 0.42, S(2.8*mm))
    fs     = max(S(4), r * 1.5)
    row_h  = r * 2 + S(1.4*mm)
    n_rows = math.ceil(n_q / n_cols)

    # Заголовок А Б В Г
    HDR_G = S(4.5*mm)
    for ci in range(n_cols):
        for oi, lbl in enumerate(opts):
            ox = x0 + P + ci*col_w + num_w + oi*cell_w + cell_w/2
            T(c, ox, cur_y-HDR_G+S(1.5*mm), lbl, BOLD, S(6.5), C_BLUE, "center")
    cur_y -= HDR_G
    HL(c, x0+P, cur_y, x0+bw-P, lw=0.35)
    cur_y -= S(0.2*mm)

    for qi in range(n_q):
        ci = qi % n_cols
        ri = qi // n_cols
        rx = x0 + P + ci * col_w
        ry = cur_y - ri * row_h - row_h/2

        if ri % 2 == 0:
            c.setFillColor(C_LIGHT)
            c.rect(rx, ry-row_h/2, col_w, row_h, stroke=0, fill=1)
        if ci > 0:
            VL(c, rx, ry-row_h/2, ry+row_h/2)

        T(c, rx+num_w-S(0.8*mm), ry-S(2), f"{qi+1}.", BOLD, S(6.5), C_DARK, "right")
        for oi in range(n_opts):
            ox = rx + num_w + oi*cell_w + cell_w/2
            CR(c, ox, ry, r)
            T(c, ox, ry-r*0.38, opts[oi], BOLD, fs, C_GRAY, "center")

    cur_y -= n_rows * row_h + S(0.5*mm)
    HL(c, x0, cur_y, x0+bw, lw=0.5, color=C_BLUE)
    cur_y -= S(2*mm)

    # Код ученика — компактно: заголовок 0-9 + 5 строк
    cr2   = S(1.45*mm)
    gap_x = cr2*2 + S(0.4*mm)
    gap_y = cr2*2 + S(0.7*mm)
    nw2   = S(4.5*mm)

    T(c, x0+P, cur_y, "КОД УЧЕНИКА", BOLD, S(5.5), C_DARK)
    for di in range(10):
        T(c, x0+P+nw2+di*gap_x+cr2, cur_y, str(di), BOLD, S(4.5), C_BLUE, "center")
    cur_y -= S(2.5*mm)

    for row in range(5):
        ry = cur_y - row*gap_y - cr2
        T(c, x0+P+nw2-S(0.8*mm), ry-cr2*0.35, str(row+1), BOLD, S(4.5), C_GRAY, "right")
        for col in range(10):
            cx = x0+P+nw2+col*gap_x+cr2
            CR(c, cx, ry, cr2, lw=0.5)
            T(c, cx, ry-cr2*0.4, str(col), BOLD, S(4), C_GRAY, "center")

    cur_y -= 5*gap_y + S(1.5*mm)

    # Подпись
    HL(c, x0, cur_y, x0+bw, lw=0.3, color=C_LINE)
    cur_y -= S(3*mm)
    T(c, x0+P, cur_y,
      f"Вопросов: {n_q}  |  Вариантов: {n_opts} ({', '.join(opts)})  |  Заполнять чёрной ручкой",
      REG, S(4.5), C_GRAY)
    T(c, x0+bw-P, cur_y, title, REG, S(4.5), C_GRAY, "right")


def render_pdf(cfg: dict, per_page: int) -> bytes:
    buf = io.BytesIO()
    pw, ph = A4
    c = canvas.Canvas(buf, pagesize=A4)
    M   = 6 * mm
    GAP = 5 * mm

    if per_page == 1:
        layouts = [(M, M, pw-2*M, ph-2*M, 1.0)]
    elif per_page == 2:
        bh = (ph - 2*M - GAP) / 2
        layouts = [
            (M, M+bh+GAP, pw-2*M, bh, 1.0),
            (M, M,        pw-2*M, bh, 1.0),
        ]
    else:
        bw2 = (pw - 2*M - GAP) / 2
        bh2 = (ph - 2*M - GAP) / 2
        sc  = 0.78   # масштаб: контент ~113мм → ~88мм, бланк 141мм — умещается
        layouts = [
            (M,         M+bh2+GAP, bw2, bh2, sc),
            (M+bw2+GAP, M+bh2+GAP, bw2, bh2, sc),
            (M,         M,         bw2, bh2, sc),
            (M+bw2+GAP, M,         bw2, bh2, sc),
        ]

    for (x, y, bw, bh, sc) in layouts:
        draw_blank(c, x, y, bw, bh, dict(cfg, scale=sc))

    # Линии разреза
    c.setStrokeColor(C_GRAY); c.setLineWidth(0.3); c.setDash(3, 5)
    if per_page == 2:
        my = M + (ph-2*M-GAP)/2 + GAP/2
        c.line(2*mm, my, pw-2*mm, my)
    elif per_page == 4:
        c.line(pw/2, 2*mm, pw/2, ph-2*mm)
        c.line(2*mm, ph/2, pw-2*mm, ph/2)
    c.setDash()

    c.showPage(); c.save()
    return buf.getvalue()


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    PDF-бланк с адаптивным масштабом: 1/2/4 на A4, всё умещается.
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
    if per_page not in (1, 2, 4): per_page = 1
    subject  = str(body.get("subject",    ""))[:40]
    cls_lbl  = str(body.get("classLabel", ""))[:10]
    date_s   = str(body.get("date",       ""))[:12]

    opts = RU_OPTS[:n_opts]
    cfg  = {
        "n_q": n_q, "opts": opts, "work_id": work_id, "title": title,
        "subject": subject, "class_label": cls_lbl, "date": date_s,
    }

    pdf_bytes = render_pdf(cfg, per_page)
    return _resp(200, {
        "pdf_b64":        base64.b64encode(pdf_bytes).decode(),
        "filename":       f"blank_{work_id}_{n_q}q.pdf",
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
    })
