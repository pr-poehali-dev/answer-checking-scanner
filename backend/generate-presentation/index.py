"""
Генерация PPTX-презентации по теме урока через GigaChat. v2
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
import time
import base64
import random
import urllib.request
import urllib.error
from datetime import datetime

AUTH_URL = os.environ.get("AUTH_FUNCTION_URL", "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b")

TOKENS_COST_PRESENTATION = 4000


def spend_ai_tokens(login: str, amount: int, action_label: str = "Презентация") -> tuple[bool, str]:
    if not login:
        return True, ""
    try:
        req = urllib.request.Request(
            f"{AUTH_URL}?action=spend-tokens",
            data=json.dumps({"login": login, "amount": amount, "action_label": action_label}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            json.loads(r.read().decode())
        return True, ""
    except urllib.error.HTTPError as e:
        err_body = {}
        try:
            err_body = json.loads(e.read().decode())
        except Exception:
            pass
        if e.code == 402:
            return False, err_body.get("error", "Недостаточно токенов")
        return True, ""
    except Exception:
        return True, ""


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
    {   # Глубокий океан — синий с бирюзой
        "name": "ocean",
        "bg":        RGBColor(0xF0, 0xF6, 0xFC),
        "title_bg":  RGBColor(0x09, 0x1E, 0x42),
        "accent":    RGBColor(0x09, 0x1E, 0x42),
        "accent2":   RGBColor(0x00, 0xB4, 0xD8),
        "accent3":   RGBColor(0x48, 0xCA, 0xE4),
        "text":      RGBColor(0x0D, 0x1B, 0x2A),
        "muted":     RGBColor(0x55, 0x70, 0x8B),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0x90, 0xC8, 0xF0),
        "stripe":    RGBColor(0x00, 0xB4, 0xD8),
        "card_bg":   RGBColor(0xE0, 0xF2, 0xFE),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
        "layout":    "left_header",   # шапка слева с крупным номером
    },
    {   # Тёмный лес — изумрудный с золотом
        "name": "forest",
        "bg":        RGBColor(0xF0, 0xF7, 0xF1),
        "title_bg":  RGBColor(0x0F, 0x2D, 0x1F),
        "accent":    RGBColor(0x0F, 0x2D, 0x1F),
        "accent2":   RGBColor(0x2D, 0xC6, 0x5F),
        "accent3":   RGBColor(0xD4, 0xA0, 0x17),
        "text":      RGBColor(0x0A, 0x1F, 0x10),
        "muted":     RGBColor(0x4A, 0x6E, 0x55),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xA8, 0xDF, 0xB8),
        "stripe":    RGBColor(0x2D, 0xC6, 0x5F),
        "card_bg":   RGBColor(0xDC, 0xF5, 0xE7),
        "label":     "УРОК · ПРИРОДА И НАУКА",
        "layout":    "split_diagonal",  # диагональная шапка
    },
    {   # Закат истории — тёмно-красный с золотом
        "name": "sunset",
        "bg":        RGBColor(0xFD, 0xF3, 0xE8),
        "title_bg":  RGBColor(0x3D, 0x0C, 0x02),
        "accent":    RGBColor(0x3D, 0x0C, 0x02),
        "accent2":   RGBColor(0xE8, 0x9A, 0x0C),
        "accent3":   RGBColor(0xC0, 0x39, 0x2B),
        "text":      RGBColor(0x1F, 0x0A, 0x04),
        "muted":     RGBColor(0x7A, 0x50, 0x3A),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xF5, 0xCE, 0x8C),
        "stripe":    RGBColor(0xE8, 0x9A, 0x0C),
        "card_bg":   RGBColor(0xFE, 0xE8, 0xCC),
        "label":     "ИСТОРИЯ И КУЛЬТУРА",
        "layout":    "top_banner",  # широкий баннер сверху
    },
    {   # Квантовый сланец — тёмно-фиолетовый с неоном
        "name": "slate",
        "bg":        RGBColor(0xF4, 0xF2, 0xFF),
        "title_bg":  RGBColor(0x1A, 0x13, 0x36),
        "accent":    RGBColor(0x1A, 0x13, 0x36),
        "accent2":   RGBColor(0x7C, 0x3A, 0xFF),
        "accent3":   RGBColor(0x00, 0xE5, 0xFF),
        "text":      RGBColor(0x12, 0x0C, 0x25),
        "muted":     RGBColor(0x6A, 0x60, 0x90),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xC4, 0xB0, 0xFF),
        "stripe":    RGBColor(0x7C, 0x3A, 0xFF),
        "card_bg":   RGBColor(0xEA, 0xE5, 0xFF),
        "label":     "ТОЧНЫЕ НАУКИ",
        "layout":    "sidebar_dark",  # тёмный сайдбар слева
    },
    {   # Лаборатория — тёмный с кораллом и циановым
        "name": "coral",
        "bg":        RGBColor(0xF8, 0xF5, 0xF2),
        "title_bg":  RGBColor(0x18, 0x22, 0x2F),
        "accent":    RGBColor(0x18, 0x22, 0x2F),
        "accent2":   RGBColor(0xFF, 0x5E, 0x4B),
        "accent3":   RGBColor(0x00, 0xD4, 0xC8),
        "text":      RGBColor(0x10, 0x18, 0x22),
        "muted":     RGBColor(0x6A, 0x72, 0x7E),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xF5, 0xBB, 0xB5),
        "stripe":    RGBColor(0xFF, 0x5E, 0x4B),
        "card_bg":   RGBColor(0xFE, 0xEC, 0xEA),
        "label":     "ХИМИЯ И БИОЛОГИЯ",
        "layout":    "top_banner",
    },
    {   # Арктика — холодный белый с синим льдом
        "name": "arctic",
        "bg":        RGBColor(0xF5, 0xF9, 0xFF),
        "title_bg":  RGBColor(0x0A, 0x2A, 0x4A),
        "accent":    RGBColor(0x0A, 0x2A, 0x4A),
        "accent2":   RGBColor(0x4F, 0xC3, 0xF7),
        "accent3":   RGBColor(0xE0, 0xF7, 0xFA),
        "text":      RGBColor(0x08, 0x20, 0x38),
        "muted":     RGBColor(0x50, 0x70, 0x90),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xB3, 0xE5, 0xFC),
        "stripe":    RGBColor(0x4F, 0xC3, 0xF7),
        "card_bg":   RGBColor(0xE1, 0xF5, 0xFE),
        "label":     "ГЕОГРАФИЯ И ПРИРОДА",
        "layout":    "left_header",
    },
    {   # Рассвет — тёплый кремовый с индиго
        "name": "dawn",
        "bg":        RGBColor(0xFE, 0xF9, 0xF0),
        "title_bg":  RGBColor(0x2C, 0x17, 0x6E),
        "accent":    RGBColor(0x2C, 0x17, 0x6E),
        "accent2":   RGBColor(0xFF, 0x8C, 0x42),
        "accent3":   RGBColor(0xFF, 0xD1, 0x66),
        "text":      RGBColor(0x1A, 0x0E, 0x3A),
        "muted":     RGBColor(0x7A, 0x65, 0x90),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xD4, 0xC0, 0xFF),
        "stripe":    RGBColor(0xFF, 0x8C, 0x42),
        "card_bg":   RGBColor(0xFE, 0xF0, 0xDC),
        "label":     "ЛИТЕРАТУРА И ИСКУССТВО",
        "layout":    "split_diagonal",
    },
    {   # Монохром — элегантный чёрно-белый с акцентом
        "name": "mono",
        "bg":        RGBColor(0xFA, 0xFA, 0xFA),
        "title_bg":  RGBColor(0x10, 0x10, 0x10),
        "accent":    RGBColor(0x10, 0x10, 0x10),
        "accent2":   RGBColor(0xE5, 0x3E, 0x3E),
        "accent3":   RGBColor(0xFF, 0xD7, 0x00),
        "text":      RGBColor(0x18, 0x18, 0x18),
        "muted":     RGBColor(0x70, 0x70, 0x70),
        "white":     RGBColor(0xFF, 0xFF, 0xFF),
        "title_sub": RGBColor(0xCC, 0xCC, 0xCC),
        "stripe":    RGBColor(0xE5, 0x3E, 0x3E),
        "card_bg":   RGBColor(0xF0, 0xF0, 0xF0),
        "label":     "УРОК · ПРЕЗЕНТАЦИЯ",
        "layout":    "sidebar_dark",
    },
]

THEME_KEYWORDS = {
    "forest":  ["биол", "экол", "природ", "животн", "растен", "лес", "зоол", "ботан", "органи", "генет", "эволюц"],
    "sunset":  ["истор", "литер", "обществ", "война", "революц", "культур", "философ", "социол", "политол", "граждан", "религ"],
    "slate":   ["физик", "матем", "информат", "програм", "алгебр", "геометр", "алгоритм", "электрон", "квант", "механик", "тригон"],
    "coral":   ["хими", "медиц", "здоровь", "биохим", "анатом", "физиол", "реакц", "молекул", "клетк", "микроб"],
    "arctic":  ["геograph", "геогр", "климат", "страно", "материк", "океан", "река", "горн", "атмосфер", "почв", "ландшафт"],
    "dawn":    ["искусств", "живопис", "музык", "архитект", "театр", "кино", "скульптур", "поэз", "роман", "пьес"],
    "mono":    ["правов", "эконом", "финанс", "право", "конституц", "государств", "юрид", "налог"],
}


def pick_theme(topic: str) -> dict:
    t = topic.lower()
    for theme_name, keywords in THEME_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return next(th for th in THEMES if th["name"] == theme_name)
    return random.choice(THEMES)


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


# ─── YANDEXGPT API ────────────────────────────────────────────────────────────

YANDEX_GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def _yandex_chat(messages: list, max_tokens: int = 4000, temperature: float = 0.2,
                 req_timeout: int = 90) -> tuple[str, int]:
    api_key = os.environ.get("YANDEXGPT_API_KEY", "").strip()
    folder_id = os.environ.get("YANDEXGPT_FOLDER_ID", "").strip()
    if not api_key or not folder_id:
        raise RuntimeError("YANDEXGPT_API_KEY или YANDEXGPT_FOLDER_ID не заданы")
    yandex_messages = [{"role": m.get("role", "user"), "text": m.get("content", "")} for m in messages]
    payload = {
        "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {
            "stream": False,
            "temperature": temperature,
            "maxTokens": str(max_tokens),
        },
        "messages": yandex_messages,
    }
    req = urllib.request.Request(
        YANDEX_GPT_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Api-Key {api_key}",
            "x-folder-id": folder_id,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=req_timeout) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="ignore")
        print(f"[YandexGPT] HTTP {e.code}: {err_body[:500]}")
        raise RuntimeError(f"YandexGPT HTTP {e.code}: {err_body[:300]}")
    alternatives = (body.get("result") or {}).get("alternatives") or []
    if not alternatives:
        raise RuntimeError(f"YandexGPT пустой ответ: {body}")
    text = alternatives[0].get("message", {}).get("text", "").strip()
    if not text:
        raise RuntimeError("YandexGPT вернул пустой текст")
    usage = (body.get("result") or {}).get("usage") or {}
    tokens_used = int(usage.get("totalTokens") or usage.get("completionTokens") or 0)
    return text, tokens_used


def get_gigachat_token():
    pass  # не используется, оставлен для совместимости ping-эндпоинта


def openrouter_chat(messages: list, max_tokens: int = 4000, temperature: float = 0.2,
                    req_timeout: int = 90) -> tuple[str, int]:
    return _yandex_chat(messages, max_tokens=max_tokens, temperature=temperature, req_timeout=req_timeout)


def gigachat_with_fallback(messages: list, max_tokens: int = 3000) -> tuple[str, int]:
    return _yandex_chat(messages, max_tokens=max_tokens)


def _repair_truncated_json(text: str) -> str:
    """Пытается закрыть обрезанный JSON: закрывает незакрытые строки/массивы/объекты."""
    # Убираем trailing мусор до последней «чистой» запятой или значения
    text = text.rstrip().rstrip(",").rstrip()
    # Считаем незакрытые скобки/кавычки
    in_string = False
    escape_next = False
    stack = []
    for ch in text:
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ("{", "["):
            stack.append(ch)
        elif ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()
        elif ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()
    # Если внутри строки — закрываем её
    if in_string:
        text += '"'
    # Закрываем массивы и объекты в обратном порядке
    for ch in reversed(stack):
        text += "]" if ch == "[" else "}"
    return text


def extract_json(text: str) -> dict:
    text = text.strip()
    # Убираем markdown-блок если есть
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*)", text)
    if fence:
        text = fence.group(1)
        end_fence = text.find("```")
        if end_fence >= 0:
            text = text[:end_fence]
    # Берём от первой { до конца
    s = text.find("{")
    if s >= 0:
        text = text[s:]
    # Пробуем распарсить как есть
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Пробуем закрыть обрезанный JSON
    fixed = _repair_truncated_json(text)
    return json.loads(fixed)


# ─── ПОИСК ИЗОБРАЖЕНИЙ ───────────────────────────────────────────────────────

def fetch_wikimedia(query: str, timeout: int = 5) -> bytes | None:
    """Ищет изображение через Wikimedia Commons."""
    try:
        # Попробуем сначала английский запрос (Wikimedia лучше по-английски)
        for q in [query]:
            search_q = urllib.parse.quote(q)
            url = (
                f"https://commons.wikimedia.org/w/api.php"
                f"?action=query&generator=search&gsrnamespace=6"
                f"&gsrsearch={search_q}&gsrlimit=5"
                f"&prop=imageinfo&iiprop=url|mime|size"
                f"&iiurlwidth=800&format=json&origin=*"
            )
            req = urllib.request.Request(url, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode())

            pages = (data.get("query") or {}).get("pages") or {}
            candidates = []
            for page in pages.values():
                ii = (page.get("imageinfo") or [{}])[0]
                mime = ii.get("mime", "")
                thumb_url = ii.get("thumburl") or ii.get("url", "")
                size = ii.get("size", 0)
                if mime in ("image/jpeg", "image/png") and thumb_url and 8000 < size < 5_000_000:
                    candidates.append((size, thumb_url))

            # Берём самое «тяжёлое» (крупное) изображение
            candidates.sort(reverse=True)
            for _, thumb_url in candidates[:2]:
                try:
                    req2 = urllib.request.Request(thumb_url, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
                    with urllib.request.urlopen(req2, timeout=timeout) as r2:
                        return r2.read()
                except Exception:
                    continue
        return None
    except Exception:
        return None


def fetch_image_bytes(query: str, timeout: int = 5) -> bytes | None:
    """Ищет изображение: сначала Wikimedia, затем Wikipedia featured."""
    result = fetch_wikimedia(query, timeout)
    if result:
        return result
    # Fallback: ищем через Wikipedia API (статейные изображения)
    try:
        search_q = urllib.parse.quote(query)
        url = (
            f"https://ru.wikipedia.org/w/api.php"
            f"?action=query&titles={search_q}&prop=pageimages"
            f"&pithumbsize=700&format=json&origin=*"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
        pages = (data.get("query") or {}).get("pages") or {}
        for page in pages.values():
            thumb = (page.get("thumbnail") or {}).get("source")
            if thumb:
                req2 = urllib.request.Request(thumb, headers={"User-Agent": "AOUSPT-Edu-Bot/1.0"})
                with urllib.request.urlopen(req2, timeout=timeout) as r2:
                    return r2.read()
    except Exception:
        pass
    return None


def fetch_images_parallel(slides: list, topic: str) -> list:
    """Параллельно загружает до 3 изображений для каждого слайда.
    Возвращает list[list[bytes]] — список фото для каждого слайда."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def get_imgs_for_slide(idx_slide):
        idx, slide = idx_slide
        queries = slide.get("image_queries") or []
        if not queries:
            old_q = slide.get("image_query") or slide.get("title", "")
            queries = [old_q, f"{topic} {slide.get('title', '')}", slide.get("title", "")]
        queries = [q for q in queries if q][:3]

        imgs = []
        seen_hashes = set()
        for q in queries:
            if len(imgs) >= 3:
                break
            img = fetch_image_bytes(q, timeout=4)
            if img:
                h = hash(img[:64])
                if h not in seen_hashes:
                    seen_hashes.add(h)
                    imgs.append(img)
        return idx, imgs

    results = [[] for _ in slides]
    with ThreadPoolExecutor(max_workers=min(len(slides) * 2, 12)) as ex:
        futures = {ex.submit(get_imgs_for_slide, (i, s)): i for i, s in enumerate(slides)}
        for future in as_completed(futures, timeout=20):
            try:
                idx, imgs = future.result()
                results[idx] = imgs
            except Exception:
                pass
    return results


def fetch_image_for_slide(slide_title: str, topic: str) -> bytes | None:
    """Совместимость со старым кодом."""
    return fetch_image_bytes(f"{slide_title} {topic}", timeout=5)


# ─── ГЕНЕРАЦИЯ СТРУКТУРЫ ─────────────────────────────────────────────────────

def generate_outline(topic: str, description: str, slides_count: int, audience: str) -> tuple[dict, int]:
    """Генерирует развёрнутую структуру презентации строго по ФГОС."""
    audience_str = audience or "школьники"

    system = (
        "Ты опытный методист и дизайнер учебных презентаций по ФГОС. "
        "Создаёшь насыщенный, информативный контент с конкретными фактами, датами, именами. "
        "Отвечаешь ТОЛЬКО валидным JSON без пояснений и markdown-блоков."
    )

    user = (
        f"Тема: {topic}. Аудитория: {audience_str}. Слайдов: {slides_count}.\n"
        + (f"Контекст учителя: {description[:800]}\n" if description else "")
        + 'Верни JSON строго в формате:\n'
        '{"subtitle":"развёрнутый подзаголовок 6-10 слов",'
        '"contents":["название раздела 1","название раздела 2","..."],'
        '"slides":[{'
        '"title":"заголовок слайда 4-7 слов",'
        '"bullets":["Развёрнутый тезис 1 — 15-25 слов с конкретным фактом","Тезис 2 — 15-25 слов","Тезис 3","Тезис 4","Тезис 5"],'
        '"fact":"Интересный факт или цитата эксперта — 15-25 слов",'
        '"image_queries":["конкретный запрос фото 1 на русском","конкретный запрос фото 2","конкретный запрос фото 3"]}],'
        '"conclusion":["Вывод 1 — 10-20 слов","Вывод 2","Вывод 3"]}\n'
        f"Ровно {slides_count} слайдов. bullets — ровно 5 штук на каждый слайд. image_queries — 3 разных запроса."
    )

    # ~300 токенов на слайд (5 тезисов × ~25 слов + заголовок + fact + 3 queries + запас)
    max_tok = min(300 * slides_count + 800, 7000)

    raw, tokens_used = gigachat_with_fallback(
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
        bullets = [str(b).strip() for b in bullets if str(b).strip()][:7]
        fact = (s.get("fact") or "").strip()
        # Поддерживаем оба формата: новый image_queries (список) и старый image_query (строка)
        image_queries = s.get("image_queries") or []
        if not isinstance(image_queries, list) or not image_queries:
            single = (s.get("image_query") or title).strip()
            image_queries = [single, f"{topic} {title}", title] if single else [title, title, title]
        image_queries = [str(q).strip() for q in image_queries if str(q).strip()][:3]
        if not image_queries:
            image_queries = [title, topic, title]
        if title and bullets:
            norm_slides.append({
                "title": title,
                "bullets": bullets,
                "fact": fact,
                "image_queries": image_queries,
            })

    if not norm_slides:
        raise RuntimeError("ИИ вернул пустые слайды")

    contents = data.get("contents") or [s["title"] for s in norm_slides]

    return {
        "subtitle": (data.get("subtitle") or "").strip(),
        "contents": [str(c).strip() for c in contents if str(c).strip()][:slides_count],
        "slides": norm_slides,
        "conclusion": [str(c).strip() for c in (data.get("conclusion") or []) if str(c).strip()][:5],
    }, tokens_used


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
    """Шапка слайда: стиль зависит от layout темы."""
    layout = theme.get("layout", "top_banner")

    if layout == "sidebar_dark":
        # Тёмный вертикальный сайдбар слева с большим номером
        sidebar_w = Inches(1.8)
        _add_rect(slide, 0, 0, sidebar_w, SLIDE_H, theme["accent"])
        _add_rect(slide, sidebar_w, 0, Inches(0.06), SLIDE_H, theme["accent2"])
        _add_text(slide, 0, Inches(0.3), sidebar_w, Inches(1.0),
                  f"{slide_num:02d}", size=52, bold=True, color=theme["accent2"],
                  align=PP_ALIGN.CENTER)
        _add_text(slide, 0, Inches(1.3), sidebar_w, Inches(0.5),
                  f"/ {total:02d}", size=14, color=theme["title_sub"],
                  align=PP_ALIGN.CENTER)
        # Заголовок в правой части
        _add_rect(slide, sidebar_w + Inches(0.06), 0,
                  SLIDE_W - sidebar_w - Inches(0.06), Inches(1.2), theme["accent"])
        _add_text(slide, sidebar_w + Inches(0.2), Inches(0.15),
                  SLIDE_W - sidebar_w - Inches(0.4), Inches(0.9),
                  title, size=24, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        if teacher_name:
            _add_text(slide, sidebar_w + Inches(0.2), Inches(0.15),
                      SLIDE_W - sidebar_w - Inches(0.4), Inches(0.9),
                      teacher_name, size=10, color=theme["title_sub"],
                      align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.BOTTOM)

    elif layout == "split_diagonal":
        # Горизонтальная шапка с диагональным акцентом
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.5), theme["accent"])
        # Диагональный декор-прямоугольник
        _add_rect(slide, Inches(10.5), 0, Inches(2.83), Inches(1.5), theme["accent2"])
        _add_text(slide, Inches(10.55), 0, Inches(2.7), Inches(1.5),
                  f"{slide_num:02d}/{total:02d}", size=28, bold=True,
                  color=theme["accent"], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        _add_text(slide, Inches(0.4), Inches(0.15), Inches(10.0), Inches(1.1),
                  title, size=26, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        _add_rect(slide, 0, Inches(1.5), Inches(0.14), SLIDE_H - Inches(1.5), theme["accent2"])

    elif layout == "left_header":
        # Широкая полоса с крупным цветным номером в кружке
        _add_rect(slide, 0, 0, SLIDE_W, Inches(1.55), theme["accent"])
        # Цветной блок-нумератор
        _add_rect(slide, Inches(0.25), Inches(0.22), Inches(0.95), Inches(0.95), theme["accent2"])
        _add_text(slide, Inches(0.25), Inches(0.22), Inches(0.95), Inches(0.95),
                  str(slide_num), size=24, bold=True, color=theme["accent"],
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        _add_text(slide, Inches(1.35), Inches(0.22), Inches(10.3), Inches(1.05),
                  title, size=26, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        _add_text(slide, Inches(1.35), Inches(0.22), Inches(11.6), Inches(1.05),
                  f"{total}", size=11, color=theme["title_sub"],
                  align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.BOTTOM)
        _add_rect(slide, 0, Inches(1.55), SLIDE_W, Emu(9144), theme["accent2"])

    else:  # top_banner (default)
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


def _content_area_top(theme: dict) -> float:
    """Возвращает Y-начало контентной зоны в зависимости от layout."""
    layout = theme.get("layout", "top_banner")
    if layout == "sidebar_dark":
        return Inches(0.2)       # контент начинается сразу, сайдбар слева
    elif layout == "split_diagonal":
        return Inches(1.6)
    elif layout == "left_header":
        return Inches(1.7)
    return Inches(1.58)          # top_banner


def _content_area_x(theme: dict) -> float:
    layout = theme.get("layout", "top_banner")
    if layout == "sidebar_dark":
        return Inches(2.0)       # после сайдбара
    return Inches(0.32)


def _content_area_w(theme: dict, has_photo: bool) -> float:
    layout = theme.get("layout", "top_banner")
    sidebar = layout == "sidebar_dark"
    base_x = Inches(2.0) if sidebar else Inches(0.32)
    total_w = SLIDE_W - base_x - Inches(0.2)
    if has_photo:
        return total_w - Inches(4.7)
    return total_w


def build_pptx(topic: str, subtitle: str, contents: list, slides_data: list,
               conclusion: list, teacher_name: str, teacher_school: str,
               theme: dict, images: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]
    total_content = len(slides_data)
    layout = theme.get("layout", "top_banner")
    parts = [p for p in [teacher_name, teacher_school] if p]
    footer_text = "   ·   ".join(parts)

    # ── 1. Титульный слайд ────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank)
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["title_bg"])

    if layout == "sidebar_dark":
        # Вертикальный акцент справа
        _add_rect(slide, SLIDE_W - Inches(0.55), 0, Inches(0.55), SLIDE_H, theme["accent2"])
        _add_rect(slide, 0, Inches(3.5), SLIDE_W - Inches(0.55), Inches(0.06), theme["accent2"])
        _add_text(slide, Inches(0.7), Inches(0.9), Inches(9), Inches(0.45),
                  theme["label"], size=11, bold=True, color=theme["accent2"])
        _add_text(slide, Inches(0.7), Inches(1.5), Inches(11.5), Inches(2.1),
                  topic, size=44, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
        if subtitle:
            _add_text(slide, Inches(0.7), Inches(3.65), Inches(11.5), Inches(0.9),
                      subtitle, size=17, color=theme["title_sub"])

    elif layout == "split_diagonal":
        # Нижний блок с диагональным стыком — визуально через два прямоугольника
        _add_rect(slide, 0, Inches(4.0), SLIDE_W, Inches(3.5), theme["accent2"])
        _add_rect(slide, 0, Inches(4.0), Inches(7.0), Inches(3.5), theme["accent"])
        _add_rect(slide, 0, 0, Inches(0.5), SLIDE_H, theme["accent2"])
        _add_text(slide, Inches(0.7), Inches(0.8), Inches(9), Inches(0.5),
                  theme["label"], size=12, bold=True, color=theme["accent2"])
        _add_text(slide, Inches(0.7), Inches(1.4), Inches(11.8), Inches(2.5),
                  topic, size=44, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
        if subtitle:
            _add_text(slide, Inches(0.7), Inches(4.1), Inches(6.5), Inches(0.9),
                      subtitle, size=16, color=theme["white"])

    elif layout == "left_header":
        # Крупный цветной блок слева
        _add_rect(slide, 0, 0, Inches(5.5), SLIDE_H, theme["accent"])
        _add_rect(slide, Inches(5.5), 0, Inches(0.08), SLIDE_H, theme["accent2"])
        _add_text(slide, Inches(0.4), Inches(1.0), Inches(5.0), Inches(0.5),
                  theme["label"], size=11, bold=True, color=theme["accent2"])
        _add_text(slide, Inches(0.4), Inches(1.6), Inches(4.8), Inches(3.5),
                  topic, size=36, bold=True, color=theme["white"],
                  align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
        if subtitle:
            _add_text(slide, Inches(0.4), Inches(5.5), Inches(4.8), Inches(0.9),
                      subtitle, size=15, color=theme["title_sub"])
        # Правая часть — дата и учитель
        _add_text(slide, Inches(5.8), Inches(2.5), Inches(7.0), Inches(1.5),
                  datetime.now().strftime("%d.%m.%Y"), size=28,
                  color=theme["title_sub"], align=PP_ALIGN.LEFT)

    else:  # top_banner
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

    if footer_text and layout != "left_header":
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

        if layout == "sidebar_dark":
            _add_rect(slide, 0, 0, Inches(1.8), SLIDE_H, theme["accent"])
            _add_rect(slide, Inches(1.8), 0, Inches(0.06), SLIDE_H, theme["accent2"])
            _add_text(slide, 0, Inches(0.5), Inches(1.8), Inches(1.2),
                      "СО\nДЕР\nЖА\nНИЕ", size=12, bold=True, color=theme["accent2"],
                      align=PP_ALIGN.CENTER)
            cx = Inches(2.1)
            cw = Inches(10.8)
            cy = Inches(0.4)
        else:
            _add_rect(slide, 0, 0, SLIDE_W, Inches(1.45), theme["accent"])
            _add_rect(slide, 0, Inches(1.45), Inches(0.18),
                      SLIDE_H - Inches(1.45), theme["accent2"])
            _add_text(slide, Inches(0.55), Inches(0.28), Inches(11.5), Inches(0.9),
                      "Содержание урока", size=28, bold=True, color=theme["white"],
                      align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
            cx = Inches(0.38)
            cw = Inches(6.0)
            cy = Inches(1.65)

        mid = (len(contents) + 1) // 2
        left_items = contents[:mid]
        right_items = contents[mid:]

        if layout == "sidebar_dark":
            # Нумерованный список крупными карточками
            for i, item in enumerate(contents):
                card_y = cy + i * Inches(0.75)
                if card_y + Inches(0.65) > SLIDE_H - Inches(0.3):
                    break
                _add_rect(slide, cx, card_y, cw, Inches(0.62), theme["card_bg"])
                _add_text(slide, cx + Inches(0.1), card_y, Inches(0.6), Inches(0.62),
                          f"{i+1:02d}", size=14, bold=True, color=theme["accent2"],
                          anchor=MSO_ANCHOR.MIDDLE)
                _add_text(slide, cx + Inches(0.75), card_y, cw - Inches(0.85), Inches(0.62),
                          item, size=15, color=theme["text"], anchor=MSO_ANCHOR.MIDDLE)
        else:
            _add_bullets(slide, cx, cy, cw, Inches(5.4),
                         left_items, size=17, color=theme["text"],
                         accent2=theme["accent2"], space_after=14)
            if right_items:
                _add_bullets(slide, Inches(6.8), cy, cw, Inches(5.4),
                             right_items, size=17, color=theme["text"],
                             accent2=theme["accent2"], space_after=14)
        _footer(slide, teacher_name, teacher_school, theme)

    # ── 3. Содержательные слайды (современный layout) ────────────────────
    for idx, s in enumerate(slides_data, start=1):
        slide = prs.slides.add_slide(blank)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])
        _slide_header(slide, s["title"], idx, total_content, teacher_name, theme)

        slide_imgs = images.get(idx) or []  # list[bytes], до 3 штук
        fact = s.get("fact", "")
        bullets = s["bullets"]
        ct = _content_area_top(theme)
        cx = _content_area_x(theme)
        content_h = SLIDE_H - ct - Inches(0.6)

        # ── Layout выбирается по количеству фото и чётности слайда ─────
        n_imgs = len(slide_imgs)

        if n_imgs == 0:
            # Нет фото: текст + карточка факта справа
            if fact:
                fact_card_w = Inches(4.0)
                fact_card_x = SLIDE_W - fact_card_w - Inches(0.25)
                fact_card_y = ct + Inches(0.1)
                fact_card_h = Inches(2.8)
                _add_rect(slide, fact_card_x, fact_card_y, fact_card_w, fact_card_h, theme["accent"])
                _add_rect(slide, fact_card_x, fact_card_y, fact_card_w, Emu(130000), theme["accent2"])
                _add_text(slide, fact_card_x + Inches(0.15), fact_card_y + Emu(15000),
                          fact_card_w - Inches(0.3), Emu(110000),
                          "ИНТЕРЕСНЫЙ ФАКТ", size=9, bold=True, color=theme["accent2"])
                _add_text(slide, fact_card_x + Inches(0.15), fact_card_y + Inches(0.28),
                          fact_card_w - Inches(0.3), fact_card_h - Inches(0.35),
                          fact, size=13, color=theme["white"], italic=True, anchor=MSO_ANCHOR.TOP)
                text_w = fact_card_x - cx - Inches(0.3)
            else:
                text_w = SLIDE_W - cx - Inches(0.25)
            _add_bullets(slide, cx, ct, text_w, content_h,
                         bullets, size=16, color=theme["text"],
                         accent2=theme["accent2"], space_after=10)

        elif n_imgs == 1:
            # 1 фото: крупное справа/слева, текст по другой стороне
            photo_on_right = (idx % 2 != 0)
            photo_w = Inches(5.2)
            photo_h = min(content_h - Inches(0.1), Inches(5.0))
            photo_y = ct + Emu(20000)

            if photo_on_right:
                photo_x = SLIDE_W - photo_w - Inches(0.2)
                text_x = cx
                text_w = photo_x - cx - Inches(0.2)
            else:
                photo_x = cx
                text_x = cx + photo_w + Inches(0.25)
                text_w = SLIDE_W - text_x - Inches(0.2)

            # Рамка-акцент под фото
            _add_rect(slide, photo_x - Emu(55000), photo_y - Emu(55000),
                      photo_w + Emu(110000), photo_h + Emu(110000), theme["accent2"])
            _add_image_to_slide(slide, slide_imgs[0], photo_x, photo_y, photo_w, photo_h)

            # Текст-тезисы
            bullets_h = Inches(3.8) if fact else content_h
            _add_bullets(slide, text_x, ct, max(text_w, Inches(3.5)), bullets_h,
                         bullets, size=15, color=theme["text"],
                         accent2=theme["accent2"], space_after=9)
            # Карточка факта под тезисами
            if fact:
                fact_y = ct + Inches(3.9)
                fact_h = SLIDE_H - fact_y - Inches(0.55)
                if fact_h > Inches(0.4):
                    _add_rect(slide, text_x, fact_y, max(text_w, Inches(3.5)), fact_h, theme["accent"])
                    _add_text(slide, text_x + Inches(0.12), fact_y + Emu(25000),
                              Inches(1.1), fact_h, "★", size=18, bold=True,
                              color=theme["accent2"], anchor=MSO_ANCHOR.MIDDLE)
                    _add_text(slide, text_x + Inches(1.25), fact_y + Emu(30000),
                              max(text_w, Inches(3.5)) - Inches(1.35), fact_h - Emu(60000),
                              fact, size=12, color=theme["white"],
                              italic=True, anchor=MSO_ANCHOR.MIDDLE)

        elif n_imgs == 2:
            # 2 фото: левая колонка текст, правая — два фото вертикально
            text_w = Inches(6.8)
            col2_x = cx + text_w + Inches(0.25)
            col2_w = SLIDE_W - col2_x - Inches(0.2)
            ph = (content_h - Inches(0.15)) / 2

            _add_rect(slide, col2_x - Emu(50000), ct - Emu(30000),
                      col2_w + Emu(100000), ph + Emu(60000), theme["accent2"])
            _add_image_to_slide(slide, slide_imgs[0], col2_x, ct, col2_w, ph)

            _add_rect(slide, col2_x - Emu(50000), ct + ph + Inches(0.15) - Emu(30000),
                      col2_w + Emu(100000), ph + Emu(60000), theme["accent2"])
            _add_image_to_slide(slide, slide_imgs[1], col2_x, ct + ph + Inches(0.15), col2_w, ph)

            bullets_h = Inches(3.8) if fact else content_h
            _add_bullets(slide, cx, ct, text_w, bullets_h,
                         bullets, size=15, color=theme["text"],
                         accent2=theme["accent2"], space_after=9)
            if fact:
                fact_y = ct + Inches(3.9)
                fact_h = SLIDE_H - fact_y - Inches(0.55)
                if fact_h > Inches(0.35):
                    _add_rect(slide, cx, fact_y, text_w, fact_h, theme["accent"])
                    _add_text(slide, cx + Inches(0.12), fact_y + Emu(25000),
                              Inches(0.9), fact_h, "★", size=16, bold=True,
                              color=theme["accent2"], anchor=MSO_ANCHOR.MIDDLE)
                    _add_text(slide, cx + Inches(1.05), fact_y + Emu(30000),
                              text_w - Inches(1.15), fact_h - Emu(60000),
                              fact, size=12, color=theme["white"],
                              italic=True, anchor=MSO_ANCHOR.MIDDLE)

        else:
            # 3 фото: верхняя половина — текст, нижняя — полоса из 3 фото
            text_area_h = content_h * 0.52
            photo_strip_y = ct + text_area_h + Inches(0.15)
            photo_strip_h = SLIDE_H - photo_strip_y - Inches(0.55)
            pw = (SLIDE_W - cx - Inches(0.5)) / 3
            gap = Inches(0.12)

            for pi, img in enumerate(slide_imgs[:3]):
                px = cx + pi * (pw + gap)
                _add_rect(slide, px - Emu(40000), photo_strip_y - Emu(40000),
                          pw + Emu(80000), photo_strip_h + Emu(80000), theme["accent2"])
                _add_image_to_slide(slide, img, px, photo_strip_y, pw, photo_strip_h)

            # Тезисы над полосой фото
            _add_bullets(slide, cx, ct, SLIDE_W - cx - Inches(0.25), text_area_h,
                         bullets, size=14, color=theme["text"],
                         accent2=theme["accent2"], space_after=7)

        _footer(slide, teacher_name, teacher_school, theme)

    # ── 4. Слайд выводов ─────────────────────────────────────────────────
    if conclusion:
        slide = prs.slides.add_slide(blank)
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme["bg"])

        if layout == "sidebar_dark":
            _add_rect(slide, 0, 0, Inches(1.8), SLIDE_H, theme["accent"])
            _add_rect(slide, Inches(1.8), 0, Inches(0.06), SLIDE_H, theme["accent2"])
            _add_text(slide, 0, Inches(0.5), Inches(1.8), Inches(2.0),
                      "ИТО\nГИ", size=20, bold=True, color=theme["accent2"],
                      align=PP_ALIGN.CENTER)
            # Крупные карточки выводов
            for i, item in enumerate(conclusion[:4]):
                cy = Inches(0.4) + i * Inches(1.65)
                _add_rect(slide, Inches(2.1), cy, Inches(10.8), Inches(1.5), theme["card_bg"])
                _add_rect(slide, Inches(2.1), cy, Inches(0.5), Inches(1.5), theme["accent2"])
                _add_text(slide, Inches(2.65), cy + Emu(50000), Inches(10.0),
                          Inches(1.4), item, size=16, color=theme["text"],
                          anchor=MSO_ANCHOR.MIDDLE)
        elif layout in ("split_diagonal", "left_header"):
            # Двухколонная сетка карточек
            _add_rect(slide, 0, 0, SLIDE_W, Inches(1.3), theme["accent"])
            _add_rect(slide, 0, Inches(1.3), SLIDE_W, Emu(9144), theme["accent2"])
            _add_text(slide, Inches(0.4), Inches(0.2), Inches(12.0), Inches(0.9),
                      "Ключевые выводы урока", size=28, bold=True, color=theme["white"],
                      align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
            cols = [(Inches(0.3), Inches(6.3)), (Inches(6.8), Inches(6.3))]
            for i, item in enumerate(conclusion[:4]):
                col_x, col_w = cols[i % 2]
                row_y = Inches(1.55) + (i // 2) * Inches(2.8)
                _add_rect(slide, col_x, row_y, col_w, Inches(2.5), theme["card_bg"])
                _add_rect(slide, col_x, row_y, col_w, Emu(110000), theme["accent2"])
                _add_text(slide, col_x + Inches(0.15), row_y + Inches(0.2),
                          col_w - Inches(0.3), Inches(2.2),
                          item, size=15, color=theme["text"], anchor=MSO_ANCHOR.TOP)
        else:
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

    if layout == "sidebar_dark":
        _add_rect(slide, SLIDE_W - Inches(0.55), 0, Inches(0.55), SLIDE_H, theme["accent2"])
        _add_rect(slide, 0, Inches(3.5), SLIDE_W - Inches(0.55), Inches(0.06), theme["accent2"])
    elif layout == "split_diagonal":
        _add_rect(slide, 0, 0, Inches(0.5), SLIDE_H, theme["accent2"])
        _add_rect(slide, 0, Inches(4.0), SLIDE_W, Inches(0.06), theme["accent2"])
    elif layout == "left_header":
        _add_rect(slide, 0, 0, Inches(0.5), SLIDE_H, theme["accent2"])
        _add_rect(slide, 0, SLIDE_H - Inches(2.0), SLIDE_W, Inches(0.06), theme["accent2"])
    else:
        _add_rect(slide, 0, Inches(4.55), SLIDE_W, Inches(0.08), theme["accent2"])
        _add_rect(slide, 0, 0, Inches(0.45), SLIDE_H, theme["accent2"])

    _add_text(slide, Inches(0.7), Inches(2.5), Inches(11.8), Inches(1.6),
              "Спасибо за внимание!", size=52, bold=True,
              color=theme["white"], align=PP_ALIGN.CENTER)
    _add_text(slide, Inches(0.7), Inches(4.2), Inches(11.8), Inches(0.7),
              "Вопросы и обсуждение", size=22,
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

def _parse_body(event: dict) -> dict:
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
        return body
    except Exception:
        return {}


def handler(event: dict, context) -> dict:
    """
    Генерация PPTX разбита на 2 шага, чтобы уложиться в таймаут платформы:
    POST ?action=outline  — запрос к GigaChat, возвращает JSON-структуру (~60 сек)
    POST ?action=build    — скачивает фото и собирает PPTX из готовой структуры (~15 сек)
    POST (без action)     — legacy: оба шага вместе (для совместимости)
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()

    if action in ("ping", "warmup"):
        try:
            api_key = os.environ.get("YANDEXGPT_API_KEY", "").strip()
            if not api_key:
                raise RuntimeError("YANDEXGPT_API_KEY не задан")
            return _resp(200, {"ok": True, "service": "YandexGPT"})
        except Exception as e:
            return _resp(500, {"ok": False, "error": str(e)})

    if method != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    body = _parse_body(event)

    # ── ШАГ 1: outline — только GigaChat (~60 сек) ──────────────────────────
    if action == "outline":
        login = (body.get("login") or "").strip()
        topic = (body.get("topic") or "").strip()
        description = (body.get("description") or "").strip()
        audience = (body.get("audience") or "").strip()

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

        try:
            outline, tokens_used = generate_outline(topic, description, slides_count, audience)
        except Exception as e:
            msg = str(e)
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                return _resp(504, {"error": "ИИ-сервис не успел ответить — попробуйте ещё раз."})
            if "429" in msg or "rate" in msg.lower():
                return _resp(429, {"error": "Слишком много запросов к ИИ-сервису — подождите 30 секунд."})
            return _resp(500, {"error": f"Ошибка генерации структуры: {msg}"})

        spend_ai_tokens(login, max(tokens_used, 1))

        theme = pick_theme(topic)
        return _resp(200, {
            "outline": outline,
            "theme_name": theme["name"],
            "topic": topic,
        })

    # ── ШАГ 2: build — фото + PPTX (~15 сек) ───────────────────────────────
    if action == "build":
        topic = (body.get("topic") or "").strip()
        teacher_name = (body.get("teacherName") or "").strip()
        teacher_school = (body.get("teacherSchool") or "").strip()
        outline = body.get("outline")
        theme_name = (body.get("theme_name") or "").strip()

        if not topic or not outline:
            return _resp(400, {"error": "Укажите topic и outline"})

        # Восстанавливаем тему
        theme = next((t for t in THEMES if t["name"] == theme_name), None) or pick_theme(topic)

        # Скачиваем до 3 фото на слайд параллельно
        images = {}
        try:
            img_list = fetch_images_parallel(outline.get("slides", []), topic)
            for idx, imgs in enumerate(img_list, start=1):
                if imgs:
                    images[idx] = imgs  # list[bytes]
        except Exception:
            pass

        try:
            pptx_bytes = build_pptx(
                topic=topic,
                subtitle=outline.get("subtitle", ""),
                contents=outline.get("contents", []),
                slides_data=outline.get("slides", []),
                conclusion=outline.get("conclusion", []),
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
                "subtitle": outline.get("subtitle", ""),
                "slides": [{"title": s["title"], "bullets": s["bullets"]} for s in outline.get("slides", [])],
                "conclusion": outline.get("conclusion", []),
            },
        })

    # ── Legacy: оба шага вместе (action="" или не указан) ───────────────────
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

    try:
        outline, tokens_used = generate_outline(topic, description, slides_count, audience)
    except Exception as e:
        msg = str(e)
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return _resp(504, {"error": "ИИ-сервис не успел ответить — попробуйте ещё раз."})
        if "429" in msg or "rate" in msg.lower():
            return _resp(429, {"error": "Слишком много запросов к ИИ-сервису — подождите 30 секунд."})
        return _resp(500, {"error": f"Ошибка генерации структуры: {msg}"})

    spend_ai_tokens(login, max(tokens_used, 1))

    images = {}
    try:
        img_list = fetch_images_parallel(outline["slides"], topic)
        for idx, imgs in enumerate(img_list, start=1):
            if imgs:
                images[idx] = imgs  # list[bytes]
    except Exception:
        pass

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