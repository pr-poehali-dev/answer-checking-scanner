"""
Чат с ИИ через OpenRouter API — бесплатные модели (Llama 3, Gemma и др.)
POST / — { messages: [{role, content}], system?: str }
-> { reply: str }
"""
import json, os, requests

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Бесплатная модель — Meta Llama 3.1 8B (free tier, без оплаты)
FREE_MODEL = "meta-llama/llama-3.1-8b-instruct:free"


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """
    Отправляет сообщение в OpenRouter (Llama 3.1 бесплатно) и возвращает ответ.
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
    system = body.get("system", "Ты умный помощник-ассистент. Отвечай на русском языке, развёрнуто и по делу.")

    if not messages:
        return _resp(400, {"error": "messages обязателен"})

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return _resp(500, {"error": "OpenRouter не настроен"})

    chat_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://poehali.dev",
                "X-Title": "AOUSPT Chat",
            },
            json={
                "model": FREE_MODEL,
                "messages": chat_messages,
                "temperature": 0.7,
                "max_tokens": 1500,
            },
            timeout=25,
        )
        resp.raise_for_status()
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return _resp(200, {"reply": reply})
    except requests.HTTPError as e:
        err = ""
        try:
            err = e.response.json().get("error", {}).get("message", "")
        except Exception:
            pass
        return _resp(502, {"error": f"API error {e.response.status_code}: {err}"})
    except Exception as e:
        return _resp(502, {"error": f"Ошибка: {e}"})