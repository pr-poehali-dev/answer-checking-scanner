"""
API авторизации и управления пользователями АОУСПТ.
POST /login — вход (учитель/админ)
POST /signup — самостоятельная регистрация (имя, фамилия, email, пароль) — логин генерируется автоматически
POST /register — добавление пользователя админом
POST /me — получить актуальный статус подписки (по токену)
POST /activate-trial — активация пробного периода 5 дней
POST /check-ai-limit — проверить/увеличить счётчик AI-запросов (trial: макс 5 в день)
GET /users — список пользователей (admin)
POST /toggle, /reset-password — admin
DELETE /delete — admin
POST /grant-subscription — admin (выдать/продлить/отозвать подписку)
"""
import json
import os
import re
import hashlib
import psycopg2
from datetime import datetime, timedelta

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin2026")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def check_admin_token(headers: dict) -> bool:
    token = headers.get("x-authorization", "")
    return token.startswith("admin:")


# ── Транслитерация для генерации логина ────────────────────────────────────
TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def translit(s: str) -> str:
    s = (s or '').strip().lower()
    out = []
    for ch in s:
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isalnum():
            out.append(ch)
    res = ''.join(out)
    return re.sub(r'[^a-z0-9]', '', res)


def generate_login(first_name: str, last_name: str, cur) -> str:
    """Генерируем логин по схеме: фамилия + первая буква имени; при коллизии — числовой суффикс."""
    f = translit(last_name)
    i = translit(first_name)
    base = (f + (i[:1] if i else ''))[:32] or 'user'
    candidate = base
    n = 1
    while True:
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s",
            (candidate,)
        )
        if not cur.fetchone():
            return candidate
        n += 1
        candidate = f"{base}{n}"


# ── Подписка и trial ────────────────────────────────────────────────────────

TRIAL_DAYS = 5
TRIAL_AI_LIMIT = 5


def get_subscription_payload(row_status, row_until, trial_until=None, trial_ai_calls_today=0, trial_ai_date=None) -> dict:
    """Нормализуем статус подписки и trial к фронту."""
    now = datetime.utcnow()
    today = now.date()

    # Платная подписка
    until = row_until
    is_active = False
    status = row_status or 'none'
    if until and isinstance(until, datetime):
        if until > now:
            is_active = True
            status = 'active'
        elif status == 'active':
            status = 'expired'

    # Trial
    trial_active = False
    trial_expired = False
    trial_until_iso = None
    if trial_until and isinstance(trial_until, datetime):
        trial_until_iso = trial_until.isoformat()
        if trial_until > now:
            trial_active = True
        else:
            trial_expired = True

    # Счётчик AI на сегодня
    if trial_ai_date and hasattr(trial_ai_date, 'year'):
        ai_date_is_today = (trial_ai_date == today)
    else:
        ai_date_is_today = False
    ai_calls_today = trial_ai_calls_today if ai_date_is_today else 0

    # Общий доступ = платная активна ИЛИ trial активен
    if not is_active and trial_active:
        is_active = True
        status = 'trial'

    return {
        "subscription_status": status,
        "subscription_active": is_active,
        "subscription_until": until.isoformat() if isinstance(until, datetime) else None,
        "trial_active": trial_active,
        "trial_expired": trial_expired,
        "trial_until": trial_until_iso,
        "trial_ai_calls_today": ai_calls_today,
        "trial_ai_limit": TRIAL_AI_LIMIT,
    }


# ── Email validation ───────────────────────────────────────────────────────
EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')


def is_valid_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email))


def handler(event: dict, context) -> dict:
    """Авторизация, регистрация, управление пользователями и подписками АОУСПТ."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_path = event.get("path", "/") or "/"
    path = raw_path.rstrip("/")
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
    route = action or path.lstrip("/").lower() or "login"

    # ── POST signup (открытая регистрация учителя) ──────────────────────────
    if method == "POST" and route == "signup":
        first_name = (body.get("first_name") or "").strip()
        last_name = (body.get("last_name") or "").strip()
        email = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        school = (body.get("school") or "АОУСПТ").strip()

        if not first_name or not last_name:
            return _resp(400, {"error": "Укажите имя и фамилию"})
        if not is_valid_email(email):
            return _resp(400, {"error": "Некорректный email"})
        if len(password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        full_name = f"{last_name} {first_name}"

        conn = get_conn()
        try:
            cur = conn.cursor()
            # Проверка уникальности email
            cur.execute(
                f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(email) = %s",
                (email,)
            )
            if cur.fetchone():
                return _resp(409, {"error": "Этот email уже зарегистрирован"})

            login = generate_login(first_name, last_name, cur)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, first_name, last_name, email, school, role, created_by, subscription_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'teacher', 'self', 'none') RETURNING id""",
                (login, hash_password(password), full_name, first_name, last_name, email, school)
            )
            conn.commit()
            user_id = cur.fetchone()[0]

            token = f"teacher:{hash_password(login + password + 'salt')}"
            return _resp(200, {
                "success": True,
                "id": user_id,
                "login": login,
                "role": "teacher",
                "full_name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "school": school,
                "token": token,
                "subscription_status": "none",
                "subscription_active": False,
                "subscription_until": None,
            })
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": "Логин или email уже заняты"})
        finally:
            conn.close()

    # ── POST login ───────────────────────────────────────────────────────────
    if method == "POST" and route in ("", "login"):
        login_or_email = body.get("login", "").strip()
        password = body.get("password", "")

        if not login_or_email or not password:
            return _resp(400, {"error": "Введите логин/email и пароль"})

        # Админ
        if login_or_email == "admin" and password == ADMIN_PASSWORD:
            return _resp(200, {
                "role": "admin",
                "login": "admin",
                "full_name": "Администратор АОУСПТ",
                "school": "АОУСПТ",
                "token": f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}",
                "subscription_status": "active",
                "subscription_active": True,
                "subscription_until": None,
            })

        conn = get_conn()
        try:
            cur = conn.cursor()
            # Поиск по логину или email
            cur.execute(
                f"""SELECT login, password_hash, full_name, first_name, last_name, email, school, role, is_active,
                          subscription_status, subscription_until,
                          trial_until, trial_ai_calls_today, trial_ai_date
                    FROM {SCHEMA}.users
                    WHERE login = %s OR LOWER(email) = LOWER(%s)
                    LIMIT 1""",
                (login_or_email, login_or_email)
            )
            row = cur.fetchone()
            if not row or row[1] != hash_password(password):
                return _resp(401, {"error": "Неверный логин или пароль"})

            (login, _ph, full_name, first_name, last_name, email, school, role, is_active,
             sub_status, sub_until, trial_until, trial_ai_calls_today, trial_ai_date) = row
            if not is_active:
                return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь к администратору."})

            sub = get_subscription_payload(sub_status, sub_until, trial_until, trial_ai_calls_today or 0, trial_ai_date)

            # Если подписка истекла — фиксируем в БД
            if sub_status == 'active' and sub['subscription_status'] == 'expired':
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET subscription_status = 'expired' WHERE login = %s",
                    (login,)
                )
                conn.commit()

            token = f"teacher:{hash_password(login + password + 'salt')}"
            return _resp(200, {
                "role": role,
                "login": login,
                "full_name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "school": school,
                "token": token,
                **sub,
            })
        finally:
            conn.close()

    # ── POST me (актуализация подписки по логину/токену) ─────────────────────
    if method == "POST" and route == "me":
        login = (body.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        if login == "admin":
            return _resp(200, {"login": "admin", "subscription_status": "active",
                               "subscription_active": True, "subscription_until": None,
                               "trial_active": False, "trial_expired": False, "trial_until": None,
                               "trial_ai_calls_today": 0, "trial_ai_limit": TRIAL_AI_LIMIT})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT subscription_status, subscription_until,
                           trial_until, trial_ai_calls_today, trial_ai_date
                    FROM {SCHEMA}.users WHERE login = %s""",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            sub = get_subscription_payload(row[0], row[1], row[2], row[3] or 0, row[4])
            return _resp(200, {"login": login, **sub})
        finally:
            conn.close()

    # ── POST activate-trial ──────────────────────────────────────────────────
    if method == "POST" and route in ("activate-trial", "activate_trial"):
        login = (body.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT subscription_status, subscription_until, trial_until FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})

            sub_status, sub_until, trial_until = row
            now = datetime.utcnow()

            # Если уже есть активная платная подписка — не нужен trial
            if sub_until and isinstance(sub_until, datetime) and sub_until > now:
                return _resp(400, {"error": "У вас уже есть активная подписка"})

            # Trial уже был активирован
            if trial_until is not None:
                return _resp(400, {"error": "Пробный период уже был использован"})

            new_trial_until = now + timedelta(days=TRIAL_DAYS)
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET trial_until = %s, trial_ai_calls_today = 0, trial_ai_date = NULL
                    WHERE login = %s""",
                (new_trial_until, login)
            )
            conn.commit()
            return _resp(200, {
                "success": True,
                "trial_active": True,
                "trial_until": new_trial_until.isoformat(),
                "trial_ai_calls_today": 0,
                "trial_ai_limit": TRIAL_AI_LIMIT,
            })
        finally:
            conn.close()

    # ── POST check-ai-limit (проверить и увеличить счётчик AI-запросов) ──────
    if method == "POST" and route in ("check-ai-limit", "check_ai_limit"):
        login = (body.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT subscription_status, subscription_until,
                           trial_until, trial_ai_calls_today, trial_ai_date
                    FROM {SCHEMA}.users WHERE login = %s""",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})

            sub_status, sub_until, trial_until, ai_calls, ai_date = row
            now = datetime.utcnow()
            today = now.date()

            # Платная подписка активна — лимит не нужен
            if sub_until and isinstance(sub_until, datetime) and sub_until > now:
                return _resp(200, {"allowed": True, "is_trial": False})

            # Trial не активирован или истёк
            if not trial_until or not isinstance(trial_until, datetime) or trial_until <= now:
                return _resp(403, {"allowed": False, "error": "Нет активной подписки или пробного периода"})

            # Считаем вызовы за сегодня
            current_calls = ai_calls if (ai_date and hasattr(ai_date, 'year') and ai_date == today) else 0

            if current_calls >= TRIAL_AI_LIMIT:
                return _resp(429, {
                    "allowed": False,
                    "is_trial": True,
                    "error": f"Достигнут дневной лимит {TRIAL_AI_LIMIT} ИИ-запросов для пробного периода. Попробуйте завтра или оформите подписку.",
                    "trial_ai_calls_today": current_calls,
                    "trial_ai_limit": TRIAL_AI_LIMIT,
                })

            new_calls = current_calls + 1
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET trial_ai_calls_today = %s, trial_ai_date = %s
                    WHERE login = %s""",
                (new_calls, today, login)
            )
            conn.commit()
            return _resp(200, {
                "allowed": True,
                "is_trial": True,
                "trial_ai_calls_today": new_calls,
                "trial_ai_limit": TRIAL_AI_LIMIT,
            })
        finally:
            conn.close()

    # ── POST register (admin) ───────────────────────────────────────────────
    if method == "POST" and route == "register":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        password = body.get("password", "").strip()
        full_name = body.get("full_name", "").strip()
        school = body.get("school", "АОУСПТ").strip()
        role = body.get("role", "teacher").strip()

        if not login or not password or not full_name:
            return _resp(400, {"error": "Заполните все поля"})
        if role not in ("teacher", "admin"):
            return _resp(400, {"error": "Роль должна быть teacher или admin"})
        if len(password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (login, password_hash, full_name, school, role, created_by) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (login, hash_password(password), full_name, school, role, "admin")
            )
            conn.commit()
            user_id = cur.fetchone()[0]
            return _resp(200, {"success": True, "id": user_id, "login": login})
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": f"Логин «{login}» уже занят"})
        finally:
            conn.close()

    # ── GET users (admin) ───────────────────────────────────────────────────
    if method == "GET" and route == "users":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, login, full_name, first_name, last_name, email, school, role, is_active, created_at,
                           subscription_status, subscription_plan, subscription_until
                    FROM {SCHEMA}.users ORDER BY created_at DESC"""
            )
            rows = cur.fetchall()
            users = []
            for r in rows:
                sub = get_subscription_payload(r[10], r[12])
                users.append({
                    "id": r[0], "login": r[1], "full_name": r[2],
                    "first_name": r[3], "last_name": r[4], "email": r[5],
                    "school": r[6], "role": r[7], "is_active": r[8],
                    "created_at": str(r[9]),
                    "subscription_plan": r[11],
                    **sub,
                })
            return _resp(200, {"users": users})
        finally:
            conn.close()

    # ── POST toggle (admin) ─────────────────────────────────────────────────
    if method == "POST" and route == "toggle":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET is_active = NOT is_active WHERE login = %s RETURNING is_active",
                (login,)
            )
            conn.commit()
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"login": login, "is_active": row[0]})
        finally:
            conn.close()

    # ── POST reset-password (admin) ─────────────────────────────────────────
    if method == "POST" and route in ("reset-password", "reset_password"):
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        new_password = body.get("new_password", "").strip()
        if not login or not new_password:
            return _resp(400, {"error": "Укажите login и новый пароль"})
        if len(new_password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE login = %s RETURNING id",
                (hash_password(new_password), login)
            )
            conn.commit()
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"success": True})
        finally:
            conn.close()

    # ── POST grant-subscription (admin) ─────────────────────────────────────
    if method == "POST" and route in ("grant-subscription", "grant_subscription"):
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = (body.get("login") or "").strip()
        plan = (body.get("plan") or "АОУСПТ").strip()
        try:
            months = int(body.get("months") or 1)
        except (TypeError, ValueError):
            months = 1
        months = max(1, min(months, 36))
        revoke = bool(body.get("revoke"))

        if not login:
            return _resp(400, {"error": "Укажите login"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT subscription_status, subscription_until FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})

            if revoke:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET subscription_status='none', subscription_until=NULL, subscription_plan=NULL
                        WHERE login = %s""",
                    (login,)
                )
                conn.commit()
                return _resp(200, {"login": login, "subscription_status": "none",
                                   "subscription_active": False, "subscription_until": None})

            now = datetime.utcnow()
            current_until = row[1] if isinstance(row[1], datetime) else None
            base = current_until if (current_until and current_until > now) else now
            new_until = base + timedelta(days=30 * months)

            started_at = now if not (current_until and current_until > now) else None
            if started_at:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET subscription_status='active', subscription_plan=%s,
                            subscription_until=%s, subscription_started_at=%s
                        WHERE login = %s""",
                    (plan, new_until, started_at, login)
                )
            else:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET subscription_status='active', subscription_plan=%s, subscription_until=%s
                        WHERE login = %s""",
                    (plan, new_until, login)
                )

            cur.execute(
                f"""INSERT INTO {SCHEMA}.payments
                    (user_login, plan, amount, months, provider, status, source, granted_by,
                     paid_at, subscription_until)
                    VALUES (%s, %s, 0, %s, 'admin-grant', 'succeeded', 'admin', 'admin', NOW(), %s)""",
                (login, plan, months, new_until)
            )
            conn.commit()
            return _resp(200, {
                "login": login,
                "subscription_status": "active",
                "subscription_active": True,
                "subscription_until": new_until.isoformat(),
                "subscription_plan": plan,
            })
        finally:
            conn.close()

    # ── POST update-profile (teacher — самостоятельное редактирование) ─────
    if method == "POST" and route in ("update-profile", "update_profile"):
        token = headers.get("x-authorization", "")
        if not token.startswith("teacher:"):
            return _resp(403, {"error": "Нет доступа"})

        login = (body.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})

        first_name = (body.get("first_name") or "").strip()
        last_name = (body.get("last_name") or "").strip()
        email = (body.get("email") or "").strip().lower()
        school = (body.get("school") or "").strip()
        new_password = (body.get("new_password") or "").strip()
        current_password = (body.get("current_password") or "").strip()

        if not first_name or not last_name:
            return _resp(400, {"error": "Укажите имя и фамилию"})
        if email and not is_valid_email(email):
            return _resp(400, {"error": "Некорректный email"})
        if new_password and len(new_password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT password_hash FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})

            # Если меняем пароль — проверяем текущий
            if new_password:
                if not current_password:
                    return _resp(400, {"error": "Для смены пароля укажите текущий пароль"})
                if row[0] != hash_password(current_password):
                    return _resp(403, {"error": "Текущий пароль неверен"})

            full_name = f"{last_name} {first_name}"

            if email:
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(email) = %s AND login != %s",
                    (email, login)
                )
                if cur.fetchone():
                    return _resp(409, {"error": "Этот email уже используется другим пользователем"})

            if new_password:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET first_name=%s, last_name=%s, full_name=%s, email=%s, school=%s, password_hash=%s
                        WHERE login=%s""",
                    (first_name, last_name, full_name, email or None, school or None, hash_password(new_password), login)
                )
            else:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET first_name=%s, last_name=%s, full_name=%s, email=%s, school=%s
                        WHERE login=%s""",
                    (first_name, last_name, full_name, email or None, school or None, login)
                )
            conn.commit()
            return _resp(200, {
                "success": True,
                "login": login,
                "full_name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "email": email or None,
                "school": school or None,
            })
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": "Email уже используется"})
        finally:
            conn.close()

    # ── DELETE delete (admin) ───────────────────────────────────────────────
    if method == "DELETE" and route == "delete":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        if not login or login == "admin":
            return _resp(400, {"error": "Нельзя удалить этого пользователя"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {SCHEMA}.users WHERE login = %s RETURNING id", (login,))
            conn.commit()
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"success": True})
        finally:
            conn.close()

    return _resp(404, {"error": "Метод не найден"})


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(data, ensure_ascii=False),
    }