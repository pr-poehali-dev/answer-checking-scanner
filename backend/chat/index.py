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
AUTH_URL = os.environ.get("AUTH_FUNCTION_URL", "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b")


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def precheck_ai(login: str, est_tokens: int = 1500) -> tuple[bool, int, str]:
    """Проверяет ДО вызова ИИ, что у пользователя есть подписка и хватает баланса.
    Возвращает (allowed, http_status, error_msg). При отсутствии login — разрешаем
    (совместимость), но фронт обязан передавать login."""
    if not login:
        return True, 200, ""
    try:
        req = urllib.request.Request(
            f"{AUTH_URL}?action=precheck-ai",
            data=json.dumps({"login": login, "est_tokens": est_tokens}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            resp = json.loads(r.read().decode())
        return bool(resp.get("allowed")), 200, ""
    except urllib.error.HTTPError as e:
        err_body = {}
        try:
            err_body = json.loads(e.read().decode())
        except Exception:
            pass
        if e.code == 402:
            return False, 402, err_body.get("error", "Недостаточно средств для ИИ. Пополните баланс.")
        if e.code == 403:
            return False, 403, err_body.get("error", "Для использования ИИ необходима активная подписка.")
        # Прочие ошибки проверки не должны блокировать (fail-open)
        return True, 200, ""
    except Exception:
        return True, 200, ""


def spend_ai_tokens(login: str, amount: int, action_label: str = "Чат с ИИ") -> float:
    """Списывает баланс за реально потреблённые токены. Возвращает остаток в рублях."""
    if not login or amount <= 0:
        return 0.0
    try:
        req = urllib.request.Request(
            f"{AUTH_URL}?action=spend-tokens",
            data=json.dumps({"login": login, "amount": amount, "action_label": action_label}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            resp = json.loads(r.read().decode())
        return float(resp.get("balance_rub") or 0)
    except Exception:
        return 0.0


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
    login = (body.get("login") or "").strip()

    if not messages:
        return _resp(400, {"error": "messages обязателен"})

    # Предусматриваем расход: проверяем баланс и подписку ДО обращения к ИИ.
    allowed, status, err = precheck_ai(login, est_tokens=1500)
    if not allowed:
        return _resp(status, {"error": err})

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
            result = data.get("result") or {}
            alternatives = result.get("alternatives") or []
            if not alternatives:
                last_err = f"ИИ API вернул пустой ответ"
                continue
            reply = alternatives[0].get("message", {}).get("text", "").strip()
            if not reply:
                last_err = "ИИ API вернул пустой текст"
                continue
            # Списываем баланс за реально потреблённые токены
            usage = result.get("usage") or {}
            tokens_used = int(usage.get("totalTokens") or usage.get("completionTokens") or 0)
            balance_rub = spend_ai_tokens(login, max(tokens_used, 1))
            return _resp(200, {"reply": reply, "balance_rub": balance_rub})
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