"""
УДС — Управление Движения Системы. Сотрудники, роли, регистрация, аудит-лог, MFA.

Действия (?action=...), X-Authorization: токен пользователя, login в body/qs:

  GET  ?action=me              — кто я (панельная роль, права, uds_registered)
  GET  ?action=employees       — список сотрудников УДС
  GET  ?action=employee&target_login=  — карточка сотрудника + лог действий
  POST ?action=register-employee — зарегистрировать сотрудника (ФИО, email, phone, role)
  POST ?action=send-email-code  — отправить 6-значный код подтверждения на email
  POST ?action=verify-email-code — проверить 6-значный email-код
  POST ?action=send-sms-code    — отправить 4-значный код входа (email/SMS МФА)
  POST ?action=verify-sms-code  — проверить 4-значный код и получить токен сессии
  POST ?action=set-role        — изменить панельную роль {target_login, panel_role}
  POST ?action=block           — заблокировать/разблокировать {target_login, blocked}
  GET  ?action=audit-log&target_login=  — логи действий (по сотруднику или все)
  GET  ?action=users           — пользователи (поиск ?q=, привязка)
  GET  ?action=user&target_login=  — карточка пользователя
"""
import json
import os
import re
import random
import hashlib
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin2026")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

PANEL_ROLE_RANK = {
    "operator": 1, "advisor": 2, "tester_role": 3,
    "developer": 4, "deputy": 5, "head": 6,
}
PANEL_ROLE_LABELS = {
    "head": "Глава Правления", "deputy": "Зам. Главы Правления",
    "developer": "Разработчик", "tester_role": "Тестер",
    "advisor": "Советник", "operator": "Оператор ТП",
}

# Кто какие роли может НАЗНАЧАТЬ
CAN_ASSIGN = {
    "advisor":   ["operator"],
    "developer": ["operator", "tester_role"],
    "deputy":    ["operator", "advisor", "tester_role", "developer"],
    "head":      ["operator", "advisor", "tester_role", "developer", "deputy", "head"],
}
# Кто может регистрировать сотрудников
CAN_REGISTER = {"advisor", "developer", "deputy", "head"}
# Кто может начислять токены
CAN_TOKENS = {"developer", "advisor", "deputy", "head"}
# Кто может менять Вид ЛК / Тех. работы (разработчик и выше)
CAN_LKVIEW = {"developer", "deputy", "head"}
# Кто может выпускать и отзывать сертификаты УДС (Глава и Зам Главы)
CAN_CERT = {"head", "deputy"}
# Код выпуска сертификата (вводит Глава/Зам при назначении)
CERT_ISSUE_CODE = os.environ.get("CERT_ISSUE_CODE", "di9u7")
# Срок действия сертификата — строго 11 месяцев
CERT_MONTHS = 11
# Подписку могут все панельные роли


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def translit(s: str) -> str:
    s = (s or '').strip().lower()
    out = [TRANSLIT.get(ch, ch if ch.isalnum() else '') for ch in s]
    return re.sub(r'[^a-z0-9]', '', ''.join(out))


def generate_login(first_name: str, last_name: str, cur) -> str:
    f = translit(last_name)
    i = translit(first_name)
    base = (f + (i[:1] if i else ''))[:28] or 'uds'
    candidate = base
    n = 1
    while True:
        cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        n += 1
        candidate = f"{base}{n}"


def gen_password(n=10) -> str:
    chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(n))


def gen_iis_code(cur) -> str:
    """5 символов: буквы+цифры, уникальный среди сотрудников."""
    alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(random.choice(alpha) for _ in range(5))
        cur.execute(f"SELECT 1 FROM {SCHEMA}.panel_operators WHERE iis_code = %s", (code,))
        if not cur.fetchone():
            return code


def next_operator_number(cur) -> int:
    cur.execute(f"SELECT COALESCE(MAX(operator_number), 0) + 1 FROM {SCHEMA}.panel_operators")
    return cur.fetchone()[0]


def get_caller(login: str, token: str, conn):
    """Возвращает данные вызывающего с учётом uds_registered. None если нет доступа."""
    if not login or not token:
        return None
    # Admin (Глава) — несъёмные права
    expected_admin = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
    if token == expected_admin or (login == "admin" and token.startswith("admin:")):
        return {"login": "admin", "panel_role": "head", "operator_number": 1,
                "is_panel": True, "is_admin": True, "uds_registered": True, "sys_role": "admin"}

    cur = conn.cursor()
    cur.execute(f"SELECT role, is_active, auth_token_hash FROM {SCHEMA}.users WHERE login = %s", (login,))
    row = cur.fetchone()
    if not row:
        return None
    sys_role, is_active, stored_hash = row
    if not is_active or not stored_hash or hash_password(token) != stored_hash:
        return None

    cur.execute(
        f"SELECT panel_role, operator_number, uds_registered FROM {SCHEMA}.panel_operators WHERE login = %s",
        (login,)
    )
    op = cur.fetchone()
    if sys_role == "admin":
        return {"login": login, "panel_role": "head", "operator_number": (op[1] if op else 1),
                "is_panel": True, "is_admin": True, "uds_registered": True, "sys_role": "admin"}
    if not op or not op[0] or op[0] == "removed":
        return {"login": login, "panel_role": None, "is_panel": False,
                "uds_registered": False, "sys_role": sys_role}
    return {
        "login": login, "panel_role": op[0], "operator_number": op[1],
        "is_panel": True, "is_admin": False,
        "uds_registered": bool(op[2]), "sys_role": sys_role,
    }


def has_uds_access(caller) -> bool:
    """Доступ в УДС: панельная роль + регистрация через УДС (или admin)."""
    return bool(caller and caller.get("is_panel") and (caller.get("is_admin") or caller.get("uds_registered")))


def perms_for(role: str) -> dict:
    return {
        "can_register": role in CAN_REGISTER,
        "can_assign_roles": CAN_ASSIGN.get(role, []),
        "can_tokens": role in CAN_TOKENS,
        "can_lkview": role in CAN_LKVIEW,
        "can_maintenance": role in CAN_LKVIEW,
        "can_subscription": True,         # подписку пользователю могут все
        "can_support": True,              # тех. поддержка у всех
        "can_block": PANEL_ROLE_RANK.get(role, 0) >= 5,   # блокировка СОТРУДНИКОВ — зам/глава
        "can_block_user": True,           # блокировка/смена пароля ПОЛЬЗОВАТЕЛЕЙ — все
        "can_cert": role in CAN_CERT,     # выпуск/отзыв сертификатов — Глава и Зам
    }


def log_action(cur, actor_login, actor_role, action, target_login=None, details=None):
    cur.execute(
        f"""INSERT INTO {SCHEMA}.uds_audit_log (actor_login, actor_role, action, target_login, details)
            VALUES (%s, %s, %s, %s, %s)""",
        (actor_login, actor_role, action, target_login,
         json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else (details or None))
    )


# ── OTP helpers ──────────────────────────────────────────────────────────────

def gen_otp(length: int) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def otp_issue(cur, login: str, purpose: str, length: int, ttl_min: int = 10) -> str:
    """Инвалидирует старые OTP и создаёт новый. Возвращает код."""
    cur.execute(
        f"UPDATE {SCHEMA}.uds_otp_codes SET used=TRUE WHERE login=%s AND purpose=%s AND used=FALSE",
        (login, purpose)
    )
    code = gen_otp(length)
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_min)
    cur.execute(
        f"""INSERT INTO {SCHEMA}.uds_otp_codes (login, purpose, code, expires_at)
            VALUES (%s, %s, %s, %s)""",
        (login, purpose, code, expires)
    )
    return code


def otp_verify(cur, login: str, purpose: str, code: str) -> str:
    """Проверяет OTP. Возвращает 'ok', 'wrong', 'expired', 'limit'."""
    cur.execute(
        f"""SELECT id, code, expires_at, attempts FROM {SCHEMA}.uds_otp_codes
            WHERE login=%s AND purpose=%s AND used=FALSE
            ORDER BY created_at DESC LIMIT 1""",
        (login, purpose)
    )
    row = cur.fetchone()
    if not row:
        return "expired"
    otp_id, stored_code, expires_at, attempts = row
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        cur.execute(f"UPDATE {SCHEMA}.uds_otp_codes SET used=TRUE WHERE id=%s", (otp_id,))
        return "expired"
    if attempts >= 5:
        return "limit"
    if code.strip() != stored_code:
        cur.execute(f"UPDATE {SCHEMA}.uds_otp_codes SET attempts=attempts+1 WHERE id=%s", (otp_id,))
        return "wrong"
    cur.execute(f"UPDATE {SCHEMA}.uds_otp_codes SET used=TRUE WHERE id=%s", (otp_id,))
    return "ok"


def send_email_otp(to_email: str, code: str, purpose: str) -> None:
    """Отправляет OTP-код на email через SMTP."""
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_host or not smtp_user:
        raise RuntimeError("SMTP не настроен")

    if purpose == "email_verify":
        subject = "УДС САОУ — подтверждение email"
        body = (
            f"Ваш код подтверждения email для регистрации в УДС САОУ:\n\n"
            f"  {code}\n\n"
            f"Код действует 10 минут. Не сообщайте его никому."
        )
    else:
        subject = "УДС САОУ — код входа"
        body = (
            f"Ваш код для входа в УДС САОУ:\n\n"
            f"  {code}\n\n"
            f"Код действует 5 минут. Не сообщайте его никому.\n"
            f"Если вы не входили в систему — немедленно сообщите Главе Правления."
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if smtp_port == 465:
        import ssl
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx) as s:
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.starttls()
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, [to_email], msg.as_string())


# ── Мини-УЦ "Управление УДС САОУ" ──────────────────────────────────────────────
CA_SUBJECT_CN = 'Управление УДС "САОУ"'


def get_or_create_ca(cur):
    """Возвращает (ca_cert, ca_key) корневого УЦ. Создаёт при первом обращении."""
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    cur.execute(f"SELECT private_key_pem, certificate_pem FROM {SCHEMA}.uds_ca WHERE id = 1")
    row = cur.fetchone()
    if row:
        key = serialization.load_pem_private_key(row[0].encode(), password=None)
        cert = x509.load_pem_x509_certificate(row[1].encode())
        return cert, key

    # Генерируем корневой УЦ один раз
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, CA_SUBJECT_CN),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'САОУ'),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, 'УДС'),
    ])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.KeyUsage(digital_signature=True, key_cert_sign=True, crl_sign=True,
                                     content_commitment=False, key_encipherment=False,
                                     data_encipherment=False, key_agreement=False,
                                     encipher_only=False, decipher_only=False), critical=True)
        .sign(key, hashes.SHA256())
    )
    key_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    cur.execute(
        f"INSERT INTO {SCHEMA}.uds_ca (id, private_key_pem, certificate_pem) VALUES (1, %s, %s) ON CONFLICT (id) DO NOTHING",
        (key_pem, cert_pem)
    )
    return cert, key


def sign_user_csr(cur, csr_pem: str, full_name: str):
    """Подписывает PKCS#10 CSR от плагина. Возвращает (cert_pem, serial_hex, fingerprint, not_before, not_after)."""
    from cryptography import x509
    from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
    from cryptography.hazmat.primitives import hashes, serialization

    csr = x509.load_pem_x509_csr(csr_pem.encode())
    if not csr.is_signature_valid:
        raise ValueError("Подпись CSR недействительна")

    ca_cert, ca_key = get_or_create_ca(cur)
    now = datetime.now(timezone.utc)
    # Строго 11 месяцев (≈ 11 * 30 дней)
    not_after = now + timedelta(days=CERT_MONTHS * 30)

    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, full_name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'САОУ'),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, 'УДС'),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(csr.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(not_after)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=True,
                                     key_encipherment=False, data_encipherment=False,
                                     key_agreement=False, key_cert_sign=False, crl_sign=False,
                                     encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    serial_hex = format(cert.serial_number, 'x')
    fingerprint = cert.fingerprint(hashes.SHA256()).hex()
    return cert_pem, serial_hex, fingerprint, cert.not_valid_before_utc, cert.not_valid_after_utc


def handler(event: dict, context) -> dict:
    """УДС: сотрудники, роли, регистрация, аудит-лог."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            pass

    login = (body.get("login") or qs.get("login") or "").strip()
    token = (headers.get("x-authorization") or headers.get("authorization") or "").strip()

    conn = get_conn()
    try:
        # ── send-email-code — отправить 6-значный код на email (регистрация) ──
        if action == "send-email-code" and method == "POST":
            target_email = (body.get("email") or "").strip().lower()
            reg_login = (body.get("login") or "").strip()
            if not target_email:
                return _resp(400, {"error": "Укажите email"})
            cur = conn.cursor()
            # Ищем email в users или panel_operators
            if reg_login:
                cur.execute(
                    f"SELECT email FROM {SCHEMA}.users WHERE login=%s", (reg_login,)
                )
                row = cur.fetchone()
                to_email = (row[0] if row else None) or target_email
            else:
                to_email = target_email
            code = otp_issue(cur, reg_login or target_email, "email_verify", 6, ttl_min=10)
            conn.commit()
            try:
                send_email_otp(to_email, code, "email_verify")
            except Exception as e:
                return _resp(500, {"error": f"Не удалось отправить email: {e}"})
            return _resp(200, {"ok": True, "hint": f"Код отправлен на {to_email[:4]}***"})

        # ── verify-email-code — подтвердить 6-значный email-код ─────────────
        if action == "verify-email-code" and method == "POST":
            reg_login = (body.get("login") or "").strip()
            target_email = (body.get("email") or "").strip().lower()
            code = (body.get("code") or "").strip()
            key = reg_login or target_email
            if not key or not code:
                return _resp(400, {"error": "Укажите логин/email и код"})
            cur = conn.cursor()
            result = otp_verify(cur, key, "email_verify", code)
            conn.commit()
            if result == "ok":
                return _resp(200, {"ok": True})
            if result == "expired":
                return _resp(400, {"error": "Код истёк. Запросите новый."})
            if result == "limit":
                return _resp(429, {"error": "Превышено число попыток. Запросите новый код."})
            return _resp(400, {"error": "Неверный код. Попробуйте ещё раз."})

        # ── send-sms-code — отправить 4-значный код для входа ───────────────
        # (логин + пароль + iis_code уже проверены — это финальный шаг MFA)
        if action == "send-sms-code" and method == "POST":
            in_login = (body.get("login") or "").strip()
            password = (body.get("password") or "").strip()
            iis_code = (body.get("iis_code") or "").strip().upper()
            if not in_login or not password:
                return _resp(400, {"error": "Укажите логин и пароль"})
            cur = conn.cursor()
            # Проверяем логин/пароль (без выдачи токена)
            admin_iis = os.environ.get("ADMIN_IIS_CODE", "ADMIN")
            if in_login == "admin" and password == ADMIN_PASSWORD:
                if iis_code and iis_code != admin_iis.upper():
                    return _resp(403, {"error": "Неверный код ИИС"})
                # Для admin — фиксированный код 2535, отправка не нужна
                return _resp(200, {"ok": True, "hint": "Введите постоянный код администратора"})
            cur.execute(
                f"SELECT password_hash, role, is_active, email, phone FROM {SCHEMA}.users WHERE login=%s",
                (in_login,)
            )
            row = cur.fetchone()
            if not row or not row[2] or row[0] != hash_password(password):
                return _resp(401, {"error": "Неверный логин или пароль"})
            cur.execute(
                f"SELECT panel_role, uds_registered, iis_code, email FROM {SCHEMA}.panel_operators WHERE login=%s",
                (in_login,)
            )
            op = cur.fetchone()
            if not op or not op[0] or op[0] == "removed" or not op[1]:
                return _resp(403, {"error": "У вас нет доступа в УДС"})
            if iis_code and (op[2] or "").upper() != iis_code:
                return _resp(403, {"error": "Код ИИС не соответствует сотруднику"})
            # Берём email из panel_operators или users
            to_email = op[3] or row[3]
            if not to_email:
                return _resp(400, {"error": "У сотрудника не указан email для отправки кода. Обратитесь к Главе Правления."})
            code = otp_issue(cur, in_login, "sms_login", 4, ttl_min=5)
            conn.commit()
            try:
                send_email_otp(to_email, code, "sms_login")
            except Exception as e:
                return _resp(500, {"error": f"Не удалось отправить код: {e}"})
            masked = to_email[:3] + "***@" + to_email.split("@")[-1] if "@" in to_email else "***"
            return _resp(200, {"ok": True, "hint": f"Код отправлен на {masked}"})

        # ── verify-sms-code — 4-значный код МФА → выдаём токен сессии ───────
        if action == "verify-sms-code" and method == "POST":
            in_login = (body.get("login") or "").strip()
            password = (body.get("password") or "").strip()
            iis_code = (body.get("iis_code") or "").strip().upper()
            code = (body.get("code") or "").strip()
            if not in_login or not code:
                return _resp(400, {"error": "Укажите логин и код"})
            cur = conn.cursor()
            # admin — фиксированный код 2535
            if in_login == "admin":
                if code != "2535":
                    return _resp(400, {"error": "Неверный код."})
                admin_token = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
                return _resp(200, {"ok": True, "login": "admin", "token": admin_token,
                                   "panel_role": "head",
                                   "panel_role_label": PANEL_ROLE_LABELS["head"],
                                   "operator_number": 1,
                                   "perms": perms_for("head")})
            # обычный сотрудник
            result = otp_verify(cur, in_login, "sms_login", code)
            if result != "ok":
                conn.commit()
                if result == "expired":
                    return _resp(400, {"error": "Код истёк. Запросите новый."})
                if result == "limit":
                    return _resp(429, {"error": "Превышено число попыток. Запросите новый код."})
                return _resp(400, {"error": "Неверный код. Попробуйте ещё раз."})
            # Всё ок — проверяем ещё раз пароль и выдаём токен
            cur.execute(
                f"SELECT password_hash, role, is_active FROM {SCHEMA}.users WHERE login=%s", (in_login,)
            )
            row = cur.fetchone()
            if not row or not row[2] or row[0] != hash_password(password):
                conn.commit()
                return _resp(401, {"error": "Ошибка аутентификации"})
            sys_role = row[1]
            cur.execute(
                f"SELECT panel_role, operator_number, uds_registered, iis_code FROM {SCHEMA}.panel_operators WHERE login=%s",
                (in_login,)
            )
            op = cur.fetchone()
            if not op or not op[0] or op[0] == "removed" or not op[2]:
                conn.commit()
                return _resp(403, {"error": "У вас нет доступа в УДС"})
            if iis_code and (op[3] or "").upper() != iis_code:
                conn.commit()
                return _resp(403, {"error": "Код ИИС не соответствует"})
            prefix = sys_role if sys_role in ("teacher", "student", "tester") else "teacher"
            new_token = f"{prefix}:{hash_password(in_login + password + 'salt')}"
            cur.execute(
                f"UPDATE {SCHEMA}.users SET last_seen_at=NOW(), auth_token_hash=%s WHERE login=%s",
                (hash_password(new_token), in_login)
            )
            conn.commit()
            p_role = op[0]
            return _resp(200, {
                "ok": True, "login": in_login, "token": new_token,
                "panel_role": p_role,
                "panel_role_label": PANEL_ROLE_LABELS.get(p_role, p_role),
                "operator_number": op[1],
                "perms": perms_for(p_role),
            })

        # ── verify-iis — 1-й шаг входа: проверка кода ИИС ────────────────────
        if action == "verify-iis" and method == "POST":
            code = (body.get("iis_code") or "").strip().upper()
            if not code:
                return _resp(400, {"error": "Введите код ИИС"})
            # Спец-код для админа (Главы)
            admin_iis = os.environ.get("ADMIN_IIS_CODE", "ADMIN")
            if code == admin_iis.upper():
                return _resp(200, {"ok": True})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT 1 FROM {SCHEMA}.panel_operators
                    WHERE UPPER(iis_code) = %s AND panel_role IS NOT NULL AND panel_role != 'removed'
                      AND uds_registered = TRUE""",
                (code,)
            )
            if not cur.fetchone():
                return _resp(403, {"error": "Код ИИС не найден или сотрудник не зарегистрирован"})
            return _resp(200, {"ok": True})

        # ── uds-login — 2-й шаг: логин + пароль (после кода ИИС) ─────────────
        if action == "uds-login" and method == "POST":
            in_login = (body.get("login") or "").strip()
            password = (body.get("password") or "").strip()
            iis_code = (body.get("iis_code") or "").strip().upper()
            if not in_login or not password:
                return _resp(400, {"error": "Укажите логин и пароль"})
            if not iis_code:
                return _resp(400, {"error": "Сначала введите код ИИС"})
            cur = conn.cursor()
            admin_iis = os.environ.get("ADMIN_IIS_CODE", "ADMIN")
            if in_login == "admin" and password == ADMIN_PASSWORD:
                if iis_code != admin_iis.upper():
                    return _resp(403, {"error": "Неверный код ИИС"})
                admin_token = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
                return _resp(200, {"ok": True, "login": "admin", "token": admin_token,
                                   "panel_role": "head",
                                   "panel_role_label": PANEL_ROLE_LABELS["head"],
                                   "operator_number": 1,
                                   "perms": perms_for("head")})
            cur.execute(
                f"SELECT password_hash, role, is_active FROM {SCHEMA}.users WHERE login = %s",
                (in_login,)
            )
            row = cur.fetchone()
            if not row or not row[2] or row[0] != hash_password(password):
                return _resp(401, {"error": "Неверный логин или пароль"})
            sys_role = row[1]
            cur.execute(
                f"SELECT panel_role, operator_number, uds_registered, iis_code FROM {SCHEMA}.panel_operators WHERE login = %s",
                (in_login,)
            )
            op = cur.fetchone()
            is_admin_role = (sys_role == "admin")
            if not is_admin_role:
                if not op or not op[0] or op[0] == "removed":
                    return _resp(403, {"error": "У вас нет роли в УДС"})
                if not op[2]:
                    return _resp(403, {"error": "Доступ закрыт. Сотрудник не зарегистрирован через УДС."})
                # Код ИИС должен совпадать с кодом этого сотрудника
                if (op[3] or "").upper() != iis_code:
                    return _resp(403, {"error": "Код ИИС не соответствует сотруднику"})
            prefix = sys_role if sys_role in ("teacher", "student", "tester") else "teacher"
            new_token = f"{prefix}:{hash_password(in_login + password + 'salt')}"
            cur.execute(
                f"UPDATE {SCHEMA}.users SET last_seen_at = NOW(), auth_token_hash = %s WHERE login = %s",
                (hash_password(new_token), in_login)
            )
            conn.commit()
            p_role = "head" if is_admin_role else op[0]
            return _resp(200, {
                "ok": True, "login": in_login, "token": new_token,
                "panel_role": p_role,
                "panel_role_label": PANEL_ROLE_LABELS.get(p_role, p_role),
                "operator_number": (op[1] if op else 1),
                "perms": perms_for(p_role),
            })

        # ── cert-challenge — выдать nonce для входа по сертификату ────────────
        if action == "cert-challenge" and method == "POST":
            nonce = hashlib.sha256(os.urandom(32)).hexdigest()
            return _resp(200, {"nonce": nonce})

        # ── cert-login — вход по сертификату (подпись nonce ключом токена) ───
        if action == "cert-login" and method == "POST":
            fingerprint = (body.get("fingerprint") or "").strip().lower()
            nonce = (body.get("nonce") or "").strip()
            signature_b64 = (body.get("signature") or "").strip()
            if not fingerprint or not nonce or not signature_b64:
                return _resp(400, {"error": "Недостаточно данных для входа по сертификату"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT c.login, c.certificate_pem, c.not_after, u.role, u.is_active
                    FROM {SCHEMA}.uds_certificates c
                    JOIN {SCHEMA}.users u ON u.login = c.login
                    WHERE LOWER(c.fingerprint) = %s AND c.status = 'active'""",
                (fingerprint,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(403, {"error": "Сертификат не найден или отозван"})
            cert_login, cert_pem, not_after, sys_role, is_active = row
            if not is_active:
                return _resp(403, {"error": "Сотрудник заблокирован"})
            if not_after:
                na = not_after if not_after.tzinfo else not_after.replace(tzinfo=timezone.utc)
                if na < datetime.now(timezone.utc):
                    return _resp(403, {"error": "Срок действия сертификата истёк"})
            # Проверяем подпись nonce открытым ключом из сертификата
            import base64
            from cryptography import x509
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding, ec
            try:
                cert = x509.load_pem_x509_certificate(cert_pem.encode())
                pub = cert.public_key()
                sig = base64.b64decode(signature_b64)
                if hasattr(pub, "verify"):
                    try:
                        pub.verify(sig, nonce.encode(), padding.PKCS1v15(), hashes.SHA256())
                    except TypeError:
                        pub.verify(sig, nonce.encode(), ec.ECDSA(hashes.SHA256()))
            except Exception:
                return _resp(403, {"error": "Подпись недействительна"})

            cur.execute(
                f"SELECT panel_role, operator_number, uds_registered FROM {SCHEMA}.panel_operators WHERE login = %s",
                (cert_login,)
            )
            op = cur.fetchone()
            is_admin_role = (sys_role == "admin")
            if not is_admin_role and (not op or not op[0] or op[0] == "removed" or not op[2]):
                return _resp(403, {"error": "Нет доступа к УДС"})
            prefix = sys_role if sys_role in ("teacher", "student", "tester") else "teacher"
            cur.execute(f"SELECT password_hash FROM {SCHEMA}.users WHERE login = %s", (cert_login,))
            pwh = cur.fetchone()[0]
            new_token = f"{prefix}:{hash_password(cert_login + pwh[:16] + 'certsalt')}"
            cur.execute(
                f"UPDATE {SCHEMA}.users SET last_seen_at = NOW(), auth_token_hash = %s WHERE login = %s",
                (hash_password(new_token), cert_login)
            )
            log_action(cur, cert_login, op[0] if op else "head", "cert_login", cert_login, None)
            conn.commit()
            p_role = "head" if is_admin_role else op[0]
            return _resp(200, {
                "ok": True, "login": cert_login, "token": new_token,
                "panel_role": p_role,
                "panel_role_label": PANEL_ROLE_LABELS.get(p_role, p_role),
                "operator_number": (op[1] if op else 1),
                "perms": perms_for(p_role),
            })

        caller = get_caller(login, token, conn)

        # ── me — статус доступа и права ──────────────────────────────────────
        if action == "me":
            if not caller:
                return _resp(401, {"error": "Не авторизованы"})
            role = caller.get("panel_role")
            access = has_uds_access(caller)
            # Статус собственного сертификата (для полноэкранного выпуска в ЛК)
            my_cert = None
            if access:
                curc = conn.cursor()
                curc.execute(
                    f"""SELECT status, container_type, serial_number, not_after, assigned_by, assigned_at
                        FROM {SCHEMA}.uds_certificates
                        WHERE login = %s AND status IN ('assigned','issuing','active')
                        ORDER BY assigned_at DESC LIMIT 1""",
                    (caller["login"],)
                )
                rc = curc.fetchone()
                if rc:
                    my_cert = {
                        "status": rc[0], "container_type": rc[1], "serial_number": rc[2],
                        "not_after": str(rc[3]) if rc[3] else None,
                        "assigned_by": rc[4], "assigned_at": str(rc[5]) if rc[5] else None,
                    }
            return _resp(200, {
                "login": caller["login"],
                "panel_role": role,
                "panel_role_label": PANEL_ROLE_LABELS.get(role, role) if role else None,
                "operator_number": caller.get("operator_number"),
                "is_panel": caller.get("is_panel", False),
                "uds_registered": caller.get("uds_registered", False),
                "uds_access": access,
                "perms": perms_for(role) if (access and role) else None,
                "my_cert": my_cert,
            })

        # ── update-profile — смена своего логина/пароля ──────────────────────
        if action == "update-profile" and method == "POST":
            if not has_uds_access(caller):
                return _resp(403, {"error": "Нет доступа к УДС"})
            if caller.get("is_admin"):
                return _resp(403, {"error": "Учётную запись администратора нельзя изменить"})
            cur_login = caller["login"]
            new_login = (body.get("new_login") or "").strip()
            new_password = (body.get("new_password") or "").strip()
            current_password = (body.get("current_password") or "").strip()

            if not new_login and not new_password:
                return _resp(400, {"error": "Укажите новый логин или пароль"})

            cur = conn.cursor()
            cur.execute(f"SELECT password_hash FROM {SCHEMA}.users WHERE login = %s", (cur_login,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            # Подтверждение текущим паролем
            if not current_password or row[0] != hash_password(current_password):
                return _resp(403, {"error": "Неверный текущий пароль"})

            final_login = cur_login
            if new_login and new_login != cur_login:
                if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", new_login):
                    return _resp(400, {"error": "Логин: 3-32 символа (латиница, цифры, . _ -)"})
                cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (new_login,))
                if cur.fetchone():
                    return _resp(409, {"error": "Этот логин уже занят"})
                final_login = new_login

            final_password_plain = new_password if new_password else current_password
            if new_password and len(new_password) < 6:
                return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

            new_pw_hash = hash_password(final_password_plain)
            prefix = caller.get("sys_role") if caller.get("sys_role") in ("teacher", "student", "tester") else "teacher"
            new_token = f"{prefix}:{hash_password(final_login + final_password_plain + 'salt')}"
            new_token_hash = hash_password(new_token)

            # Обновляем users (логин — в т.ч. в panel_operators по FK по значению)
            cur.execute(
                f"UPDATE {SCHEMA}.users SET login = %s, password_hash = %s, auth_token_hash = %s WHERE login = %s",
                (final_login, new_pw_hash, new_token_hash, cur_login)
            )
            if final_login != cur_login:
                cur.execute(
                    f"UPDATE {SCHEMA}.panel_operators SET login = %s WHERE login = %s",
                    (final_login, cur_login)
                )
            log_action(cur, final_login, caller.get("panel_role"), "update_profile", final_login,
                       {"login_changed": final_login != cur_login, "password_changed": bool(new_password)})
            conn.commit()
            return _resp(200, {"ok": True, "login": final_login, "token": new_token})

        # Все остальные действия требуют доступа в УДС
        if not has_uds_access(caller):
            return _resp(403, {"error": "Нет доступа к УДС. Сотрудник должен быть зарегистрирован через УДС."})

        my_role = caller["panel_role"]
        my_rank = PANEL_ROLE_RANK.get(my_role, 0)
        perms = perms_for(my_role)

        # ── employees — список сотрудников УДС ───────────────────────────────
        if action == "employees" and method == "GET":
            cur = conn.cursor()
            cur.execute(
                f"""SELECT po.login, po.panel_role, po.operator_number, po.assigned_by, po.assigned_at,
                           po.uds_registered, po.phone, po.email, po.iis_code,
                           u.full_name, u.is_active, u.last_seen_at
                    FROM {SCHEMA}.panel_operators po
                    LEFT JOIN {SCHEMA}.users u ON u.login = po.login
                    WHERE po.panel_role IS NOT NULL AND po.panel_role != 'removed'
                    ORDER BY po.operator_number"""
            )
            emps = []
            for r in cur.fetchall():
                emps.append({
                    "login": r[0], "panel_role": r[1],
                    "panel_role_label": PANEL_ROLE_LABELS.get(r[1], r[1]),
                    "operator_number": r[2], "assigned_by": r[3], "assigned_at": str(r[4]),
                    "uds_registered": bool(r[5]), "phone": r[6], "email": r[7], "iis_code": r[8],
                    "full_name": r[9] or r[0], "is_active": bool(r[10]) if r[10] is not None else True,
                    "last_seen_at": str(r[11]) if r[11] else None,
                })
            return _resp(200, {"employees": emps})

        # ── employee — карточка + лог ────────────────────────────────────────
        if action == "employee" and method == "GET":
            tl = (qs.get("target_login") or "").strip()
            cur = conn.cursor()
            cur.execute(
                f"""SELECT po.login, po.panel_role, po.operator_number, po.assigned_by, po.assigned_at,
                           po.uds_registered, po.phone, po.email, po.iis_code,
                           u.full_name, u.is_active, u.last_seen_at, u.created_at
                    FROM {SCHEMA}.panel_operators po
                    LEFT JOIN {SCHEMA}.users u ON u.login = po.login
                    WHERE po.login = %s""", (tl,)
            )
            r = cur.fetchone()
            if not r:
                return _resp(404, {"error": "Сотрудник не найден"})
            cur.execute(
                f"""SELECT actor_login, actor_role, action, target_login, details, created_at
                    FROM {SCHEMA}.uds_audit_log
                    WHERE actor_login = %s OR target_login = %s
                    ORDER BY created_at DESC LIMIT 200""", (tl, tl)
            )
            logs = [{"actor_login": x[0], "actor_role": x[1], "action": x[2],
                     "target_login": x[3], "details": x[4], "created_at": str(x[5])}
                    for x in cur.fetchall()]
            return _resp(200, {
                "employee": {
                    "login": r[0], "panel_role": r[1],
                    "panel_role_label": PANEL_ROLE_LABELS.get(r[1], r[1]),
                    "operator_number": r[2], "assigned_by": r[3], "assigned_at": str(r[4]),
                    "uds_registered": bool(r[5]), "phone": r[6], "email": r[7], "iis_code": r[8],
                    "full_name": r[9] or r[0],
                    "is_active": bool(r[10]) if r[10] is not None else True,
                    "last_seen_at": str(r[11]) if r[11] else None,
                    "created_at": str(r[12]) if r[12] else None,
                },
                "logs": logs,
            })

        # ── register-employee ────────────────────────────────────────────────
        if action == "register-employee" and method == "POST":
            if not perms["can_register"]:
                return _resp(403, {"error": "Нет прав регистрировать сотрудников"})
            first_name = (body.get("first_name") or "").strip()
            last_name = (body.get("last_name") or "").strip()
            middle_name = (body.get("middle_name") or "").strip()
            email = (body.get("email") or "").strip().lower()
            phone = (body.get("phone") or "").strip()[:32]
            panel_role = (body.get("panel_role") or "operator").strip()

            if not first_name or not last_name:
                return _resp(400, {"error": "Укажите имя и фамилию"})
            if panel_role not in PANEL_ROLE_RANK:
                return _resp(400, {"error": "Неверная роль"})
            if panel_role not in perms["can_assign_roles"]:
                return _resp(403, {"error": "Вы не можете назначить эту роль"})

            cur = conn.cursor()
            if email:
                cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(email) = %s", (email,))
                if cur.fetchone():
                    return _resp(409, {"error": "Этот email уже зарегистрирован"})

            full_name = " ".join(x for x in [last_name, first_name, middle_name] if x)
            new_login = generate_login(first_name, last_name, cur)
            new_password = gen_password()
            iis_code = gen_iis_code(cur)
            token_user = f"teacher:{hash_password(new_login + new_password + 'salt')}"
            token_hash = hash_password(token_user)

            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, first_name, last_name, email, phone,
                     iis_code, school, role, created_by, subscription_status, auth_token_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'УДС', 'teacher', %s, 'none', %s)
                    RETURNING id""",
                (new_login, hash_password(new_password), full_name, first_name, last_name,
                 email or None, phone or None, iis_code, caller["login"], token_hash)
            )
            op_num = next_operator_number(cur)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.panel_operators
                    (login, panel_role, operator_number, assigned_by, uds_registered, phone, email, iis_code)
                    VALUES (%s, %s, %s, %s, TRUE, %s, %s, %s)""",
                (new_login, panel_role, op_num, caller["login"], phone or None, email or None, iis_code)
            )
            log_action(cur, caller["login"], my_role, "register_employee", new_login,
                       {"panel_role": panel_role, "operator_number": op_num})
            conn.commit()
            return _resp(200, {
                "ok": True,
                "login": new_login,
                "password": new_password,
                "iis_code": iis_code,
                "operator_number": op_num,
                "full_name": full_name,
                "panel_role": panel_role,
            })

        # ── set-role — изменить панельную роль ───────────────────────────────
        if action == "set-role" and method == "POST":
            tl = (body.get("target_login") or "").strip()
            new_role = (body.get("panel_role") or "").strip()
            if not tl:
                return _resp(400, {"error": "Укажите сотрудника"})
            if new_role and new_role not in PANEL_ROLE_RANK:
                return _resp(400, {"error": "Неверная роль"})
            if new_role and new_role not in perms["can_assign_roles"]:
                return _resp(403, {"error": "Вы не можете назначить эту роль"})

            cur = conn.cursor()
            cur.execute(f"SELECT panel_role FROM {SCHEMA}.panel_operators WHERE login = %s", (tl,))
            ex = cur.fetchone()
            if ex and not caller.get("is_admin") and my_role != "head":
                if PANEL_ROLE_RANK.get(ex[0], 0) >= my_rank:
                    return _resp(403, {"error": "Нельзя изменить роль равного или вышестоящего"})

            if new_role == "":
                cur.execute(
                    f"UPDATE {SCHEMA}.panel_operators SET panel_role = 'removed', assigned_by = %s WHERE login = %s",
                    (caller["login"], tl)
                )
                log_action(cur, caller["login"], my_role, "remove_role", tl, None)
            elif ex:
                cur.execute(
                    f"""UPDATE {SCHEMA}.panel_operators
                        SET panel_role = %s, assigned_by = %s, assigned_at = NOW(), uds_registered = TRUE
                        WHERE login = %s""", (new_role, caller["login"], tl)
                )
                log_action(cur, caller["login"], my_role, "set_role", tl, {"panel_role": new_role})
            else:
                cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (tl,))
                if not cur.fetchone():
                    return _resp(404, {"error": "Пользователь не найден"})
                op_num = next_operator_number(cur)
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.panel_operators (login, panel_role, operator_number, assigned_by, uds_registered)
                        VALUES (%s, %s, %s, %s, TRUE)""", (tl, new_role, op_num, caller["login"])
                )
                log_action(cur, caller["login"], my_role, "set_role", tl, {"panel_role": new_role})
            conn.commit()
            return _resp(200, {"ok": True})

        # ── block — заблокировать/разблокировать сотрудника ──────────────────
        if action == "block" and method == "POST":
            if not perms["can_block"]:
                return _resp(403, {"error": "Нет прав блокировать сотрудников"})
            tl = (body.get("target_login") or "").strip()
            blocked = bool(body.get("blocked"))
            if not tl or tl == "admin":
                return _resp(400, {"error": "Недопустимый сотрудник"})
            cur = conn.cursor()
            cur.execute(f"SELECT panel_role FROM {SCHEMA}.panel_operators WHERE login = %s", (tl,))
            ex = cur.fetchone()
            if ex and not caller.get("is_admin") and my_role != "head":
                if PANEL_ROLE_RANK.get(ex[0], 0) >= my_rank:
                    return _resp(403, {"error": "Нельзя блокировать равного или вышестоящего"})
            cur.execute(f"UPDATE {SCHEMA}.users SET is_active = %s WHERE login = %s", (not blocked, tl))
            log_action(cur, caller["login"], my_role, "block" if blocked else "unblock", tl, None)
            conn.commit()
            return _resp(200, {"ok": True})

        # ── audit-log — логи действий ────────────────────────────────────────
        if action == "audit-log" and method == "GET":
            tl = (qs.get("target_login") or "").strip()
            cur = conn.cursor()
            if tl:
                cur.execute(
                    f"""SELECT actor_login, actor_role, action, target_login, details, created_at
                        FROM {SCHEMA}.uds_audit_log
                        WHERE actor_login = %s OR target_login = %s
                        ORDER BY created_at DESC LIMIT 300""", (tl, tl)
                )
            else:
                cur.execute(
                    f"""SELECT actor_login, actor_role, action, target_login, details, created_at
                        FROM {SCHEMA}.uds_audit_log ORDER BY created_at DESC LIMIT 300"""
                )
            logs = [{"actor_login": x[0], "actor_role": x[1], "action": x[2],
                     "target_login": x[3], "details": x[4], "created_at": str(x[5])}
                    for x in cur.fetchall()]
            return _resp(200, {"logs": logs})

        # ── users — список/поиск пользователей ───────────────────────────────
        if action == "users" and method == "GET":
            q = (qs.get("q") or "").strip().lower()
            cur = conn.cursor()
            base = f"""SELECT u.login, u.full_name, u.email, u.phone, u.role, u.is_active,
                              u.subscription_status, u.subscription_until, u.last_seen_at,
                              u.created_at, u.created_by, u.study_group,
                              po.panel_role, sc.bind_code
                       FROM {SCHEMA}.users u
                       LEFT JOIN {SCHEMA}.panel_operators po ON po.login = u.login AND po.panel_role != 'removed'
                       LEFT JOIN {SCHEMA}.student_codes sc ON sc.bound_login = u.login"""
            if q:
                like = f"%{q}%"
                cur.execute(base + """ WHERE LOWER(u.login) LIKE %s OR LOWER(u.full_name) LIKE %s
                                       OR LOWER(COALESCE(u.email,'')) LIKE %s OR COALESCE(u.phone,'') LIKE %s
                                       ORDER BY u.created_at DESC LIMIT 200""",
                            (like, like, like, like))
            else:
                cur.execute(base + " ORDER BY u.created_at DESC LIMIT 200")
            users = []
            for r in cur.fetchall():
                users.append({
                    "login": r[0], "full_name": r[1], "email": r[2], "phone": r[3],
                    "role": r[4], "is_active": bool(r[5]),
                    "subscription_status": r[6], "subscription_until": str(r[7]) if r[7] else None,
                    "last_seen_at": str(r[8]) if r[8] else None,
                    "created_at": str(r[9]) if r[9] else None, "created_by": r[10],
                    "study_group": r[11], "panel_role": r[12],
                    "bound": r[13] is not None, "bind_code": r[13],
                })
            return _resp(200, {"users": users})

        # ── user-detail — карточка пользователя + платежи + списания ──────────
        if action == "user-detail" and method == "GET":
            tl = (qs.get("target_login") or "").strip()
            if not tl:
                return _resp(400, {"error": "Укажите пользователя"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.login, u.full_name, u.first_name, u.last_name, u.email, u.phone,
                           u.role, u.is_active, u.school, u.study_group,
                           u.subscription_status, u.subscription_until, u.subscription_plan,
                           u.subscription_started_at, u.trial_until,
                           u.ai_balance_kopecks, u.last_seen_at, u.created_at, u.created_by,
                           u.institution_id, u.institution_position, u.subject,
                           po.panel_role, sc.bind_code, sc.full_name, sc.teacher_login
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.panel_operators po ON po.login = u.login AND po.panel_role != 'removed'
                    LEFT JOIN {SCHEMA}.student_codes sc ON sc.bound_login = u.login
                    WHERE u.login = %s""", (tl,)
            )
            r = cur.fetchone()
            if not r:
                return _resp(404, {"error": "Пользователь не найден"})
            user = {
                "login": r[0], "full_name": r[1], "first_name": r[2], "last_name": r[3],
                "email": r[4], "phone": r[5], "role": r[6], "is_active": bool(r[7]),
                "school": r[8], "study_group": r[9],
                "subscription_status": r[10], "subscription_until": str(r[11]) if r[11] else None,
                "subscription_plan": r[12], "subscription_started_at": str(r[13]) if r[13] else None,
                "trial_until": str(r[14]) if r[14] else None,
                "ai_balance_rub": round((r[15] or 0) / 100, 2),
                "last_seen_at": str(r[16]) if r[16] else None,
                "created_at": str(r[17]) if r[17] else None, "created_by": r[18],
                "institution_id": r[19], "institution_position": r[20], "subject": r[21],
                "panel_role": r[22],
                "bound": r[23] is not None, "bind_code": r[23],
                "bound_name": r[24], "teacher_login": r[25],
            }
            # История платежей (подписки/токены)
            cur.execute(
                f"""SELECT plan, amount, months, provider, status, source, granted_by, created_at, paid_at
                    FROM {SCHEMA}.payments WHERE user_login = %s
                    ORDER BY created_at DESC LIMIT 100""", (tl,)
            )
            payments = [{
                "plan": p[0], "amount_rub": float(p[1] or 0), "months": p[2],
                "provider": p[3], "status": p[4], "source": p[5], "granted_by": p[6],
                "created_at": str(p[7]) if p[7] else None, "paid_at": str(p[8]) if p[8] else None,
            } for p in cur.fetchall()]
            # История начислений/списаний ИИ-баланса
            cur.execute(
                f"""SELECT action, tokens, amount_kopecks, balance_kopecks_after, created_at
                    FROM {SCHEMA}.ai_token_logs WHERE login = %s
                    ORDER BY created_at DESC LIMIT 100""", (tl,)
            )
            charges = [{
                "action": c[0], "tokens": c[1],
                "amount_rub": round((c[2] or 0) / 100, 2),
                "balance_rub_after": round((c[3] or 0) / 100, 2),
                "created_at": str(c[4]) if c[4] else None,
            } for c in cur.fetchall()]
            return _resp(200, {"user": user, "payments": payments, "charges": charges})

        # ── grant-tokens — начислить ИИ-баланс (руб) пользователю ─────────────
        if action == "grant-tokens" and method == "POST":
            if not perms["can_tokens"]:
                return _resp(403, {"error": "Нет прав начислять токены"})
            tl = (body.get("target_login") or "").strip()
            try:
                amount_rub = float(body.get("amount_rub") or 0)
            except (TypeError, ValueError):
                amount_rub = 0
            if not tl or amount_rub == 0:
                return _resp(400, {"error": "Укажите пользователя и сумму"})
            kop = round(amount_rub * 100)
            cur = conn.cursor()
            cur.execute(
                f"""UPDATE {SCHEMA}.users SET ai_balance_kopecks = GREATEST(0, ai_balance_kopecks + %s)
                    WHERE login = %s RETURNING ai_balance_kopecks""", (kop, tl)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            new_kop = row[0] or 0
            cur.execute(
                f"""INSERT INTO {SCHEMA}.ai_token_logs (login, action, tokens, balance_after, amount_kopecks, balance_kopecks_after)
                    VALUES (%s, %s, 0, %s, %s, %s)""",
                (tl, "uds_grant" if kop >= 0 else "uds_deduct", new_kop, kop, new_kop)
            )
            log_action(cur, caller["login"], my_role, "grant_tokens", tl, {"amount_rub": amount_rub})
            conn.commit()
            return _resp(200, {"ok": True, "balance_rub": round(new_kop / 100, 2)})

        # ── grant-subscription — выдать/продлить/отозвать подписку ────────────
        if action == "grant-subscription" and method == "POST":
            tl = (body.get("target_login") or "").strip()
            try:
                months = int(body.get("months") or 1)
            except (TypeError, ValueError):
                months = 1
            months = max(1, min(months, 36))
            revoke = bool(body.get("revoke"))
            plan = (body.get("plan") or "УДС").strip()
            if not tl:
                return _resp(400, {"error": "Укажите пользователя"})
            cur = conn.cursor()
            cur.execute(f"SELECT subscription_until FROM {SCHEMA}.users WHERE login = %s", (tl,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            if revoke:
                cur.execute(
                    f"""UPDATE {SCHEMA}.users SET subscription_status='none',
                        subscription_until=NULL, subscription_plan=NULL WHERE login = %s""", (tl,)
                )
                log_action(cur, caller["login"], my_role, "revoke_subscription", tl, None)
                conn.commit()
                return _resp(200, {"ok": True, "subscription_status": "none"})
            now = datetime.utcnow()
            cur_until = row[0] if isinstance(row[0], datetime) else None
            base = cur_until if (cur_until and cur_until > now) else now
            new_until = base + timedelta(days=30 * months)
            cur.execute(
                f"""UPDATE {SCHEMA}.users SET subscription_status='active',
                    subscription_plan=%s, subscription_until=%s WHERE login = %s""",
                (plan, new_until, tl)
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.payments
                    (user_login, plan, amount, months, provider, status, source, granted_by, paid_at, subscription_until)
                    VALUES (%s, %s, 0, %s, 'uds-grant', 'succeeded', 'uds', %s, NOW(), %s)""",
                (tl, plan, months, caller["login"], new_until)
            )
            log_action(cur, caller["login"], my_role, "grant_subscription", tl, {"months": months})
            conn.commit()
            return _resp(200, {"ok": True, "subscription_until": new_until.isoformat()})

        # ── block-user — заблокировать/разблокировать пользователя (все) ─────
        if action == "block-user" and method == "POST":
            tl = (body.get("target_login") or "").strip()
            blocked = bool(body.get("blocked"))
            if not tl or tl == "admin":
                return _resp(400, {"error": "Недопустимый пользователь"})
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.users SET is_active = %s WHERE login = %s RETURNING id", (not blocked, tl))
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            log_action(cur, caller["login"], my_role, "block_user" if blocked else "unblock_user", tl, None)
            conn.commit()
            return _resp(200, {"ok": True})

        # ── reset-user-password — сменить пароль пользователю (все) ──────────
        if action == "reset-user-password" and method == "POST":
            tl = (body.get("target_login") or "").strip()
            new_password = (body.get("new_password") or "").strip()
            if not tl:
                return _resp(400, {"error": "Укажите пользователя"})
            if len(new_password) < 6:
                return _resp(400, {"error": "Пароль не менее 6 символов"})
            if tl == "admin":
                return _resp(403, {"error": "Нельзя изменить пароль администратора"})
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET password_hash = %s, auth_token_hash = NULL WHERE login = %s RETURNING id",
                (hash_password(new_password), tl)
            )
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            log_action(cur, caller["login"], my_role, "reset_user_password", tl, None)
            conn.commit()
            return _resp(200, {"ok": True})

        # ── lk-visibility — видимость разделов ЛК (разработчик+) ─────────────
        if action == "lk-visibility" and method == "GET":
            cur = conn.cursor()
            cur.execute(f"SELECT role, section FROM {SCHEMA}.lk_section_visibility WHERE visible = FALSE")
            hidden = {"teacher": [], "student": []}
            for rr, sect in cur.fetchall():
                hidden.setdefault(rr, []).append(sect)
            return _resp(200, {"hidden": hidden})

        if action == "lk-visibility" and method == "POST":
            if not perms["can_lkview"]:
                return _resp(403, {"error": "Доступно только разработчику и выше"})
            role_key = (body.get("role") or "").strip().lower()
            hidden = body.get("hidden", [])
            if role_key not in ("teacher", "student"):
                return _resp(400, {"error": "role: teacher или student"})
            if not isinstance(hidden, list):
                return _resp(400, {"error": "hidden — массив"})
            hidden = [str(s)[:32] for s in hidden]
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {SCHEMA}.lk_section_visibility WHERE role = %s", (role_key,))
            for sect in hidden:
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.lk_section_visibility (role, section, visible, updated_at)
                        VALUES (%s, %s, FALSE, NOW())
                        ON CONFLICT (role, section) DO UPDATE SET visible = FALSE, updated_at = NOW()""",
                    (role_key, sect)
                )
            log_action(cur, caller["login"], my_role, "lk_visibility", None, {"role": role_key, "hidden": hidden})
            conn.commit()
            return _resp(200, {"ok": True, "role": role_key, "hidden": hidden})

        # ── maintenance — разделы на тех. работах (разработчик+) ─────────────
        if action == "maintenance" and method == "GET":
            cur = conn.cursor()
            cur.execute(f"SELECT sections FROM {SCHEMA}.maintenance WHERE id = 1")
            row = cur.fetchone()
            sections = json.loads(row[0]) if row and row[0] else []
            return _resp(200, {"sections": sections})

        if action == "maintenance" and method == "POST":
            if not perms["can_maintenance"]:
                return _resp(403, {"error": "Доступно только разработчику и выше"})
            sections = body.get("sections", [])
            if not isinstance(sections, list):
                return _resp(400, {"error": "sections — массив"})
            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.maintenance (id, sections, updated_at, updated_by)
                    VALUES (1, %s, NOW(), %s)
                    ON CONFLICT (id) DO UPDATE
                    SET sections = EXCLUDED.sections, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by""",
                (json.dumps(sections, ensure_ascii=False), caller["login"])
            )
            log_action(cur, caller["login"], my_role, "maintenance", None, {"sections": sections})
            conn.commit()
            return _resp(200, {"ok": True, "sections": sections})

        # ════════════ СЕРТИФИКАТЫ УДС ════════════════════════════════════════

        # ── assign-cert — Глава/Зам назначает выпуск сертификата сотруднику ──
        if action == "assign-cert" and method == "POST":
            if not perms["can_cert"]:
                return _resp(403, {"error": "Выпуск доступен только Главе и Зам. Главы"})
            tl = (body.get("target_login") or "").strip()
            issue_code = (body.get("issue_code") or "").strip()
            if not tl:
                return _resp(400, {"error": "Укажите сотрудника"})
            if issue_code != CERT_ISSUE_CODE:
                return _resp(403, {"error": "Неверный код ИИС выпуска"})
            cur = conn.cursor()
            # сотрудник должен быть зарегистрирован в УДС
            cur.execute(
                f"""SELECT u.full_name, po.panel_role FROM {SCHEMA}.users u
                    JOIN {SCHEMA}.panel_operators po ON po.login = u.login
                    WHERE u.login = %s AND po.panel_role != 'removed' AND po.uds_registered = TRUE""",
                (tl,)
            )
            r = cur.fetchone()
            if not r:
                return _resp(404, {"error": "Сотрудник не найден или не зарегистрирован в УДС"})
            full_name = r[0]
            # уже есть активный/назначенный?
            cur.execute(
                f"SELECT status FROM {SCHEMA}.uds_certificates WHERE login = %s AND status IN ('assigned','issuing','active')",
                (tl,)
            )
            if cur.fetchone():
                return _resp(409, {"error": "У сотрудника уже есть назначенный или активный сертификат"})
            cur.execute(
                f"""INSERT INTO {SCHEMA}.uds_certificates (login, full_name, status, assigned_by)
                    VALUES (%s, %s, 'assigned', %s) RETURNING id""",
                (tl, full_name, caller["login"])
            )
            log_action(cur, caller["login"], my_role, "assign_cert", tl, None)
            conn.commit()
            return _resp(200, {"ok": True})

        # ── cert-status — статус сертификата сотрудника (для Главы/Зама) ─────
        if action == "cert-status" and method == "GET":
            tl = (qs.get("target_login") or "").strip()
            if not tl:
                return _resp(400, {"error": "Укажите сотрудника"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT status, container_type, serial_number, fingerprint, not_before, not_after,
                           assigned_by, assigned_at, issued_at, revoked_by, revoked_at
                    FROM {SCHEMA}.uds_certificates WHERE login = %s
                    ORDER BY assigned_at DESC LIMIT 1""", (tl,)
            )
            r = cur.fetchone()
            if not r:
                return _resp(200, {"cert": None})
            return _resp(200, {"cert": {
                "status": r[0], "container_type": r[1], "serial_number": r[2],
                "fingerprint": r[3],
                "not_before": str(r[4]) if r[4] else None,
                "not_after": str(r[5]) if r[5] else None,
                "assigned_by": r[6], "assigned_at": str(r[7]) if r[7] else None,
                "issued_at": str(r[8]) if r[8] else None,
                "revoked_by": r[9], "revoked_at": str(r[10]) if r[10] else None,
            }})

        # ── cert-agree — сотрудник согласился, выбрал носитель ──────────────
        if action == "cert-agree" and method == "POST":
            container_type = (body.get("container_type") or "").strip().lower()
            if container_type not in ("rutoken", "cryptopro"):
                return _resp(400, {"error": "Выберите носитель: rutoken или cryptopro"})
            cur = conn.cursor()
            # Любой сотрудник может выпускать сертификат сам, в любой момент.
            # Старый активный сертификат не мешает — отзываем его при новом выпуске.
            cur.execute(
                f"""UPDATE {SCHEMA}.uds_certificates
                    SET status = 'revoked', revoked_by = %s, revoked_at = NOW(),
                        revoke_reason = 'Перевыпуск сертификата'
                    WHERE login = %s AND status = 'active'""",
                (caller["login"], caller["login"])
            )
            # Незавершённый выпуск (assigned/issuing) переиспользуем — переводим в 'issuing'.
            cur.execute(
                f"""UPDATE {SCHEMA}.uds_certificates
                    SET status = 'issuing', container_type = %s
                    WHERE login = %s AND status IN ('assigned','issuing') RETURNING id""",
                (container_type, caller["login"])
            )
            if not cur.fetchone():
                # Нет незавершённой заявки — создаём новую
                cur.execute(f"SELECT full_name FROM {SCHEMA}.users WHERE login = %s", (caller["login"],))
                fn_row = cur.fetchone()
                full_name = (fn_row[0] if fn_row and fn_row[0] else caller["login"])
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.uds_certificates (login, full_name, status, container_type, assigned_by)
                        VALUES (%s, %s, 'issuing', %s, %s) RETURNING id""",
                    (caller["login"], full_name, container_type, caller["login"])
                )
            log_action(cur, caller["login"], my_role, "cert_agree", caller["login"], {"container_type": container_type})
            conn.commit()
            return _resp(200, {"ok": True})

        # ── sign-csr — подпись запроса (CSR от плагина) → выдача сертификата ──
        if action == "sign-csr" and method == "POST":
            csr_pem = (body.get("csr") or "").strip()
            if not csr_pem:
                return _resp(400, {"error": "Не передан запрос на сертификат (CSR)"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT full_name FROM {SCHEMA}.uds_certificates
                    WHERE login = %s AND status = 'issuing'""", (caller["login"],)
            )
            r = cur.fetchone()
            if not r:
                return _resp(404, {"error": "Нет процесса выпуска. Сначала согласитесь и выберите носитель."})
            full_name = r[0]
            try:
                cert_pem, serial_hex, fingerprint, not_before, not_after = sign_user_csr(cur, csr_pem, full_name)
            except Exception as e:
                return _resp(400, {"error": f"Не удалось подписать сертификат: {e}"})
            cur.execute(
                f"""UPDATE {SCHEMA}.uds_certificates
                    SET status = 'active', serial_number = %s, fingerprint = %s,
                        certificate_pem = %s, not_before = %s, not_after = %s, issued_at = NOW()
                    WHERE login = %s AND status = 'issuing'""",
                (serial_hex, fingerprint, cert_pem, not_before, not_after, caller["login"])
            )
            log_action(cur, caller["login"], my_role, "cert_issued", caller["login"],
                       {"serial": serial_hex})
            conn.commit()
            return _resp(200, {
                "ok": True,
                "certificate": cert_pem,
                "serial_number": serial_hex,
                "fingerprint": fingerprint,
                "not_after": not_after.isoformat() if not_after else None,
            })

        # ── revoke-cert — Глава/Зам отзывает сертификат ─────────────────────
        if action == "revoke-cert" and method == "POST":
            if not perms["can_cert"]:
                return _resp(403, {"error": "Отзыв доступен только Главе и Зам. Главы"})
            tl = (body.get("target_login") or "").strip()
            reason = (body.get("reason") or "").strip()[:256]
            if not tl:
                return _resp(400, {"error": "Укажите сотрудника"})
            cur = conn.cursor()
            cur.execute(
                f"""UPDATE {SCHEMA}.uds_certificates
                    SET status = 'revoked', revoked_by = %s, revoked_at = NOW(), revoke_reason = %s
                    WHERE login = %s AND status IN ('assigned','issuing','active') RETURNING id""",
                (caller["login"], reason or None, tl)
            )
            if not cur.fetchone():
                return _resp(404, {"error": "Активный сертификат не найден"})
            log_action(cur, caller["login"], my_role, "revoke_cert", tl, {"reason": reason})
            conn.commit()
            return _resp(200, {"ok": True})

        return _resp(404, {"error": f"Неизвестный action: {action}"})
    finally:
        conn.close()