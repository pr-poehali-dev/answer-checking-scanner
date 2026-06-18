"""
Генерация PDF-бланка ответов.
Ответы: кружки с буквой (закрашивать).
Идентификация ученика: персональный QR-код (вместо зоны кода 0-9) + реперы вокруг.
POST / — { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4),
           subject?, classLabel?, date?,
           students?: [{ code, name, classLabel }] }
-> { pdf_b64, filename }
Если students пуст — печатается один пустой бланк без QR.
"""
import json, base64, io, math, os

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

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

def CR(c, cx, cy, r, stroke=C_BLUE, fill=white, lw=0.6):
    """Кружок (для ответов и кода ученика)."""
    c.setStrokeColor(stroke); c.setFillColor(fill)
    c.setLineWidth(lw); c.circle(cx, cy, r, stroke=1, fill=1)

def ANCHOR(c, cx, cy, side):
    """Жирный чёрный квадрат-репер для OCR-навигации (сплошная заливка)."""
    c.setFillColor(black); c.setStrokeColor(black); c.setLineWidth(0)
    c.rect(cx - side/2, cy - side/2, side, side, stroke=0, fill=1)


QR_PREFIX = "SAOU"


def QR(c, cx, cy, size, value):
    """Рисует QR-код по центру (cx, cy) со стороной size."""
    qr = QrCodeWidget(value)
    qr.barLevel = "M"
    b = qr.getBounds()
    qw = b[2] - b[0]
    qh = b[3] - b[1]
    d = Drawing(size, size, transform=[size / qw, 0, 0, size / qh, 0, 0])
    d.add(qr)
    renderPDF.draw(d, c, cx - size / 2, cy - size / 2)


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
    stu_name = cfg.get("student_name", "")   # ФИО ученика (печатается готовым)
    stu_code = cfg.get("student_code", "")   # 5-значный код для QR

    def S(v): return v * sc

    P = S(4 * mm)

    # Светлый, БЕЗ тёмных рамок. Геометрия (высоты блоков) сохранена, чтобы
    # шаблон распознавания совпадал. Цвета — только тонкие линии и текст.
    cur_y = y0 + bh

    # ── Шапка (только текст) ──────────────────────────────────────────────────
    HDR = S(6.5 * mm)
    T(c, x0+bw/2, cur_y-HDR+S(2.2*mm), "БЛАНК ОТВЕТОВ", BOLD, S(8.5), C_BLUE, "center")
    T(c, x0+bw-P, cur_y-HDR+S(2.2*mm), f"№ {work_id}", REG, S(5.5), C_GRAY, "right")
    cur_y -= HDR
    HL(c, x0+P, cur_y, x0+bw-P, lw=0.5, color=C_LINE)

    # ── Поля ученика (только линии для записи) ────────────────────────────────
    META = S(10.5 * mm)
    fy1 = cur_y - S(3.2*mm)
    fy2 = cur_y - S(7.5*mm)

    T(c, x0+P, fy1, "ФИО:", BOLD, S(6.5), C_DARK)
    c.setStrokeColor(C_LINE); c.setLineWidth(0.5)
    c.line(x0+P+S(10*mm), fy1-0.3, x0+bw*0.61, fy1-0.3)
    if stu_name: T(c, x0+P+S(11*mm), fy1, stu_name[:40], BOLD, S(6.5), C_DARK)
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
    HL(c, x0+P, cur_y, x0+bw-P, lw=0.5, color=C_LINE)

    # ── Инструкция (только текст) ─────────────────────────────────────────────
    INST = S(5.5 * mm)
    T(c, x0+P, cur_y - S(3.4*mm),
      "Инструкция: закрасьте нужный кружок полностью.  "
      "Если исправляете — зачеркните неверный и закрасьте правильный.",
      REG, S(4.8), C_DARK)
    cur_y -= INST
    HL(c, x0+P, cur_y, x0+bw-P, lw=0.5, color=C_LINE)
    cur_y -= S(0.5*mm)

    # ── Сетка вопросов: КРУЖКИ с буквой ──────────────────────────────────────
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    n_rows = math.ceil(n_q / n_cols)
    col_w  = (bw - 2*P) / n_cols
    num_w  = S(7.5*mm)
    cell_w = min((col_w - num_w) / n_opts, S(8.5*mm))
    sq     = min(cell_w * 0.78, S(5.5*mm))   # диаметр кружка ответа (геом. совместимо)
    fs     = max(S(4), sq * 0.46)
    row_h  = sq + S(2.0*mm)
    anc    = S(5.5*mm)   # размер репера — крупнее для надёжной детекции

    # Заголовок А Б В Г
    HDR_G = S(4.5*mm)
    for ci in range(n_cols):
        for oi, lbl in enumerate(opts):
            ox = x0 + P + ci*col_w + num_w + oi*cell_w + cell_w/2
            T(c, ox, cur_y-HDR_G+S(1.5*mm), lbl, BOLD, S(6.5), C_BLUE, "center")
    cur_y -= HDR_G
    cur_y -= S(0.2*mm)

    # Запоминаем Y начала сетки (верх первой строки)
    grid_top_y = cur_y

    for qi in range(n_q):
        ci = qi // n_rows
        ri = qi % n_rows
        rx = x0 + P + ci * col_w
        ry = cur_y - ri * row_h - row_h/2

        T(c, rx+num_w-S(0.8*mm), ry-S(2), f"{qi+1}.", BOLD, S(6.5), C_DARK, "right")

        for oi in range(n_opts):
            ox = rx + num_w + oi*cell_w + cell_w/2
            CR(c, ox, ry, sq/2)
            T(c, ox, ry-sq*0.30, opts[oi], BOLD, fs, C_GRAY, "center")

    grid_bottom_y = cur_y - n_rows * row_h
    cur_y = grid_bottom_y - S(0.5*mm)

    # ── 4 якорных квадрата — за пределами сетки ответов ─────────────────────
    # По X: левее левого края и правее правого края бланка (в поле рамки)
    # По Y: выше первой строки и ниже последней (с зазором row_h)
    ax_l = x0 + P / 2          # левее сетки, в левом поле
    ax_r = x0 + bw - P / 2     # правее сетки, в правом поле
    ay_t = grid_top_y + anc / 2 + S(1*mm)          # над первой строкой
    ay_b = grid_bottom_y - anc / 2 - S(1*mm)       # под последней строкой
    ANCHOR(c, ax_l, ay_t, anc)
    ANCHOR(c, ax_r, ay_t, anc)
    ANCHOR(c, ax_l, ay_b, anc)
    ANCHOR(c, ax_r, ay_b, anc)

    cur_y -= S(6*mm)   # зазор: зона идентификации не сливается с ответами
    HL(c, x0+P, cur_y, x0+bw-P, lw=0.4, color=C_LINE)
    cur_y -= S(3*mm)

    # ── Идентификация ученика: персональный QR-код + реперы ─────────────────
    qr_size = S(22*mm)              # сторона QR
    anc_c   = S(4.0*mm)             # размер репера зоны QR
    qr_pad  = S(2.0*mm)             # отступ репера от QR
    qr_top_y = cur_y - S(1*mm)
    qr_cx    = x0 + P + qr_size/2 + S(2*mm)
    qr_cy    = qr_top_y - qr_size/2

    if stu_code:
        QR(c, qr_cx, qr_cy, qr_size, f"{QR_PREFIX}:{work_id}:{stu_code}")
    else:
        # Пустой бланк без ученика — рамка-плейсхолдер
        c.setStrokeColor(C_LINE); c.setLineWidth(0.6)
        c.rect(qr_cx - qr_size/2, qr_cy - qr_size/2, qr_size, qr_size, stroke=1, fill=0)
        T(c, qr_cx, qr_cy, "QR ученика", REG, S(4.5), C_GRAY, "center")

    # 4 репера вокруг QR (для надёжного поиска зоны)
    qa_l = qr_cx - qr_size/2 - qr_pad - anc_c/2
    qa_r = qr_cx + qr_size/2 + qr_pad + anc_c/2
    qa_t = qr_cy + qr_size/2 + qr_pad + anc_c/2
    qa_b = qr_cy - qr_size/2 - qr_pad - anc_c/2
    ANCHOR(c, qa_l, qa_t, anc_c)
    ANCHOR(c, qa_r, qa_t, anc_c)
    ANCHOR(c, qa_l, qa_b, anc_c)
    ANCHOR(c, qa_r, qa_b, anc_c)

    # Подпись справа от QR
    tx = qr_cx + qr_size/2 + qr_pad + anc_c + S(4*mm)
    T(c, tx, qr_cy + S(4*mm), "ИДЕНТИФИКАЦИЯ УЧЕНИКА", BOLD, S(5.5), C_DARK)
    if stu_name:
        T(c, tx, qr_cy - S(1*mm), stu_name[:36], BOLD, S(6), C_BLUE)
    T(c, tx, qr_cy - S(6*mm),
      "QR-код определяет ученика автоматически. Не сгибайте и не закрашивайте.",
      REG, S(4.3), C_GRAY)

    cur_y = qa_b - S(3*mm)   # низ зоны QR

    # ── Подпись ──────────────────────────────────────────────────────────────
    HL(c, x0, cur_y, x0+bw, lw=0.3, color=C_LINE)
    cur_y -= S(3*mm)
    T(c, x0+P, cur_y,
      f"Вопросов: {n_q}  |  Вариантов: {n_opts} ({', '.join(opts)})  |  Заполнять чёрной ручкой",
      REG, S(4.5), C_GRAY)
    T(c, x0+bw-P, cur_y, title, REG, S(4.5), C_GRAY, "right")


def _page_layouts(per_page: int):
    pw, ph = A4
    M   = 6 * mm
    GAP = 5 * mm
    if per_page == 1:
        return [(M, M, pw-2*M, ph-2*M, 1.0)]
    elif per_page == 2:
        bh = (ph - 2*M - GAP) / 2
        return [
            (M, M+bh+GAP, pw-2*M, bh, 1.0),
            (M, M,        pw-2*M, bh, 1.0),
        ]
    else:
        bw2 = (pw - 2*M - GAP) / 2
        bh2 = (ph - 2*M - GAP) / 2
        sc  = 0.78
        return [
            (M,         M+bh2+GAP, bw2, bh2, sc),
            (M+bw2+GAP, M+bh2+GAP, bw2, bh2, sc),
            (M,         M,         bw2, bh2, sc),
            (M+bw2+GAP, M,         bw2, bh2, sc),
        ]


def _page_cut_lines(c, per_page: int):
    pw, ph = A4
    M = 6 * mm
    GAP = 5 * mm
    c.setStrokeColor(C_GRAY); c.setLineWidth(0.3); c.setDash(3, 5)
    if per_page == 2:
        my = M + (ph-2*M-GAP)/2 + GAP/2
        c.line(2*mm, my, pw-2*mm, my)
    elif per_page == 4:
        c.line(pw/2, 2*mm, pw/2, ph-2*mm)
        c.line(2*mm, ph/2, pw-2*mm, ph/2)
    c.setDash()


def render_pdf(cfg: dict, per_page: int, students: list) -> bytes:
    """Если students пуст — один пустой бланк. Иначе — по бланку на ученика,
    раскладывая по per_page слотам на страницу."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    layouts = _page_layouts(per_page)
    slots = len(layouts)

    # Список "заданий": каждый — данные ученика (или пустой бланк)
    items = students if students else [None]

    for i, stu in enumerate(items):
        slot = i % slots
        if i > 0 and slot == 0:
            _page_cut_lines(c, per_page)
            c.showPage()
        x, y, bw, bh, sc = layouts[slot]
        scfg = dict(cfg, scale=sc)
        if stu:
            scfg["student_name"] = stu.get("name", "")
            scfg["student_code"] = stu.get("code", "")
            if stu.get("classLabel"):
                scfg["class_label"] = stu.get("classLabel")
        draw_blank(c, x, y, bw, bh, scfg)

    _page_cut_lines(c, per_page)
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
    PDF-бланк: квадраты для крестиков + кружки кода ученика.
    POST { workId, workTitle, questionsCount, optionsCount(2-6), perPage(1|2|4) }
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

    # Список учеников: каждый получит персональный бланк с ФИО + QR
    raw_students = body.get("students") or []
    students = []
    if isinstance(raw_students, list):
        for s in raw_students[:200]:
            code = str(s.get("code", "")).strip()[:16]
            name = str(s.get("name", "")).strip()[:60]
            clbl = str(s.get("classLabel", "")).strip()[:10]
            if code and name:
                students.append({"code": code, "name": name, "classLabel": clbl})

    opts = RU_OPTS[:n_opts]
    cfg  = {
        "n_q": n_q, "opts": opts, "work_id": work_id, "title": title,
        "subject": subject, "class_label": cls_lbl, "date": date_s,
    }

    pdf_bytes = render_pdf(cfg, per_page, students)
    suffix = f"_{len(students)}st" if students else ""
    return _resp(200, {
        "pdf_b64":        base64.b64encode(pdf_bytes).decode(),
        "filename":       f"blank_{work_id}_{n_q}q{suffix}.pdf",
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
        "studentsCount":  len(students),
    })