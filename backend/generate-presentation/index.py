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
import time
import uuid
import base64
import random
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

# ─── 5 ДИЗАЙН-ТЕМ ─────────────────────────────────────────────────────────

THEMES = [
    {
        "name": "ocean",        # Синий океан — строгий академический
        "bg":       RGBColor(0xF4, 0xF7, 0xFA),
        "title_bg": RGBColor(0x0D, 0x2B, 0x55),
        "accent":   RGBColor(0x0D, 0x2B, 0x55),
        "accent2":  RGBColor(0x1E, 0x9E, 0xD4),
        "text":     RGBColor(0x1A, 0x24, 0x30),
        "muted":    RGBColor(0x6B, 0x7C, 0x93),
        "white":    RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub":RGBColor(0xB8, 0xD4, 0xED),
        "stripe":   RGBColor(0x1E, 0x9E, 0xD4),
        "label":    "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "forest",       # Зелёный лес — природа/биология/экология
        "bg":       RGBColor(0xF3, 0xF7, 0xF3),
        "title_bg": RGBColor(0x1B, 0x42, 0x32),
        "accent":   RGBColor(0x1B, 0x42, 0x32),
        "accent2":  RGBColor(0x4C, 0xAF, 0x50),
        "text":     RGBColor(0x1A, 0x28, 0x1E),
        "muted":    RGBColor(0x5A, 0x72, 0x5C),
        "white":    RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub":RGBColor(0xB2, 0xDF, 0xB8),
        "stripe":   RGBColor(0x4C, 0xAF, 0x50),
        "label":    "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "sunset",       # Бордово-золотой — история/литература/обществознание
        "bg":       RGBColor(0xFB, 0xF5, 0xEE),
        "title_bg": RGBColor(0x5C, 0x1A, 0x1A),
        "accent":   RGBColor(0x5C, 0x1A, 0x1A),
        "accent2":  RGBColor(0xD4, 0x8B, 0x00),
        "text":     RGBColor(0x2A, 0x1A, 0x0E),
        "muted":    RGBColor(0x7A, 0x60, 0x4A),
        "white":    RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub":RGBColor(0xF0, 0xD0, 0xA0),
        "stripe":   RGBColor(0xD4, 0x8B, 0x00),
        "label":    "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "slate",        # Серо-фиолетовый — физика/математика/информатика
        "bg":       RGBColor(0xF5, 0xF4, 0xF8),
        "title_bg": RGBColor(0x2D, 0x27, 0x4B),
        "accent":   RGBColor(0x2D, 0x27, 0x4B),
        "accent2":  RGBColor(0x7C, 0x5C, 0xBF),
        "text":     RGBColor(0x1E, 0x1A, 0x2E),
        "muted":    RGBColor(0x6E, 0x6A, 0x86),
        "white":    RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub":RGBColor(0xC8, 0xC0, 0xE8),
        "stripe":   RGBColor(0x7C, 0x5C, 0xBF),
        "label":    "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "coral",        # Коралл+серый — химия/медицина/здоровье
        "bg":       RGBColor(0xFB, 0xF7, 0xF5),
        "title_bg": RGBColor(0x22, 0x2E, 0x3A),
        "accent":   RGBColor(0x22, 0x2E, 0x3A),
        "accent2":  RGBColor(0xCF, 0x55, 0x44),
        "text":     RGBColor(0x1A, 0x22, 0x2C),
        "muted":    RGBColor(0x70, 0x7A, 0x84),
        "white":    RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub":RGBColor(0xE8, 0xC8, 0xC0),
        "stripe":   RGBColor(0xCF, 0x55, 0x44),
        "label":    "УРОК · ПРЕЗЕНТАЦИЯ",
    },
]

# Подберём тему по ключевым словам в теме урока
THEME_KEYWORDS = {
    "forest": ["биол", "экол", "природ", "животн", "растен", "лес", "ocean", "море", "зоол", "ботан", "органи"],
    "sunset": ["истор", "литер", "обществ", "война", "революц", "культур", "искусств", "философ", "социол", "политол"],
    "slate":  ["физик", "матем", "информат", "програм", "алгебр", "геометр", "вычисл", "алгоритм", "электрон", "квант"],
    "coral":  ["хими", "медиц", "здоровь", "биохим", "анатом", "физиол", "лечен", "орган", "реакц"],
}


def pick_theme(topic: str) -> dict:
    t = topic.lower()
    for theme_name, keywords in THEME_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return next(th for th in THEMES if th["name"] == theme_name)
    return random.choice(THEMES)


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

    expires_in_ms = body.get("expires_at")
    if expires_in_ms:
        expires_at = datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
    else:
        expires_at = now + timedelta(minutes=25)

    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def _gigachat_call_once(messages: list, max_tokens: int, temperature: float, model: str, req_timeout: int) -> str:
    token = get_gigachat_token()
    payload = {
        "model": model,
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
            "Connection": "close",
        },
    )
    with urllib.request.urlopen(req, timeout=req_timeout, context=_ssl_ctx()) as r:
        body = json.loads(r.read().decode())
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError(f"GigaChat вернул пустой ответ: {body}")
    return choices[0].get("message", {}).get("content", "").strip()


def gigachat_chat(messages: list, max_tokens: int = 1500, temperature: float = 0.4,
                  model: str = "GigaChat", req_timeout: int = 25, max_retries: int = 2) -> str:
    """Отправляет запрос в GigaChat с быстрыми ретраями при сетевых сбоях."""
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            return _gigachat_call_once(messages, max_tokens, temperature, model, req_timeout)
        except urllib.error.HTTPError as e:
            err_text = e.read().decode(errors='ignore')[:300] if hasattr(e, 'read') else str(e)
            if e.code in (401, 403, 404):
                if e.code == 404 and "model" in err_text.lower():
                    raise RuntimeError(f"MODEL_NOT_FOUND: {err_text}")
                raise RuntimeError(f"GigaChat chat HTTP {e.code}: {err_text}")
            last_err = RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
            if attempt < max_retries:
                time.sleep(1.0)
                continue
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"GigaChat недоступен: {e}")
            if attempt < max_retries:
                time.sleep(1.0)
                _TOKEN_CACHE["token"] = None
                _TOKEN_CACHE["expires_at"] = None
                continue
            raise last_err
    raise last_err if last_err else RuntimeError("GigaChat: не удалось получить ответ")


def gigachat_with_fallback(messages: list, max_tokens: int = 1500) -> str:
    """Сначала пробует быструю Lite-модель, при недоступности — обычную."""
    last_err = None
    for model in ("GigaChat-2-Lite", "GigaChat-Lite", "GigaChat"):
        try:
            return gigachat_chat(messages, max_tokens=max_tokens, model=model)
        except RuntimeError as e:
            last_err = e
            msg = str(e)
            if "MODEL_NOT_FOUND" in msg or "404" in msg or "401" in msg:
                continue
            raise
    raise last_err if last_err else RuntimeError("Все модели GigaChat недоступны")


def extract_json(text: str) -> dict:
    """Извлекает JSON из ответа модели."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence:
        text = fence.group(1)
    else:
        s = text.find("{")
        e = text.rfind("}")
        if s >= 0 and e > s:
            text = text[s:e + 1]
    return json.loads(text)


def generate_outline(topic: str, description: str, slides_count: int, audience: str) -> dict:
    """Просит GigaChat сгенерировать подробную структуру презентации в JSON."""
    audience_str = audience or "школьники"
    system = (
        "Ты опытный учитель-методист и эксперт по созданию учебных презентаций. "
        "Создавай ПОДРОБНУЮ, ИНФОРМАТИВНУЮ структуру презентации с реальными фактами, "
        "примерами, датами, определениями, терминами и числовыми данными. "
        "Каждый тезис должен содержать конкретную информацию — не общие слова, а факты. "
        "Заголовки слайдов — 4–7 слов, ёмкие и точные. "
        "Тезисы — 12–20 слов каждый, включай конкретику: цифры, даты, имена, термины, примеры. "
        "На каждом слайде 5–6 тезисов. "
        "Вывод должен содержать 4–5 ёмких итоговых утверждения по теме. "
        "Включай интересные факты, которые удивят учеников."
    )
    user = (
        f"Тема урока: {topic}\n"
        f"Дополнительный контекст: {description or 'не указан'}\n"
        f"Аудитория: {audience_str}\n"
        f"Количество содержательных слайдов: {slides_count}\n\n"
        "Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):\n"
        '{"subtitle":"краткий подзаголовок темы (8–12 слов)","slides":['
        '{"title":"заголовок слайда","bullets":["тезис 1 с конкретным фактом","тезис 2","тезис 3","тезис 4","тезис 5"],'
        '"fact":"🔍 Интересный факт или важная дата по теме этого слайда (1 предложение)"}],'
        '"conclusion":["итог 1","итог 2","итог 3","итог 4","итог 5"]}\n'
        f"Массив slides должен содержать ровно {slides_count} элементов. "
        "Каждый тезис — отдельная строка с конкретной информацией. Не повторяй одни и те же факты."
    )

    max_tok = min(280 * slides_count + 600, 4000)

    raw = gigachat_with_fallback(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tok,
    )
    try:
        data = extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Не удалось разобрать ответ ИИ как JSON: {e}. Ответ: {raw[:300]}")

    slides = data.get("slides") or []
    if not isinstance(slides, list) or not slides:
        raise RuntimeError("ИИ не вернул слайды")

    norm_slides = []
    for s in slides[:slides_count]:
        title = (s.get("title") or "").strip()
        bullets = s.get("bullets") or []
        if not isinstance(bullets, list):
            bullets = []
        bullets = [str(b).strip() for b in bullets if str(b).strip()][:7]
        fact = (s.get("fact") or "").strip()
        if title and bullets:
            norm_slides.append({"title": title, "bullets": bullets, "fact": fact})

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
              color: RGBColor = None, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
              font: str = "Calibri", italic: bool = False):
    if color is None:
        color = RGBColor(0x22, 0x2A, 0x35)
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
    run.font.italic = italic
    run.font.color.rgb = color
    return box


def _add_bullets(slide, x, y, w, h, bullets: list, *, size: int = 19,
                 color: RGBColor = None, font: str = "Calibri",
                 accent2: RGBColor = None, space_after: int = 7):
    if color is None:
        color = RGBColor(0x22, 0x2A, 0x35)
    if accent2 is None:
        accent2 = RGBColor(0xC2, 0x8B, 0x42)
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    for i, item in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(space_after)
        # Цветная точка-маркер
        dot = p.add_run()
        dot.text = "▸  "
        dot.font.name = font
        dot.font.size = Pt(size)
        dot.font.color.rgb = accent2
        dot.font.bold = True
        # Текст тезиса
        run = p.add_run()
        run.text = item
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color


def _add_fact_box(slide, x, y, w, h, fact: str, theme: dict):
    """Блок с интересным фактом — выделенный прямоугольник."""
    # Фон блока с лёгкой заливкой accent2
    box_bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    box_bg.fill.solid()
    box_bg.fill.fore_color.rgb = theme["accent2"]
    box_bg.fill.fore_color.theme_color = None
    # Прозрачность через XML (упрощённо — просто светлый оттенок)
    box_bg.line.fill.background()

    inner_box = slide.shapes.add_textbox(x + Inches(0.12), y + Inches(0.07),
                                          w - Inches(0.24), h - Inches(0.1))
    tf = inner_box.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = fact
    run.font.name = "Calibri"
    run.font.size = Pt(13)
    run.font.color.rgb = theme["white"]
    run.font.italic = True


def _footer(slide, teacher_name: str, teacher_school: str, theme: dict):
    """Подпись внизу слайда."""
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                  Inches(0.5), SLIDE_H - Inches(0.52),
                                  Inches(12.33), Emu(7620))
    _set_solid_fill(line, theme["accent2"])
    parts = []
    if teacher_name:
        parts.append(teacher_name)
    if teacher_school:
        parts.append(teacher_school)
    text = "  ·  ".join(parts) if parts else ""
    if text:
        _add_text(slide,
                  Inches(0.5), SLIDE_H - Inches(0.44),
                  Inches(12.33), Inches(0.35),
                  text, size=11, color=theme["muted"], align=PP_ALIGN.RIGHT)


def build_pptx(topic: str, subtitle: str, slides_data: list, conclusion: list,
               teacher_name: str, teacher_school: str, theme: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank_layout = prs.slide_layouts[6]

    # ── 1. Титульный слайд ─────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    # Фон
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["title_bg"])
    # Декоративный прямоугольник — яркая полоса снизу (~40% высоты)
    _add_rect(slide, 0, Inches(4.6), SLIDE_W, Inches(2.9), theme["accent"])
    # Тонкая акцентная линия разделителя
    _add_rect(slide, 0, Inches(4.55), SLIDE_W, Inches(0.08), theme["accent2"])
    # Декоративный боковой блок
    _add_rect(slide, 0, 0, Inches(0.45), SLIDE_H, theme["accent2"])
    # Лейбл
    _add_text(slide, Inches(0.7), Inches(1.6), Inches(10), Inches(0.4),
              theme["label"], size=11, bold=True, color=theme["accent2"], align=PP_ALIGN.LEFT)
    # Главный заголовок
    _add_text(slide, Inches(0.7), Inches(2.1), Inches(11.8), Inches(2.2),
              topic, size=44, bold=True, color=theme["white"],
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
    # Подзаголовок
    if subtitle:
        _add_text(slide, Inches(0.7), Inches(4.8), Inches(11.8), Inches(0.8),
                  subtitle, size=18, color=theme["title_sub"], align=PP_ALIGN.LEFT)
    # Учитель + дата
    parts = []
    if teacher_name:
        parts.append(teacher_name)
    if teacher_school:
        parts.append(teacher_school)
    footer_text = "   ·   ".join(parts) if parts else ""
    if footer_text:
        _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75),
                  Inches(10), Inches(0.45),
                  footer_text, size=13, color=theme["title_sub"], align=PP_ALIGN.LEFT)
    _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75),
              Inches(12.13), Inches(0.45),
              datetime.now().strftime("%d.%m.%Y"),
              size=12, color=theme["title_sub"], align=PP_ALIGN.RIGHT)

    # ── 2. Содержательные слайды ───────────────────────────────────────────
    for idx, s in enumerate(slides_data, start=1):
        slide = prs.slides.add_slide(blank_layout)
        # Фон
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        # Шапка слайда — тёмная полоса
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.55), theme["accent"])
        # Боковая полоса акцент
        _add_rect(slide, 0, Inches(1.55), Inches(0.18), SLIDE_H - Inches(1.55), theme["accent2"])
        # Номер слайда в шапке
        _add_text(slide, Inches(0.3), Inches(0.3), Inches(2), Inches(0.5),
                  f"{idx:02d} / {len(slides_data):02d}",
                  size=13, bold=True, color=theme["accent2"], align=PP_ALIGN.LEFT)
        # Заголовок в шапке
        _add_text(slide, Inches(0.55), Inches(0.35), Inches(11.5), Inches(1.0),
                  s["title"], size=28, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        # Учитель в шапке справа
        if teacher_name:
            _add_text(slide, Inches(0.3), Inches(0.3), Inches(12.73), Inches(0.5),
                      teacher_name, size=11, color=theme["title_sub"], align=PP_ALIGN.RIGHT)

        fact = s.get("fact", "")
        has_fact = bool(fact)

        if has_fact:
            # Тезисы — левая колонка (чуть уже)
            bullets_w = Inches(8.5)
            _add_bullets(slide,
                         Inches(0.38), Inches(1.75),
                         bullets_w, Inches(5.1),
                         s["bullets"], size=18, color=theme["text"],
                         accent2=theme["accent2"], space_after=9)
            # Блок факта — правая колонка
            _add_rect(slide, Inches(9.2), Inches(1.8), Inches(3.7), Inches(1.15), theme["accent"])
            _add_text(slide, Inches(9.35), Inches(1.87), Inches(3.4), Inches(0.35),
                      "ИНТЕРЕСНЫЙ ФАКТ", size=9, bold=True,
                      color=theme["accent2"], align=PP_ALIGN.LEFT)
            _add_text(slide, Inches(9.35), Inches(2.22), Inches(3.4), Inches(0.65),
                      fact, size=12, color=theme["white"], align=PP_ALIGN.LEFT,
                      anchor=MSO_ANCHOR.TOP, italic=True)
        else:
            # Тезисы на всю ширину
            _add_bullets(slide,
                         Inches(0.38), Inches(1.75),
                         Inches(12.6), Inches(5.3),
                         s["bullets"], size=18, color=theme["text"],
                         accent2=theme["accent2"], space_after=9)

        _footer(slide, teacher_name, teacher_school, theme)

    # ── 3. Слайд выводов ───────────────────────────────────────────────────
    if conclusion:
        slide = prs.slides.add_slide(blank_layout)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.55), theme["accent"])
        _add_rect(slide, 0, Inches(1.55), Inches(0.18), SLIDE_H - Inches(1.55), theme["accent2"])
        _add_text(slide, Inches(0.3), Inches(0.3), Inches(3), Inches(0.5),
                  "ИТОГИ УРОКА", size=11, bold=True, color=theme["accent2"])
        _add_text(slide, Inches(0.55), Inches(0.35), Inches(11.5), Inches(1.0),
                  "Ключевые выводы", size=28, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        _add_bullets(slide,
                     Inches(0.38), Inches(1.75),
                     Inches(12.6), Inches(5.1),
                     conclusion, size=20, color=theme["text"],
                     accent2=theme["accent2"], space_after=10)
        _footer(slide, teacher_name, teacher_school, theme)

    # ── 4. Финальный слайд ─────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["title_bg"])
    _add_rect(slide, 0, Inches(4.55), SLIDE_W, Inches(0.08), theme["accent2"])
    _add_rect(slide, 0, 0, Inches(0.45), SLIDE_H, theme["accent2"])
    _add_text(slide, Inches(0.7), Inches(2.7), Inches(11.8), Inches(1.6),
              "Спасибо за внимание!", size=52, bold=True,
              color=theme["white"], align=PP_ALIGN.CENTER)
    _add_text(slide, Inches(0.7), Inches(4.4), Inches(11.8), Inches(0.6),
              "Вопросы и обсуждение", size=20,
              color=theme["title_sub"], align=PP_ALIGN.CENTER)
    if footer_text:
        _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75), Inches(12.13), Inches(0.45),
                  footer_text, size=13, color=theme["title_sub"], align=PP_ALIGN.CENTER)

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

    theme = pick_theme(topic)

    try:
        outline = generate_outline(topic, description, slides_count, audience)
    except Exception as e:
        msg = str(e)
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return _resp(504, {"error": "Сервис GigaChat сейчас перегружен. Подождите 1-2 минуты и попробуйте снова."})
        return _resp(500, {"error": f"Ошибка генерации структуры: {msg}"})

    try:
        pptx_bytes = build_pptx(
            topic=topic,
            subtitle=outline["subtitle"],
            slides_data=outline["slides"],
            conclusion=outline["conclusion"],
            teacher_name=teacher_name,
            teacher_school=teacher_school,
            theme=theme,
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