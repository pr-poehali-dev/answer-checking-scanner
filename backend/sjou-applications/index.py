"""
API заявок на регистрацию образовательных организаций (ОО) в СЖОУ.
POST /         (action=submit)  — подать заявку (публично) + загрузить файл заявления
POST /         (action=list)    — список заявок для оператора (требует пароль оператора)
POST /         (action=review)  — одобрить/отклонить заявку с комментарием (оператор)
"""
import json
import os
import base64
import uuid
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
    return bool(pwd) and pwd == os.environ.get("ADMIN_PASSWORD")


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
        return _resp(401, {"error": "Неверный пароль оператора"})
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
            WHERE id=%s RETURNING id""",
            (decision, comment, int(app_id)),
        )
        if not cur.fetchone():
            return _resp(404, {"error": "Заявка не найдена"})
        conn.commit()
        return _resp(200, {"ok": True})
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
        return handle_submit(body)
    if action == "list":
        return handle_list(event, body)
    if action == "review":
        return handle_review(event, body)
    return _resp(400, {"error": "Неизвестное действие"})
