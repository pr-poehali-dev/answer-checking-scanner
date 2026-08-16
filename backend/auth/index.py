"""
API авторизации и управления пользователями САОУ.
POST /login — вход (учитель/админ/tester)
POST /signup — самостоятельная регистрация (имя, фамилия, email, пароль) — логин генерируется автоматически,
              требуется подтверждение email кодом (см. /confirm-email)
POST /confirm-email — подтвердить 6-значный код с почты, выдать рабочий токен
POST /confirm-email-link — подтвердить по токену из ссылки в письме, выдать рабочий токен
POST /resend-email-code — повторно отправить код подтверждения email
POST /register — добавление пользователя админом
POST /me — получить актуальный статус подписки (по токену)
POST /activate-trial — активация пробного периода 5 дней (не более раза на IP и на устройство)
POST /check-ai-limit — проверить/увеличить счётчик AI-запросов (trial: макс 5 в день)
GET /users — список пользователей (admin), включая IP регистрации
GET /ip-stats — IP-адреса с несколькими аккаунтами и история попыток пробного периода (admin)
POST /toggle, /reset-password, /set-role — admin
DELETE /delete — admin
POST /grant-subscription — admin (выдать/продлить/отозвать подписку)
GET /maintenance — получить список разделов на ТО
POST /maintenance — обновить список разделов на ТО (admin)
"""
import json
import os
import re
import ssl
import random
import smtplib
import hashlib
import hmac
import secrets
import psycopg2
from email.mime.text import MIMEText
from email import utils as email_utils
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


# ── Подтверждение email при регистрации ──────────────────────────────────────
EMAIL_CONFIRM_TTL_MIN = 15
SMTP_HOST = os.environ.get("UDS_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("UDS_SMTP_PORT") or "465")
SMTP_USER = os.environ.get("UDS_SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("UDS_SMTP_PASSWORD", "").strip()
# Отдельный SMTP-хост (если общий не отвечает) — как в backend/uds/mail.py
MAIL_SMTP_HOST = os.environ.get("MAIL_SMTP_HOST", "").strip()
SMTP_TIMEOUT = 7
# Публичный адрес сайта — для ссылки подтверждения в письме
SITE_URL = os.environ.get("SITE_URL", "").strip().rstrip("/") or "https://poehali.dev"


def gen_email_code() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(6))


def issue_email_code(cur, login: str) -> tuple[str, str]:
    """Инвалидирует старые коды и создаёт новый 6-значный код + токен ссылки подтверждения email."""
    cur.execute(
        f"UPDATE {SCHEMA}.email_verify_codes SET used = TRUE WHERE login = %s AND used = FALSE",
        (login,)
    )
    code = gen_email_code()
    verify_token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(minutes=EMAIL_CONFIRM_TTL_MIN)
    cur.execute(
        f"""INSERT INTO {SCHEMA}.email_verify_codes (login, code, verify_token, expires_at)
            VALUES (%s, %s, %s, %s)""",
        (login, code, verify_token, expires)
    )
    return code, verify_token


def verify_email_code(cur, login: str, code: str) -> str:
    """Возвращает 'ok', 'wrong', 'expired' или 'limit'."""
    cur.execute(
        f"""SELECT id, code, expires_at, attempts FROM {SCHEMA}.email_verify_codes
            WHERE login = %s AND used = FALSE ORDER BY created_at DESC LIMIT 1""",
        (login,)
    )
    row = cur.fetchone()
    if not row:
        return "expired"
    code_id, stored_code, expires_at, attempts = row
    if datetime.utcnow() > expires_at:
        cur.execute(f"UPDATE {SCHEMA}.email_verify_codes SET used = TRUE WHERE id = %s", (code_id,))
        return "expired"
    if attempts >= 5:
        return "limit"
    if (code or "").strip() != stored_code:
        cur.execute(f"UPDATE {SCHEMA}.email_verify_codes SET attempts = attempts + 1 WHERE id = %s", (code_id,))
        return "wrong"
    cur.execute(f"UPDATE {SCHEMA}.email_verify_codes SET used = TRUE WHERE id = %s", (code_id,))
    return "ok"


def verify_email_token(cur, token: str) -> str | None:
    """Проверяет токен ссылки подтверждения. Возвращает login при успехе, иначе None."""
    if not token:
        return None
    cur.execute(
        f"""SELECT id, login, expires_at FROM {SCHEMA}.email_verify_codes
            WHERE verify_token = %s AND used = FALSE""",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    code_id, login, expires_at = row
    if datetime.utcnow() > expires_at:
        cur.execute(f"UPDATE {SCHEMA}.email_verify_codes SET used = TRUE WHERE id = %s", (code_id,))
        return None
    cur.execute(f"UPDATE {SCHEMA}.email_verify_codes SET used = TRUE WHERE id = %s", (code_id,))
    return login


def _finish_email_confirmation(cur, login: str) -> dict:
    """Отмечает email подтверждённым и выдаёт рабочий токен — общая логика
    для подтверждения по коду (confirm-email) и по ссылке (confirm-email-link)."""
    cur.execute(
        f"""SELECT password_hash, full_name, first_name, last_name, email, school, role, is_active
            FROM {SCHEMA}.users WHERE login = %s""",
        (login,)
    )
    row = cur.fetchone()
    if not row:
        return _resp(404, {"error": "Пользователь не найден"})
    pw_hash, full_name, first_name, last_name, email, school, role, is_active = row
    if not is_active:
        return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь к администратору."})

    token = _make_token(role, login, pw_hash)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    cur.execute(
        f"UPDATE {SCHEMA}.users SET email_confirmed = TRUE, auth_token_hash = %s WHERE login = %s",
        (token_hash, login)
    )
    return _resp(200, {
        "success": True, "login": login, "role": role,
        "full_name": full_name, "first_name": first_name, "last_name": last_name,
        "email": email, "school": school, "token": token,
        "subscription_status": "none", "subscription_active": False, "subscription_until": None,
    })


def _smtp_candidates():
    """Список вариантов (host, port, mode) для перебора — общий хост часто
    обрывает соединение, поэтому пробуем несколько комбинаций подряд."""
    hosts = []
    for h in [MAIL_SMTP_HOST, SMTP_HOST, "mail.hosting.reg.ru"]:
        if h and h not in hosts:
            hosts.append(h)
    candidates = []
    for h in hosts:
        candidates.append((h, 465, "ssl"))
        candidates.append((h, 587, "starttls"))
    return candidates


def send_confirmation_email(to_email: str, code: str, verify_token: str = "", site_url: str = "") -> None:
    """Отправляет письмо с кодом и ссылкой подтверждения. Перебирает несколько
    комбинаций host/port (как в backend/uds/mail.py) — устойчиво к обрыву
    соединения на общем хосте хостинга. Логирует каждую попытку."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        raise RuntimeError("Отправка email не настроена")

    base = (site_url or "").strip().rstrip("/") or SITE_URL
    link = f"{base}/confirm-email?token={verify_token}" if verify_token else ""
    subject = "САОУ — подтверждение регистрации"
    text_body = (
        f"Здравствуйте!\n\n"
        f"Ваш код подтверждения регистрации в системе САОУ:\n\n"
        f"  {code}\n\n"
        + (f"Либо просто перейдите по ссылке, чтобы подтвердить email:\n{link}\n\n" if link else "")
        + f"Код и ссылка действуют {EMAIL_CONFIRM_TTL_MIN} минут. "
        f"Если вы не регистрировались — просто проигнорируйте это письмо."
    )
    msg = MIMEText(text_body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"САОУ <{SMTP_USER}>"
    msg["To"] = to_email
    msg["Reply-To"] = SMTP_USER
    # Date и Message-ID обязательны для многих почтовых провайдеров (mail.ru,
    # Яндекс) — без них письмо часто уходит в спам или отклоняется молча,
    # даже если SMTP-сервер принял его с кодом 250 OK.
    msg["Date"] = email_utils.formatdate(localtime=True)
    msg["Message-ID"] = email_utils.make_msgid(domain=SMTP_USER.split("@")[-1] or "poehali.dev")
    raw = msg.as_string()

    import socket
    ctx = ssl.create_default_context()
    last_err = None
    auth_failed = False
    unresolved = set()
    for host, port, mode in _smtp_candidates():
        if host in unresolved:
            continue
        try:
            socket.getaddrinfo(host, port)
        except Exception:
            unresolved.add(host)
            last_err = f"хост {host} не найден"
            print(f"[AUTH SMTP] DNS FAIL {host}")
            continue
        try:
            if mode == "ssl":
                with smtplib.SMTP_SSL(host, port, context=ctx, timeout=SMTP_TIMEOUT) as s:
                    s.login(SMTP_USER, SMTP_PASSWORD)
                    s.sendmail(SMTP_USER, [to_email], raw)
            else:
                with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT) as s:
                    s.ehlo(); s.starttls(context=ctx); s.ehlo()
                    s.login(SMTP_USER, SMTP_PASSWORD)
                    s.sendmail(SMTP_USER, [to_email], raw)
            print(f"[AUTH SMTP] OK via {host}:{port} ({mode}) to={to_email}")
            return
        except smtplib.SMTPAuthenticationError as e:
            auth_failed = True
            last_err = f"неверный логин или пароль почты ({e.smtp_code})"
            print(f"[AUTH SMTP] AUTH FAIL {host}:{port}: {e}")
            break
        except Exception as e:
            last_err = str(e)
            print(f"[AUTH SMTP] FAIL {host}:{port} ({mode}): {e}")
            continue

    if auth_failed:
        raise RuntimeError("Неверный пароль почты отправителя. Проверьте UDS_SMTP_PASSWORD.")
    raise RuntimeError(f"Не удалось подключиться к почтовому серверу: {last_err or 'соединение закрыто'}")


# ── Журнал согласий (доказательная база) ────────────────────────────────────

def get_client_ip(event: dict, headers: dict) -> str:
    """Извлекает IP клиента из заголовков / requestContext."""
    xff = headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()[:64]
    ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp")
    return (ip or "")[:64]


def record_consent(cur, *, user_id, login, full_name, email, phone, context,
                   consent: dict, ip: str, user_agent: str, institution_id=None):
    """Записывает факт согласия пользователя с документами в журнал."""
    consent = consent or {}
    cur.execute(
        f"""INSERT INTO {SCHEMA}.user_consents
            (user_id, login, full_name, email, phone, context, documents,
             app_version, privacy_revision, oferta_revision, documents_hash,
             ip_address, user_agent, institution_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            user_id, (login or "")[:64], (full_name or "")[:256],
            (email or "")[:256] or None, (phone or "")[:32] or None,
            (context or "registration")[:64],
            (consent.get("documents") or "oferta,privacy")[:64],
            (consent.get("app_version") or "")[:32] or None,
            (consent.get("privacy_revision") or "")[:32] or None,
            (consent.get("oferta_revision") or "")[:32] or None,
            (consent.get("documents_hash") or "")[:64] or None,
            ip or None, (user_agent or "")[:2000] or None,
            institution_id,
        ),
    )


def handler(event: dict, context) -> dict:
    """Авторизация, регистрация, управление пользователями и подписками САОУ."""
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
        school = (body.get("school") or "САОУ").strip()
        study_group = (body.get("study_group") or "").strip()[:64]
        site_url = (body.get("site_url") or "").strip()
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
            reg_ip = get_client_ip(event, headers)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, first_name, last_name, email, school, role,
                     created_by, subscription_status, study_group, email_confirmed, registration_ip)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'self', 'none', %s, FALSE, %s) RETURNING id""",
                (login, pw_hash, full_name, first_name, last_name, email, school, role,
                 study_group or None, reg_ip or None)
            )
            user_id = cur.fetchone()[0]
            # Фиксируем согласие с офертой и политикой (доказательная база)
            record_consent(
                cur, user_id=user_id, login=login, full_name=full_name,
                email=email, phone=None,
                context=(body.get("consent") or {}).get("context") or "registration",
                consent=body.get("consent") or {},
                ip=reg_ip,
                user_agent=headers.get("user-agent", ""),
            )
            code, verify_token = issue_email_code(cur, login)
            try:
                send_confirmation_email(email, code, verify_token, site_url)
            except Exception as e:
                conn.rollback()
                return _resp(500, {"error": f"Не удалось отправить код на email: {e}"})
            conn.commit()
            return _resp(200, {
                "success": True, "need_confirmation": True, "login": login,
                "email": email, "role": role,
            })
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": "Логин или email уже заняты"})
        finally:
            conn.close()

    # ── POST confirm-email — подтвердить код и получить рабочий токен ───────
    if method == "POST" and route == "confirm-email":
        login = (body.get("login") or "").strip()
        code = (body.get("code") or "").strip()
        if not login or not code:
            return _resp(400, {"error": "Укажите login и код"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            result = verify_email_code(cur, login, code)
            if result == "expired":
                conn.commit()
                return _resp(400, {"error": "Код истёк. Запросите новый."})
            if result == "limit":
                conn.commit()
                return _resp(429, {"error": "Превышено число попыток. Запросите новый код."})
            if result == "wrong":
                conn.commit()
                return _resp(400, {"error": "Неверный код. Попробуйте ещё раз."})

            resp = _finish_email_confirmation(cur, login)
            conn.commit()
            return resp
        finally:
            conn.close()

    # ── POST confirm-email-link — подтвердить по токену из ссылки в письме ──
    if method == "POST" and route == "confirm-email-link":
        token = (body.get("token") or "").strip()
        if not token:
            return _resp(400, {"error": "Укажите token"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            login = verify_email_token(cur, token)
            if not login:
                conn.commit()
                return _resp(400, {"error": "Ссылка недействительна или устарела. Запросите новый код/ссылку."})

            resp = _finish_email_confirmation(cur, login)
            conn.commit()
            return resp
        finally:
            conn.close()

    # ── POST resend-email-code — повторно отправить код подтверждения ───────
    if method == "POST" and route == "resend-email-code":
        login = (body.get("login") or "").strip()
        site_url = (body.get("site_url") or "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT email, email_confirmed FROM {SCHEMA}.users WHERE login = %s", (login,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            email, confirmed = row
            if confirmed:
                return _resp(400, {"error": "Email уже подтверждён"})
            code, verify_token = issue_email_code(cur, login)
            try:
                send_confirmation_email(email, code, verify_token, site_url)
            except Exception as e:
                conn.rollback()
                return _resp(500, {"error": f"Не удалось отправить email: {e}"})
            conn.commit()
            return _resp(200, {"ok": True, "hint": f"Код отправлен на {email[:3]}***"})
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
                "full_name": "Администратор САОУ", "school": "САОУ",
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
                          trial_until, trial_ai_calls_today, trial_ai_date, ai_balance_kopecks, email_confirmed
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
             sub_status, sub_until, trial_until, trial_ai_calls_today, trial_ai_date, ai_balance_kopecks,
             email_confirmed) = row

            if not is_active:
                return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь к администратору."})

            if not email_confirmed:
                return _resp(403, {"error": "Email не подтверждён. Проверьте почту и введите код из письма.",
                                    "need_confirmation": True, "login": login})

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
        device_fp = (body.get("device_fingerprint") or "").strip()[:128]
        if not login:
            return _resp(400, {"error": "Укажите login"})
        client_ip = get_client_ip(event, headers)
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

            # Trial уже был активирован этим аккаунтом
            if trial_until is not None:
                return _resp(400, {"error": "Пробный период уже был использован"})

            # Пробный период — не более одного раза на IP-адрес и на устройство,
            # даже если создать новый аккаунт с другим email.
            if client_ip:
                cur.execute(
                    f"SELECT login FROM {SCHEMA}.trial_usage WHERE ip_address = %s",
                    (client_ip,)
                )
                if cur.fetchone():
                    return _resp(403, {"error": "С этого IP-адреса пробный период уже активировался ранее"})
            if device_fp:
                cur.execute(
                    f"SELECT login FROM {SCHEMA}.trial_usage WHERE device_fingerprint = %s",
                    (device_fp,)
                )
                if cur.fetchone():
                    return _resp(403, {"error": "На этом устройстве пробный период уже активировался ранее"})

            new_trial_until = now + timedelta(days=TRIAL_DAYS)
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                    SET trial_until = %s, trial_ai_calls_today = 0, trial_ai_date = NULL
                    WHERE login = %s""",
                (new_trial_until, login)
            )
            try:
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.trial_usage (ip_address, device_fingerprint, login)
                        VALUES (%s, %s, %s)""",
                    (client_ip or None, device_fp or None, login)
                )
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return _resp(403, {"error": "Пробный период с этого IP-адреса или устройства уже был использован"})
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
        school = body.get("school", "САОУ").strip()
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
                           trial_until, trial_ai_calls_today, trial_ai_date, last_seen_at,
                           registration_ip, email_confirmed
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
                    "registration_ip": r[17],
                    "email_confirmed": r[18],
                    **sub,
                })
            return _resp(200, {"users": users})
        finally:
            conn.close()

    # ── GET ip-stats (admin) — регистрации, сгруппированные по IP-адресу ────
    if method == "GET" and route == "ip-stats":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            # IP-адреса, с которых зарегистрировано больше одного аккаунта
            cur.execute(
                f"""SELECT registration_ip, COUNT(*) AS cnt,
                           ARRAY_AGG(login ORDER BY created_at) AS logins,
                           MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
                    FROM {SCHEMA}.users
                    WHERE registration_ip IS NOT NULL AND registration_ip != ''
                    GROUP BY registration_ip
                    HAVING COUNT(*) > 1
                    ORDER BY cnt DESC, last_seen DESC
                    LIMIT 200"""
            )
            rows = cur.fetchall()
            suspicious_ips = [{
                "ip_address": r[0], "accounts_count": r[1], "logins": r[2],
                "first_seen": r[3].isoformat() if r[3] else None,
                "last_seen": r[4].isoformat() if r[4] else None,
            } for r in rows]

            # Использования пробного периода — сколько раз данный IP/устройство пытались
            cur.execute(
                f"""SELECT ip_address, device_fingerprint, login, created_at
                    FROM {SCHEMA}.trial_usage ORDER BY created_at DESC LIMIT 500"""
            )
            trial_rows = cur.fetchall()
            trial_usage = [{
                "ip_address": r[0], "device_fingerprint": r[1], "login": r[2],
                "created_at": r[3].isoformat() if r[3] else None,
            } for r in trial_rows]

            cur.execute(f"SELECT COUNT(DISTINCT registration_ip) FROM {SCHEMA}.users WHERE registration_ip IS NOT NULL AND registration_ip != ''")
            unique_ips = cur.fetchone()[0] or 0
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
            total_users = cur.fetchone()[0] or 0

            return _resp(200, {
                "suspicious_ips": suspicious_ips,
                "trial_usage": trial_usage,
                "unique_ips": unique_ips,
                "total_users": total_users,
            })
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
        plan = (body.get("plan") or "САОУ").strip()
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

    # ── POST precheck-ai — проверка возможности использовать ИИ ДО генерации ──
    # Не списывает баланс. Возвращает allowed:false с 402/403, если денег нет
    # или нет подписки. Используется всеми ИИ-функциями (в т.ч. чатом), чтобы
    # заранее предусмотреть расход и не тратить впустую вызов ИИ.
    if method == "POST" and route in ("precheck-ai", "precheck_ai"):
        login = (body.get("login") or "").strip()
        # Ориентировочная стоимость запроса в токенах (для оценки достаточности).
        try:
            est_tokens = int(body.get("est_tokens") or 0)
        except (TypeError, ValueError):
            est_tokens = 0
        if not login:
            return _resp(400, {"error": "Укажите login"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT ai_balance_kopecks, role, subscription_until FROM {SCHEMA}.users WHERE login = %s",
                (login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"allowed": False, "error": "Пользователь не найден"})
            balance_kop, role, sub_until = row[0] or 0, row[1], row[2]
            now = datetime.utcnow()
            balance_rub = round(balance_kop / 100, 2)
            # admin и tester — ИИ бесплатно
            if role in ("tester", "admin"):
                return _resp(200, {"allowed": True, "free": True, "balance_rub": balance_rub})
            # Без активной подписки — ИИ заблокирован
            has_sub = sub_until and isinstance(sub_until, datetime) and sub_until > now
            if not has_sub:
                return _resp(403, {"allowed": False, "balance_rub": balance_rub,
                                   "error": "Для использования ИИ необходима активная подписка."})
            # Предусматриваем расход: нужен хотя бы минимальный положительный баланс,
            # а если ИИ оценил размер запроса — проверяем достаточность заранее.
            AI_MARKUP = 1.40
            est_kop = max(round(est_tokens * 0.2 * AI_MARKUP), 0) if est_tokens > 0 else 1
            if balance_kop <= 0 or balance_kop < est_kop:
                need_rub = round(max(est_kop, 1) / 100, 2)
                return _resp(402, {"allowed": False, "balance_rub": balance_rub,
                                   "error": f"Недостаточно средств для ИИ. Баланс: {balance_rub} ₽" +
                                            (f", нужно ~{need_rub} ₽" if est_tokens > 0 else "") +
                                            ". Пополните баланс в личном кабинете."})
            return _resp(200, {"allowed": True, "balance_rub": balance_rub})
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