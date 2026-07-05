"""
Корпоративная почта УДС (@ooo29.ru).

- Генерация адреса по ФИО (не похож на логин сотрудника)
- Создание ящика через ISPmanager API (Рег.ру)
- Шифрование пароля почты (Fernet) для авто-отправки по SMTP
- Мессенджер: внутренняя переписка в БД + реальная отправка наружу по SMTP
"""
import os
import re
import ssl
import json
import random
import smtplib
import urllib.parse
import urllib.request
import urllib.error
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

MAIL_DOMAIN = "ooo29.ru"

# Транслитерация для генерации адреса
_TR = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def _translit(s: str) -> str:
    s = (s or '').strip().lower()
    out = [_TR.get(ch, ch if ch.isalnum() else '') for ch in s]
    return re.sub(r'[^a-z0-9]', '', ''.join(out))


# Нейтральные «корпоративные» словечки, чтобы адрес НЕ был похож на логин
_STYLE_WORDS = ["office", "team", "work", "corp", "mail", "info", "staff", "pro", "hub", "desk"]


def generate_email(first_name: str, last_name: str, middle_name: str, cur, schema: str) -> str:
    """Генерирует уникальный адрес @ooo29.ru по ФИО, отличающийся от логина.

    Схема: <имя>.<фамилия> или <имя>.<фамилия><word><digits>. Всегда через точку —
    так адрес визуально отличается от логина (который у нас склеен: фамилия+буква имени).
    """
    fn = _translit(first_name)
    ln = _translit(last_name)
    mn = _translit(middle_name)

    base_variants = []
    if fn and ln:
        base_variants.append(f"{fn}.{ln}")
        if mn:
            base_variants.append(f"{fn}.{mn[:1]}.{ln}")
        base_variants.append(f"{ln}.{fn}")
    elif ln:
        base_variants.append(ln)
    elif fn:
        base_variants.append(fn)
    else:
        base_variants.append("employee")

    def _free(local: str) -> bool:
        addr = f"{local}@{MAIL_DOMAIN}"
        cur.execute(f"SELECT 1 FROM {schema}.mailboxes WHERE LOWER(email_address) = %s", (addr.lower(),))
        return cur.fetchone() is None

    # 1) Пробуем чистые варианты
    for local in base_variants:
        local = local[:40].strip('.')
        if local and _free(local):
            return f"{local}@{MAIL_DOMAIN}"

    # 2) Добавляем «корпоративное» слово + число (делает адрес непохожим на логин)
    primary = (base_variants[0] if base_variants else "employee")[:32].strip('.')
    for _ in range(200):
        word = random.choice(_STYLE_WORDS)
        num = random.randint(1, 999)
        local = f"{primary}.{word}{num}"[:48].strip('.')
        if _free(local):
            return f"{local}@{MAIL_DOMAIN}"

    # 3) Крайний случай — полностью случайный
    local = f"{primary}.{random.randint(100000, 999999)}"
    return f"{local}@{MAIL_DOMAIN}"


# ── Шифрование пароля почты ───────────────────────────────────────────────────

def _fernet():
    from cryptography.fernet import Fernet
    key = os.environ.get("MAIL_ENCRYPTION_KEY", "").strip()
    if not key:
        raise RuntimeError("MAIL_ENCRYPTION_KEY не задан")
    return Fernet(key.encode())


def encrypt_password(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_password(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


# ── ISPmanager API (создание/смена пароля почтового ящика) ────────────────────

def _isp_config():
    url = os.environ.get("ISPMANAGER_URL", "").strip().rstrip("/")
    user = os.environ.get("ISPMANAGER_USER", "").strip()
    pwd = os.environ.get("ISPMANAGER_PASSWORD", "").strip()
    return url, user, pwd


def isp_available() -> bool:
    url, user, pwd = _isp_config()
    return bool(url and user and pwd)


def _ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # у хостинг-панелей часто самоподписанный серт
    return ctx


def _http_post(endpoint: str, params: dict) -> str:
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(endpoint, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=25, context=_ssl_ctx()) as r:
            return r.read().decode(errors="ignore")
    except urllib.error.HTTPError as e:
        return e.read().decode(errors="ignore") if hasattr(e, "read") else str(e)


def _isp_error(parsed: dict):
    """Возвращает текст ошибки из ответа ISPmanager или None."""
    doc = parsed.get("doc") or parsed
    if isinstance(doc, dict) and doc.get("error"):
        err = doc["error"]
        if isinstance(err, dict):
            return err.get("msg", {}).get("$") if isinstance(err.get("msg"), dict) else \
                   (err.get("msg") or err.get("$") or err.get("value") or json.dumps(err, ensure_ascii=False))
        return str(err)
    return None


def _isp_auth() -> tuple[str, str]:
    """Авторизация в ISPmanager 6: получаем session id. Возвращает (base_url, session_id)."""
    url, user, pwd = _isp_config()
    if not (url and user and pwd):
        raise RuntimeError("ISPmanager не настроен (ISPMANAGER_URL/USER/PASSWORD)")

    # ISPmanager 6 отдаёт API по /manager/ispmgr, старые сборки — /ispmgr
    for path in ("/manager/ispmgr", "/ispmgr"):
        endpoint = f"{url}{path}"
        raw = _http_post(endpoint, {
            "func": "auth", "username": user, "password": pwd, "out": "json",
        })
        print(f"[ISP AUTH] {endpoint} -> {raw[:300]}")
        try:
            parsed = json.loads(raw)
        except Exception:
            continue  # не тот путь / не JSON — пробуем следующий
        err = _isp_error(parsed)
        if err:
            raise RuntimeError(f"Авторизация ISPmanager: {err}")
        doc = parsed.get("doc") or parsed
        sid = (doc.get("auth", {}).get("$") if isinstance(doc.get("auth"), dict)
               else doc.get("auth")) or parsed.get("auth")
        if sid:
            return endpoint, str(sid)
    raise RuntimeError("Не удалось авторизоваться в ISPmanager (проверьте адрес, логин и пароль)")


def _isp_call(params: dict) -> dict:
    """Вызов ISPmanager 6 API с авторизацией по сессии."""
    endpoint, sid = _isp_auth()
    raw = _http_post(endpoint, {"auth": sid, "out": "json", **params})
    print(f"[ISP CALL] func={params.get('func')} -> {raw[:400]}")
    try:
        parsed = json.loads(raw)
    except Exception:
        raise RuntimeError(f"ISPmanager: неожиданный ответ: {raw[:200]}")
    err = _isp_error(parsed)
    if err:
        raise RuntimeError(f"ISPmanager: {err}")
    return parsed


def create_mailbox(email_address: str, password: str) -> None:
    """Создаёт почтовый ящик в ISPmanager 6. Бросает исключение при ошибке."""
    local, _, domain = email_address.partition("@")
    _isp_call({
        "func": "mail.box.edit",
        "sok": "ok",
        "elid": domain,          # в v6 контекст ящика — почтовый домен
        "domain": domain,
        "mailbox": local,        # v6: имя ящика — параметр mailbox
        "name": local,           # совместимость со старыми сборками
        "passwd": password,
        "confirm": password,
    })


def set_mailbox_password(email_address: str, password: str) -> None:
    """Меняет пароль существующего ящика в ISPmanager 6."""
    local, _, domain = email_address.partition("@")
    _isp_call({
        "func": "mail.box.edit",
        "sok": "ok",
        "elid": email_address,   # редактирование существующего ящика по полному адресу
        "domain": domain,
        "mailbox": local,
        "name": local,
        "passwd": password,
        "confirm": password,
    })


# ── SMTP отправка наружу ──────────────────────────────────────────────────────

SMTP_HOST = os.environ.get("UDS_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("UDS_SMTP_PORT") or "465")


def send_external_email(from_address: str, from_password: str, from_name: str,
                        to_address: str, subject: str, body: str) -> None:
    """Отправляет реальное письмо от имени сотрудника через SMTP Рег.ру."""
    if not SMTP_HOST:
        raise RuntimeError("SMTP не настроен (UDS_SMTP_HOST)")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject or "(без темы)"
    msg["From"] = f"{from_name} <{from_address}>" if from_name else from_address
    msg["To"] = to_address
    msg.attach(MIMEText(body, "plain", "utf-8"))

    ctx = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=20) as s:
            s.login(from_address, from_password)
            s.sendmail(from_address, [to_address], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.ehlo(); s.starttls(context=ctx); s.ehlo()
            s.login(from_address, from_password)
            s.sendmail(from_address, [to_address], msg.as_string())


def thread_key(a: str, b: str) -> str:
    """Детерминированный ключ треда для пары адресов."""
    x, y = sorted([(a or "").lower(), (b or "").lower()])
    return f"{x}|{y}"


def is_internal(address: str) -> bool:
    return (address or "").lower().endswith(f"@{MAIL_DOMAIN}")