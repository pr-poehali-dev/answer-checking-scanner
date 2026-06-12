"""
API заявок на регистрацию образовательных организаций (ОО) в СЖОУ.
POST /         (action=submit)  — подать заявку (публично) + загрузить файл заявления
POST /         (action=list)    — список заявок для оператора (требует пароль оператора)
POST /         (action=review)  — одобрить/отклонить заявку с комментарием (оператор)
                                  + автоматическое письмо организации на email
"""
import json
import os
import base64
import uuid
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


def _check_operator(event: dict) -> bool:
    headers = event.get("headers", {})
    pwd = headers.get("X-Operator-Password") or headers.get("x-operator-password")
    if not pwd:
        return False
    pwd = pwd.strip()
    valid = set()
    for key in ("SJOU_OPERATOR_PASSWORD", "ADMIN_PASSWORD"):
        v = os.environ.get(key)
        if v:
            valid.add(v.strip())
    return pwd in valid


def _operator_debug(event: dict) -> dict:
    headers = event.get("headers", {})
    pwd = headers.get("X-Operator-Password") or headers.get("x-operator-password") or ""
    return {
        "got_password_len": len(pwd.strip()),
        "sjou_pwd_set": bool(os.environ.get("SJOU_OPERATOR_PASSWORD")),
        "admin_pwd_set": bool(os.environ.get("ADMIN_PASSWORD")),
        "sjou_pwd_len": len((os.environ.get("SJOU_OPERATOR_PASSWORD") or "").strip()),
        "admin_pwd_len": len((os.environ.get("ADMIN_PASSWORD") or "").strip()),
    }


def _row_to_dict(r) -> dict:
    cols = [
        "id", "oo_full_name", "oo_short_name", "oo_type", "inn", "ogrn",
        "legal_address", "actual_address", "region", "director_name",
        "contact_name", "contact_position", "contact_phone", "contact_email",
        "students_count", "statement_file_url", "statement_file_name",
        "status", "operator_comment", "reviewed_at", "created_at",
    ]
    d = dict(zip(cols, r))
    d["oo_type_label"] = OO_TYPES.get(d.get("oo_type"), d.get("oo_type"))
    return d


def handle_submit(body: dict) -> dict:
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
        conn.commit()
        return _resp(200, {"ok": True, "id": new_id})
    finally:
        conn.close()


def handle_list(event: dict, body: dict) -> dict:
    if not _check_operator(event):
        return _resp(401, {"error": "Неверный пароль оператора", "debug": _operator_debug(event)})
    status = (body.get("status") or "").strip()
    conn = get_conn()
    try:
        cur = conn.cursor()
        if status in ("pending", "approved", "rejected"):
            cur.execute(f"SELECT * FROM {TABLE} WHERE status=%s ORDER BY created_at DESC", (status,))
        else:
            cur.execute(f"SELECT * FROM {TABLE} ORDER BY created_at DESC")
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


def _build_email(app: dict, decision: str, comment: str) -> tuple:
    name = app.get("oo_full_name", "")
    contact = app.get("contact_name", "")
    if decision == "approved":
        subject = "СЖОУ: заявка вашей организации одобрена"
        status_html = (
            '<p style="font-size:16px;color:#16a34a;font-weight:600">'
            "Ваша заявка на регистрацию в системе СЖОУ одобрена!</p>"
        )
        next_html = (
            "<p>В ближайшее время с вами свяжется специалист СЖОУ для настройки "
            "доступа и добавления участников вашей организации.</p>"
        )
    else:
        subject = "СЖОУ: заявка вашей организации отклонена"
        status_html = (
            '<p style="font-size:16px;color:#dc2626;font-weight:600">'
            "К сожалению, ваша заявка на регистрацию в СЖОУ отклонена.</p>"
        )
        next_html = (
            "<p>Вы можете подать заявку повторно, устранив указанные замечания, "
            "или связаться с оператором для уточнения деталей.</p>"
        )
    comment_html = (
        f'<div style="margin:16px 0;padding:14px 16px;background:#f1f5f9;'
        f'border-radius:8px;color:#334155"><b>Комментарий оператора:</b><br>{comment}</div>'
        if comment else ""
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px;
                  border-radius:12px 12px 0 0;color:#fff">
        <div style="font-size:20px;font-weight:800">СЖОУ</div>
        <div style="font-size:13px;opacity:.85">Электронный журнал и дневник</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
        <p>Здравствуйте, {contact}!</p>
        {status_html}
        <p style="color:#475569">Организация: <b>{name}</b></p>
        {comment_html}
        {next_html}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
        <p style="font-size:12px;color:#94a3b8">
          Это автоматическое письмо системы СЖОУ. Данные хранятся на серверах в России
          в соответствии с требованиями Минпросвещения РФ.
        </p>
      </div>
    </div>
    """
    return subject, html


def handle_review(event: dict, body: dict) -> dict:
    if not _check_operator(event):
        return _resp(401, {"error": "Неверный пароль оператора"})
    app_id = body.get("id")
    decision = (body.get("decision") or "").strip()
    comment = (body.get("comment") or "").strip() or None
    if not app_id or decision not in ("approved", "rejected"):
        return _resp(400, {"error": "Нужен id и решение (approved/rejected)"})
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE {TABLE}
            SET status=%s, operator_comment=%s, reviewed_at=NOW()
            WHERE id=%s
            RETURNING oo_full_name, contact_name, contact_email""",
            (decision, comment, int(app_id)),
        )
        row = cur.fetchone()
        if not row:
            return _resp(404, {"error": "Заявка не найдена"})
        conn.commit()
    finally:
        conn.close()

    app_data = {
        "oo_full_name": row[0],
        "contact_name": row[1],
        "contact_email": row[2],
    }
    email_sent = False
    if app_data["contact_email"]:
        subject, html = _build_email(app_data, decision, comment or "")
        email_sent = _send_email(app_data["contact_email"], subject, html)

    return _resp(200, {"ok": True, "email_sent": email_sent})


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
        return handle_submit(body)
    if action == "list":
        return handle_list(event, body)
    if action == "review":
        return handle_review(event, body)
    return _resp(400, {"error": "Неизвестное действие"})