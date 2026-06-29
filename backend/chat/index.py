"""
Чат с ИИ через ИИ API.
POST / — { messages: [{role, content}], system?: str }
-> { reply: str }
"""
import json
import os
import time
import urllib.request
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

YANDEX_GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    Чат с ИИ API. POST { messages: [{role, content}], system?: str } -> { reply: str }
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
    system_text = body.get("system", "Ты умный помощник-ассистент. Отвечай на русском языке, развёрнуто и по делу.")

    if not messages:
        return _resp(400, {"error": "messages обязателен"})

    api_key = os.environ.get("YANDEXGPT_API_KEY", "").strip()
    folder_id = os.environ.get("YANDEXGPT_FOLDER_ID", "").strip()
    if not api_key or not folder_id:
        return _resp(500, {"error": "ИИ API: ключи доступа не заданы"})

    yandex_messages = [{"role": "system", "text": system_text}]
    for m in messages:
        role = m.get("role", "user")
        if role in ("user", "assistant") and m.get("content"):
            yandex_messages.append({"role": role, "text": m["content"]})

    payload = {
        "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {
            "stream": False,
            "temperature": 0.7,
            "maxTokens": "1500",
        },
        "messages": yandex_messages,
    }

    last_err = "Нет ответа"
    for attempt in range(1, 4):
        try:
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
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.loads(r.read().decode())
            alternatives = (data.get("result") or {}).get("alternatives") or []
            if not alternatives:
                last_err = f"ИИ API вернул пустой ответ"
                continue
            reply = alternatives[0].get("message", {}).get("text", "").strip()
            if not reply:
                last_err = "ИИ API вернул пустой текст"
                continue
            return _resp(200, {"reply": reply})
        except urllib.error.HTTPError as e:
            err_text = e.read().decode(errors="ignore")[:200]
            if e.code in (401, 403):
                return _resp(502, {"error": f"ИИ API auth error {e.code}"})
            last_err = f"ИИ API HTTP {e.code}: {err_text}"
            if attempt < 3:
                time.sleep(1.5)
        except Exception as e:
            last_err = str(e)
            if attempt < 3:
                time.sleep(1.5)

    return _resp(502, {"error": last_err})