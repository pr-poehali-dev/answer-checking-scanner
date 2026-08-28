"""
API подписки САОУ.
GET  /plans — список тарифов
POST /create — создать платёж в ЮKassa, вернуть confirmation_url
POST /check — проверить статус платежа (вызывается фронтом после возврата с оплаты)
GET  /history — история платежей пользователя
GET  /cards — привязанные карты + лицевой счёт
POST /add-card — привязать новую карту (платёж 10 ₽ с зачислением на баланс)
POST /delete-card — отвязать одну карту (удаляется навсегда)
POST /delete-all-cards — отвязать все карты сразу
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
from receipt_mail import send_payment_receipt

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Login, X-Authorization, X-Cron-Secret",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")

# ── Тарифы САОУ ──────────────────────────────────────────────────────────
# ai_gift_rub — подарок на баланс ИИ при покупке/продлении подписки этого тарифа
PLANS = [
    {
        "code": "monthly",
        "name": "САОУ — Месяц",
        "amount": 199,
        "months": 1,
        "description": "Подписка на 1 месяц. Все разделы доступны.",
        "popular": False,
        "ai_gift_rub": 40,
    },
    {
        "code": "halfyear",
        "name": "САОУ — Полгода",
        "amount": 1099,
        "months": 6,
        "description": "Подписка на 6 месяцев. Экономия 8%.",
        "popular": True,
        "ai_gift_rub": 250,
    },
    {
        "code": "year",
        "name": "САОУ — Год",
        "amount": 2299,
        "months": 12,
        "description": "Подписка на 12 месяцев. Экономия 4%.",
        "popular": False,
        "ai_gift_rub": 550,
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


# ── Привязанные карты ────────────────────────────────────────────────────────
# Полные данные карты у нас НЕ хранятся: ЮKassa отдаёт только тип платёжной
# системы и последние 4 цифры — этого достаточно, чтобы пользователь узнал
# свою карту в списке. Списания идут по токену payment_method_id.

CARD_TYPE_LABELS = {
    "MasterCard": "MasterCard",
    "Maestro": "Maestro",
    "MIR": "Мир",
    "Mir": "Мир",
    "VISA": "Visa",
    "Visa": "Visa",
    "UnionPay": "UnionPay",
    "JCB": "JCB",
    "AmericanExpress": "American Express",
    "DinersClub": "Diners Club",
    "DiscoverCard": "Discover",
}


def card_type_label(raw: str | None) -> str:
    """Человекочитаемое название платёжной системы («Мир», «Visa»…)."""
    if not raw:
        return "Карта"
    return CARD_TYPE_LABELS.get(raw, CARD_TYPE_LABELS.get(str(raw).title(), str(raw)))


def save_card(cur, login: str, payment_method: dict) -> None:
    """Сохраняет привязанную карту пользователя (токен + тип + последние 4 цифры).

    Вызывается после успешной оплаты, если пользователь согласился запомнить карту.
    Повторная оплата той же картой не плодит дубли — обновляем существующую запись.
    """
    pm_id = (payment_method or {}).get("id")
    if not pm_id:
        return
    card = (payment_method or {}).get("card") or {}
    card_type = card_type_label(card.get("card_type"))
    last4 = (card.get("last4") or "").strip()[:4] or None
    title = (payment_method or {}).get("title") or (f"{card_type} •••• {last4}" if last4 else card_type)

    cur.execute(
        f"""INSERT INTO {SCHEMA}.saved_cards
            (user_login, payment_method_id, card_type, card_last4, card_title,
             is_default, autorenew_enabled, last_used_at)
            VALUES (%s, %s, %s, %s, %s, TRUE, FALSE, NOW())
            ON CONFLICT (payment_method_id) DO UPDATE
            SET card_type = EXCLUDED.card_type,
                card_last4 = EXCLUDED.card_last4,
                card_title = EXCLUDED.card_title,
                last_used_at = NOW()""",
        (login, pm_id, card_type, last4, title[:128])
    )


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


def grant_subscription(login: str, plan_code: str, months: int, payment_id: str | None,
                       autorenew: bool = False, payment_method_id: str | None = None,
                       payment_method_title: str | None = None, is_recurrent: bool = False,
                       payment_method: dict | None = None) -> datetime:
    """Активирует подписку: продлевает или начинает новую. Начисляет подарочные ИИ-рубли
    по тарифу (40 ₽ / 250 ₽ / 550 ₽ за 1/6/12 месяцев). Возвращает дату окончания.

    Если это первая платная подписка после пробного периода (trial_until IS NOT NULL,
    subscription_started_at IS NULL) — пробный ИИ-баланс безвозвратно сгорает: баланс
    обнуляется перед начислением подарка за оплаченный тариф.

    Если autorenew=True и передан payment_method_id — включает автопродление (сохраняет карту).
    """
    plan = get_plan(plan_code)
    gift_kopecks = round((plan["ai_gift_rub"] if plan else 0) * 100)

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT subscription_until, trial_until, subscription_started_at FROM {SCHEMA}.users WHERE login = %s",
            (login,)
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("Пользователь не найден")

        now = datetime.utcnow()
        current_until, trial_until, sub_started_at = row[0], row[1], row[2]
        current_until = current_until if isinstance(current_until, datetime) else None
        base = current_until if (current_until and current_until > now) else now
        new_until = base + timedelta(days=30 * months)

        # Первая платная подписка после пробного периода — пробный ИИ-баланс сгорает безвозвратно
        is_first_paid_after_trial = trial_until is not None and sub_started_at is None
        if is_first_paid_after_trial:
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_status='active', subscription_plan=%s,
                        subscription_until=%s,
                        subscription_started_at = NOW(),
                        ai_balance_kopecks = %s,
                        trial_until = NULL, trial_ai_calls_today = 0, trial_ai_date = NULL
                    WHERE login = %s""",
                (plan_code, new_until, gift_kopecks, login)
            )
        else:
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET subscription_status='active', subscription_plan=%s,
                        subscription_until=%s,
                        subscription_started_at = COALESCE(subscription_started_at, NOW()),
                        ai_balance_kopecks = ai_balance_kopecks + %s
                    WHERE login = %s""",
                (plan_code, new_until, gift_kopecks, login)
            )

        # Автопродление: включаем и сохраняем способ оплаты (с явного согласия пользователя)
        if autorenew and payment_method_id:
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET autorenew_enabled = true, autorenew_plan = %s,
                        payment_method_id = %s, payment_method_title = %s,
                        autorenew_consent_at = COALESCE(autorenew_consent_at, NOW()),
                        autorenew_last_charge_at = NOW(), autorenew_last_error = NULL
                    WHERE login = %s""",
                (plan_code, payment_method_id, payment_method_title, login)
            )
        elif is_recurrent:
            # Успешное автосписание — обновляем отметку и чистим ошибку
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET autorenew_last_charge_at = NOW(), autorenew_last_error = NULL
                    WHERE login = %s""",
                (login,)
            )

        # Карта, которую пользователь разрешил запомнить — в список привязанных
        if payment_method and payment_method.get("saved"):
            save_card(cur, login, payment_method)
            if autorenew and payment_method_id:
                cur.execute(
                    f"""UPDATE {SCHEMA}.saved_cards SET autorenew_enabled = TRUE
                        WHERE payment_method_id = %s""",
                    (payment_method_id,)
                )

        if payment_id:
            cur.execute(
                f"""UPDATE {SCHEMA}.payments
                    SET status='succeeded', paid_at=NOW(), subscription_until=%s, is_recurrent=%s
                    WHERE provider_payment_id = %s""",
                (new_until, is_recurrent, payment_id)
            )
        conn.commit()

        # Электронный чек на почту пользователя. Оплата уже зачислена, поэтому
        # проблемы с почтой не должны ломать ответ — только пишем в лог.
        try:
            cur.execute(
                f"SELECT email, full_name, personal_account FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            u = cur.fetchone()
            if u and u[0]:
                send_payment_receipt(
                    cur, SCHEMA,
                    to_email=u[0], full_name=u[1] or "", personal_account=u[2],
                    kind="subscription",
                    plan_name=(plan or {}).get("name") or f"Подписка САОУ ({months} мес.)",
                    amount_rub=float((plan or {}).get("amount") or 0),
                    payment_id=payment_id or "",
                    subscription_until=new_until,
                    is_recurrent=is_recurrent,
                )
        except Exception as e:
            print(f"[RECEIPT] subscription receipt failed for {login}: {e}")

        return new_until
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """Платежи и подписки САОУ через ЮKassa."""
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

        # Автопродление: только для месячного тарифа и при явном согласии пользователя
        autorenew = bool(body.get("autorenew")) and plan_code == "monthly"

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
                "description": f"САОУ · {plan['name']} · {full_name}",
                "metadata": {
                    "login": user_login, "plan": plan_code, "months": str(plan["months"]),
                    "autorenew": "1" if autorenew else "0",
                },
            }
            # Сохраняем способ оплаты для будущих безакцептных списаний (54-ФЗ: с согласия)
            if autorenew:
                payment_body["save_payment_method"] = True
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

        # Сохранённый способ оплаты (для автопродления)
        autorenew = meta.get("autorenew") == "1"
        pm = result.get("payment_method") or {}
        pm_id = pm.get("id") if pm.get("saved") else None
        card = pm.get("card") or {}
        pm_title = (pm.get("title") or (f"•••• {card.get('last4')}" if card.get("last4") else None))

        if status == "succeeded" and login and plan_code:
            try:
                until = grant_subscription(
                    login, plan_code, months, payment_id,
                    autorenew=autorenew, payment_method_id=pm_id, payment_method_title=pm_title,
                    payment_method=pm,
                )
                plan = get_plan(plan_code)
                return _resp(200, {
                    "status": "succeeded",
                    "subscription_until": until.isoformat(),
                    "subscription_active": True,
                    "autorenew_enabled": bool(autorenew and pm_id),
                    "ai_gift_rub": (plan or {}).get("ai_gift_rub", 0),
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

    # ── POST buy-tokens — создать платёж на пополнение баланса ИИ ─────────────
    if method == "POST" and route in ("buy-tokens", "buy_tokens"):
        if not user_login or user_login == "admin":
            return _resp(400, {"error": "Неизвестный пользователь"})
        try:
            amount_rub = float(body.get("amount_rub") or 0)
        except (TypeError, ValueError):
            amount_rub = 0
        if amount_rub < 50:
            return _resp(400, {"error": "Минимальная сумма пополнения: 50 руб"})
        if amount_rub > 10000:
            return _resp(400, {"error": "Максимальная сумма пополнения: 10 000 руб"})

        amount_rub = round(amount_rub, 2)
        return_url = (body.get("return_url") or "").strip() or "https://poehali.dev"

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT email, full_name, subscription_until, trial_until FROM {SCHEMA}.users WHERE login = %s",
                (user_login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            email, full_name, sub_until, trial_until = row
            now = datetime.utcnow()
            has_paid_sub = isinstance(sub_until, datetime) and sub_until > now
            on_trial = isinstance(trial_until, datetime) and trial_until > now
            # На пробном периоде пополнение баланса ИИ недоступно — только покупка подписки
            if on_trial and not has_paid_sub:
                return _resp(403, {"error": "Пополнение баланса ИИ недоступно во время пробного периода. Оформите подписку — вы получите подарочный ИИ-баланс."})
        finally:
            conn.close()

        try:
            payment_body = {
                "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
                "capture": True,
                "confirmation": {"type": "redirect", "return_url": return_url},
                "description": f"САОУ · Пополнение баланса ИИ · {full_name}",
                "metadata": {"login": user_login, "plan": "balance", "amount_rub": str(amount_rub)},
            }
            # Пользователь отметил «Запомнить данные карты» — просим ЮKassa сохранить токен
            if bool(body.get("save_card")):
                payment_body["save_payment_method"] = True
            if email:
                payment_body["receipt"] = {
                    "customer": {"email": email},
                    "items": [{
                        "description": "Пополнение баланса ИИ",
                        "quantity": "1.00",
                        "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
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
                    VALUES (%s, 'balance', %s, 0, 'yookassa', %s, %s, 'user')""",
                (user_login, amount_rub, payment_id, status)
            )
            conn.commit()
        finally:
            conn.close()

        return _resp(200, {
            "payment_id": payment_id,
            "confirmation_url": confirmation,
            "status": status,
            "amount_rub": amount_rub,
        })

    # ── POST check-tokens — проверить статус платежа за пополнение баланса ────
    if method == "POST" and route in ("check-tokens", "check_tokens"):
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

        # amount_rub: берём из metadata, либо из суммы платежа от ЮKassa
        try:
            amount_rub = float(meta.get("amount_rub") or 0)
        except (TypeError, ValueError):
            amount_rub = 0
        if not amount_rub:
            try:
                amount_rub = float((result.get("amount") or {}).get("value") or 0)
            except (TypeError, ValueError):
                amount_rub = 0
        kopecks = round(amount_rub * 100)

        if status == "succeeded" and login and kopecks > 0:
            conn = get_conn()
            try:
                cur = conn.cursor()
                cur.execute(
                    f"""UPDATE {SCHEMA}.payments SET status='succeeded', paid_at=NOW()
                        WHERE provider_payment_id = %s AND status != 'succeeded'""",
                    (payment_id,)
                )
                updated = cur.rowcount
                if updated > 0:
                    cur.execute(
                        f"""UPDATE {SCHEMA}.users
                            SET ai_balance_kopecks = ai_balance_kopecks + %s
                            WHERE login = %s RETURNING ai_balance_kopecks""",
                        (kopecks, login)
                    )
                    row = cur.fetchone()
                    new_kop = row[0] if row else 0
                else:
                    cur.execute(f"SELECT ai_balance_kopecks FROM {SCHEMA}.users WHERE login = %s", (login,))
                    row = cur.fetchone()
                    new_kop = row[0] if row else 0
                # Если пользователь разрешил запомнить карту — добавляем её в список привязанных
                pm = result.get("payment_method") or {}
                if pm.get("saved"):
                    save_card(cur, login, pm)
                conn.commit()

                # Чек шлём только при первом подтверждении платежа (updated > 0),
                # чтобы повторные проверки статуса не слали письмо заново.
                if updated > 0:
                    try:
                        cur.execute(
                            f"SELECT email, full_name, personal_account FROM {SCHEMA}.users WHERE login = %s",
                            (login,)
                        )
                        u = cur.fetchone()
                        if u and u[0]:
                            bind_card = meta.get("bind_card") == "1"
                            send_payment_receipt(
                                cur, SCHEMA,
                                to_email=u[0], full_name=u[1] or "", personal_account=u[2],
                                kind="balance",
                                plan_name=("Привязка карты (зачислено на баланс ИИ)"
                                           if bind_card else "Пополнение баланса ИИ"),
                                amount_rub=amount_rub,
                                payment_id=payment_id,
                                balance_rub=round(new_kop / 100, 2),
                            )
                    except Exception as e:
                        print(f"[RECEIPT] balance receipt failed for {login}: {e}")

                return _resp(200, {
                    "status": "succeeded",
                    "amount_rub": amount_rub,
                    "ai_balance_kopecks": new_kop,
                    "ai_balance_rub": round(new_kop / 100, 2),
                })
            finally:
                conn.close()

        return _resp(200, {"status": status, "amount_rub": amount_rub})

    # ── GET autorenew-status — состояние автопродления пользователя ────────────
    if route in ("autorenew-status", "autorenew_status"):
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT autorenew_enabled, autorenew_plan, payment_method_title,
                           subscription_until, autorenew_last_charge_at, autorenew_last_error
                    FROM {SCHEMA}.users WHERE login = %s""",
                (user_login,)
            )
            r = cur.fetchone()
            if not r:
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {
                "autorenew_enabled": bool(r[0]),
                "autorenew_plan": r[1],
                "payment_method_title": r[2],
                "subscription_until": str(r[3]) if r[3] else None,
                "last_charge_at": str(r[4]) if r[4] else None,
                "last_error": r[5],
            })
        finally:
            conn.close()

    # ── POST cancel-autorenew — отключить автопродление (кнопка пользователя) ──
    if method == "POST" and route in ("cancel-autorenew", "cancel_autorenew"):
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            # Полностью отключаем автопродление и забываем сохранённую карту
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET autorenew_enabled = false, autorenew_plan = NULL,
                        payment_method_id = NULL, payment_method_title = NULL,
                        autorenew_consent_at = NULL, autorenew_last_error = NULL
                    WHERE login = %s""",
                (user_login,)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.saved_cards SET autorenew_enabled = FALSE WHERE user_login = %s",
                (user_login,)
            )
            conn.commit()
            return _resp(200, {"ok": True, "autorenew_enabled": False})
        finally:
            conn.close()

    # ── GET cards — привязанные карты пользователя ─────────────────────────────
    if route == "cards":
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, card_type, card_last4, card_title, is_default,
                           autorenew_enabled, created_at, last_used_at
                    FROM {SCHEMA}.saved_cards
                    WHERE user_login = %s
                    ORDER BY created_at DESC""",
                (user_login,)
            )
            cards = [
                {
                    "id": r[0],
                    "card_type": r[1] or "Карта",
                    "card_last4": r[2],
                    "card_title": r[3],
                    "is_default": bool(r[4]),
                    "autorenew_enabled": bool(r[5]),
                    "created_at": str(r[6]) if r[6] else None,
                    "last_used_at": str(r[7]) if r[7] else None,
                }
                for r in cur.fetchall()
            ]
            cur.execute(
                f"SELECT personal_account FROM {SCHEMA}.users WHERE login = %s",
                (user_login,)
            )
            r = cur.fetchone()
            return _resp(200, {
                "cards": cards,
                "personal_account": r[0] if r else None,
            })
        finally:
            conn.close()

    # ── POST delete-card — отвязать одну карту (навсегда) ──────────────────────
    # Требование ЮMoney: пользователь может удалить привязку в любой момент сам,
    # без обращений в поддержку. Токен карты удаляется из нашей базы полностью.
    if method == "POST" and route in ("delete-card", "delete_card"):
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        try:
            card_id = int(body.get("card_id") or 0)
        except (TypeError, ValueError):
            card_id = 0
        if not card_id:
            return _resp(400, {"error": "Укажите карту"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""DELETE FROM {SCHEMA}.saved_cards
                    WHERE id = %s AND user_login = %s
                    RETURNING payment_method_id""",
                (card_id, user_login)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Карта не найдена"})
            pm_id = row[0]
            # Если это была карта автоплатежа — автопродление выключается навсегда
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET autorenew_enabled = false, autorenew_plan = NULL,
                        payment_method_id = NULL, payment_method_title = NULL,
                        autorenew_consent_at = NULL, autorenew_last_error = NULL
                    WHERE login = %s AND payment_method_id = %s""",
                (user_login, pm_id)
            )
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.saved_cards WHERE user_login = %s",
                (user_login,)
            )
            left = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "deleted": 1, "cards_left": left})
        finally:
            conn.close()

    # ── POST delete-all-cards — отвязать все карты сразу ───────────────────────
    if method == "POST" and route in ("delete-all-cards", "delete_all_cards"):
        if not user_login:
            return _resp(400, {"error": "Не указан пользователь"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM {SCHEMA}.saved_cards WHERE user_login = %s",
                (user_login,)
            )
            deleted = cur.rowcount
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET autorenew_enabled = false, autorenew_plan = NULL,
                        payment_method_id = NULL, payment_method_title = NULL,
                        autorenew_consent_at = NULL, autorenew_last_error = NULL
                    WHERE login = %s""",
                (user_login,)
            )
            conn.commit()
            return _resp(200, {"ok": True, "deleted": deleted, "cards_left": 0})
        finally:
            conn.close()

    # ── POST add-card — привязать новую карту для автоплатежа ─────────────────
    # ЮKassa не умеет «просто сохранить карту»: привязка возможна только через
    # реальный платёж. Списываем минимальную сумму (10 ₽), которая сразу
    # зачисляется на баланс ИИ пользователя — деньги не пропадают.
    if method == "POST" and route in ("add-card", "add_card"):
        if not user_login or user_login == "admin":
            return _resp(400, {"error": "Неизвестный пользователь"})
        return_url = (body.get("return_url") or "").strip() or "https://saou.ru"
        amount_rub = 10.00

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
            email, full_name = row
        finally:
            conn.close()

        try:
            payment_body = {
                "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
                "capture": True,
                "save_payment_method": True,
                "confirmation": {"type": "redirect", "return_url": return_url},
                "description": f"САОУ · Привязка карты · {full_name}",
                "metadata": {"login": user_login, "plan": "balance",
                             "amount_rub": str(amount_rub), "bind_card": "1"},
            }
            if email:
                payment_body["receipt"] = {
                    "customer": {"email": email},
                    "items": [{
                        "description": "Пополнение баланса ИИ",
                        "quantity": "1.00",
                        "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
                        "vat_code": 1,
                        "payment_subject": "service",
                        "payment_mode": "full_payment",
                    }],
                }
            result = yookassa_request("POST", "/payments", payment_body,
                                      idempotence=str(uuid.uuid4()))
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
                    VALUES (%s, 'balance', %s, 0, 'yookassa', %s, %s, 'user')""",
                (user_login, amount_rub, payment_id, status)
            )
            conn.commit()
        finally:
            conn.close()

        return _resp(200, {
            "payment_id": payment_id,
            "confirmation_url": confirmation,
            "status": status,
            "amount_rub": amount_rub,
        })

    # ── POST charge-recurring — безакцептные автосписания (вызывается по cron) ──
    if method == "POST" and route in ("charge-recurring", "charge_recurring"):
        # Защита эндпоинта секретным токеном
        cron_secret = os.environ.get("CRON_SECRET", "").strip()
        provided = (headers.get("x-cron-secret") or body.get("cron_secret") or "").strip()
        if not cron_secret or provided != cron_secret:
            return _resp(403, {"error": "Доступ запрещён"})

        return_url = (body.get("return_url") or "").strip() or "https://poehali.dev"
        # За сколько часов до окончания начинаем списывать (по умолчанию — в день окончания)
        try:
            window_hours = int(body.get("window_hours") or 24)
        except (TypeError, ValueError):
            window_hours = 24

        conn = get_conn()
        try:
            cur = conn.cursor()
            # Берём подписки с включённым автопродлением, срок которых истекает в ближайшее окно
            cur.execute(
                f"""SELECT login, autorenew_plan, payment_method_id, email, full_name
                    FROM {SCHEMA}.users
                    WHERE autorenew_enabled = true
                      AND payment_method_id IS NOT NULL
                      AND subscription_until IS NOT NULL
                      AND subscription_until <= (NOW() + (%s || ' hours')::interval)
                    ORDER BY subscription_until ASC
                    LIMIT 50""",
                (str(window_hours),)
            )
            due = cur.fetchall()
        finally:
            conn.close()

        charged, failed = [], []
        for login, plan_code, pm_id, email, full_name in due:
            plan = get_plan(plan_code or "monthly")
            if not plan:
                continue
            try:
                pay_body = {
                    "amount": {"value": f"{plan['amount']:.2f}", "currency": "RUB"},
                    "capture": True,
                    "payment_method_id": pm_id,
                    "description": f"САОУ · Автопродление · {plan['name']} · {full_name}",
                    "metadata": {
                        "login": login, "plan": plan_code, "months": str(plan["months"]),
                        "autorenew": "0", "recurrent": "1",
                    },
                }
                if email:
                    pay_body["receipt"] = {
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
                result = yookassa_request("POST", "/payments", pay_body, idempotence=str(uuid.uuid4()))
                pay_id = result.get("id")
                status = result.get("status", "pending")

                # Логируем платёж
                conn = get_conn()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.payments
                            (user_login, plan, amount, months, provider, provider_payment_id, status, source, is_recurrent)
                            VALUES (%s, %s, %s, %s, 'yookassa', %s, %s, 'autorenew', true)""",
                        (login, plan_code, plan["amount"], plan["months"], pay_id, status)
                    )
                    conn.commit()
                finally:
                    conn.close()

                if status == "succeeded":
                    grant_subscription(login, plan_code, plan["months"], pay_id, is_recurrent=True)
                    charged.append({"login": login, "payment_id": pay_id, "amount": plan["amount"]})
                else:
                    # Платёж не прошёл сразу (например, требует действий) — не продлеваем
                    _mark_autorenew_error(login, f"Статус платежа: {status}")
                    failed.append({"login": login, "reason": status})
            except Exception as e:
                _mark_autorenew_error(login, str(e)[:400])
                failed.append({"login": login, "reason": str(e)[:200]})

        return _resp(200, {"charged": charged, "failed": failed, "due_count": len(due)})

    return _resp(404, {"error": "Метод не найден"})


def _mark_autorenew_error(login: str, msg: str) -> None:
    """Сохраняет последнюю ошибку автосписания (для диагностики, без отключения)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.users SET autorenew_last_error = %s WHERE login = %s",
            (msg, login)
        )
        conn.commit()
    finally:
        conn.close()