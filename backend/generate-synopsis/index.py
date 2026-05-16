"""
Генерация полноценного конспекта урока через GigaChat.
POST / body: {subject, class_num, topic, description, teacher_name, teacher_school}
Возвращает: {text, word_count, topic, subject, class_num}
"""
import json
import os
import re
import ssl
import time
import uuid
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta

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
    with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as r:
        body_data = json.loads(r.read().decode())

    token = body_data.get("access_token")
    if not token:
        raise RuntimeError(f"GigaChat не вернул access_token: {body_data}")

    expires_in_ms = body_data.get("expires_at")
    if expires_in_ms:
        expires_at = datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
    else:
        expires_at = now + timedelta(minutes=25)

    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def gigachat_chat(messages: list, max_tokens: int = 4000, temperature: float = 0.3,
                  model: str = "GigaChat", req_timeout: int = 300, max_retries: int = 3) -> str:
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
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
                body_data = json.loads(r.read().decode())
            choices = body_data.get("choices") or []
            if not choices:
                raise RuntimeError(f"GigaChat вернул пустой ответ: {body_data}")
            return choices[0].get("message", {}).get("content", "").strip()
        except urllib.error.HTTPError as e:
            err_text = e.read().decode(errors="ignore")[:300]
            if e.code in (401, 403, 404):
                raise RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
            wait = 4.0 if e.code == 429 else 3.0
            last_err = RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
            if attempt < max_retries:
                time.sleep(wait)
        except Exception as e:
            last_err = RuntimeError(f"GigaChat недоступен: {e}")
            if attempt < max_retries:
                time.sleep(3.0)
                _TOKEN_CACHE["token"] = None
                _TOKEN_CACHE["expires_at"] = None
    raise last_err or RuntimeError("GigaChat: не удалось получить ответ")


def gigachat_with_fallback(messages: list, max_tokens: int = 4000) -> str:
    """Lite(50с) → Lite(50с) → GigaChat-2(400с). Без sleep — экономим время функции."""
    last_err = None
    for model, timeout in (("GigaChat-Lite", 50), ("GigaChat-Lite", 50), ("GigaChat-2", 400)):
        try:
            return gigachat_chat(messages, max_tokens=max_tokens, model=model,
                                 req_timeout=timeout, max_retries=1)
        except RuntimeError as e:
            last_err = e
            msg = str(e)
            if "MODEL_NOT_FOUND" in msg or "404" in msg or "401" in msg or "403" in msg:
                continue
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                continue
            if "remote end closed" in msg.lower() or "remotedisconnected" in msg.lower() \
                    or "connection reset" in msg.lower() or "недоступен" in msg.lower():
                _TOKEN_CACHE["token"] = None
                _TOKEN_CACHE["expires_at"] = None
                continue
            raise
    raise last_err or RuntimeError("Все модели GigaChat недоступны")


def generate_synopsis(subject: str, class_num: int, topic: str, description: str,
                      teacher_name: str, teacher_school: str) -> str:
    """Генерирует полноценный конспект урока через GigaChat."""
    system = (
        "Ты опытный учитель-методист и составитель учебных материалов. "
        "Твоя задача — писать подробные, академически грамотные конспекты уроков "
        "строго в соответствии с официальной программой Министерства просвещения РФ "
        "и ФГОС. Используй только официально признанные научные факты, термины и материалы. "
        "Конспект должен быть от 2 до 4 страниц (1200–2500 слов), структурированный, "
        "полный и понятный для учеников. "
        "Не торопись — пиши развёрнуто, обстоятельно, с примерами, определениями и пояснениями."
    )

    class_label = f"{class_num} класс"
    desc_part = f"\nДополнительный контекст и акценты: {description}" if description.strip() else ""

    user = (
        f"Составь полноценный конспект урока по следующим параметрам:\n\n"
        f"Предмет: {subject}\n"
        f"Класс: {class_label}\n"
        f"Тема урока: {topic}\n"
        f"Учитель: {teacher_name}, {teacher_school}\n"
        f"{desc_part}\n\n"
        "ТРЕБОВАНИЯ К КОНСПЕКТУ:\n"
        "1. Объём: от 1200 до 2500 слов (2–4 страницы A4)\n"
        "2. Строго соответствуй программе Минпросвещения РФ и ФГОС для данного класса\n"
        "3. Структура:\n"
        "   - Заголовок (предмет, класс, тема, дата)\n"
        "   - Цели и задачи урока (образовательная, развивающая, воспитательная)\n"
        "   - Планируемые результаты (предметные, метапредметные, личностные)\n"
        "   - Оборудование и материалы\n"
        "   - Ход урока (этапы с временными рамками):\n"
        "     * Организационный момент (2-3 мин)\n"
        "     * Актуализация знаний (5-7 мин)\n"
        "     * Изучение нового материала (20-25 мин) — максимально развёрнуто\n"
        "     * Первичное закрепление (7-10 мин)\n"
        "     * Подведение итогов и рефлексия (3-5 мин)\n"
        "     * Домашнее задание\n"
        "4. В разделе 'Изучение нового материала' дай полное, развёрнутое объяснение темы:\n"
        "   - Все ключевые понятия с определениями\n"
        "   - Теоретические основы и законы\n"
        "   - Конкретные примеры, задачи или иллюстрации\n"
        "   - Связь с предыдущим и последующим материалом\n"
        "5. Включи вопросы для учеников на каждом этапе\n"
        "6. Оформи конспект в формате Markdown (заголовки ##, ###, жирный **текст**, списки)\n"
        "7. Пиши профессионально, ясно, академически грамотно\n\n"
        "Напиши конспект полностью, не сокращай и не пропускай разделы."
    )

    return gigachat_with_fallback(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=4000,
    )


def handler(event: dict, context) -> dict:
    """ИИ-генерация конспекта урока по предмету, классу и теме в соответствии с программой Минпросвещения РФ."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        qs = event.get("queryStringParameters") or {}
        if (qs.get("action") or "").strip().lower() == "ping":
            try:
                get_gigachat_token()
                return _resp(200, {"ok": True, "status": "GigaChat доступен"})
            except Exception as e:
                return _resp(503, {"ok": False, "error": str(e)})
        return _resp(404, {"error": "Неизвестное действие"})

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