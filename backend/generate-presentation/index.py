"""
Генерация PPTX-презентации по теме урока через GigaChat.
POST / body: {topic, description, slidesCount, audience?, teacherName, teacherSchool}
Возвращает: {pptx_b64, filename, slides: [...]}.

Отдельные действия:
GET  /?action=ping — проверка доступности GigaChat
"""
import json
import os
import io
import re
import ssl
import uuid
import base64
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# Палитра — спокойные академические цвета
COLOR_BG = RGBColor(0xF7, 0xF7, 0xF5)        # светлый фон
COLOR_ACCENT = RGBColor(0x1E, 0x3A, 0x5F)    # тёмно-синий (заголовки)
COLOR_ACCENT2 = RGBColor(0xC2, 0x8B, 0x42)   # охра (акценты)
COLOR_TEXT = RGBColor(0x22, 0x2A, 0x35)      # тёмно-серый
COLOR_MUTED = RGBColor(0x6E, 0x76, 0x82)     # серый
COLOR_WHITE = RGBColor(0xFF, 0xFF, 0xFF)

# Кэш токена в памяти процесса
_TOKEN_CACHE = {"token": None, "expires_at": None}


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def get_gigachat_token() -> str:
    """Получает access token для GigaChat (с кэшем на 25 минут)."""
    now = datetime.utcnow()
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] and _TOKEN_CACHE["expires_at"] > now:
        return _TOKEN_CACHE["token"]

    auth_key = os.environ.get("GIGACHAT_AUTH_KEY", "").strip()
    if not auth_key:
        raise RuntimeError("GIGACHAT_AUTH_KEY не задан")

    rq_uid = str(uuid.uuid4())
    data = urllib.parse.urlencode({"scope": "GIGACHAT_API_PERS"}).encode()
    req = urllib.request.Request(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": rq_uid,
            "Authorization": f"Basic {auth_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"GigaChat auth HTTP {e.code}: {e.read().decode(errors='ignore')[:300]}")

    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GigaChat не вернул access_token: {body}")

    expires_in_ms = body.get("expires_at")  # это unix-ms окончания
    if expires_in_ms:
        expires_at = datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
    else:
        expires_at = now + timedelta(minutes=25)

    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def gigachat_chat(messages: list, max_tokens: int = 2500, temperature: float = 0.4) -> str:
    """Отправляет запрос в GigaChat и возвращает текст ответа."""
    token = get_gigachat_token()
    payload = {
        "model": "GigaChat",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    req = urllib.request.Request(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=_ssl_ctx()) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"GigaChat chat HTTP {e.code}: {e.read().decode(errors='ignore')[:300]}")

    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError(f"GigaChat вернул пустой ответ: {body}")
    return choices[0].get("message", {}).get("content", "").strip()


def extract_json(text: str) -> dict:
    """Извлекает JSON из ответа модели (даже если он в ```json ... ```)."""
    text = text.strip()
    # Срезаем ```json ... ```
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence:
        text = fence.group(1)
    else:
        # Берём всё от первой { до последней }
        s = text.find("{")
        e = text.rfind("}")
        if s >= 0 and e > s:
            text = text[s:e + 1]
    return json.loads(text)


def generate_outline(topic: str, description: str, slides_count: int, audience: str) -> dict:
    """Просит GigaChat сгенерировать структуру презентации в JSON."""
    audience_str = audience or "школьники"
    system = (
        "Ты — опытный учитель-методист. Ты создаёшь структуру учебной презентации в формате JSON. "
        "Пиши на русском языке, кратко и информативно. Используй академический стиль. "
        "Каждый слайд должен иметь чёткий заголовок и 3–5 коротких пунктов (8–14 слов каждый). "
        "Не повторяй одно и то же. Не используй слова 'слайд 1', 'слайд 2' в заголовках."
    )
    user = (
        f"Создай план презентации для урока.\n"
        f"Тема: {topic}\n"
        f"Описание/контекст: {description or '—'}\n"
        f"Аудитория: {audience_str}\n"
        f"Количество содержательных слайдов: {slides_count} "
        f"(не считая титульного и финального).\n\n"
        "Верни СТРОГО JSON следующего вида (без комментариев и без markdown):\n"
        "{\n"
        '  "subtitle": "короткий подзаголовок темы (до 80 символов)",\n'
        '  "slides": [\n'
        '    {"title": "Заголовок слайда", "bullets": ["Тезис 1", "Тезис 2", "Тезис 3"], "note": "Краткий комментарий учителя 1-2 предложения"}\n'
        "  ],\n"
        '  "conclusion": ["Ключевой вывод 1", "Ключевой вывод 2", "Ключевой вывод 3"]\n'
        "}\n"
        f"В массиве slides должно быть РОВНО {slides_count} элементов."
    )

    raw = gigachat_chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=2200,
        temperature=0.5,
    )
    try:
        data = extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Не удалось разобрать ответ ИИ как JSON: {e}. Ответ: {raw[:300]}")

    # Валидация и нормализация
    slides = data.get("slides") or []
    if not isinstance(slides, list) or not slides:
        raise RuntimeError("ИИ не вернул слайды")

    norm_slides = []
    for s in slides[:slides_count]:
        title = (s.get("title") or "").strip()
        bullets = s.get("bullets") or []
        if not isinstance(bullets, list):
            bullets = []
        bullets = [str(b).strip() for b in bullets if str(b).strip()][:6]
        note = (s.get("note") or "").strip()
        if title and bullets:
            norm_slides.append({"title": title, "bullets": bullets, "note": note})

    if not norm_slides:
        raise RuntimeError("ИИ вернул пустые слайды")

    return {
        "subtitle": (data.get("subtitle") or "").strip(),
        "slides": norm_slides,
        "conclusion": [str(c).strip() for c in (data.get("conclusion") or []) if str(c).strip()][:5],
    }


# ─── PPTX BUILDER ──────────────────────────────────────────────────────────

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def _set_solid_fill(shape, rgb: RGBColor):
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb
    shape.line.fill.background()


def _add_rect(slide, x, y, w, h, rgb: RGBColor):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    _set_solid_fill(shape, rgb)
    return shape


def _add_text(slide, x, y, w, h, text: str, *, size: int = 18, bold: bool = False,
              color: RGBColor = COLOR_TEXT, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font: str = "Calibri"):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return box


def _add_bullets(slide, x, y, w, h, bullets: list, *, size: int = 20, color: RGBColor = COLOR_TEXT, font: str = "Calibri"):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    for i, item in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(8)
        run = p.add_run()
        run.text = f"•   {item}"
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color


def _footer(slide, teacher_name: str, teacher_school: str):
    """Подпись внизу слайда: ФИО + школа."""
    # Тонкая линия
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                  Inches(0.6), SLIDE_H - Inches(0.55),
                                  Inches(12.13), Emu(9525))
    _set_solid_fill(line, COLOR_ACCENT2)
    parts = []
    if teacher_name:
        parts.append(teacher_name)
    if teacher_school:
        parts.append(teacher_school)
    text = "  ·  ".join(parts) if parts else ""
    if text:
        _add_text(slide,
                  Inches(0.6), SLIDE_H - Inches(0.45),
                  Inches(12.13), Inches(0.35),
                  text, size=11, color=COLOR_MUTED, align=PP_ALIGN.RIGHT)


def build_pptx(topic: str, subtitle: str, slides_data: list, conclusion: list,
               teacher_name: str, teacher_school: str) -> bytes:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank_layout = prs.slide_layouts[6]

    # ── 1. Титульный слайд ────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, COLOR_ACCENT)
    # Декоративная полоса
    _add_rect(slide, 0, Inches(2.6), SLIDE_W, Inches(0.06), COLOR_ACCENT2)
    # Тема
    _add_text(slide, Inches(0.8), Inches(2.85), Inches(11.7), Inches(2.4),
              topic, size=46, bold=True, color=COLOR_WHITE, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
    if subtitle:
        _add_text(slide, Inches(0.8), Inches(5.0), Inches(11.7), Inches(0.8),
                  subtitle, size=20, color=RGBColor(0xCF, 0xD8, 0xE3), align=PP_ALIGN.LEFT)
    # Маленький лейбл
    _add_text(slide, Inches(0.8), Inches(2.0), Inches(6), Inches(0.4),
              "УРОК · ПРЕЗЕНТАЦИЯ", size=12, bold=True, color=COLOR_ACCENT2, align=PP_ALIGN.LEFT)

    # Подпись внизу — ФИО и школа учителя (на тёмном фоне)
    parts = []
    if teacher_name:
        parts.append(teacher_name)
    if teacher_school:
        parts.append(teacher_school)
    footer_text = "   ·   ".join(parts) if parts else ""
    if footer_text:
        _add_text(slide,
                  Inches(0.8), SLIDE_H - Inches(0.7),
                  Inches(11.7), Inches(0.4),
                  footer_text, size=13, color=RGBColor(0xCF, 0xD8, 0xE3), align=PP_ALIGN.LEFT)
    # Дата справа внизу
    _add_text(slide,
              Inches(0.8), SLIDE_H - Inches(0.7),
              Inches(11.7), Inches(0.4),
              datetime.now().strftime("%d.%m.%Y"),
              size=12, color=RGBColor(0xCF, 0xD8, 0xE3), align=PP_ALIGN.RIGHT)

    # ── Содержательные слайды ─────────────────────────────────────────────
    for idx, s in enumerate(slides_data, start=1):
        slide = prs.slides.add_slide(blank_layout)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, COLOR_BG)
        # Полоска слева
        _add_rect(slide, 0, 0, Inches(0.25), SLIDE_H, COLOR_ACCENT)
        # Номер слайда
        _add_text(slide, Inches(0.6), Inches(0.4), Inches(2), Inches(0.4),
                  f"{idx:02d} / {len(slides_data):02d}", size=11, bold=True, color=COLOR_ACCENT2)
        # Заголовок
        _add_text(slide, Inches(0.6), Inches(0.85), Inches(12.1), Inches(1.0),
                  s["title"], size=30, bold=True, color=COLOR_ACCENT)
        # Подчёркивание заголовка
        _add_rect(slide, Inches(0.6), Inches(1.85), Inches(1.2), Emu(38100), COLOR_ACCENT2)
        # Bullets
        _add_bullets(slide, Inches(0.7), Inches(2.2), Inches(12.0), Inches(4.5),
                     s["bullets"], size=20, color=COLOR_TEXT)
        # Footer
        _footer(slide, teacher_name, teacher_school)

    # ── Финальный слайд: выводы ──────────────────────────────────────────
    if conclusion:
        slide = prs.slides.add_slide(blank_layout)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, COLOR_BG)
        _add_rect(slide, 0, 0, Inches(0.25), SLIDE_H, COLOR_ACCENT2)
        _add_text(slide, Inches(0.6), Inches(0.4), Inches(2), Inches(0.4),
                  "ИТОГИ УРОКА", size=11, bold=True, color=COLOR_ACCENT2)
        _add_text(slide, Inches(0.6), Inches(0.85), Inches(12.1), Inches(1.0),
                  "Ключевые выводы", size=30, bold=True, color=COLOR_ACCENT)
        _add_rect(slide, Inches(0.6), Inches(1.85), Inches(1.2), Emu(38100), COLOR_ACCENT2)
        _add_bullets(slide, Inches(0.7), Inches(2.2), Inches(12.0), Inches(4.5),
                     conclusion, size=22, color=COLOR_TEXT)
        _footer(slide, teacher_name, teacher_school)

    # Спасибо-слайд
    slide = prs.slides.add_slide(blank_layout)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, COLOR_ACCENT)
    _add_text(slide, Inches(0.8), Inches(2.8), Inches(11.7), Inches(1.5),
              "Спасибо за внимание!", size=54, bold=True, color=COLOR_WHITE, align=PP_ALIGN.CENTER)
    _add_text(slide, Inches(0.8), Inches(4.4), Inches(11.7), Inches(0.6),
              "Вопросы и обсуждение", size=20, color=RGBColor(0xCF, 0xD8, 0xE3), align=PP_ALIGN.CENTER)
    if footer_text:
        _add_text(slide, Inches(0.8), SLIDE_H - Inches(0.7), Inches(11.7), Inches(0.4),
                  footer_text, size=13, color=RGBColor(0xCF, 0xD8, 0xE3), align=PP_ALIGN.CENTER)

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()


def safe_filename(s: str, max_len: int = 60) -> str:
    s = re.sub(r"[\\/:*?\"<>|]+", " ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:max_len] or "Презентация"


def handler(event: dict, context) -> dict:
    """Генерирует PPTX-презентацию по теме урока с помощью GigaChat."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()

    if method == "GET" and action == "ping":
        try:
            get_gigachat_token()
            return _resp(200, {"ok": True, "service": "GigaChat"})
        except Exception as e:
            return _resp(500, {"ok": False, "error": str(e)})

    if method != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    body = {}
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode()
        except Exception:
            raw = ""
    try:
        body = json.loads(raw) if raw else {}
        if isinstance(body, str):
            body = json.loads(body)
    except Exception:
        body = {}

    topic = (body.get("topic") or "").strip()
    description = (body.get("description") or "").strip()
    audience = (body.get("audience") or "").strip()
    teacher_name = (body.get("teacherName") or "").strip()
    teacher_school = (body.get("teacherSchool") or "").strip()

    try:
        slides_count = int(body.get("slidesCount") or 8)
    except (TypeError, ValueError):
        slides_count = 8
    slides_count = max(3, min(slides_count, 16))

    if not topic:
        return _resp(400, {"error": "Укажите тему урока"})

    try:
        outline = generate_outline(topic, description, slides_count, audience)
    except Exception as e:
        return _resp(500, {"error": f"Ошибка генерации структуры: {e}"})

    try:
        pptx_bytes = build_pptx(
            topic=topic,
            subtitle=outline["subtitle"],
            slides_data=outline["slides"],
            conclusion=outline["conclusion"],
            teacher_name=teacher_name,
            teacher_school=teacher_school,
        )
    except Exception as e:
        return _resp(500, {"error": f"Ошибка сборки PPTX: {e}"})

    filename = f"{safe_filename(topic)}.pptx"
    return _resp(200, {
        "pptx_b64": base64.b64encode(pptx_bytes).decode(),
        "filename": filename,
        "size": len(pptx_bytes),
        "outline": {
            "subtitle": outline["subtitle"],
            "slides": [{"title": s["title"], "bullets": s["bullets"]} for s in outline["slides"]],
            "conclusion": outline["conclusion"],
        },
    })
