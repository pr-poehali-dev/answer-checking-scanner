"""
Генерация PDF-бланка ответов АОУСПТ.
POST / — { workId, workTitle, perPage(1|2|4), part1Count(default 15), part2Count(default 5) }
Возвращает PDF в base64.

Бланк: только текст и линии — никаких квадратов-реперов.
Части 1 и 2 с чёткими заголовками, крупный читаемый шрифт.
"""
import json
import base64
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}


def register_font():
    try:
        pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
        return "DejaVu", "DejaVu-Bold"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


REG, BOLD = register_font()


def hline(c, x1, y, x2, lw=0.5):
    c.setLineWidth(lw)
    c.line(x1, y, x2, y)


def draw_blank(c, x0, y0, w, h, work_id, work_title, part1_count, part2_count):
    """
    Рисует один бланк в прямоугольнике (x0, y0, w, h).
    Координаты PDF: (0,0) — левый нижний угол.
    """
    total = part1_count + part2_count
    pad = 7 * mm
    right = x0 + w - pad
    inner_w = w - 2 * pad

    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0, 0, 0)

    # Внешняя рамка
    c.setLineWidth(1.5)
    c.rect(x0, y0, w, h, stroke=1, fill=0)

    cur_y = y0 + h - 7 * mm

    # ── ЗАГОЛОВОК ──────────────────────────────────────────────────────
    c.setFont(BOLD, 11)
    c.drawCentredString(x0 + w / 2, cur_y, "АОУСПТ — БЛАНК ОТВЕТОВ")
    cur_y -= 5 * mm

    c.setFont(REG, 8.5)
    c.drawCentredString(x0 + w / 2, cur_y, f"Работа № {work_id}   {work_title}")
    cur_y -= 4 * mm

    hline(c, x0, cur_y, x0 + w, 1.0)
    cur_y -= 5 * mm

    # ── КОД УЧЕНИКА ────────────────────────────────────────────────────
    c.setFont(BOLD, 9)
    c.drawString(x0 + pad, cur_y, "Код ученика (5 цифр):")
    cell = 8 * mm
    code_x = x0 + pad + 52 * mm
    c.setLineWidth(1.2)
    for i in range(5):
        cx = code_x + i * (cell + 1 * mm)
        c.rect(cx, cur_y - 1.5 * mm, cell, cell, stroke=1, fill=0)
    cur_y -= 4 * mm + cell

    # ── ФИО ────────────────────────────────────────────────────────────
    c.setFont(BOLD, 9)
    c.drawString(x0 + pad, cur_y + 2 * mm, "Фамилия, имя, отчество:")
    hline(c, x0 + pad + 58 * mm, cur_y + 1 * mm, right, 0.8)
    cur_y -= 6 * mm

    # Класс / Дата
    c.setFont(BOLD, 9)
    c.drawString(x0 + pad, cur_y + 2 * mm, "Класс:")
    hline(c, x0 + pad + 16 * mm, cur_y + 1 * mm, x0 + pad + 40 * mm, 0.8)
    c.drawString(x0 + pad + 44 * mm, cur_y + 2 * mm, "Дата:")
    hline(c, x0 + pad + 56 * mm, cur_y + 1 * mm, x0 + pad + 90 * mm, 0.8)
    cur_y -= 4 * mm

    hline(c, x0, cur_y, x0 + w, 1.0)
    cur_y -= 5 * mm

    # ── ЧАСТЬ 1 ────────────────────────────────────────────────────────
    c.setFont(BOLD, 9.5)
    c.drawString(x0 + pad, cur_y,
        f"Часть 1 — краткий ответ   (задания 1 – {part1_count},  всего {part1_count} заданий)")
    cur_y -= 4 * mm

    c.setFont(REG, 7.5)
    c.drawString(x0 + pad, cur_y, "Запишите букву или цифру в клетку. Исправление: зачеркнуть и написать рядом.")
    cur_y -= 5 * mm

    # Сетка клеток части 1: 2 колонки
    a_cell = 8 * mm
    num_w = 9 * mm
    col_gap = 6 * mm
    per_col = (part1_count + 1) // 2
    col_w = num_w + a_cell + col_gap
    grid_x = x0 + pad
    row_h = a_cell + 2 * mm

    c.setLineWidth(1.2)
    for q in range(part1_count):
        col = q // per_col
        row = q % per_col
        cx = grid_x + col * (col_w + inner_w / 2 - col_w)
        # Равномерно по ширине: 2 колонки
        cx = grid_x + col * (inner_w / 2)
        cy = cur_y - row * row_h - a_cell
        c.setFont(BOLD, 9)
        c.drawRightString(cx + num_w - 1 * mm, cy + 2.5 * mm, f"{q + 1}.")
        c.rect(cx + num_w, cy, a_cell, a_cell, stroke=1, fill=0)

    grid_rows = per_col
    cur_y -= grid_rows * row_h + 4 * mm

    hline(c, x0, cur_y, x0 + w, 1.0)
    cur_y -= 5 * mm

    # ── ЧАСТЬ 2 ────────────────────────────────────────────────────────
    if part2_count > 0:
        c.setFont(BOLD, 9.5)
        c.drawString(x0 + pad, cur_y,
            f"Часть 2 — развёрнутый ответ   (задания {part1_count + 1} – {total},  всего {part2_count} заданий)")
        cur_y -= 4 * mm

        c.setFont(REG, 7.5)
        c.drawString(x0 + pad, cur_y, "Записывайте ответ на строке. Каждое задание — отдельная строка.")
        cur_y -= 6 * mm

        line_h = 9 * mm
        for i in range(part2_count):
            q_num = part1_count + i + 1
            c.setFont(BOLD, 9)
            c.drawString(x0 + pad, cur_y + 2 * mm, f"{q_num}.")
            hline(c, x0 + pad + 10 * mm, cur_y + 1 * mm, right, 0.8)
            cur_y -= line_h

        cur_y -= 2 * mm
        hline(c, x0, cur_y, x0 + w, 1.0)
        cur_y -= 4 * mm

    # ── НИЖНЯЯ СТРОКА: допустимые символы ──────────────────────────────
    c.setFont(BOLD, 7.5)
    c.drawString(x0 + pad, cur_y, "Допустимые буквы:")
    c.setFont(REG, 7.5)
    c.drawString(x0 + pad + 36 * mm, cur_y, "А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я")
    cur_y -= 4.5 * mm

    c.setFont(BOLD, 7.5)
    c.drawString(x0 + pad, cur_y, "Допустимые цифры:")
    c.setFont(REG, 7.5)
    c.drawString(x0 + pad + 36 * mm, cur_y, "1   2   3   4   5   6   7   8   9   0")
    cur_y -= 4.5 * mm

    c.setFont(REG, 7)
    c.drawString(x0 + pad, cur_y,
        f"Всего заданий: {total}   |   Не сгибать   |   Писать синей или чёрной ручкой")


def render_pdf(work_id: str, work_title: str, per_page: int,
               part1_count: int, part2_count: int) -> bytes:
    buf = io.BytesIO()
    page_w, page_h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    margin = 8 * mm
    if per_page == 1:
        layout = [(margin, margin, page_w - 2 * margin, page_h - 2 * margin)]
    elif per_page == 2:
        h = (page_h - 3 * margin) / 2
        layout = [
            (margin, margin + h + margin, page_w - 2 * margin, h),
            (margin, margin, page_w - 2 * margin, h),
        ]
    else:  # 4
        w2 = (page_w - 3 * margin) / 2
        h2 = (page_h - 3 * margin) / 2
        layout = [
            (margin, margin + h2 + margin, w2, h2),
            (margin + w2 + margin, margin + h2 + margin, w2, h2),
            (margin, margin, w2, h2),
            (margin + w2 + margin, margin, w2, h2),
        ]

    for (x, y, bw, bh) in layout:
        draw_blank(c, x, y, bw, bh, work_id, work_title, part1_count, part2_count)

    c.showPage()
    c.save()
    return buf.getvalue()


def _resp(status: int, body, content_type: str = "application/json"):
    if isinstance(body, (dict, list)):
        body_str = json.dumps(body, ensure_ascii=False)
    else:
        body_str = body
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": content_type},
        "body": body_str,
    }


def handler(event: dict, context) -> dict:
    """Генерация PDF-бланка ответов (Часть 1 + Часть 2) без реперных меток."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
        if isinstance(body, str):
            body = json.loads(body)
    except Exception:
        body = {}

    work_id = str(body.get("workId", "000000"))[:6]
    work_title = str(body.get("workTitle", "Бланк ответов"))[:80]
    per_page = int(body.get("perPage", 1))
    if per_page not in (1, 2, 4):
        per_page = 1

    part1_count = int(body.get("part1Count", 15))
    part2_count = int(body.get("part2Count", 5))
    # Лимит: суммарно не более 40
    if part1_count < 1:
        part1_count = 1
    if part2_count < 0:
        part2_count = 0
    if part1_count + part2_count > 40:
        part1_count = min(part1_count, 40)
        part2_count = min(part2_count, 40 - part1_count)

    pdf_bytes = render_pdf(work_id, work_title, per_page, part1_count, part2_count)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    return _resp(200, {
        "pdf": pdf_b64,
        "filename": f"blank_{work_id}_{per_page}up.pdf",
        "size": len(pdf_bytes),
    })
