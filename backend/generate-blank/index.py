"""
Генерация PDF-бланка ответов.
Сетка: номер вопроса × варианты А / Б / В / Г (русские буквы) с кружками.
Шрифт DejaVu — гарантированная кириллица.
POST / — { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date? }
Возвращает { pdf_b64, filename }
"""
import json, base64, io, math

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

# ── Шрифты ──────────────────────────────────────────────────────────────────
_fonts_registered = False

def _register():
    global _fonts_registered, REG, BOLD
    if _fonts_registered:
        return
    for name, path in [
        ("DJ",  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("DJB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]:
        try:
            pdfmetrics.registerFont(TTFont(name, path))
        except Exception:
            pass
    if "DJ" in pdfmetrics.getRegisteredFontNames():
        REG, BOLD = "DJ", "DJB"
    else:
        REG, BOLD = "Helvetica", "Helvetica-Bold"
    _fonts_registered = True

_register()
REG  = "DJ"  if "DJ"  in pdfmetrics.getRegisteredFontNames() else "Helvetica"
BOLD = "DJB" if "DJB" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"

# ── Цвета ────────────────────────────────────────────────────────────────────
BLACK  = black
WHITE  = white
DARK   = HexColor("#1a1a2e")   # тёмно-синий — заголовок
ACCENT = HexColor("#1e3a5f")   # синий — рамки
LIGHT  = HexColor("#f0f4f8")   # светло-серый — чередование строк
GRAY   = HexColor("#8898aa")   # серый — подписи
LINE   = HexColor("#c8d6e5")   # линии

# Русские метки вариантов ответа
RU_OPTS = ["А", "Б", "В", "Г", "Д", "Е"]


def _txt(c, x, y, text, font, size, color=None, align="left"):
    c.setFont(font, size)
    c.setFillColor(color or BLACK)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _hline(c, x1, y, x2, lw=0.4, color=None):
    c.setStrokeColor(color or LINE)
    c.setLineWidth(lw)
    c.line(x1, y, x2, y)


def _circle(c, cx, cy, r):
    """Пустой кружок для закрашивания."""
    c.setStrokeColor(ACCENT)
    c.setFillColor(WHITE)
    c.setLineWidth(0.8)
    c.circle(cx, cy, r, stroke=1, fill=1)


def draw_blank(c, x0, y0, bw, bh, cfg):
    n_q     = cfg["n_q"]
    opts    = cfg["opts"]          # ["А","Б","В","Г"]
    n_opts  = len(opts)
    title   = cfg["title"]
    work_id = cfg["work_id"]
    subject = cfg.get("subject", "")
    cls_lbl = cfg.get("class_label", "")
    date_s  = cfg.get("date", "")

    P = 6 * mm   # горизонтальные отступы

    # ── Внешняя рамка ────────────────────────────────────────────────────
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.0)
    c.rect(x0, y0, bw, bh, stroke=1, fill=0)

    cur_y = y0 + bh   # идём сверху вниз

    # ── Шапка ────────────────────────────────────────────────────────────
    HDR = 9 * mm
    c.setFillColor(DARK)
    c.rect(x0, cur_y - HDR, bw, HDR, stroke=0, fill=1)
    _txt(c, x0 + bw/2, cur_y - HDR + 3*mm, "БЛАНК ОТВЕТОВ", BOLD, 10, WHITE, "center")
    _txt(c, x0 + bw - P, cur_y - HDR + 3*mm, f"№ {work_id}", REG, 7.5, GRAY, "right")
    cur_y -= HDR

    # ── Поля ученика ─────────────────────────────────────────────────────
    META = 16 * mm
    c.setFillColor(LIGHT)
    c.rect(x0, cur_y - META, bw, META, stroke=0, fill=1)

    fy1 = cur_y - 5.5 * mm
    fy2 = cur_y - 11.5 * mm

    # Строка 1: ФИО  ────────────────────   Класс ───────
    _txt(c, x0 + P, fy1, "ФИО:", BOLD, 7.5, DARK)
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    c.line(x0 + P + 14*mm, fy1 - 0.5, x0 + bw*0.60, fy1 - 0.5)
    _txt(c, x0 + bw*0.62, fy1, "Класс:", BOLD, 7.5, DARK)
    c.line(x0 + bw*0.62 + 15*mm, fy1 - 0.5, x0 + bw - P, fy1 - 0.5)
    if cls_lbl:
        _txt(c, x0 + bw*0.62 + 16*mm, fy1, cls_lbl, REG, 7.5, DARK)

    # Строка 2: Предмет ─────────────  Дата ──────────
    _txt(c, x0 + P, fy2, "Предмет:", BOLD, 7.5, DARK)
    c.line(x0 + P + 21*mm, fy2 - 0.5, x0 + bw*0.55, fy2 - 0.5)
    _txt(c, x0 + bw*0.57, fy2, "Дата:", BOLD, 7.5, DARK)
    c.line(x0 + bw*0.57 + 13*mm, fy2 - 0.5, x0 + bw - P, fy2 - 0.5)
    if subject:
        _txt(c, x0 + P + 22*mm, fy2, subject, REG, 7.5, DARK)
    if date_s:
        _txt(c, x0 + bw*0.57 + 14*mm, fy2, date_s, REG, 7.5, DARK)

    cur_y -= META

    # ── Горизонтальная черта ─────────────────────────────────────────────
    _hline(c, x0, cur_y, x0 + bw, lw=0.6, color=ACCENT)
    cur_y -= 1 * mm

    # ── Расчёт сетки ─────────────────────────────────────────────────────
    # Количество колонок: подбираем чтобы строки умещались по высоте
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)

    # Ширина одной колонки
    col_w = (bw - 2*P) / n_cols

    # Ширина ячейки варианта: номер (8мм) + n_opts кружков
    num_w  = 8 * mm
    avail  = col_w - num_w - 2*mm          # место под кружки
    cell_w = min(avail / n_opts, 8 * mm)   # ширина на 1 вариант
    r      = min(cell_w * 0.35, 3.2 * mm) # радиус кружка

    row_h  = max(r * 2 + 2.5*mm, 6.5 * mm)

    n_rows = math.ceil(n_q / n_cols)
    grid_h = n_rows * row_h + 3*mm

    # ── Шапка колонок (А Б В Г) ──────────────────────────────────────────
    hdr_h = 5 * mm
    for ci in range(n_cols):
        cx0 = x0 + P + ci * col_w
        for oi, lbl in enumerate(opts):
            ox = cx0 + num_w + oi * cell_w + cell_w / 2
            _txt(c, ox, cur_y - hdr_h + 1.5*mm, lbl, BOLD, 7, ACCENT, "center")
    cur_y -= hdr_h

    # Тонкая черта под шапкой
    _hline(c, x0 + P, cur_y, x0 + bw - P, lw=0.4)
    cur_y -= 0.5*mm

    # ── Строки вопросов ───────────────────────────────────────────────────
    for qi in range(n_q):
        ci = qi % n_cols          # колонка
        ri = qi // n_cols         # строка внутри колонки

        rx = x0 + P + ci * col_w
        ry = cur_y - ri * row_h - row_h / 2

        # Чередование строк
        if ri % 2 == 0:
            c.setFillColor(LIGHT)
            c.rect(rx, ry - row_h/2, col_w, row_h, stroke=0, fill=1)

        # Вертикальный разделитель колонок (кроме последней)
        if ci < n_cols - 1:
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.line(rx + col_w, ry - row_h/2, rx + col_w, ry + row_h/2)

        # Номер вопроса
        _txt(c, rx + num_w - 2*mm, ry - 2.2, f"{qi+1}.", BOLD, 7, DARK, "right")

        # Кружки
        for oi in range(n_opts):
            ox = rx + num_w + oi * cell_w + cell_w / 2
            _circle(c, ox, ry, r)
            # Буква внутри кружка
            _txt(c, ox, ry - r*0.42, opts[oi], BOLD, max(5, r * 1.5), GRAY, "center")

    cur_y -= grid_h

    # ── Разделитель ───────────────────────────────────────────────────────
    _hline(c, x0, cur_y, x0 + bw, lw=0.6, color=ACCENT)
    cur_y -= 4 * mm

    # ── Код ученика ───────────────────────────────────────────────────────
    _txt(c, x0 + P, cur_y, "Код ученика:", BOLD, 7, DARK)
    code_x = x0 + P + 28*mm
    csz    = 6.5 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(0.8)
    for i in range(5):
        cx = code_x + i * (csz + 1.5*mm)
        c.rect(cx, cur_y - 1.5*mm, csz, csz, stroke=1, fill=0)

    cur_y -= csz + 3*mm

    # ── Подпись ───────────────────────────────────────────────────────────
    _hline(c, x0, cur_y, x0 + bw, lw=0.4, color=LINE)
    cur_y -= 3.5 * mm
    info = f"Вопросов: {n_q}   |   Вариантов: {n_opts} ({', '.join(opts)})   |   Писать чёрной ручкой"
    _txt(c, x0 + P, cur_y, info, REG, 6, GRAY)
    _txt(c, x0 + bw - P, cur_y, title, REG, 6, GRAY, "right")


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

    # Линии разреза
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
    PDF-бланк ответов: сетка вопрос × варианты А/Б/В/Г (кириллица).
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

    opts = RU_OPTS[:n_opts]   # ["А","Б","В","Г",...]

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
        "pdf_b64":       base64.b64encode(pdf_bytes).decode(),
        "filename":      f"blank_{work_id}_{n_q}q.pdf",
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
    })