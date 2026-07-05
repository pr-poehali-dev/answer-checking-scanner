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
    import base64
    import hashlib
    key = os.environ.get("MAIL_ENCRYPTION_KEY", "").strip()
    if not key:
        raise RuntimeError("MAIL_ENCRYPTION_KEY не задан")
    # Fernet требует ровно 32 url-safe base64 байта. Если ключ задан в другом
    # формате — нормализуем детерминированно (SHA-256 → base64url), чтобы
    # шифрование всегда работало, а расшифровка была стабильной.
    try:
        return Fernet(key.encode())
    except Exception:
        derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
        return Fernet(derived)


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


# Возможные имена функции создания ящика (зависит от сборки ISPmanager хостинга)
_MAILBOX_FUNCS = ["emailbox.edit", "email.box.edit", "mail.box.edit"]


def _isp_mailbox(base_params: dict) -> None:
    """Пробует создать/изменить ящик перебирая известные имена функций.

    'module missing' по одной функции — не фатально, пробуем следующую.
    """
    endpoint, sid = _isp_auth()
    last_err = None
    for func in _MAILBOX_FUNCS:
        raw = _http_post(endpoint, {"auth": sid, "out": "json", "func": func, **base_params})
        print(f"[ISP MAILBOX] func={func} -> {raw[:300]}")
        try:
            parsed = json.loads(raw)
        except Exception:
            last_err = f"неожиданный ответ ({func})"
            continue
        err = _isp_error(parsed)
        if not err:
            return  # успех
        last_err = err
        # Если модуль/функция отсутствует — пробуем следующее имя
        if "missing" in err.lower() or "find the" in err.lower() or "module" in err.lower():
            continue
        # Иная ошибка (например, ящик уже существует) — прекращаем перебор
        raise RuntimeError(f"ISPmanager: {err}")
    raise RuntimeError(f"ISPmanager: {last_err or 'не удалось создать ящик'}")


def create_mailbox(email_address: str, password: str) -> None:
    """Создаёт почтовый ящик на хостинге. Бросает исключение при ошибке."""
    local, _, domain = email_address.partition("@")
    _isp_mailbox({
        "sok": "ok",
        "elid": domain,
        "domain": domain,
        "mailbox": local,
        "name": local,
        "passwd": password,
        "confirm": password,
    })


def set_mailbox_password(email_address: str, password: str) -> None:
    """Меняет пароль существующего ящика на хостинге."""
    local, _, domain = email_address.partition("@")
    _isp_mailbox({
        "sok": "ok",
        "elid": email_address,   # редактирование существующего ящика по полному адресу
        "domain": domain,
        "mailbox": local,
        "name": local,
        "passwd": password,
        "confirm": password,
    })


# ── SMTP отправка наружу ──────────────────────────────────────────────────────

SMTP_HOST = os.environ.get("UDS_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("UDS_SMTP_PORT") or "465")


# Отдельный SMTP-хост для отправки писем сотрудников (если общий не работает)
MAIL_SMTP_HOST = os.environ.get("MAIL_SMTP_HOST", "").strip()

# Быстрый таймаут на попытку, чтобы уложиться в лимит функции (30 сек)
SMTP_TIMEOUT = 7


def _server_host_from_isp():
    """Извлекает хост сервера хостинга из ISPMANAGER_URL (напр. server185.hosting.reg.ru)."""
    url = os.environ.get("ISPMANAGER_URL", "").strip()
    if not url:
        return None
    host = url.replace("https://", "").replace("http://", "")
    host = host.split("/")[0].split(":")[0]  # убираем порт и путь
    return host or None


def _smtp_candidates():
    """Список вариантов (host, port, mode) для перебора при отправке.

    Приоритет — персональному серверу хостинга (server185...), т.к. общий
    mail.hosting.reg.ru часто обрывает соединение. Держим короткий список,
    чтобы не упереться в таймаут функции.
    """
    hosts = []
    # Приоритет: явный MAIL_SMTP_HOST → сервер из ISP → заданный UDS_SMTP_HOST → общий
    for h in [MAIL_SMTP_HOST, _server_host_from_isp(), SMTP_HOST, "mail.hosting.reg.ru"]:
        if h and h not in hosts:
            hosts.append(h)
    candidates = []
    for h in hosts:
        candidates.append((h, 465, "ssl"))
        candidates.append((h, 587, "starttls"))
    return candidates


def send_external_email(from_address: str, from_password: str, from_name: str,
                        to_address: str, subject: str, body: str) -> None:
    """Отправляет реальное письмо от имени сотрудника через SMTP Рег.ру.

    Перебирает несколько комбинаций хост/порт/режим, пока не получится.
    """
    if not SMTP_HOST:
        raise RuntimeError("SMTP не настроен (UDS_SMTP_HOST)")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject or "(без темы)"
    msg["From"] = f"{from_name} <{from_address}>" if from_name else from_address
    msg["To"] = to_address
    msg.attach(MIMEText(body, "plain", "utf-8"))
    raw = msg.as_string()

    import socket
    ctx = ssl.create_default_context()
    last_err = None
    auth_failed = False
    unresolved = set()
    for host, port, mode in _smtp_candidates():
        # Хост не резолвится — пропускаем сразу, без ожидания
        if host in unresolved:
            continue
        try:
            socket.getaddrinfo(host, port)
        except Exception:
            unresolved.add(host)
            last_err = f"хост {host} не найден"
            print(f"[UDS SMTP] DNS FAIL {host}")
            continue
        try:
            if mode == "ssl":
                with smtplib.SMTP_SSL(host, port, context=ctx, timeout=SMTP_TIMEOUT) as s:
                    s.login(from_address, from_password)
                    s.sendmail(from_address, [to_address], raw)
            else:
                with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT) as s:
                    s.ehlo(); s.starttls(context=ctx); s.ehlo()
                    s.login(from_address, from_password)
                    s.sendmail(from_address, [to_address], raw)
            print(f"[UDS SMTP] OK via {host}:{port} ({mode})")
            return
        except smtplib.SMTPAuthenticationError as e:
            # Неверный логин/пароль — перебор других портов не поможет
            auth_failed = True
            last_err = f"неверный логин или пароль почты ({e.smtp_code})"
            print(f"[UDS SMTP] AUTH FAIL {host}:{port}: {e}")
            break
        except Exception as e:
            last_err = str(e)
            print(f"[UDS SMTP] FAIL {host}:{port} ({mode}): {e}")
            continue

    if auth_failed:
        raise RuntimeError("Неверный пароль почты. Задайте пароль ящика заново в разделе «Почта».")
    raise RuntimeError(f"Не удалось подключиться к почтовому серверу: {last_err or 'соединение закрыто'}")


def thread_key(a: str, b: str) -> str:
    """Детерминированный ключ треда для пары адресов."""
    x, y = sorted([(a or "").lower(), (b or "").lower()])
    return f"{x}|{y}"


def is_internal(address: str) -> bool:
    return (address or "").lower().endswith(f"@{MAIL_DOMAIN}")