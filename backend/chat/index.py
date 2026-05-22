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
# Бесплатные модели по приоритету (fallback при 404 и 429)
FREE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
    "google/gemma-3-27b-it:free",
    "qwen/qwen3-235b-a22b:free",
    "microsoft/phi-4-reasoning-plus:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "minimax/minimax-m2.5:free",
]


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

    last_err = "Нет доступных моделей"
    for model in FREE_MODELS:
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
                    "model": model,
                    "messages": chat_messages,
                    "temperature": 0.7,
                    "max_tokens": 1500,
                },
                timeout=25,
            )
            resp.raise_for_status()
            data = resp.json()
            # Provider returned error — ошибка в теле 200-ответа
            if data.get("error"):
                err_msg = data["error"].get("message", str(data["error"])) if isinstance(data["error"], dict) else str(data["error"])
                last_err = f"Provider error ({model}): {err_msg}"
                continue
            choices = data.get("choices") or []
            if not choices:
                last_err = f"Пустой ответ ({model})"
                continue
            finish_reason = choices[0].get("finish_reason", "")
            if finish_reason == "error":
                last_err = f"finish_reason=error ({model})"
                continue
            reply = choices[0].get("message", {}).get("content", "").strip()
            if not reply:
                last_err = f"Пустой content ({model})"
                continue
            return _resp(200, {"reply": reply})
        except requests.HTTPError as e:
            try:
                err_msg = e.response.json().get("error", {}).get("message", "")
            except Exception:
                err_msg = str(e)
            last_err = f"API error {e.response.status_code}: {err_msg}"
            if e.response.status_code in (400, 403, 404, 429, 500, 502, 503):
                continue
            return _resp(502, {"error": last_err})
        except Exception as e:
            last_err = str(e)
            continue
    return _resp(502, {"error": last_err})