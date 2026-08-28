"""
Биллинг ИИ для распознавания бланков — та же схема, что у остальных
ИИ-функций проекта (generate-test, chat и др.):

  1) precheck_ai(login, est_tokens) — ДО обращения к ИИ проверяем подписку и
     достаточность баланса. Нет денег/подписки — работу не начинаем;
  2) spend_ai_tokens(login, tokens) — ПОСЛЕ успешного распознавания списываем
     фактическое потребление.

Ставка и наценка живут в одном месте — backend/auth (spend-tokens):
0.2 коп за токен + наценка 40% сверху. Здесь мы только сообщаем количество
токенов, поэтому наценка применяется автоматически, как и везде.
"""
import json
import os
import urllib.request
import urllib.error

AUTH_URL = os.environ.get(
    "AUTH_FUNCTION_URL",
    "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b",
)


def precheck_ai(login: str, est_tokens: int = 0) -> tuple[bool, int, str]:
    """Проверяет ДО распознавания: подписка и достаточный баланс.

    Возвращает (allowed, http_status, error). Без login — разрешаем
    (публичный вызов, например из тестов).
    """
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
            return False, 402, err_body.get(
                "error", "Недостаточно средств на балансе ИИ. Пополните баланс.")
        if e.code == 403:
            return False, 403, err_body.get(
                "error", "Для использования ИИ необходима активная подписка.")
        # Прочие ошибки сервиса авторизации не должны блокировать учителя
        return True, 200, ""
    except Exception:
        return True, 200, ""


def spend_ai_tokens(login: str, amount: int,
                    action_label: str = "Распознавание бланка") -> tuple[float, float]:
    """Списывает баланс за фактически потреблённые токены.

    Возвращает (spent_rub, balance_rub). Ошибки списания не роняют уже
    выполненное распознавание — учитель получит свой результат в любом случае.
    """
    if not login or amount <= 0:
        return 0.0, 0.0
    try:
        req = urllib.request.Request(
            f"{AUTH_URL}?action=spend-tokens",
            data=json.dumps({
                "login": login,
                "amount": amount,
                "action_label": action_label,
            }).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            resp = json.loads(r.read().decode())
        return float(resp.get("spent_rub") or 0), float(resp.get("balance_rub") or 0)
    except Exception:
        return 0.0, 0.0
