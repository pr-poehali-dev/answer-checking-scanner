"""
Генерация PDF-бланка ответов АОУСПТ.
POST / — { workId, workTitle, perPage(1|2|4), questionsCount(default 40) }
Возвращает PDF в base64.

Бланк оптимизирован под OCR:
- 4 чёрных квадрата-репера (anchors) по углам
- Жирная рамка по периметру
- Сверху: 5 клеток для кода ученика
- Образец русских букв и цифр
- 40 ячеек для ответов (1 символ = 1 клетка)
- Только Ч/Б, без серого
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

ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
DIGITS = "0123456789"


def register_font():
    """Подключаем DejaVuSans (поддержка кириллицы) — есть в системе reportlab."""
    try:
        pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
        return "DejaVu", "DejaVu-Bold"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


REG, BOLD = register_font()


def draw_anchor(c, x, y, size=5 * mm):
    """Чёрный квадрат-репер для OCR-выравнивания."""
    c.setFillColorRGB(0, 0, 0)
    c.rect(x, y, size, size, stroke=0, fill=1)


def draw_blank(c, x0, y0, w, h, work_id, work_title, q_count):
    """
    Рисует один бланк в прямоугольнике (x0,y0,w,h).
    Координаты PDF: (0,0) — левый нижний угол.
    """
    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0, 0, 0)
    c.setLineWidth(1.5)

    # Внешняя рамка
    c.rect(x0, y0, w, h, stroke=1, fill=0)

    # 4 репера по углам (внутри рамки, с отступом)
    inset = 3 * mm
    a = 5 * mm
    draw_anchor(c, x0 + inset, y0 + h - inset - a, a)         # top-left
    draw_anchor(c, x0 + w - inset - a, y0 + h - inset - a, a) # top-right
    draw_anchor(c, x0 + inset, y0 + inset, a)                  # bottom-left
    draw_anchor(c, x0 + w - inset - a, y0 + inset, a)          # bottom-right

    # Заголовок
    title_y = y0 + h - 12 * mm
    c.setFont(BOLD, 10)
    c.drawString(x0 + 12 * mm, title_y, "АОУСПТ — БЛАНК ОТВЕТОВ")
    c.setFont(REG, 8)
    c.drawString(x0 + 12 * mm, title_y - 4 * mm, f"Работа № {work_id}  ·  {work_title}")

    # ── Код ученика — 5 клеток ─────────────────────────────────────
    code_y = y0 + h - 28 * mm
    c.setFont(BOLD, 8)
    c.drawString(x0 + 12 * mm, code_y + 8 * mm, "КОД УЧЕНИКА (5 цифр)")

    cell = 8 * mm
    code_x = x0 + 12 * mm
    c.setLineWidth(1.2)
    for i in range(5):
        cx = code_x + i * cell
        c.rect(cx, code_y, cell, cell, stroke=1, fill=0)
    # маленькие подписи 1..5 над клетками
    c.setFont(REG, 6)
    for i in range(5):
        c.drawCentredString(code_x + i * cell + cell / 2, code_y + cell + 1 * mm, str(i + 1))

    # ── Образец азбуки и цифр ──────────────────────────────────────
    sample_y = code_y - 14 * mm
    c.setFont(BOLD, 7)
    c.drawString(x0 + 12 * mm, sample_y + 5 * mm, "ПИШИТЕ ПЕЧАТНЫМИ — ОБРАЗЕЦ:")
    c.setFont(BOLD, 9)
    s_cell = 4.2 * mm
    s_x = x0 + 12 * mm
    # Алфавит
    for i, ch in enumerate(ALPHABET):
        cx = s_x + i * s_cell
        if cx + s_cell > x0 + w - 12 * mm:
            break
        c.rect(cx, sample_y - s_cell, s_cell, s_cell, stroke=1, fill=0)
        c.drawCentredString(cx + s_cell / 2, sample_y - s_cell + 1.2 * mm, ch)
    # Цифры на следующей линии
    sample_y2 = sample_y - s_cell - 5 * mm
    for i, ch in enumerate(DIGITS):
        cx = s_x + i * s_cell
        c.rect(cx, sample_y2 - s_cell, s_cell, s_cell, stroke=1, fill=0)
        c.drawCentredString(cx + s_cell / 2, sample_y2 - s_cell + 1.2 * mm, ch)

    # ── Сетка ответов ──────────────────────────────────────────────
    ans_y_top = sample_y2 - s_cell - 10 * mm
    c.setFont(BOLD, 8)
    c.drawString(x0 + 12 * mm, ans_y_top + 2 * mm, f"ОТВЕТЫ (1 символ в клетке, всего {q_count})")

    # 4 колонки по 10 заданий = 40
    cols = 4
    per_col = q_count // cols
    if per_col * cols < q_count:
        per_col += 1
    a_cell = 7 * mm
    num_w = 7 * mm  # ширина на номер задания
    col_w = num_w + a_cell + 4 * mm  # ширина одной колонки
    grid_x0 = x0 + 12 * mm
    grid_y0 = ans_y_top - 2 * mm
    c.setLineWidth(1.2)

    for q in range(q_count):
        col = q // per_col
        row = q % per_col
        cx = grid_x0 + col * col_w
        cy = grid_y0 - row * (a_cell + 1.5 * mm) - a_cell
        # номер задания
        c.setFont(REG, 8)
        c.drawRightString(cx + num_w - 1.5 * mm, cy + 2 * mm, f"{q + 1}.")
        # клетка
        c.rect(cx + num_w, cy, a_cell, a_cell, stroke=1, fill=0)


def render_pdf(work_id: str, work_title: str, per_page: int, q_count: int) -> bytes:
    buf = io.BytesIO()
    page_w, page_h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    margin = 8 * mm
    if per_page == 1:
        layout = [(margin, margin, page_w - 2 * margin, page_h - 2 * margin)]
    elif per_page == 2:
        # Два бланка вертикально (один над другим)
        h = (page_h - 3 * margin) / 2
        layout = [
            (margin, margin + h + margin, page_w - 2 * margin, h),
            (margin, margin, page_w - 2 * margin, h),
        ]
    else:  # 4
        w = (page_w - 3 * margin) / 2
        h = (page_h - 3 * margin) / 2
        layout = [
            (margin, margin + h + margin, w, h),
            (margin + w + margin, margin + h + margin, w, h),
            (margin, margin, w, h),
            (margin + w + margin, margin, w, h),
        ]

    for (x, y, w, h) in layout:
        draw_blank(c, x, y, w, h, work_id, work_title, q_count)

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
    """Генерация PDF-бланка ответов для печати."""
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
    q_count = int(body.get("questionsCount", 40))
    if q_count < 1 or q_count > 60:
        q_count = 40

    pdf_bytes = render_pdf(work_id, work_title, per_page, q_count)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    return _resp(200, {
        "pdf": pdf_b64,
        "filename": f"blank_{work_id}_{per_page}up.pdf",
        "size": len(pdf_bytes),
    })
