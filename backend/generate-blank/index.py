"""
Генерация PDF-бланков ответов «САОУ» (бланк с закрашиваемыми кружками).

Как устроен бланк:
  • в углах четыре чёрных квадрата-метки — по ним программа выравнивает фото;
  • вверху код ученика: 5 строк по 10 цифр, в каждой строке закрашивается один
    кружок (на именных бланках код уже впечатан);
  • ниже ответы: номер вопроса и ряд кружков А Б В Г Д Е — ученик ставит
    крестик в кружке выбранного ответа. Если ошибся — полностью закрашивает
    верный кружок: закрашенный кружок важнее крестика.

На лист A4 помещается от 1 до 4 бланков — зависит от числа вопросов и вариантов.
Между бланками печатаются пунктирные линии отреза.

POST / — { workId, workTitle, questionsCount, optionsCount(2-6),
           subject?, classLabel?, date?,
           students?: [{ code, name, classLabel }] }
-> { pdf_b64, filename, perSheet, sheets, ... }
"""
import json, base64, io, os, math

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white

import geometry as G

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}


def _reg():
    """Регистрирует встроенный шрифт с кириллицей (Helvetica русских букв не содержит)."""
    try:
        import fonts_data
        pdfmetrics.registerFont(TTFont("F", io.BytesIO(fonts_data.REGULAR)))
        pdfmetrics.registerFont(TTFont("FB", io.BytesIO(fonts_data.BOLD)))
        return "F", "FB"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


REG, BOLD = _reg()

C_DARK = HexColor("#1a1a2e")
C_BLUE = HexColor("#1e3a5f")
C_GRAY = HexColor("#6f7f90")
C_RULE = HexColor("#9fb3c8")
C_RING = HexColor("#4a5b70")
C_LETTER = HexColor("#9aa8b8")

INSTRUCTION = [
    "Ответ: поставьте крестик",
    "в кружке. Ошиблись —",
    "закрасьте полностью",
    "верный кружок.",
    "Код: закрасьте цифры.",
]


class Slot:
    """Один бланк на листе: переводит координаты бланка (мм, Y вниз) в PDF."""

    def __init__(self, c, sx, sy, w, h):
        self.c, self.sx, self.sy, self.w, self.h = c, sx, sy, w, h

    def X(self, x):
        return (self.sx + x) * mm

    def Y(self, y):
        return (G.SHEET_H - self.sy - y) * mm

    def text(self, x, y, s, font, size, color=C_DARK, align="left"):
        c = self.c
        c.setFont(font, size)
        c.setFillColor(color)
        if align == "center":
            c.drawCentredString(self.X(x), self.Y(y), s)
        elif align == "right":
            c.drawRightString(self.X(x), self.Y(y), s)
        else:
            c.drawString(self.X(x), self.Y(y), s)

    def hline(self, x1, x2, y, lw=0.4, color=C_RULE):
        c = self.c
        c.setStrokeColor(color)
        c.setLineWidth(lw)
        c.line(self.X(x1), self.Y(y), self.X(x2), self.Y(y))

    def square(self, cx, cy, side):
        c = self.c
        c.setFillColor(black)
        c.rect(self.X(cx - side / 2), self.Y(cy + side / 2), side * mm, side * mm, stroke=0, fill=1)

    def bubble(self, x, y, r, filled=False, label=None, label_size=6.0):
        c = self.c
        if filled:
            c.setFillColor(black)
            c.circle(self.X(x), self.Y(y), r * mm, stroke=0, fill=1)
            return
        c.setStrokeColor(C_RING)
        c.setLineWidth(0.6)
        c.setFillColor(white)
        c.circle(self.X(x), self.Y(y), r * mm, stroke=1, fill=1)
        if label:
            c.setFont(REG, label_size)
            c.setFillColor(C_LETTER)
            c.drawCentredString(self.X(x), self.Y(y) - label_size * 0.36, label)


def _fit(text, font, size, max_w_mm):
    """Обрезает строку, чтобы она поместилась в заданную ширину."""
    max_pt = max_w_mm * mm
    if pdfmetrics.stringWidth(text, font, size) <= max_pt:
        return text
    while text and pdfmetrics.stringWidth(text + "…", font, size) > max_pt:
        text = text[:-1]
    return text + "…"


def draw_blank(c, slot_xywh, cfg):
    sx, sy, w, h = slot_xywh
    sl = Slot(c, sx, sy, w, h)
    n_q, n_opts = cfg["n_q"], cfg["n_opts"]
    opts = G.OPT_LABELS[:n_opts]
    stu_code = cfg.get("student_code", "")
    stu_name = cfg.get("student_name", "")
    inner_r = w - G.PAD

    for name, (mx, my) in G.marker_centers(w, h).items():
        sl.square(mx, my, G.BIG_MARK if name == "tl" else G.SMALL_MARK)

    sl.text(11, G.Y_TITLE, "БЛАНК ОТВЕТОВ", BOLD, 8, C_BLUE)
    sl.text(inner_r, G.Y_TITLE, f"№{cfg['work_id']}", REG, 5.5, C_GRAY, "right")
    sl.hline(11, inner_r, G.Y_RULE, lw=0.5)

    info = cfg.get("title", "")
    extra = " · ".join(x for x in (cfg.get("subject"), cfg.get("class_label"), cfg.get("date")) if x)
    if extra:
        info = f"{info} · {extra}" if info else extra
    if info:
        sl.text(G.PAD, G.Y_INFO, _fit(info, REG, 5.5, w - 2 * G.PAD), REG, 5.5, C_GRAY)

    if stu_name:
        sl.text(G.PAD, G.Y_NAME, _fit(stu_name, BOLD, 7, w - 2 * G.PAD), BOLD, 7, C_DARK)
    else:
        sl.text(G.PAD, G.Y_NAME, "ФИО:", BOLD, 6.5, C_DARK)
        sl.hline(G.PAD + 8, inner_r, G.Y_NAME + 0.7, lw=0.5)

    sl.text(G.PAD, G.Y_CODE_LABEL, "КОД УЧЕНИКА", BOLD, 5.6, C_BLUE)

    for d in range(G.CODE_DIGITS):
        x = G.PAD + G.CODE_LABEL_W + G.CODE_R + d * G.CODE_PX
        sl.text(x, G.Y_DIGITS, str(d), BOLD, 5.6, C_DARK, "center")
    for p in range(G.CODE_LEN):
        y = G.Y_CODE_ROW0 + p * G.CODE_PY
        sl.text(G.PAD + G.CODE_LABEL_W - 1.3, y + 0.7, str(p + 1), REG, 4.6, C_GRAY, "right")
    for (p, d, x, y) in G.code_bubbles():
        on = bool(stu_code) and p < len(stu_code) and stu_code[p] == str(d)
        sl.bubble(x, y, G.CODE_R, filled=on)

    code_w = G.CODE_LABEL_W + G.CODE_DIGITS * G.CODE_PX
    if G.instr_below(w):
        y = G.Y_CODE_ROW0 + (G.CODE_LEN - 1) * G.CODE_PY + G.CODE_R + 3.4
        for i, line in enumerate(INSTRUCTION):
            sl.text(G.PAD, y + i * 3.0, line, REG, 5, C_GRAY)
    else:
        x = G.PAD + code_w + 3
        for i, line in enumerate(INSTRUCTION):
            sl.text(x, G.Y_CODE_LABEL + 3.0 * i, line, REG, 5, C_GRAY)

    qc = max(1, G.question_columns(w, n_opts))
    rows = math.ceil(n_q / qc)
    col_step = (w - 2 * G.PAD) / qc
    for q in range(n_q):
        col, row = divmod(q, rows)
        x_col = G.PAD + col * col_step
        cy = G.head_end(w) + (row + 0.5) * G.ROW_H
        sl.text(x_col + G.NUM_W - 1.6, cy + 0.9, f"{q + 1}.", BOLD, 7, C_DARK, "right")
    for (q, j, x, y) in G.answer_bubbles(w, h, n_q, n_opts):
        sl.bubble(x, y, G.BUB_R, label=opts[j])

    foot = f"САОУ · {n_q} вопр. · {opts[0]}–{opts[-1]}"
    sl.text(w / 2, h - 2.6, foot, REG, 4.2, C_LETTER, "center")


def _cut_lines(c, rects, cols, rows):
    if len(rects) < 2:
        return
    c.setStrokeColor(C_GRAY)
    c.setLineWidth(0.3)
    c.setDash(2, 3)
    sw, sh = G.slot_size(cols, rows)
    for k in range(1, cols):
        x = (G.SHEET_MARGIN + k * sw + (k - 0.5) * G.SLOT_GAP) * mm
        c.line(x, 2 * mm, x, (G.SHEET_H - 2) * mm)
    for k in range(1, rows):
        y = (G.SHEET_H - (G.SHEET_MARGIN + k * sh + (k - 0.5) * G.SLOT_GAP)) * mm
        c.line(2 * mm, y, (G.SHEET_W - 2) * mm, y)
    c.setDash()


def render_pdf(cfg, students):
    """Раскладывает бланки по листам A4. Возвращает (pdf_bytes, per_sheet, sheets)."""
    per, cs, rs = G.choose_layout(cfg["n_q"], cfg["n_opts"])
    rects = G.slot_rects(cs, rs)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(G.SHEET_W * mm, G.SHEET_H * mm))

    items = students if students else [None] * per
    sheets = 0
    for i, stu in enumerate(items):
        slot = i % per
        if i > 0 and slot == 0:
            _cut_lines(c, rects, cs, rs)
            c.showPage()
            sheets += 1
        scfg = dict(cfg)
        if stu:
            scfg["student_name"] = stu.get("name", "")
            scfg["student_code"] = stu.get("code", "")
            if stu.get("classLabel"):
                scfg["class_label"] = stu["classLabel"]
        draw_blank(c, rects[slot], scfg)
    _cut_lines(c, rects, cs, rs)
    c.showPage()
    c.save()
    return buf.getvalue(), per, sheets + 1


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """PDF-бланк с закрашиваемыми кружками: код ученика и ответы на вопросы."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    work_id = str(body.get("workId", "000000"))[:10]
    title = str(body.get("workTitle", ""))[:60]
    n_q = max(1, min(int(body.get("questionsCount") or 20), G.MAX_Q))
    n_opts = max(2, min(int(body.get("optionsCount") or 4), 6))
    subject = str(body.get("subject", ""))[:40]
    cls_lbl = str(body.get("classLabel", ""))[:10]
    date_s = str(body.get("date", ""))[:12]

    raw = body.get("students") or []
    students = []
    if isinstance(raw, list):
        for s in raw[:300]:
            code = "".join(ch for ch in str(s.get("code", "")) if ch.isdigit())[:G.CODE_LEN]
            name = str(s.get("name", "")).strip()[:60]
            clbl = str(s.get("classLabel", "")).strip()[:10]
            if len(code) == G.CODE_LEN and name:
                students.append({"code": code, "name": name, "classLabel": clbl})

    cfg = {"n_q": n_q, "n_opts": n_opts, "work_id": work_id, "title": title,
           "subject": subject, "class_label": cls_lbl, "date": date_s}

    pdf_bytes, per_sheet, sheets = render_pdf(cfg, students)
    suffix = f"_{len(students)}st" if students else ""
    return _resp(200, {
        "pdf_b64": base64.b64encode(pdf_bytes).decode(),
        "filename": f"blank_{work_id}_{n_q}q{suffix}.pdf",
        "questionsCount": n_q,
        "optionsCount": n_opts,
        "options": G.OPT_LABELS[:n_opts],
        "studentsCount": len(students),
        "perSheet": per_sheet,
        "sheets": sheets,
    })
