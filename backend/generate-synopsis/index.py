"""
Генерация полноценного конспекта урока через GigaChat.
POST / body: {subject, class_num, topic, description, teacher_name, teacher_school}
Возвращает: {text, word_count, topic, subject, class_num}
"""
import json
import os
import re
import time
import urllib.request
import urllib.error

AUTH_URL = os.environ.get("AUTH_FUNCTION_URL", "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b")

TOKENS_COST_SYNOPSIS = 5000


def spend_ai_tokens(login: str, amount: int) -> tuple[bool, str]:
    if not login:
        return True, ""
    try:
        req = urllib.request.Request(
            f"{AUTH_URL}?action=spend-tokens",
            data=json.dumps({"login": login, "amount": amount}).encode("utf-8"),
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


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


# ─── OPENROUTER AI ───────────────────────────────────────────────────────────

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_OR_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
    "google/gemma-3-27b-it:free",
    "qwen/qwen3-235b-a22b:free",
    "microsoft/phi-4-reasoning-plus:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "minimax/minimax-m2.5:free",
    "mistralai/mistral-7b-instruct:free",
]


def gigachat_with_fallback(messages: list, max_tokens: int = 6000) -> str:
    """Вызов OpenRouter с автоматическим перебором моделей при ошибках."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан")

    last_err = None
    for model in _OR_MODELS:
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": max_tokens,
        }
        req = urllib.request.Request(
            OPENROUTER_URL,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://poehali.dev",
                "X-Title": "AOUSPT Synopsis",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body_data = json.loads(r.read().decode())
            choices = body_data.get("choices") or []
            if not choices:
                last_err = RuntimeError(f"OpenRouter пустой ответ ({model})")
                continue
            content = choices[0].get("message", {}).get("content", "").strip()
            if not content:
                last_err = RuntimeError(f"OpenRouter пустой content ({model})")
                continue
            return content
        except urllib.error.HTTPError as e:
            err_text = e.read().decode(errors="ignore")[:300]
            if e.code in (403, 404, 429, 502, 503):
                last_err = RuntimeError(f"OpenRouter {e.code} ({model}): {err_text}")
                if e.code == 429:
                    time.sleep(2)
                continue
            raise RuntimeError(f"OpenRouter HTTP {e.code}: {err_text}")
        except Exception as e:
            last_err = RuntimeError(f"OpenRouter недоступен ({model}): {e}")
            continue

    raise last_err or RuntimeError("Все модели OpenRouter недоступны")


def generate_synopsis(subject: str, class_num: int, topic: str, description: str,
                      teacher_name: str, teacher_school: str) -> str:
    """Генерирует полноценный конспект урока через OpenRouter."""
    system = (
        "Ты — опытный учитель-методист с 20-летним стажем, эксперт по ФГОС и программам "
        "Министерства просвещения РФ. Твоя задача — создавать профессиональные, "
        "ДЕТАЛЬНЫЕ и СОДЕРЖАТЕЛЬНЫЕ конспекты уроков. "
        "ВАЖНО: каждый раздел пиши максимально подробно. "
        "Раздел 'Изучение нового материала' должен содержать ПОЛНОЕ объяснение темы "
        "так, как если бы ты объяснял её на уроке — с примерами, формулами, датами, "
        "историческими фактами, доказательствами. Минимум 2000 слов в конспекте. "
        "Пиши на русском языке. Формат — Markdown."
    )

    class_label = f"{class_num} класс"
    desc_part = f"\n\nДополнительные акценты от учителя: {description}" if description.strip() else ""

    user = (
        f"Напиши подробный конспект урока:\n\n"
        f"**Предмет:** {subject}\n"
        f"**Класс:** {class_label}\n"
        f"**Тема:** {topic}\n"
        f"**Учитель:** {teacher_name}\n"
        f"**Школа:** {teacher_school}"
        f"{desc_part}\n\n"
        "## Структура конспекта (обязательно все разделы):\n\n"
        "### 1. Заголовок\n"
        "Предмет, класс, тема, ФИО учителя, дата (оставь поле для заполнения).\n\n"
        "### 2. Цели урока\n"
        "Три цели: образовательная (что узнают), развивающая (какие навыки), воспитательная (ценности). "
        "Каждая цель — 2-3 предложения.\n\n"
        "### 3. Планируемые результаты по ФГОС\n"
        "Предметные, метапредметные (регулятивные, познавательные, коммуникативные), личностные. "
        "По 3-4 пункта каждый.\n\n"
        "### 4. Оборудование и материалы\n"
        "Полный список: учебники (с авторами), наглядные пособия, оборудование, ЭОР.\n\n"
        "### 5. Ход урока\n\n"
        "**5.1 Организационный момент (3 мин)**\n"
        "Приветствие, проверка готовности, объявление темы. Напиши конкретные слова учителя.\n\n"
        "**5.2 Актуализация знаний (7 мин)**\n"
        "5-7 конкретных вопросов по пройденному материалу с краткими ответами. "
        "Связь с новой темой.\n\n"
        "**5.3 Изучение нового материала (25 мин) — ГЛАВНЫЙ РАЗДЕЛ**\n"
        "Это самый важный раздел — пиши максимально подробно:\n"
        "- Введение в тему: что это такое и почему важно\n"
        "- ВСЕ ключевые понятия с чёткими определениями и пояснениями\n"
        "- Теоретический материал: законы, правила, формулы, факты — с подробным объяснением КАЖДОГО\n"
        "- Конкретные примеры, задачи, исторические события, явления — подробно разобранные\n"
        "- Связи между понятиями, причинно-следственные связи\n"
        "- Вопросы учителя к классу в ходе объяснения\n"
        "- Что записать в тетрадь (схемы, определения, формулы)\n\n"
        "**5.4 Первичное закрепление (8 мин)**\n"
        "3-4 конкретных задания/вопроса с развёрнутыми ответами и разборами.\n\n"
        "**5.5 Подведение итогов и рефлексия (5 мин)**\n"
        "Выводы по теме (3-5 предложений), вопросы рефлексии для учеников.\n\n"
        "**5.6 Домашнее задание**\n"
        "Конкретные задания с указанием параграфов/страниц учебника. Базовый и творческий уровень.\n\n"
        "Пиши развёрнуто и содержательно. Не сокращай. Минимальный объём — 2000 слов."
    )

    return gigachat_with_fallback(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=6000,
    )


def handler(event: dict, context) -> dict:
    """ИИ-генерация конспекта урока по предмету, классу и теме в соответствии с программой Минпросвещения РФ."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        return _resp(200, {"ok": True, "status": "OpenRouter активен"})

    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Метод не разрешён"})

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            return _resp(400, {"error": "Некорректный JSON"})

    subject = (body.get("subject") or "").strip()
    topic = (body.get("topic") or "").strip()
    description = (body.get("description") or "").strip()
    teacher_name = (body.get("teacher_name") or "").strip()
    teacher_school = (body.get("teacher_school") or "").strip()

    try:
        class_num = int(body.get("class_num") or 0)
    except (TypeError, ValueError):
        class_num = 0

    if not subject:
        return _resp(400, {"error": "Укажите предмет"})
    if not topic:
        return _resp(400, {"error": "Укажите тему урока"})
    if not class_num or class_num < 1 or class_num > 11:
        return _resp(400, {"error": "Укажите класс (1–11)"})

    # Списываем токены
    login = (body.get("login") or "").strip()
    ok, tok_err = spend_ai_tokens(login, TOKENS_COST_SYNOPSIS)
    if not ok:
        return _resp(402, {"error": tok_err})

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
            pass  # При ошибке проверки лимита — не блокируем

    try:
        text = generate_synopsis(
            subject=subject,
            class_num=class_num,
            topic=topic,
            description=description,
            teacher_name=teacher_name or "Учитель",
            teacher_school=teacher_school or "",
        )
    except Exception as e:
        return _resp(500, {"error": f"Не удалось сгенерировать конспект: {e}"})

    word_count = len(text.split())

    return _resp(200, {
        "text": text,
        "word_count": word_count,
        "topic": topic,
        "subject": subject,
        "class_num": class_num,
    })