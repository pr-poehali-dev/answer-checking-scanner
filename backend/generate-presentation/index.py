"""
Генерация PPTX-презентации по теме урока через GigaChat.
POST / body: {topic, description, slidesCount, audience?, teacherName, teacherSchool}
Возвращает: {pptx_b64, filename, outline}.

Особенности:
- Контент строго по ФГОС и программе Минпросвещения РФ
- Фотографии по теме на каждом слайде (Wikimedia Commons / Unsplash)
- Двухколоночный layout: текст слева, фото справа
- Таймаут 320 секунд, мощная модель GigaChat-2
- Слайд "Содержание" после титульного

GET /?action=ping — проверка доступности GigaChat
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

AUTH_URL = os.environ.get("AUTH_FUNCTION_URL", "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b")

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

# ─── ДИЗАЙН-ТЕМЫ ────────────────────────────────────────────────────────────

THEMES = [
    {
        "name": "ocean",
        "bg":        RGBColor(0xF4, 0xF7, 0xFA),
        "title_bg":  RGBColor(0x0D, 0x2B, 0x55),
        "accent":    RGBColor(0x0D, 0x2B, 0x55),
        "accent2":   RGBColor(0x1E, 0x9E, 0xD4),
        "text":      RGBColor(0x1A, 0x24, 0x30),
        "muted":     RGBColor(0x6B, 0x7C, 0x93),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xB8, 0xD4, 0xED),
        "stripe":    RGBColor(0x1E, 0x9E, 0xD4),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "forest",
        "bg":        RGBColor(0xF3, 0xF7, 0xF3),
        "title_bg":  RGBColor(0x1B, 0x42, 0x32),
        "accent":    RGBColor(0x1B, 0x42, 0x32),
        "accent2":   RGBColor(0x4C, 0xAF, 0x50),
        "text":      RGBColor(0x1A, 0x28, 0x1E),
        "muted":     RGBColor(0x5A, 0x72, 0x5C),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xB2, 0xDF, 0xB8),
        "stripe":    RGBColor(0x4C, 0xAF, 0x50),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "sunset",
        "bg":        RGBColor(0xFB, 0xF5, 0xEE),
        "title_bg":  RGBColor(0x5C, 0x1A, 0x1A),
        "accent":    RGBColor(0x5C, 0x1A, 0x1A),
        "accent2":   RGBColor(0xD4, 0x8B, 0x00),
        "text":      RGBColor(0x2A, 0x1A, 0x0E),
        "muted":     RGBColor(0x7A, 0x60, 0x4A),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xF0, 0xD0, 0xA0),
        "stripe":    RGBColor(0xD4, 0x8B, 0x00),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "slate",
        "bg":        RGBColor(0xF5, 0xF4, 0xF8),
        "title_bg":  RGBColor(0x2D, 0x27, 0x4B),
        "accent":    RGBColor(0x2D, 0x27, 0x4B),
        "accent2":   RGBColor(0x7C, 0x5C, 0xBF),
        "text":      RGBColor(0x1E, 0x1A, 0x2E),
        "muted":     RGBColor(0x6E, 0x6A, 0x86),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xC8, 0xC0, 0xE8),
        "stripe":    RGBColor(0x7C, 0x5C, 0xBF),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
    },
    {
        "name": "coral",
        "bg":        RGBColor(0xFB, 0xF7, 0xF5),
        "title_bg":  RGBColor(0x22, 0x2E, 0x3A),
        "accent":    RGBColor(0x22, 0x2E, 0x3A),
        "accent2":   RGBColor(0xCF, 0x55, 0x44),
        "text":      RGBColor(0x1A, 0x22, 0x2C),
        "muted":     RGBColor(0x70, 0x7A, 0x84),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xE8, 0xC8, 0xC0),
        "stripe":    RGBColor(0xCF, 0x55, 0x44),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
    },
]

THEME_KEYWORDS = {
    "forest": ["биол", "экол", "природ", "животн", "растен", "лес", "море", "зоол", "ботан", "органи", "генет"],
    "sunset": ["истор", "литер", "обществ", "война", "революц", "культур", "искусств", "философ", "социол", "политол", "граждан"],
    "slate":  ["физик", "матем", "информат", "програм", "алгебр", "геометр", "вычисл", "алгоритм", "электрон", "квант", "механик"],
    "coral":  ["хими", "медиц", "здоровь", "биохим", "анатом", "физиол", "лечен", "реакц", "молекул"],
}


def pick_theme(topic: str) -> dict:
    t = topic.lower()
    for theme_name, keywords in THEME_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return next(th for th in THEMES if th["name"] == theme_name)
    return random.choice(THEMES)


# ─── КЭШИ ───────────────────────────────────────────────────────────────────

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


# ─── GIGACHAT AUTH ───────────────────────────────────────────────────────────

def get_gigachat_token() -> str:
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
    expires_at = (datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
                  if expires_in_ms else now + timedelta(minutes=25))
    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def _gigachat_call_once(messages: list, max_tokens: int, temperature: float,
                        model: str, req_timeout: int) -> str:
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


def gigachat_chat(messages: list, max_tokens: int = 3000, temperature: float = 0.2,
                  model: str = "GigaChat-2", req_timeout: int = 300,
                  max_retries: int = 3) -> str:
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            return _gigachat_call_once(messages, max_tokens, temperature, model, req_timeout)
        except urllib.error.HTTPError as e:
            try:
                err_text = e.read().decode(errors="ignore")[:300]
            except Exception:
                err_text = str(e)
            if e.code in (401, 403):
                raise RuntimeError(f"GigaChat auth HTTP {e.code}: {err_text}")
            if e.code == 404:
                raise RuntimeError(f"MODEL_NOT_FOUND: {err_text}")
            wait = 4.0 if e.code == 429 else 3.0
            last_err = RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
            if attempt < max_retries:
                time.sleep(wait)
                continue
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"GigaChat недоступен: {e}")
            if attempt < max_retries:
                time.sleep(3.0)
                _TOKEN_CACHE["token"] = None
                _TOKEN_CACHE["expires_at"] = None
                continue
            raise last_err
    raise last_err if last_err else RuntimeError("GigaChat: не удалось получить ответ")


def gigachat_with_fallback(messages: list, max_tokens: int = 3000) -> str:
    """Пробует модели по очереди: GigaChat-2 → GigaChat → GigaChat-Lite."""
    last_err = None
    for model in ("GigaChat-2", "GigaChat", "GigaChat-Lite"):
        try:
            return gigachat_chat(messages, max_tokens=max_tokens, model=model, req_timeout=300)
        except RuntimeError as e:
            last_err = e
            msg = str(e)
            if "MODEL_NOT_FOUND" in msg or "404" in msg or "401" in msg or "403" in msg:
                continue
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                continue
            raise
    raise last_err if last_err else RuntimeError("Все модели GigaChat недоступны")


def extract_json(text: str) -> dict:
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


# ─── ПОИСК ИЗОБРАЖЕНИЙ ───────────────────────────────────────────────────────

def fetch_image_bytes(query: str) -> bytes | None:
    """Ищет релевантное изображение через Wikimedia Commons REST API (без ключа)."""
    try:
        # Используем Wikimedia Commons — общедоступные учебные изображения
        search_q = urllib.parse.quote(query)
        url = (
            f"https://commons.wikimedia.org/w/api.php"
            f"?action=query&generator=search&gsrnamespace=6"
            f"&gsrsearch={search_q}&gsrlimit=5"
            f"&prop=imageinfo&iiprop=url|mime|size"
            f"&iiurlwidth=800&format=json&origin=*"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())

        pages = (data.get("query") or {}).get("pages") or {}
        candidates = []
        for page in pages.values():
            ii = (page.get("imageinfo") or [{}])[0]
            mime = ii.get("mime", "")
            thumb_url = ii.get("thumburl") or ii.get("url", "")
            size = ii.get("size", 0)
            if mime in ("image/jpeg", "image/png") and thumb_url and size < 5_000_000:
                candidates.append(thumb_url)

        if not candidates:
            return None

        img_url = candidates[0]
        req2 = urllib.request.Request(img_url, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
        with urllib.request.urlopen(req2, timeout=12) as r:
            img_bytes = r.read()

        if len(img_bytes) < 5000:
            return None
        return img_bytes

    except Exception:
        return None


def fetch_image_for_slide(slide_title: str, topic: str) -> bytes | None:
    """Пробует найти фото по заголовку слайда, затем по теме урока."""
    img = fetch_image_bytes(f"{slide_title} {topic} учебник")
    if img:
        return img
    img = fetch_image_bytes(slide_title)
    if img:
        return img
    return fetch_image_bytes(topic)


# ─── ГЕНЕРАЦИЯ СТРУКТУРЫ ─────────────────────────────────────────────────────

def generate_outline(topic: str, description: str, slides_count: int, audience: str) -> dict:
    """Генерирует развёрнутую структуру презентации строго по ФГОС."""
    audience_str = audience or "школьники"

    system = (
        "Ты учитель-методист высшей категории и эксперт по ФГОС. "
        "Создаёшь структуру учебной презентации строго по официальной программе "
        "Министерства просвещения РФ и ФГОС. "
        "ТРЕБОВАНИЯ К КОНТЕНТУ:\n"
        "1. Только официально признанные научные факты, определения и формулировки\n"
        "2. Соответствие учебникам, рекомендованным МО РФ (УМК)\n"
        "3. Конкретные даты, цифры, термины, имена, формулы — без общих фраз\n"
        "4. Логическая последовательность: от простого к сложному\n"
        "5. Каждый тезис: полное, завершённое, информативное предложение (15–25 слов)\n"
        "6. Заголовки слайдов: чёткие, академические, 4–7 слов\n"
        "7. image_query: конкретный поисковый запрос на русском для иллюстрации слайда "
        "(схема, фото, диаграмма — что подойдёт лучше всего)\n"
        "8. fact: достоверный интересный факт по теме слайда из научных источников"
    )

    user = (
        f"Тема урока: {topic}\n"
        f"Аудитория: {audience_str}\n"
        + (f"Дополнительный контекст (конспект/описание):\n{description[:3000]}\n" if description else "")
        + f"\nКоличество содержательных слайдов: {slides_count}\n\n"
        "Создай структуру презентации. Ответ — ТОЛЬКО JSON:\n"
        '{\n'
        '  "subtitle": "подзаголовок презентации 6-10 слов",\n'
        '  "contents": ["название раздела 1", "название раздела 2", ...],\n'
        '  "slides": [\n'
        '    {\n'
        '      "title": "Заголовок слайда 4-7 слов",\n'
        '      "bullets": [\n'
        '        "Полное информативное предложение с конкретными фактами, 15-25 слов",\n'
        '        "Второй тезис с определением термина или формулой/датой/цифрой",\n'
        '        "Третий тезис — пример или применение из реальной жизни/практики",\n'
        '        "Четвёртый тезис — связь с предыдущим или последующим материалом",\n'
        '        "Пятый тезис — вывод или обобщение по данному пункту"\n'
        '      ],\n'
        '      "fact": "Один достоверный интересный факт по теме слайда",\n'
        '      "image_query": "конкретный запрос для поиска иллюстрации на русском"\n'
        '    }\n'
        '  ],\n'
        '  "conclusion": [\n'
        '    "Первый ключевой вывод урока — конкретный и измеримый",\n'
        '    "Второй вывод — связь с практикой или другими предметами",\n'
        '    "Третий вывод — что ученики должны уметь делать после урока",\n'
        '    "Четвёртый вывод — связь с ФГОС и метапредметными результатами"\n'
        '  ]\n'
        '}\n\n'
        f"slides — ровно {slides_count} элементов. Пиши академически, точно, без общих фраз."
    )

    # Увеличиваем токены: ~250 на слайд + запас
    max_tok = min(250 * slides_count + 800, 4000)

    raw = gigachat_with_fallback(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tok,
    )

    try:
        data = extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Не удалось разобрать ответ ИИ как JSON: {e}. Ответ: {raw[:400]}")

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
        fact = (s.get("fact") or "").strip()
        image_query = (s.get("image_query") or title).strip()
        if title and bullets:
            norm_slides.append({
                "title": title,
                "bullets": bullets,
                "fact": fact,
                "image_query": image_query,
            })

    if not norm_slides:
        raise RuntimeError("ИИ вернул пустые слайды")

    contents = data.get("contents") or [s["title"] for s in norm_slides]

    return {
        "subtitle": (data.get("subtitle") or "").strip(),
        "contents": [str(c).strip() for c in contents if str(c).strip()][:slides_count],
        "slides": norm_slides,
        "conclusion": [str(c).strip() for c in (data.get("conclusion") or []) if str(c).strip()][:5],
    }


# ─── PPTX BUILDER ────────────────────────────────────────────────────────────

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


def _add_bullets(slide, x, y, w, h, bullets: list, *, size: int = 17,
                 color: RGBColor = None, font: str = "Calibri",
                 accent2: RGBColor = None, space_after: int = 8):
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
        dot = p.add_run()
        dot.text = "▸  "
        dot.font.name = font
        dot.font.size = Pt(size)
        dot.font.color.rgb = accent2
        dot.font.bold = True
        run = p.add_run()
        run.text = item
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color


def _add_image_to_slide(slide, img_bytes: bytes, x, y, w, h):
    """Добавляет изображение на слайд из bytes."""
    try:
        img_stream = io.BytesIO(img_bytes)
        slide.shapes.add_picture(img_stream, x, y, w, h)
        return True
    except Exception:
        return False


def _add_image_placeholder(slide, x, y, w, h, theme: dict, label: str = ""):
    """Заглушка если фото не найдено — цветной прямоугольник."""
    _add_rect(slide, x, y, w, h, theme["accent"])
    if label:
        _add_text(slide, x + Inches(0.1), y + h // 2 - Inches(0.2),
                  w - Inches(0.2), Inches(0.4),
                  label, size=11, color=theme["title_sub"],
                  align=PP_ALIGN.CENTER, italic=True)


def _footer(slide, teacher_name: str, teacher_school: str, theme: dict):
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Inches(0.5), SLIDE_H - Inches(0.52),
        Inches(12.33), Emu(7620)
    )
    _set_solid_fill(line, theme["accent2"])
    parts = [p for p in [teacher_name, teacher_school] if p]
    text = "  ·  ".join(parts)
    if text:
        _add_text(slide,
                  Inches(0.5), SLIDE_H - Inches(0.44),
                  Inches(12.33), Inches(0.35),
                  text, size=11, color=theme["muted"], align=PP_ALIGN.RIGHT)


def _slide_header(slide, title: str, slide_num: int, total: int,
                  teacher_name: str, theme: dict):
    """Общая шапка для содержательных слайдов."""
    _add_rect(slide, 0, 0, SLIDE_W, Inches(1.45), theme["accent"])
    _add_rect(slide, 0, Inches(1.45), Inches(0.18),
              SLIDE_H - Inches(1.45), theme["accent2"])
    _add_text(slide, Inches(0.3), Inches(0.28), Inches(2), Inches(0.5),
              f"{slide_num:02d} / {total:02d}",
              size=12, bold=True, color=theme["accent2"], align=PP_ALIGN.LEFT)
    _add_text(slide, Inches(0.55), Inches(0.28), Inches(11.5), Inches(0.9),
              title, size=26, bold=True, color=theme["white"],
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
    if teacher_name:
        _add_text(slide, Inches(0.3), Inches(0.28), Inches(12.73), Inches(0.5),
                  teacher_name, size=11, color=theme["title_sub"], align=PP_ALIGN.RIGHT)


def build_pptx(topic: str, subtitle: str, contents: list, slides_data: list,
               conclusion: list, teacher_name: str, teacher_school: str,
               theme: dict, images: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]
    total_content = len(slides_data)

    # ── 1. Титульный слайд ────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["title_bg"])
    _add_rect(slide, 0, Inches(4.6), SLIDE_W, Inches(2.9), theme["accent"])
    _add_rect(slide, 0, Inches(4.55), SLIDE_W, Inches(0.08), theme["accent2"])
    _add_rect(slide, 0, 0, Inches(0.45), SLIDE_H, theme["accent2"])
    _add_text(slide, Inches(0.7), Inches(1.55), Inches(10), Inches(0.4),
              theme["label"], size=11, bold=True, color=theme["accent2"])
    _add_text(slide, Inches(0.7), Inches(2.05), Inches(11.8), Inches(2.2),
              topic, size=42, bold=True, color=theme["white"],
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
    if subtitle:
        _add_text(slide, Inches(0.7), Inches(4.75), Inches(11.8), Inches(0.8),
                  subtitle, size=17, color=theme["title_sub"])
    parts = [p for p in [teacher_name, teacher_school] if p]
    footer_text = "   ·   ".join(parts)
    if footer_text:
        _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75),
                  Inches(10), Inches(0.45),
                  footer_text, size=13, color=theme["title_sub"])
    _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75),
              Inches(12.13), Inches(0.45),
              datetime.now().strftime("%d.%m.%Y"),
              size=12, color=theme["title_sub"], align=PP_ALIGN.RIGHT)

    # ── 2. Слайд «Содержание» ────────────────────────────────────────────
    if contents:
        slide = prs.slides.add_slide(blank)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.45), theme["accent"])
        _add_rect(slide, 0, Inches(1.45), Inches(0.18),
                  SLIDE_H - Inches(1.45), theme["accent2"])
        _add_text(slide, Inches(0.55), Inches(0.28), Inches(11.5), Inches(0.9),
                  "Содержание урока", size=28, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        # Два столбца содержания
        mid = (len(contents) + 1) // 2
        left_items = contents[:mid]
        right_items = contents[mid:]
        _add_bullets(slide, Inches(0.38), Inches(1.65),
                     Inches(6.0), Inches(5.4),
                     left_items, size=17, color=theme["text"],
                     accent2=theme["accent2"], space_after=14)
        if right_items:
            _add_bullets(slide, Inches(6.8), Inches(1.65),
                         Inches(6.0), Inches(5.4),
                         right_items, size=17, color=theme["text"],
                         accent2=theme["accent2"], space_after=14)
        _footer(slide, teacher_name, teacher_school, theme)

    # ── 3. Содержательные слайды (двухколоночный layout с фото) ──────────
    for idx, s in enumerate(slides_data, start=1):
        slide = prs.slides.add_slide(blank)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        _slide_header(slide, s["title"], idx, total_content, teacher_name, theme)

        img_bytes = images.get(idx)
        fact = s.get("fact", "")
        bullets = s["bullets"]

        if img_bytes:
            # Двухколоночный layout: тезисы слева (8.1"), фото справа (4.7")
            content_top = Inches(1.58)
            content_h = SLIDE_H - Inches(1.58) - Inches(0.6)
            photo_w = Inches(4.55)
            photo_h = Inches(4.8)
            photo_x = SLIDE_W - photo_w - Inches(0.25)
            photo_y = Inches(1.62)

            # Рамка под фото
            _add_rect(slide, photo_x - Emu(76200), photo_y - Emu(76200),
                      photo_w + Emu(152400), photo_h + Emu(152400), theme["accent"])
            _add_image_to_slide(slide, img_bytes, photo_x, photo_y, photo_w, photo_h)

            bullets_w = Inches(8.0)
            # Тезисы
            _add_bullets(slide,
                         Inches(0.32), content_top,
                         bullets_w, Inches(4.0) if fact else content_h,
                         bullets, size=16, color=theme["text"],
                         accent2=theme["accent2"], space_after=8)
            # Блок факта под тезисами (если есть)
            if fact:
                fact_y = content_top + Inches(4.1)
                fact_h = SLIDE_H - fact_y - Inches(0.62)
                if fact_h > Inches(0.4):
                    _add_rect(slide, Inches(0.32), fact_y,
                              bullets_w, fact_h, theme["accent"])
                    _add_text(slide, Inches(0.32), fact_y, Inches(1.5), fact_h,
                              "★ ФАКТ", size=9, bold=True,
                              color=theme["accent2"], anchor=MSO_ANCHOR.MIDDLE)
                    _add_text(slide, Inches(1.85), fact_y + Emu(50000),
                              bullets_w - Inches(1.6), fact_h - Emu(100000),
                              fact, size=12, color=theme["white"],
                              italic=True, anchor=MSO_ANCHOR.MIDDLE)
        else:
            # Без фото — тезисы на всю ширину + блок факта справа
            if fact:
                bullets_w = Inches(8.5)
                _add_bullets(slide, Inches(0.32), Inches(1.65),
                             bullets_w, Inches(5.2),
                             bullets, size=17, color=theme["text"],
                             accent2=theme["accent2"], space_after=9)
                _add_rect(slide, Inches(9.1), Inches(1.75),
                          Inches(3.85), Inches(1.1), theme["accent"])
                _add_text(slide, Inches(9.25), Inches(1.82), Inches(3.5), Inches(0.3),
                          "ИНТЕРЕСНЫЙ ФАКТ", size=9, bold=True,
                          color=theme["accent2"])
                _add_text(slide, Inches(9.25), Inches(2.14), Inches(3.5), Inches(0.62),
                          fact, size=12, color=theme["white"],
                          italic=True, anchor=MSO_ANCHOR.TOP)
            else:
                _add_bullets(slide, Inches(0.32), Inches(1.65),
                             Inches(12.6), Inches(5.3),
                             bullets, size=17, color=theme["text"],
                             accent2=theme["accent2"], space_after=9)

        _footer(slide, teacher_name, teacher_school, theme)

    # ── 4. Слайд выводов ─────────────────────────────────────────────────
    if conclusion:
        slide = prs.slides.add_slide(blank)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.45), theme["accent"])
        _add_rect(slide, 0, Inches(1.45), Inches(0.18),
                  SLIDE_H - Inches(1.45), theme["accent2"])
        _add_text(slide, Inches(0.3), Inches(0.28), Inches(3), Inches(0.5),
                  "ИТОГИ УРОКА", size=11, bold=True, color=theme["accent2"])
        _add_text(slide, Inches(0.55), Inches(0.28), Inches(11.5), Inches(0.9),
                  "Ключевые выводы", size=28, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        _add_bullets(slide, Inches(0.32), Inches(1.65),
                     Inches(12.6), Inches(5.1),
                     conclusion, size=19, color=theme["text"],
                     accent2=theme["accent2"], space_after=12)
        _footer(slide, teacher_name, teacher_school, theme)

    # ── 5. Финальный слайд ───────────────────────────────────────────────
    slide = prs.slides.add_slide(blank)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["title_bg"])
    _add_rect(slide, 0, Inches(4.55), SLIDE_W, Inches(0.08), theme["accent2"])
    _add_rect(slide, 0, 0, Inches(0.45), SLIDE_H, theme["accent2"])
    _add_text(slide, Inches(0.7), Inches(2.65), Inches(11.8), Inches(1.6),
              "Спасибо за внимание!", size=50, bold=True,
              color=theme["white"], align=PP_ALIGN.CENTER)
    _add_text(slide, Inches(0.7), Inches(4.35), Inches(11.8), Inches(0.6),
              "Вопросы и обсуждение", size=20,
              color=theme["title_sub"], align=PP_ALIGN.CENTER)
    if footer_text:
        _add_text(slide, Inches(0.7), SLIDE_H - Inches(0.75),
                  Inches(12.13), Inches(0.45),
                  footer_text, size=13, color=theme["title_sub"], align=PP_ALIGN.CENTER)

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()


def safe_filename(s: str, max_len: int = 60) -> str:
    s = re.sub(r"[\\/:*?\"<>|]+", " ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:max_len] or "Презентация"


# ─── HANDLER ─────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Генерирует PPTX-презентацию по теме урока строго по ФГОС и программе Минпросвещения РФ, с фотографиями."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()

    if method == "GET" and action == "ping":
        try:
            get_gigachat_token()
            return _resp(200, {"ok": True, "service": "GigaChat-2"})
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

    login = (body.get("login") or "").strip()
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

    # Проверяем лимит AI-запросов для trial-пользователей
    if login:
        try:
            limit_req = urllib.request.Request(
                f"{AUTH_URL}?action=check-ai-limit",
                data=json.dumps({"login": login}).encode("utf-8"),
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(limit_req, timeout=10) as r:
                limit_data = json.loads(r.read().decode())
            if not limit_data.get("allowed"):
                return _resp(429, {"error": limit_data.get("error", "Достигнут лимит ИИ-запросов")})
        except urllib.error.HTTPError as e:
            err_body = json.loads(e.read().decode() or "{}")
            if e.code == 429:
                return _resp(429, {"error": err_body.get("error", "Достигнут лимит ИИ-запросов на сегодня")})
        except Exception:
            pass

    theme = pick_theme(topic)

    # Шаг 1: генерируем структуру через GigaChat-2
    try:
        outline = generate_outline(topic, description, slides_count, audience)
    except Exception as e:
        msg = str(e)
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return _resp(504, {"error": "ИИ-сервис не успел ответить — попробуйте ещё раз."})
        if "429" in msg or "rate" in msg.lower():
            return _resp(429, {"error": "Слишком много запросов к ИИ-сервису — подождите 30 секунд."})
        return _resp(500, {"error": f"Ошибка генерации структуры: {msg}"})

    # Шаг 2: загружаем фотографии для каждого слайда параллельно (последовательно)
    images = {}
    for idx, slide_data in enumerate(outline["slides"], start=1):
        query = slide_data.get("image_query") or slide_data["title"]
        img = fetch_image_for_slide(query, topic)
        if img:
            images[idx] = img

    # Шаг 3: собираем PPTX
    try:
        pptx_bytes = build_pptx(
            topic=topic,
            subtitle=outline["subtitle"],
            contents=outline.get("contents", []),
            slides_data=outline["slides"],
            conclusion=outline["conclusion"],
            teacher_name=teacher_name,
            teacher_school=teacher_school,
            theme=theme,
            images=images,
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