"""
API подписки АОУСПТ.
GET  /plans — список тарифов
POST /create — создать платёж в ЮKassa, вернуть confirmation_url
POST /check — проверить статус платежа (вызывается фронтом после возврата с оплаты)
GET  /history — история платежей пользователя
Header: X-User-Login — логин пользователя
"""
import os
import json
import uuid
import base64
import urllib.request
import urllib.error
import psycopg2
from datetime import datetime, timedelta

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Login, X-Authorization",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")

# ── Тарифы АОУСПТ ──────────────────────────────────────────────────────────
PLANS = [
    {
        "code": "monthly",
        "name": "АОУСПТ — Месяц",
        "amount": 1,
        "months": 1,
        "description": "Подписка на 1 месяц. Все разделы доступны.",
        "popular": False,
    },
    {
        "code": "halfyear",
        "name": "АОУСПТ — Полгода",
        "amount": 1099,
        "months": 6,
        "description": "Подписка на 6 месяцев. Экономия 8%.",
        "popular": True,
    },
    {
        "code": "year",
        "name": "АОУСПТ — Год",
        "amount": 2299,
        "months": 12,
        "description": "Подписка на 12 месяцев. Экономия 4%.",
        "popular": False,
    },
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def get_plan(code: str):
    for p in PLANS:
        if p["code"] == code:
            return p
    return None


def yookassa_request(method: str, path: str, body: dict | None = None, idempotence: str | None = None) -> dict:
    """REST-запрос к ЮKassa API (api.yookassa.ru/v3)."""
    shop_id = os.environ.get("YOOKASSA_SHOP_ID", "").strip()
    secret = os.environ.get("YOOKASSA_SECRET_KEY", "").strip()
    if not shop_id or not secret:
        raise RuntimeError("ЮKassa не настроена (YOOKASSA_SHOP_ID/SECRET_KEY)")

    auth = base64.b64encode(f"{shop_id}:{secret}".encode()).decode()
    url = f"https://api.yookassa.ru/v3{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "Authorization": f"Basic {auth}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if idempotence:
        headers["Idempotence-Key"] = idempotence

    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err_text = e.read().decode(errors='ignore') if hasattr(e, 'read') else str(e)
        try:
            err_json = json.loads(err_text)
            msg = err_json.get("description") or err_json.get("error") or err_text[:200]
        except Exception:
            msg = err_text[:200]
        raise RuntimeError(f"ЮKassa HTTP {e.code}: {msg}")


def grant_subscription(login: str, plan_code: str, months: int, payment_id: str | None) -> datetime:
    """Активирует подписку: продлевает или начинает новую. Возвращает дату окончания."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT subscription_until FROM {SCHEMA}.users WHERE login = %s",
            (login,)
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("Пользователь не найден")

        now = datetime.utcnow()
        current_until = row[0] if isinstance(row[0], datetime) else None
        base = current_until if (current_until and current_until > now) else now
        new_until = base + timedelta(days=30 * months)

        cur.execute(
            f"""UPDATE {SCHEMA}.users
                SET subscription_status='active', subscription_plan=%s,
                    subscription_until=%s,
                    subscription_started_at = COALESCE(subscription_started_at, NOW())
                WHERE login = %s""",
            (plan_code, new_until, login)
        )

        if payment_id:
            cur.execute(
                f"""UPDATE {SCHEMA}.payments
                    SET status='succeeded', paid_at=NOW(), subscription_until=%s
                    WHERE provider_payment_id = %s""",
                (new_until, payment_id)
            )
        conn.commit()
        return new_until
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """Платежи и подписки АОУСПТ через ЮKassa."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_path = (event.get("path") or "/").rstrip("/")
    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            body = {}
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or body.get("action") or "").strip().lower()
    route = action or raw_path.lstrip("/").lower() or "plans"
    user_login = (headers.get("x-user-login") or body.get("login") or qs.get("login") or "").strip()

    # ── GET plans ───────────────────────────────────────────────────────────
    if route == "plans":
        return _resp(200, {
            "plans": PLANS,
            "available": bool(os.environ.get("YOOKASSA_SHOP_ID") and os.environ.get("YOOKASSA_SECRET_KEY")),
        })

    # ── POST create ─────────────────────────────────────────────────────────
    if method == "POST" and route == "create":
        if not user_login or user_login == "admin":
            return _resp(400, {"error": "Неизвестный пользователь"})
        plan_code = (body.get("plan") or "").strip()
        plan = get_plan(plan_code)
        if not plan:
            return _resp(400, {"error": "Тариф не найден"})

        return_url = (body.get("return_url") or "").strip() or "https://poehali.dev"

        # Проверим, что пользователь существует и не админ
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT email, full_name FROM {SCHEMA}.users WHERE login = %s",
                (user_login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            email, full_name = row[0], row[1]
        finally:
            conn.close()

        try:
            payment_body = {
                "amount": {"value": f"{plan['amount']:.2f}", "currency": "RUB"},
                "capture": True,
                "confirmation": {"type": "redirect", "return_url": return_url},
                "description": f"АОУСПТ · {plan['name']} · {full_name}",
                "metadata": {"login": user_login, "plan": plan_code, "months": str(plan["months"])},
            }
            if email:
                payment_body["receipt"] = {
                    "customer": {"email": email},
                    "items": [{
                        "description": plan["name"][:128],
                        "quantity": "1.00",
                        "amount": {"value": f"{plan['amount']:.2f}", "currency": "RUB"},
                        "vat_code": 1,
                        "payment_subject": "service",
                        "payment_mode": "full_payment",
                    }],
                }

            idempotence = str(uuid.uuid4())
            result = yookassa_request("POST", "/payments", payment_body, idempotence=idempotence)
        except Exception as e:
            return _resp(503, {"error": f"Не удалось создать платёж: {e}"})

        payment_id = result.get("id")
        confirmation = (result.get("confirmation") or {}).get("confirmation_url")
        status = result.get("status", "pending")

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.payments
                    (user_login, plan, amount, months, provider, provider_payment_id, status, source)
                    VALUES (%s, %s, %s, %s, 'yookassa', %s, %s, 'user')""",
                (user_login, plan_code, plan["amount"], plan["months"], payment_id, status)
            )
            conn.commit()
        finally:
            conn.close()

        return _resp(200, {
            "payment_id": payment_id,
            "confirmation_url": confirmation,
            "status": status,
            "amount": plan["amount"],
            "plan": plan_code,
        })

    # ── POST check ──────────────────────────────────────────────────────────
    if method == "POST" and route == "check":
        payment_id = (body.get("payment_id") or "").strip()
        if not payment_id:
            return _resp(400, {"error": "Укажите payment_id"})

        try:
            result = yookassa_request("GET", f"/payments/{payment_id}")
        except Exception as e:
            return _resp(503, {"error": f"Не удалось проверить платёж: {e}"})

        status = result.get("status", "pending")
        meta = result.get("metadata") or {}
        login = meta.get("login")
        plan_code = meta.get("plan")
        try:
            months = int(meta.get("months") or 1)
        except (TypeError, ValueError):
            months = 1

        if status == "succeeded" and login and plan_code:
            try:
                until = grant_subscription(login, plan_code, months, payment_id)
                return _resp(200, {
                    "status": "succeeded",
                    "subscription_until": until.isoformat(),
                    "subscription_active": True,
                })
            except Exception as e:
                return _resp(500, {"error": f"Ошибка активации подписки: {e}"})

        # Обновляем статус в payments если нужно
        if status in ("canceled", "pending", "waiting_for_capture"):
            conn = get_conn()
            try:
                cur = conn.cursor()
                cur.execute(
                    f"UPDATE {SCHEMA}.payments SET status=%s WHERE provider_payment_id=%s",
                    (status, payment_id)
                )
                conn.commit()
            finally:
                conn.close()

        return _resp(200, {"status": status, "subscription_active": False})

    # ── GET history ─────────────────────────────────────────────────────────
    if route == "history":
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, plan, amount, months, provider, status, source, granted_by,
                           created_at, paid_at, subscription_until
                    FROM {SCHEMA}.payments
                    WHERE user_login = %s
                    ORDER BY created_at DESC
                    LIMIT 50""",
                (user_login,)
            )
            rows = cur.fetchall()
            history = [
                {
                    "id": r[0], "plan": r[1], "amount": float(r[2]), "months": r[3],
                    "provider": r[4], "status": r[5], "source": r[6], "granted_by": r[7],
                    "created_at": str(r[8]),
                    "paid_at": str(r[9]) if r[9] else None,
                    "subscription_until": str(r[10]) if r[10] else None,
                }
                for r in rows
            ]
            return _resp(200, {"history": history})
        finally:
            conn.close()

    return _resp(404, {"error": "Метод не найден"})