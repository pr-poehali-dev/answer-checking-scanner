"""
Чат с ИИ через GigaChat API (Сбер, Freemium — бесплатно).
POST / — { messages: [{role, content}], system?: str }
-> { reply: str }
"""
import json, os, uuid, requests

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

GIGACHAT_AUTH_URL  = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_CHAT_URL  = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
GIGACHAT_SCOPE     = "GIGACHAT_API_PERS"

_token_cache: dict = {}


def _get_token(auth_key: str) -> str:
    import time
    now = time.time()
    if _token_cache.get("expires_at", 0) > now + 30:
        return _token_cache["token"]

    resp = requests.post(
        GIGACHAT_AUTH_URL,
        headers={
            "Authorization": f"Basic {auth_key}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": GIGACHAT_SCOPE},
        verify=False,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_at", 1800) / 1000
    return _token_cache["token"]


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    Отправляет сообщение в GigaChat и возвращает ответ ИИ.
    POST { messages: [{role: 'user'|'assistant', content: str}], system?: str }
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Некорректный JSON"})

    messages = body.get("messages", [])
    system   = body.get("system", "Ты умный помощник-ассистент для учителей. Отвечай на русском языке.")

    if not messages:
        return _resp(400, {"error": "messages обязателен"})

    auth_key = os.environ.get("GIGACHAT_AUTH_KEY", "")
    if not auth_key:
        return _resp(500, {"error": "GigaChat не настроен"})

    try:
        token = _get_token(auth_key)
    except Exception as e:
        return _resp(502, {"error": f"Ошибка авторизации GigaChat: {e}"})

    # Формируем список сообщений с системным промптом
    chat_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    try:
        resp = requests.post(
            GIGACHAT_CHAT_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "model": "GigaChat",
                "messages": chat_messages,
                "temperature": 0.7,
                "max_tokens": 1500,
            },
            verify=False,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return _resp(200, {"reply": reply})
    except requests.HTTPError as e:
        return _resp(502, {"error": f"GigaChat API error: {e.response.status_code}"})
    except Exception as e:
        return _resp(502, {"error": f"Ошибка: {e}"})
