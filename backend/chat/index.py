"""
Чат с ИИ через GigaChat API (Сбер).
POST / — { messages: [{role, content}], system?: str }
-> { reply: str }
"""
import json
import os
import ssl
import uuid
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

_TOKEN_CACHE: dict = {"token": None, "expires_at": None}


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _ssl_ctx():
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
        data=data, method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": rq_uid,
            "Authorization": f"Basic {auth_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as r:
        body = json.loads(r.read().decode())
    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GigaChat не вернул access_token: {body}")
    expires_in_ms = body.get("expires_at")
    expires_at = (datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
                  if expires_in_ms else datetime.utcnow() + timedelta(minutes=25))
    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def handler(event: dict, context) -> dict:
    """
    Чат с GigaChat. POST { messages: [{role, content}], system?: str } -> { reply: str }
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
    system = body.get("system", "Ты умный помощник-ассистент. Отвечай на русском языке, развёрнуто и по делу.")

    if not messages:
        return _resp(400, {"error": "messages обязателен"})

    chat_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    last_err = "Нет доступных моделей"
    for model in ("GigaChat-2", "GigaChat", "GigaChat-Lite"):
        try:
            token = get_gigachat_token()
            payload = {
                "model": model,
                "messages": chat_messages,
                "temperature": 0.7,
                "max_tokens": 1500,
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
            with urllib.request.urlopen(req, timeout=25, context=_ssl_ctx()) as r:
                data = json.loads(r.read().decode())
            choices = data.get("choices") or []
            if not choices:
                last_err = f"Пустой ответ ({model})"
                continue
            reply = choices[0].get("message", {}).get("content", "").strip()
            if not reply:
                last_err = f"Пустой content ({model})"
                continue
            return _resp(200, {"reply": reply})
        except urllib.error.HTTPError as e:
            err_text = e.read().decode(errors="ignore")[:200]
            if e.code in (401, 403):
                _TOKEN_CACHE["token"] = None
                return _resp(502, {"error": f"GigaChat auth error {e.code}"})
            if e.code == 404:
                last_err = f"Модель недоступна ({model})"
                continue
            last_err = f"GigaChat HTTP {e.code}: {err_text}"
        except Exception as e:
            last_err = str(e)
            _TOKEN_CACHE["token"] = None

    return _resp(502, {"error": last_err})
