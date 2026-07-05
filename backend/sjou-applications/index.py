"""
API заявок на регистрацию образовательных организаций (ОО) в СЖОУ.
POST /         (action=submit)  — подать заявку (публично) + загрузить файл заявления
POST /         (action=list)    — список заявок для оператора (требует пароль оператора)
POST /         (action=review)  — одобрить/отклонить заявку (оператор);
                                  при одобрении генерирует логин/пароль админа ОО
                                  и шлёт письмо с данными доступа
POST /         (action=messages)      — история переписки по заявке (оператор)
POST /         (action=send_message)  — оператор шлёт письмо организации
"""
import json
import os
import base64
import uuid
import secrets
import string
import re
import smtplib
import ssl
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr
import psycopg2
import boto3

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Operator-Password",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
TABLE = f"{SCHEMA}.sjou_oo_applications"

OO_TYPES = {
    "school": "Общеобразовательная школа",
    "gymnasium": "Гимназия",
    "lyceum": "Лицей",
    "kindergarten": "Детский сад",
    "college": "Колледж / СПО",
    "supplementary": "Учреждение доп. образования",
    "other": "Другое",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }


def _upload_statement(file_b64: str, file_name: str) -> tuple:
    raw = base64.b64decode(file_b64.split(",")[-1])
    ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "pdf").lower()[:8]
    key = f"sjou/applications/{uuid.uuid4().hex}.{ext}"
    ctype = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }.get(ext, "application/octet-stream")
    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=ctype)
    url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return url, file_name


def _check_operator(event: dict, body: dict = None) -> bool:
    headers = event.get("headers", {})
    pwd = (
        (body or {}).get("operator_password")
        or headers.get("X-Operator-Password")
        or headers.get("x-operator-password")
    )
    if not pwd:
        return False
    pwd = pwd.strip()
    valid = set()
    for key in ("SJOU_OPERATOR_PASSWORD", "ADMIN_PASSWORD"):
        v = os.environ.get(key)
        if v:
            valid.add(v.strip())
    return pwd in valid


def _auth_debug(event: dict, body: dict = None) -> dict:
    headers = event.get("headers", {})
    pwd = (
        (body or {}).get("operator_password")
        or headers.get("X-Operator-Password")
        or headers.get("x-operator-password")
        or ""
    )
    return {
        "got_len": len(pwd.strip()),
        "sjou_set": bool(os.environ.get("SJOU_OPERATOR_PASSWORD")),
        "sjou_len": len((os.environ.get("SJOU_OPERATOR_PASSWORD") or "").strip()),
        "admin_set": bool(os.environ.get("ADMIN_PASSWORD")),
        "admin_len": len((os.environ.get("ADMIN_PASSWORD") or "").strip()),
    }


APP_COLS = [
    "id", "oo_full_name", "oo_short_name", "oo_type", "inn", "ogrn",
    "legal_address", "actual_address", "region", "director_name",
    "contact_name", "contact_position", "contact_phone", "contact_email",
    "students_count", "statement_file_url", "statement_file_name",
    "status", "operator_comment", "reviewed_at", "created_at",
    "oo_admin_login", "oo_admin_password", "operator_number",
]
APP_COLS_SQL = ", ".join(APP_COLS)


def _row_to_dict(r) -> dict:
    d = dict(zip(APP_COLS, r))
    d["oo_type_label"] = OO_TYPES.get(d.get("oo_type"), d.get("oo_type"))
    return d


def _client_ip(event: dict) -> str:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    xff = headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()[:64]
    ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp")
    return (ip or "")[:64]


def _record_consent(cur, *, full_name, email, phone, consent, ip, user_agent):
    consent = consent or {}
    cur.execute(
        f"""INSERT INTO {SCHEMA}.user_consents
            (user_id, login, full_name, email, phone, context, documents,
             app_version, privacy_revision, oferta_revision, documents_hash,
             ip_address, user_agent, institution_id)
            VALUES (NULL,NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NULL)""",
        (
            (full_name or "")[:256], (email or "")[:256] or None,
            (phone or "")[:32] or None,
            (consent.get("context") or "sjou_application")[:64],
            (consent.get("documents") or "oferta,privacy")[:64],
            (consent.get("app_version") or "")[:32] or None,
            (consent.get("privacy_revision") or "")[:32] or None,
            (consent.get("oferta_revision") or "")[:32] or None,
            (consent.get("documents_hash") or "")[:64] or None,
            ip or None, (user_agent or "")[:2000] or None,
        ),
    )


def handle_submit(body: dict, event: dict = None) -> dict:
    required = ["oo_full_name", "oo_type", "inn", "legal_address", "region",
                "director_name", "contact_name", "contact_phone", "contact_email"]
    for f in required:
        if not (body.get(f) or "").strip():
            return _resp(400, {"error": f"Поле «{f}» обязательно"})

    file_url, file_name = None, None
    if body.get("statement_file_b64") and body.get("statement_file_name"):
        try:
            file_url, file_name = _upload_statement(
                body["statement_file_b64"], body["statement_file_name"])
        except Exception as e:
            return _resp(400, {"error": f"Ошибка загрузки файла: {e}"})

    students = body.get("students_count")
    try:
        students = int(students) if students not in (None, "") else None
    except (ValueError, TypeError):
        students = None

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {TABLE}
            (oo_full_name, oo_short_name, oo_type, inn, ogrn, legal_address,
             actual_address, region, director_name, contact_name,
             contact_position, contact_phone, contact_email, students_count,
             statement_file_url, statement_file_name, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
            RETURNING id""",
            (
                body["oo_full_name"].strip(),
                (body.get("oo_short_name") or "").strip() or None,
                body["oo_type"].strip(),
                body["inn"].strip(),
                (body.get("ogrn") or "").strip() or None,
                body["legal_address"].strip(),
                (body.get("actual_address") or "").strip() or None,
                body["region"].strip(),
                body["director_name"].strip(),
                body["contact_name"].strip(),
                (body.get("contact_position") or "").strip() or None,
                body["contact_phone"].strip(),
                body["contact_email"].strip(),
                students,
                file_url,
                file_name,
            ),
        )
        new_id = cur.fetchone()[0]
        # Фиксируем согласие контактного лица (доказательная база)
        if event is not None:
            hdrs = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
            _record_consent(
                cur,
                full_name=body["contact_name"].strip(),
                email=body["contact_email"].strip(),
                phone=body["contact_phone"].strip(),
                consent=body.get("consent") or {},
                ip=_client_ip(event),
                user_agent=hdrs.get("user-agent", ""),
            )
        conn.commit()
        return _resp(200, {"ok": True, "id": new_id})
    finally:
        conn.close()


def handle_list(event: dict, body: dict) -> dict:
    if not _check_operator(event, body):
        return _resp(401, {"error": "Неверный пароль оператора", "debug": _auth_debug(event, body)})
    status = (body.get("status") or "").strip()
    conn = get_conn()
    try:
        cur = conn.cursor()
        if status in ("pending", "approved", "rejected"):
            cur.execute(f"SELECT {APP_COLS_SQL} FROM {TABLE} WHERE status=%s ORDER BY created_at DESC", (status,))
        else:
            cur.execute(f"SELECT {APP_COLS_SQL} FROM {TABLE} ORDER BY created_at DESC")
        rows = [_row_to_dict(r) for r in cur.fetchall()]
        cur.execute(f"SELECT status, COUNT(*) FROM {TABLE} GROUP BY status")
        counts = {s: c for s, c in cur.fetchall()}
        return _resp(200, {"applications": rows, "counts": counts})
    finally:
        conn.close()


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    port = int(os.environ.get("SMTP_PORT", "465") or "465")
    if not (host and user and password and to_email):
        return False
    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header("СЖОУ", "utf-8")), user))
    msg["To"] = to_email
    try:
        if port == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as s:
                s.login(user, password)
                s.sendmail(user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(user, password)
                s.sendmail(user, [to_email], msg.as_string())
        return True
    except Exception:
        return False


def _generate_login(inn: str, app_id: int) -> str:
    base = re.sub(r"[^a-z0-9]", "", (inn or "").lower())[:8] or "oo"
    return f"oo_{base}_{app_id}"


def _generate_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def _email_shell(contact: str, inner_html: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px;
                  border-radius:12px 12px 0 0;color:#fff">
        <div style="font-size:20px;font-weight:800">СЖОУ</div>
        <div style="font-size:13px;opacity:.85">Электронный журнал и дневник</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
        <p>Здравствуйте, {contact}!</p>
        {inner_html}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
        <p style="font-size:12px;color:#94a3b8">
          Это письмо системы СЖОУ. Данные хранятся на серверах в России
          в соответствии с требованиями Минпросвещения РФ.
        </p>
      </div>
    </div>
    """


def _signature_html(operator_number: str) -> str:
    num = operator_number or "—"
    return (
        '<p style="margin-top:20px;color:#475569">С уважением,<br>'
        f'<b>Оператор СЖОУ</b><br>Номер оператора: {num}</p>'
    )


def _build_review_email(app: dict, decision: str, comment: str,
                        login: str = "", password: str = "",
                        operator_number: str = "") -> tuple:
    name = app.get("oo_full_name", "")
    contact = app.get("contact_name", "")
    comment_html = (
        f'<div style="margin:16px 0;padding:14px 16px;background:#f1f5f9;'
        f'border-radius:8px;color:#334155"><b>Сообщение от оператора:</b><br>{comment}</div>'
        if comment else ""
    )
    if decision == "approved":
        subject = "СЖОУ: заявка одобрена — доступ администратора ОО"
        creds_html = (
            '<div style="margin:16px 0;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;'
            'border-radius:8px"><b style="color:#1e40af">Данные для входа администратора ОО:</b>'
            f'<p style="margin:10px 0 4px"><b>Логин:</b> '
            f'<code style="background:#dbeafe;padding:2px 8px;border-radius:4px">{login}</code></p>'
            f'<p style="margin:4px 0"><b>Пароль:</b> '
            f'<code style="background:#dbeafe;padding:2px 8px;border-radius:4px">{password}</code></p>'
            '<p style="margin:10px 0 0;font-size:12px;color:#64748b">'
            'Рекомендуем сменить пароль после первого входа.</p></div>'
        )
        inner = (
            '<p style="font-size:16px;color:#16a34a;font-weight:600">'
            "Ваша заявка на регистрацию в системе СЖОУ одобрена!</p>"
            f'<p style="color:#475569">Организация: <b>{name}</b></p>'
            + creds_html
            + "<p>Используйте эти данные для входа в систему как администратор "
              "образовательной организации. Вы сможете добавлять классы, учителей и учеников.</p>"
            + comment_html
            + _signature_html(operator_number)
        )
    else:
        subject = "СЖОУ: заявка вашей организации отклонена"
        inner = (
            '<p style="font-size:16px;color:#dc2626;font-weight:600">'
            "К сожалению, ваша заявка на регистрацию в СЖОУ отклонена.</p>"
            f'<p style="color:#475569">Организация: <b>{name}</b></p>'
            + comment_html
            + "<p>Вы можете подать заявку повторно, устранив указанные замечания, "
              "или связаться с оператором для уточнения деталей.</p>"
            + _signature_html(operator_number)
        )
    return subject, _email_shell(contact, inner)


def _build_message_email(contact: str, subject: str, message: str,
                         operator_number: str) -> str:
    inner = (
        f'<div style="color:#334155;white-space:pre-wrap">{message}</div>'
        + _signature_html(operator_number)
    )
    return _email_shell(contact, inner)


def handle_review(event: dict, body: dict) -> dict:
    if not _check_operator(event, body):
        return _resp(401, {"error": "Неверный пароль оператора"})
    app_id = body.get("id")
    decision = (body.get("decision") or "").strip()
    comment = (body.get("comment") or "").strip() or None
    operator_number = (body.get("operator_number") or "").strip() or None
    if not app_id or decision not in ("approved", "rejected"):
        return _resp(400, {"error": "Нужен id и решение (approved/rejected)"})
    app_id = int(app_id)

    login = password = None
    if decision == "approved":
        login = _generate_login(body.get("inn") or "", app_id)
        password = _generate_password()

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE {TABLE}
            SET status=%s, operator_comment=%s, operator_number=%s, reviewed_at=NOW(),
                oo_admin_login=COALESCE(%s, oo_admin_login),
                oo_admin_password=COALESCE(%s, oo_admin_password)
            WHERE id=%s
            RETURNING oo_full_name, contact_name, contact_email, inn""",
            (decision, comment, operator_number, login, password, app_id),
        )
        row = cur.fetchone()
        if not row:
            return _resp(404, {"error": "Заявка не найдена"})
        conn.commit()
        oo_name, contact_name, contact_email, inn = row

        if decision == "approved" and login is None:
            cur.execute(f"SELECT oo_admin_login, oo_admin_password FROM {TABLE} WHERE id=%s", (app_id,))
            login, password = cur.fetchone()

        app_data = {"oo_full_name": oo_name, "contact_name": contact_name}
        email_sent = False
        if contact_email:
            subject, html = _build_review_email(
                app_data, decision, comment or "",
                login or "", password or "", operator_number or "")
            email_sent = _send_email(contact_email, subject, html)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.sjou_oo_messages
                (application_id, direction, subject, body, operator_number, to_email, email_sent)
                VALUES (%s,'outgoing',%s,%s,%s,%s,%s)""",
                (app_id, subject,
                 f"Решение: {'одобрено' if decision == 'approved' else 'отклонено'}."
                 + (f" Логин: {login}, пароль: {password}." if login else "")
                 + (f" Комментарий: {comment}" if comment else ""),
                 operator_number, contact_email, email_sent),
            )
            conn.commit()
        return _resp(200, {"ok": True, "email_sent": email_sent,
                           "login": login, "password": password})
    finally:
        conn.close()


def handle_messages(event: dict, body: dict) -> dict:
    """Список писем переписки по заявке (оператор)."""
    if not _check_operator(event, body):
        return _resp(401, {"error": "Неверный пароль оператора"})
    app_id = body.get("id")
    if not app_id:
        return _resp(400, {"error": "Нужен id заявки"})
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""SELECT id, direction, subject, body, operator_number, to_email,
                       email_sent, created_at
                FROM {SCHEMA}.sjou_oo_messages
                WHERE application_id=%s ORDER BY created_at ASC""",
            (int(app_id),),
        )
        cols = ["id", "direction", "subject", "body", "operator_number",
                "to_email", "email_sent", "created_at"]
        msgs = [dict(zip(cols, r)) for r in cur.fetchall()]
        return _resp(200, {"messages": msgs})
    finally:
        conn.close()


def handle_send_message(event: dict, body: dict) -> dict:
    """Оператор отправляет письмо организации (свободный текст)."""
    if not _check_operator(event, body):
        return _resp(401, {"error": "Неверный пароль оператора"})
    app_id = body.get("id")
    message = (body.get("message") or "").strip()
    subject = (body.get("subject") or "Сообщение от оператора СЖОУ").strip()
    operator_number = (body.get("operator_number") or "").strip() or None
    if not app_id or not message:
        return _resp(400, {"error": "Нужен id заявки и текст сообщения"})
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT contact_name, contact_email FROM {TABLE} WHERE id=%s",
            (int(app_id),),
        )
        row = cur.fetchone()
        if not row:
            return _resp(404, {"error": "Заявка не найдена"})
        contact_name, contact_email = row
        email_sent = False
        if contact_email:
            html = _build_message_email(contact_name or "", subject, message, operator_number or "")
            email_sent = _send_email(contact_email, subject, html)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.sjou_oo_messages
            (application_id, direction, subject, body, operator_number, to_email, email_sent)
            VALUES (%s,'outgoing',%s,%s,%s,%s,%s)""",
            (int(app_id), subject, message, operator_number, contact_email, email_sent),
        )
        conn.commit()
        return _resp(200, {"ok": True, "email_sent": email_sent})
    finally:
        conn.close()


def handle_oo_login(body: dict) -> dict:
    """Вход администратора ОО по логину/паролю, выданным при одобрении заявки."""
    login = (body.get("login") or "").strip()
    password = (body.get("password") or "").strip()
    if not login or not password:
        return _resp(400, {"error": "Укажите логин и пароль"})
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""SELECT id, oo_full_name, oo_short_name, contact_name, status
                FROM {TABLE}
                WHERE oo_admin_login=%s AND oo_admin_password=%s""",
            (login, password),
        )
        row = cur.fetchone()
        if not row:
            return _resp(401, {"error": "Неверный логин или пароль"})
        app_id, oo_full_name, oo_short_name, contact_name, status = row
        if status != "approved":
            return _resp(403, {"error": "Доступ организации не активирован"})
        return _resp(200, {
            "ok": True,
            "id": app_id,
            "oo_full_name": oo_full_name,
            "oo_short_name": oo_short_name,
            "contact_name": contact_name,
            "login": login,
        })
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """Заявки ОО в СЖОУ: подача, список для оператора, рассмотрение."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        body = {}

    action = body.get("action", "submit")
    if action == "submit":
        return handle_submit(body, event)
    if action == "list":
        return handle_list(event, body)
    if action == "review":
        return handle_review(event, body)
    if action == "messages":
        return handle_messages(event, body)
    if action == "send_message":
        return handle_send_message(event, body)
    if action == "oo_login":
        return handle_oo_login(body)
    return _resp(400, {"error": "Неизвестное действие"})