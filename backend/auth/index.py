"""
API авторизации и управления пользователями АОУСПТ.
POST /login — вход (учитель/админ/tester)
POST /signup — самостоятельная регистрация (имя, фамилия, email, пароль) — логин генерируется автоматически
POST /register — добавление пользователя админом
POST /me — получить актуальный статус подписки (по токену)
POST /activate-trial — активация пробного периода 5 дней
POST /check-ai-limit — проверить/увеличить счётчик AI-запросов (trial: макс 5 в день)
GET /users — список пользователей (admin)
POST /toggle, /reset-password, /set-role — admin
DELETE /delete — admin
POST /grant-subscription — admin (выдать/продлить/отозвать подписку)
GET /maintenance — получить список разделов на ТО
POST /maintenance — обновить список разделов на ТО (admin)
"""
import json
import os
import re
import hashlib
import hmac
import secrets
import psycopg2
from datetime import datetime, timedelta

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    # Защитные заголовки: запрет встраивания, XSS-фильтр, скрытие сервера
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "no-referrer",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
# Пароль администратора — только из переменной окружения, без дефолта
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

# Секрет для подписи токенов — из переменной окружения
TOKEN_SECRET = os.environ.get("TOKEN_SECRET", "")

# Лимит неудачных попыток входа (rate-limit по логину)
LOGIN_FAIL_LIMIT = 10
LOGIN_FAIL_WINDOW_MIN = 15


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


# ── Хеширование паролей (pbkdf2 + per-user salt) ─────────────────────────────
# Формат хранения: "pbkdf2$<salt_hex>$<hash_hex>" — совместим с обновлением налету.
# Старые sha256-хеши (без "$") продолжают работать до смены пароля пользователем.

_PBKDF2_ITER = 260_000
_PBKDF2_ALG = "sha256"


def hash_password(password: str, salt_hex: str | None = None) -> str:
    """Возвращает pbkdf2-хеш в формате 'pbkdf2$salt$hash'."""
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        _PBKDF2_ALG,
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        _PBKDF2_ITER,
    )
    return f"pbkdf2${salt_hex}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Проверяет пароль против pbkdf2 или старого sha256 (для плавной миграции)."""
    if not password or not stored_hash:
        return False
    if stored_hash.startswith("pbkdf2$"):
        try:
            _, salt_hex, expected = stored_hash.split("$")
        except ValueError:
            return False
        new_hash = hash_password(password, salt_hex)
        _, _, computed = new_hash.split("$")
        return hmac.compare_digest(expected, computed)
    # Обратная совместимость: sha256 без соли
    return hmac.compare_digest(stored_hash, hashlib.sha256(password.encode()).hexdigest())


def _make_token(role: str, login: str, password_hash_snippet: str) -> str:
    """Генерирует сессионный токен: prefix:login:hmac(login+hash_snippet)."""
    if not TOKEN_SECRET:
        # Если секрет не задан — fallback на прежний формат (не меняем поведение)
        return f"{role}:{hashlib.sha256((login + password_hash_snippet + 'salt').encode()).hexdigest()}"
    sig = hmac.new(
        TOKEN_SECRET.encode(),
        f"{role}:{login}:{password_hash_snippet}".encode(),
        "sha256",
    ).hexdigest()
    return f"{role}:{login}:{sig}"


def _verify_token(token: str, expected_role: str, login: str, stored_hash: str) -> bool:
    """Проверяет, что токен принадлежит пользователю с данным логином."""
    if not token:
        return False
    if not TOKEN_SECRET:
        # Старый формат — принимаем если role совпадает
        return token.startswith(f"{expected_role}:")
    expected = _make_token(expected_role, login, stored_hash)
    return hmac.compare_digest(token, expected)


def check_admin_token(headers: dict) -> bool:
    """Проверяет, что заголовок X-Authorization содержит действительный admin-токен."""
    token = headers.get("x-authorization", "")
    if not token.startswith("admin:"):
        return False
    if not ADMIN_PASSWORD:
        return False
    # Верифицируем HMAC-подпись admin-токена
    expected = _make_token("admin", "admin", hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest())
    return hmac.compare_digest(token, expected)


# ── Rate-limit входа: считаем неудачи в БД ────────────────────────────────────

def _check_rate_limit(cur, login_key: str) -> bool:
    """Возвращает True если лимит превышен. login_key — логин или email."""
    window_start = datetime.utcnow() - timedelta(minutes=LOGIN_FAIL_WINDOW_MIN)
    cur.execute(
        f"""SELECT COUNT(*) FROM {SCHEMA}.login_attempts
            WHERE login_key = %s AND success = FALSE AND created_at > %s""",
        (login_key[:128], window_start),
    )
    row = cur.fetchone()
    return row and row[0] >= LOGIN_FAIL_LIMIT


def _record_attempt(cur, login_key: str, success: bool):
    """Записываем попытку входа."""
    cur.execute(
        f"""INSERT INTO {SCHEMA}.login_attempts (login_key, success, created_at)
            VALUES (%s, %s, NOW())""",
        (login_key[:128], success),
    )


def _clear_attempts(cur, login_key: str):
    """Очищаем счётчик после успешного входа."""
    cur.execute(
        f"DELETE FROM {SCHEMA}.login_attempts WHERE login_key = %s",
        (login_key[:128],),
    )


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
        study_group = (body.get("study_group") or "").strip()[:64]
        # Роль самостоятельной регистрации: только учитель или ученик
        req_role = (body.get("role") or "teacher").strip().lower()
        role = "student" if req_role == "student" else "teacher"

        if not first_name or not last_name:
            return _resp(400, {"error": "Укажите имя и фамилию"})
        if len(first_name) > 64 or len(last_name) > 64:
            return _resp(400, {"error": "Слишком длинное имя или фамилия"})
        if not is_valid_email(email):
            return _resp(400, {"error": "Некорректный email"})
        if len(password) < 8:
            return _resp(400, {"error": "Пароль должен быть не менее 8 символов"})

        full_name = f"{last_name} {first_name}"

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(email) = %s",
                (email,)
            )
            if cur.fetchone():
                return _resp(409, {"error": "Этот email уже зарегистрирован"})

            login = generate_login(first_name, last_name, cur)
            pw_hash = hash_password(password)          # pbkdf2 + соль
            token = _make_token(role, login, pw_hash)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, first_name, last_name, email, school, role,
                     created_by, subscription_status, auth_token_hash, study_group)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'self', 'none', %s, %s) RETURNING id""",
                (login, pw_hash, full_name, first_name, last_name, email, school, role,
                 token_hash, study_group or None)
            )
            conn.commit()
            user_id = cur.fetchone()[0]
            return _resp(200, {
                "success": True, "id": user_id, "login": login, "role": role,
                "full_name": full_name, "first_name": first_name, "last_name": last_name,
                "email": email, "school": school, "study_group": study_group,
                "token": token, "subscription_status": "none",
                "subscription_active": False, "subscription_until": None,
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
        if len(login_or_email) > 256 or len(password) > 256:
            return _resp(400, {"error": "Слишком длинные данные"})

        # Вход администратора — проверяем через HMAC, без прямого сравнения
        if login_or_email == "admin":
            if not ADMIN_PASSWORD:
                return _resp(401, {"error": "Неверный логин или пароль"})
            if not hmac.compare_digest(password, ADMIN_PASSWORD):
                return _resp(401, {"error": "Неверный логин или пароль"})
            admin_pw_hash = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()
            admin_token = _make_token("admin", "admin", admin_pw_hash)
            return _resp(200, {
                "role": "admin", "login": "admin",
                "full_name": "Администратор АОУСПТ", "school": "АОУСПТ",
                "token": admin_token,
                "subscription_status": "active", "subscription_active": True,
                "subscription_until": None,
            })

        conn = get_conn()
        try:
            cur = conn.cursor()

            # Rate-limit: блокируем после LOGIN_FAIL_LIMIT неудачных попыток
            if _check_rate_limit(cur, login_or_email):
                return _resp(429, {"error": f"Слишком много попыток входа. Подождите {LOGIN_FAIL_WINDOW_MIN} минут."})

            cur.execute(
                f"""SELECT login, password_hash, full_name, first_name, last_name, email, school, role, is_active,
                          subscription_status, subscription_until,
                          trial_until, trial_ai_calls_today, trial_ai_date, ai_balance_kopecks
                    FROM {SCHEMA}.users
                    WHERE login = %s OR LOWER(email) = LOWER(%s)
                    LIMIT 1""",
                (login_or_email, login_or_email)
            )
            row = cur.fetchone()

            # verify_password поддерживает pbkdf2 и старый sha256 (плавная миграция)
            if not row or not verify_password(password, row[1]):
                _record_attempt(cur, login_or_email, False)
                conn.commit()
                return _resp(401, {"error": "Неверный логин или пароль"})

            (login, stored_ph, full_name, first_name, last_name, email, school, role, is_active,
             sub_status, sub_until, trial_until, trial_ai_calls_today, trial_ai_date, ai_balance_kopecks) = row

            if not is_active:
                return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь к администратору."})

            # Если пароль хранился в старом sha256 — обновляем на pbkdf2 налету
            new_ph = stored_ph
            if not stored_ph.startswith("pbkdf2$"):
                new_ph = hash_password(password)
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE login = %s",
                    (new_ph, login)
                )

            _clear_attempts(cur, login_or_email)

            sub = get_subscription_payload(sub_status, sub_until, trial_until, trial_ai_calls_today or 0, trial_ai_date)
            if role == "tester":
                sub["subscription_active"] = True
                sub["subscription_status"] = "active"

            now_ts = datetime.utcnow()
            token_prefix = role if role in ("teacher", "student", "tester") else "teacher"
            token = _make_token(token_prefix, login, new_ph)
            token_hash = hashlib.sha256(token.encode()).hexdigest()

            update_fields = "last_seen_at = %s, auth_token_hash = %s, password_hash = %s"
            update_vals = [now_ts, token_hash, new_ph, login]
            if sub_status == "active" and sub["subscription_status"] == "expired":
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET subscription_status = 'expired', {update_fields} WHERE login = %s",
                    update_vals
                )
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET {update_fields} WHERE login = %s",
                    update_vals
                )
            conn.commit()
            return _resp(200, {
                "role": role, "login": login,
                "full_name": full_name, "first_name": first_name, "last_name": last_name,
                "email": email, "school": school, "token": token,
                "ai_balance_kopecks": ai_balance_kopecks or 0,
                "ai_balance_rub": round((ai_balance_kopecks or 0) / 100, 2),
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
                           trial_until, trial_ai_calls_today, trial_ai_date, role, ai_balance_kopecks
                    FROM {SCHEMA}.users WHERE login = %s""",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            sub = get_subscription_payload(row[0], row[1], row[2], row[3] or 0, row[4])
            user_role = row[5]
            ai_balance_kop = row[6] or 0
            if user_role == "tester":
                sub["subscription_active"] = True
                sub["subscription_status"] = "active"
            return _resp(200, {"login": login, "role": user_role, "ai_balance_kopecks": ai_balance_kop, "ai_balance_rub": round(ai_balance_kop / 100, 2), **sub})
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
        if role not in ("teacher", "admin", "tester"):
            return _resp(400, {"error": "Роль должна быть teacher, admin или tester"})
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
                           subscription_status, subscription_plan, subscription_until,
                           trial_until, trial_ai_calls_today, trial_ai_date, last_seen_at
                    FROM {SCHEMA}.users ORDER BY created_at DESC"""
            )
            rows = cur.fetchall()
            users = []
            for r in rows:
                sub = get_subscription_payload(r[10], r[12], r[13], r[14] or 0, r[15])
                users.append({
                    "id": r[0], "login": r[1], "full_name": r[2],
                    "first_name": r[3], "last_name": r[4], "email": r[5],
                    "school": r[6], "role": r[7], "is_active": r[8],
                    "created_at": str(r[9]),
                    "subscription_plan": r[11],
                    "last_seen_at": r[16].isoformat() if r[16] else None,
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
        if len(new_password) < 8:
            return _resp(400, {"error": "Пароль должен быть не менее 8 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE login = %s RETURNING id",
                (hash_password(new_password), login)   # pbkdf2
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

    # ── POST update-profile (учитель/ученик — самостоятельное редактирование) ─
    if method == "POST" and route in ("update-profile", "update_profile"):
        token = headers.get("x-authorization", "")
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
                f"SELECT password_hash, role FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})

            # Проверяем токен под ролью пользователя (учитель/ученик/тестер/админ)
            stored_hash = row[0]
            user_role = row[1] or "teacher"
            token_ok = any(
                _verify_token(token, r, login, stored_hash)
                for r in {user_role, "teacher", "student", "tester", "admin"}
            )
            if not token_ok:
                return _resp(403, {"error": "Нет доступа"})

            # Если меняем пароль — проверяем текущий через безопасное сравнение
            if new_password:
                if not current_password:
                    return _resp(400, {"error": "Для смены пароля укажите текущий пароль"})
                if not verify_password(current_password, row[0]):
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
                new_pw_hash = hash_password(new_password)   # pbkdf2
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET first_name=%s, last_name=%s, full_name=%s, email=%s, school=%s, password_hash=%s
                        WHERE login=%s""",
                    (first_name, last_name, full_name, email or None, school or None, new_pw_hash, login)
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

    # ── POST set-role (admin) — сменить роль пользователя ───────────────────
    if method == "POST" and route in ("set-role", "set_role"):
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = (body.get("login") or "").strip()
        role = (body.get("role") or "").strip()
        if not login or not role:
            return _resp(400, {"error": "Укажите login и role"})
        if role not in ("teacher", "tester", "student"):
            return _resp(400, {"error": "Роль должна быть teacher, tester или student"})
        if login == "admin":
            return _resp(400, {"error": "Нельзя изменить роль администратора"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET role = %s WHERE login = %s RETURNING id",
                (role, login)
            )
            conn.commit()
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"success": True, "login": login, "role": role})
        finally:
            conn.close()

    # ── GET maintenance — получить список разделов на ТО ────────────────────
    if method == "GET" and route == "maintenance":
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT sections FROM {SCHEMA}.maintenance WHERE id = 1")
            row = cur.fetchone()
            sections = json.loads(row[0]) if row else []
            return _resp(200, {"sections": sections})
        finally:
            conn.close()

    # ── POST maintenance — обновить список разделов на ТО (admin) ───────────
    if method == "POST" and route == "maintenance":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        sections = body.get("sections", [])
        if not isinstance(sections, list):
            return _resp(400, {"error": "sections должен быть массивом"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.maintenance (id, sections, updated_at, updated_by)
                    VALUES (1, %s, NOW(), 'admin')
                    ON CONFLICT (id) DO UPDATE
                    SET sections = EXCLUDED.sections,
                        updated_at = EXCLUDED.updated_at,
                        updated_by = EXCLUDED.updated_by""",
                (json.dumps(sections, ensure_ascii=False),)
            )
            conn.commit()
            return _resp(200, {"success": True, "sections": sections})
        finally:
            conn.close()

    # ── GET lk-visibility — видимость разделов ЛК по ролям ──────────────────
    # Возвращает {hidden: {teacher: [...sections], student: [...sections]}}
    if method == "GET" and route in ("lk-visibility", "lk_visibility"):
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT role, section FROM {SCHEMA}.lk_section_visibility WHERE visible = FALSE"
            )
            hidden = {"teacher": [], "student": []}
            for r, sect in cur.fetchall():
                hidden.setdefault(r, []).append(sect)
            return _resp(200, {"hidden": hidden})
        finally:
            conn.close()

    # ── POST lk-visibility (admin) — задать скрытые разделы по роли ──────────
    # body: {role: 'teacher'|'student', hidden: [...sections]}
    if method == "POST" and route in ("lk-visibility", "lk_visibility"):
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})
        role = (body.get("role") or "").strip().lower()
        hidden = body.get("hidden", [])
        if role not in ("teacher", "student"):
            return _resp(400, {"error": "role должен быть teacher или student"})
        if not isinstance(hidden, list):
            return _resp(400, {"error": "hidden должен быть массивом"})
        hidden = [str(s)[:32] for s in hidden]

        conn = get_conn()
        try:
            cur = conn.cursor()
            # Сбрасываем прежние скрытия этой роли и пишем новые
            cur.execute(
                f"DELETE FROM {SCHEMA}.lk_section_visibility WHERE role = %s",
                (role,)
            )
            for sect in hidden:
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.lk_section_visibility (role, section, visible, updated_at)
                        VALUES (%s, %s, FALSE, NOW())
                        ON CONFLICT (role, section) DO UPDATE SET visible = FALSE, updated_at = NOW()""",
                    (role, sect)
                )
            conn.commit()
            return _resp(200, {"success": True, "role": role, "hidden": hidden})
        finally:
            conn.close()

    # ── POST spend-tokens — списание баланса в копейках за ИИ-генерацию ───────
    # amount = количество токенов YandexGPT; базовая ставка 0.2 коп/токен (2 руб/1000),
    # к потреблению добавляется наценка +40%.
    if method == "POST" and route in ("spend-tokens", "spend_tokens"):
        login = (body.get("login") or "").strip()
        try:
            amount = int(body.get("amount") or 0)  # токены YandexGPT
        except (TypeError, ValueError):
            amount = 0
        if not login:
            return _resp(400, {"error": "Укажите login"})
        if amount <= 0:
            return _resp(400, {"error": "Укажите amount > 0"})

        # Базовая стоимость: 0.2 коп/токен. Наценка +40% сверху на потребление ИИ.
        AI_MARKUP = 1.40
        kopecks_to_spend = max(round(amount * 0.2 * AI_MARKUP), 1)

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT ai_balance_kopecks, role, subscription_until FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            balance_kop, role, sub_until = row[0] or 0, row[1], row[2]
            now = datetime.utcnow()
            # admin и tester — бесплатно без списания
            if role in ("tester", "admin"):
                return _resp(200, {"ok": True, "balance_kopecks": balance_kop, "balance_rub": round(balance_kop / 100, 2)})
            # Без активной подписки — ИИ заблокирован
            has_sub = sub_until and isinstance(sub_until, datetime) and sub_until > now
            if not has_sub:
                return _resp(403, {"error": "Для использования ИИ необходима активная подписка."})
            # С подпиской — списываем рубли всегда
            if balance_kop < kopecks_to_spend:
                need_rub = round(kopecks_to_spend / 100, 2)
                have_rub = round(balance_kop / 100, 2)
                return _resp(402, {"error": f"Недостаточно средств. Баланс: {have_rub} ₽, нужно: {need_rub} ₽. Пополните баланс в личном кабинете."})
            new_balance_kop = balance_kop - kopecks_to_spend
            action_label = (body.get("action_label") or "ИИ-генерация").strip()[:64]
            cur.execute(
                f"UPDATE {SCHEMA}.users SET ai_balance_kopecks = %s WHERE login = %s",
                (new_balance_kop, login)
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.ai_token_logs
                    (login, action, tokens, balance_after, amount_kopecks, balance_kopecks_after)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                (login, action_label, amount, new_balance_kop, kopecks_to_spend, new_balance_kop)
            )
            conn.commit()
            return _resp(200, {
                "ok": True,
                "balance_kopecks": new_balance_kop,
                "balance_rub": round(new_balance_kop / 100, 2),
                "spent_kopecks": kopecks_to_spend,
                "spent_rub": round(kopecks_to_spend / 100, 2),
            })
        finally:
            conn.close()

    # ── GET get-tokens-balance — получить баланс в рублях ───────────────────
    if method == "GET" and route in ("get-tokens-balance", "get_tokens_balance"):
        login = (qs.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT ai_balance_kopecks FROM {SCHEMA}.users WHERE login = %s", (login,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            kop = row[0] or 0
            return _resp(200, {"balance_kopecks": kop, "balance_rub": round(kop / 100, 2)})
        finally:
            conn.close()

    # ── POST add-tokens (admin) — пополнить баланс вручную в рублях ──────────
    if method == "POST" and route in ("add-tokens", "add_tokens"):
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})
        login = (body.get("login") or "").strip()
        try:
            # amount = рубли (дробные)
            amount_rub = float(body.get("amount") or 0)
        except (TypeError, ValueError):
            amount_rub = 0
        if not login or amount_rub <= 0:
            return _resp(400, {"error": "Укажите login и amount > 0"})
        kopecks = round(amount_rub * 100)
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET ai_balance_kopecks = ai_balance_kopecks + %s WHERE login = %s RETURNING ai_balance_kopecks",
                (kopecks, login)
            )
            conn.commit()
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            new_kop = row[0] or 0
            return _resp(200, {"ok": True, "balance_kopecks": new_kop, "balance_rub": round(new_kop / 100, 2)})
        finally:
            conn.close()

    # ── GET token-logs — история списаний в рублях ────────────────────────────
    if method == "GET" and route in ("token-logs", "token_logs"):
        login = (qs.get("login") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        limit_count = min(int(qs.get("limit") or 50), 100)
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT action, tokens, amount_kopecks, balance_kopecks_after, created_at
                    FROM {SCHEMA}.ai_token_logs
                    WHERE login = %s
                    ORDER BY created_at DESC
                    LIMIT %s""",
                (login, limit_count)
            )
            rows = cur.fetchall()
            logs = [
                {
                    "action": r[0],
                    "tokens": r[1],
                    "amount_rub": round((r[2] or 0) / 100, 2),
                    "balance_rub_after": round((r[3] or 0) / 100, 2),
                    "created_at": r[4].isoformat() if r[4] else None,
                }
                for r in rows
            ]
            return _resp(200, {"logs": logs})
        finally:
            conn.close()

    # ── GET collective-by-token — коллектив ОУ для обычного пользователя ────
    if method == "GET" and route in ("collective-by-token", "collective_by_token"):
        token = headers.get("x-authorization", "").strip()
        login = (qs.get("login") or "").strip()
        if not token or not login:
            return _resp(400, {"error": "Укажите login и токен"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT institution_id FROM {SCHEMA}.users
                    WHERE login = %s AND is_active = true AND institution_id IS NOT NULL""",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(200, {"members": [], "has_institution": False})

            institution_id = row[0]
            cur.execute(
                f"""SELECT full_name, institution_position, subject
                    FROM {SCHEMA}.users
                    WHERE institution_id = %s AND is_active = true
                    ORDER BY institution_position, full_name""",
                (institution_id,)
            )
            position_labels = {
                "director": "Директор",
                "vice_director": "Зам. директора",
                "counselor": "Советник",
                "teacher": "Педагог",
            }
            members = []
            for r in cur.fetchall():
                pos = r[1]
                subj = r[2]
                label = position_labels.get(pos, pos)
                if pos == "teacher" and subj:
                    label = f"Педагог ({subj})"
                members.append({
                    "full_name": r[0],
                    "position": pos,
                    "position_label": label,
                    "subject": subj,
                })
            return _resp(200, {"members": members, "has_institution": True})
        finally:
            conn.close()

    return _resp(404, {"error": "Метод не найден"})


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(data, ensure_ascii=False),
    }