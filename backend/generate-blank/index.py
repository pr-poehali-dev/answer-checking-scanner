"""
Генерация PDF-бланка ответов в стиле examica.io.
Сетка: номер вопроса × варианты A / B / C / D с кружками для закрашивания.
POST / — { workId, workTitle, questionsCount, optionsCount, perPage, subject, classLabel, date }
Возвращает { pdf_b64, filename }
"""
import json
import base64
import io
import math

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


def register_font():
    try:
        pdfmetrics.registerFont(TTFont("DejaVu",      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
        return "DejaVu", "DejaVu-Bold"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


REG, BOLD = register_font()
BLUE   = HexColor("#1e40af")
LGRAY  = HexColor("#f1f5f9")
MGRAY  = HexColor("#94a3b8")
DGRAY  = HexColor("#334155")
CIRCLE_CLR = HexColor("#e2e8f0")


def hline(c, x1, y, x2, lw=0.4, color=None):
    c.setStrokeColor(color or MGRAY)
    c.setLineWidth(lw)
    c.line(x1, y, x2, y)


def draw_circle(c, cx, cy, r, fill_color=None, stroke_color=None):
    c.setStrokeColor(stroke_color or MGRAY)
    c.setFillColor(fill_color or CIRCLE_CLR)
    c.setLineWidth(0.7)
    c.circle(cx, cy, r, stroke=1, fill=1)


def draw_blank(c, x0, y0, bw, bh, cfg):
    """
    Рисует один бланк в прямоугольнике (x0, y0, bw, bh).
    Координаты PDF: y растёт вверх.
    """
    n_q      = cfg["questions"]          # кол-во вопросов
    opts     = cfg["options"]            # список меток: ["A","B","C","D"]
    work_id  = cfg["work_id"]
    title    = cfg["title"]
    subject  = cfg.get("subject", "")
    cls_lbl  = cfg.get("class_label", "")
    date_str = cfg.get("date", "")

    PAD  = 5 * mm
    cur_y = y0 + bh - PAD

    # ── Внешняя рамка ──────────────────────────────────────────────────
    c.setStrokeColor(BLUE)
    c.setLineWidth(1.2)
    c.rect(x0, y0, bw, bh, stroke=1, fill=0)

    # ── Шапка (синяя полоса) ─────────────────────────────────────────
    header_h = 10 * mm
    c.setFillColor(BLUE)
    c.rect(x0, cur_y - header_h + 2*mm, bw, header_h, stroke=0, fill=1)

    c.setFillColor(white)
    c.setFont(BOLD, 9)
    c.drawCentredString(x0 + bw / 2, cur_y - header_h + 4.5 * mm, "БЛАНК ОТВЕТОВ")

    c.setFont(REG, 7)
    right_text = f"Работа: {work_id}"
    c.drawRightString(x0 + bw - PAD, cur_y - header_h + 4.5 * mm, right_text)

    cur_y -= header_h - 2 * mm + 2 * mm

    # ── Данные ученика ────────────────────────────────────────────────
    c.setFillColor(LGRAY)
    meta_h = 18 * mm
    c.rect(x0, cur_y - meta_h, bw, meta_h, stroke=0, fill=1)

    c.setFillColor(DGRAY)
    c.setFont(BOLD, 7.5)

    field_y = cur_y - 5 * mm
    c.drawString(x0 + PAD, field_y, "ФИО:")
    c.setStrokeColor(MGRAY)
    c.setLineWidth(0.6)
    c.line(x0 + PAD + 13 * mm, field_y, x0 + bw * 0.62, field_y)

    c.drawString(x0 + bw * 0.64, field_y, "Класс:")
    c.line(x0 + bw * 0.64 + 14 * mm, field_y, x0 + bw - PAD, field_y)

    field_y -= 7 * mm
    c.drawString(x0 + PAD, field_y, "Предмет:")
    c.line(x0 + PAD + 20 * mm, field_y, x0 + bw * 0.45, field_y)

    c.drawString(x0 + bw * 0.47, field_y, "Дата:")
    c.line(x0 + bw * 0.47 + 13 * mm, field_y, x0 + bw - PAD, field_y)

    # Предзаполнение если переданы
    c.setFont(REG, 7.5)
    c.setFillColor(black)
    if subject:
        c.drawString(x0 + PAD + 21 * mm, field_y + 1 * mm, subject)
    if cls_lbl:
        c.drawString(x0 + bw * 0.64 + 15 * mm, cur_y - 5 * mm + 1 * mm, cls_lbl)
    if date_str:
        c.drawString(x0 + bw * 0.47 + 14 * mm, field_y + 1 * mm, date_str)

    cur_y -= meta_h + 2 * mm

    # ── Подзаголовок сетки ────────────────────────────────────────────
    c.setFillColor(DGRAY)
    c.setFont(BOLD, 7.5)
    c.drawString(x0 + PAD, cur_y, f"Вопросы 1–{n_q}")
    c.setFont(REG, 6.5)
    c.setFillColor(MGRAY)
    c.drawString(x0 + PAD + 22 * mm, cur_y, "Закрасьте кружок рядом с верным ответом")
    cur_y -= 4 * mm

    # ── Сетка вопросов ───────────────────────────────────────────────
    n_cols    = 2 if n_q <= 30 else (3 if n_q <= 60 else 4)
    rows      = math.ceil(n_q / n_cols)

    col_w     = (bw - 2 * PAD) / n_cols
    n_opts    = len(opts)
    opt_w     = min(6 * mm, (col_w - 12 * mm) / max(n_opts, 1))
    r_circle  = opt_w * 0.38
    row_h     = max(r_circle * 2 + 1.8 * mm, 5.5 * mm)
    num_w     = 8 * mm

    grid_top  = cur_y
    grid_h    = rows * row_h + 2 * mm

    # Фон сетки
    c.setFillColor(white)
    c.rect(x0, cur_y - grid_h, bw, grid_h, stroke=0, fill=1)

    for q_idx in range(n_q):
        col_i = q_idx % n_cols
        row_i = q_idx // n_cols

        rx = x0 + PAD + col_i * col_w
        ry = grid_top - row_i * row_h - row_h / 2 - 1 * mm

        # Чередующийся фон строки (по строкам сетки)
        if row_i % 2 == 0:
            c.setFillColor(LGRAY)
            c.rect(rx, ry - row_h / 2, col_w, row_h, stroke=0, fill=1)

        # Номер вопроса
        c.setFillColor(DGRAY)
        c.setFont(BOLD, 7)
        c.drawRightString(rx + num_w - 1 * mm, ry - 2.5, f"{q_idx + 1}.")

        # Кружки вариантов
        for o_idx, opt_label in enumerate(opts):
            cx = rx + num_w + o_idx * (opt_w + 0.5 * mm) + opt_w / 2
            cy = ry

            draw_circle(c, cx, cy, r_circle, fill_color=white, stroke_color=MGRAY)

            c.setFillColor(DGRAY)
            c.setFont(BOLD, max(5.5, r_circle * 1.3))
            c.drawCentredString(cx, cy - r_circle * 0.38, opt_label)

    cur_y -= grid_h + 2 * mm

    # Разделитель
    hline(c, x0, cur_y, x0 + bw, lw=0.5, color=MGRAY)
    cur_y -= 4 * mm

    # ── Код ученика + легенда ─────────────────────────────────────────
    c.setFillColor(DGRAY)
    c.setFont(BOLD, 7)
    c.drawString(x0 + PAD, cur_y, "КОД УЧЕНИКА:")
    code_x = x0 + PAD + 28 * mm
    cell_sz = 6 * mm
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.8)
    for i in range(5):
        cx = code_x + i * (cell_sz + 1 * mm)
        c.rect(cx, cur_y - 1.5 * mm, cell_sz, cell_sz, stroke=1, fill=0)

    # Легенда справа
    c.setFont(REG, 5.5)
    c.setFillColor(MGRAY)
    legend_x = x0 + bw - PAD - 50 * mm
    c.drawString(legend_x, cur_y, "○ — пусто   ● — ваш ответ   ✕ — исправление")

    cur_y -= cell_sz + 3 * mm

    # ── Нижний колонтитул ────────────────────────────────────────────
    hline(c, x0, cur_y, x0 + bw, lw=0.5, color=MGRAY)
    cur_y -= 3.5 * mm
    c.setFont(REG, 6)
    c.setFillColor(MGRAY)
    c.drawString(x0 + PAD, cur_y, f"Всего вопросов: {n_q}   |   Вариантов ответа: {n_opts}   |   Писать чёрной ручкой")
    c.drawRightString(x0 + bw - PAD, cur_y, title)


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
    else:  # 4
        bw2 = (pw - 3*M) / 2
        bh2 = (ph - 3*M) / 2
        layouts = [
            (M,          M + bh2 + M, bw2, bh2),
            (M + bw2 + M, M + bh2 + M, bw2, bh2),
            (M,          M,           bw2, bh2),
            (M + bw2 + M, M,          bw2, bh2),
        ]

    for (x, y, bw, bh) in layouts:
        draw_blank(c, x, y, bw, bh, cfg)

    # Пунктирные линии разреза между бланками
    if per_page == 2:
        cut_y = M + (ph - 3*M) / 2 + M / 2
        c.setStrokeColor(MGRAY)
        c.setLineWidth(0.4)
        c.setDash(3, 4)
        c.line(M, cut_y, pw - M, cut_y)
        c.setDash()  # сброс

    if per_page == 4:
        mid_x = pw / 2
        mid_y = ph / 2
        c.setStrokeColor(MGRAY)
        c.setLineWidth(0.4)
        c.setDash(3, 4)
        c.line(mid_x, M, mid_x, ph - M)
        c.line(M, mid_y, pw - M, mid_y)
        c.setDash()

    c.showPage()
    c.save()
    return buf.getvalue()


def _resp(status: int, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    Генерация PDF-бланка с сеткой A/B/C/D (стиль examica.io).
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

    work_id     = str(body.get("workId",     "000000"))[:10]
    title       = str(body.get("workTitle",  "Бланк ответов"))[:60]
    n_q         = max(1, min(int(body.get("questionsCount", 20)), 80))
    n_opts      = max(2, min(int(body.get("optionsCount",   4)),  6))
    per_page    = int(body.get("perPage", 1))
    if per_page not in (1, 2, 4):
        per_page = 1
    subject     = str(body.get("subject",    ""))[:40]
    cls_lbl     = str(body.get("classLabel", ""))[:10]
    date_str    = str(body.get("date",       ""))[:12]

    # Метки вариантов: A B C D E F (по числу optionsCount)
    all_labels = ["A", "B", "C", "D", "E", "F"]
    opts = all_labels[:n_opts]

    cfg = {
        "questions":    n_q,
        "options":      opts,
        "work_id":      work_id,
        "title":        title,
        "subject":      subject,
        "class_label":  cls_lbl,
        "date":         date_str,
    }

    pdf_bytes = render_pdf(cfg, per_page)
    pdf_b64   = base64.b64encode(pdf_bytes).decode()
    filename  = f"blank_{work_id}_{n_q}q.pdf"

    return _resp(200, {
        "pdf_b64":  pdf_b64,
        "filename": filename,
        "questionsCount": n_q,
        "optionsCount":   n_opts,
        "options":        opts,
    })
