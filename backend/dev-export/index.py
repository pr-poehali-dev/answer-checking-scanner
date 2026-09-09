"""
DEV — экспорт данных проекта для переноса на собственный хостинг (Beget и т.п.).

Доступ: только Разработчик, Зам. Главы Правления и Глава Правления (can_dev).
X-Authorization: токен сотрудника УДС.

ВАЖНО: облачная функция физически не имеет доступа к файлам других функций
и к исходникам фронтенда (/src, /backend/*) — каждая функция изолирована.
Поэтому этот экспорт закрывает то, что backend-функции реально доступно:
  1) структура и данные БД (через DATABASE_URL);
  2) список файлов в S3-бакете с прямыми CDN-ссылками (через boto3);
  3) список названий секретов проекта + (по коду подтверждения) их значения.
Код проекта (фронтенд + backend) выгружается штатной кнопкой платформы
«Скачать → Скачать код» / «Подключить GitHub» — экспорт БД/файлов/секретов
её не заменяет, а дополняет.

Действия (?action=...):
  GET  ?action=tables                — список таблиц схемы + кол-во строк
  GET  ?action=schema-all             — DDL (CREATE TABLE) всех таблиц одним текстом
  GET  ?action=table-schema&table=    — DDL одной таблицы
  GET  ?action=table-data&table=      — данные одной таблицы как INSERT-запросы
  GET  ?action=files&prefix=&marker=  — список файлов в S3 (постранично)
  GET  ?action=secrets                — имена секретов проекта + факт установки (без значений)
  POST ?action=reveal-secrets         — {confirm_code} → значения секретов (аудит-лог)
  GET  ?action=info                   — сводка: таблицы/строки, файлы/размер, секреты
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin2026")
# Код подтверждения для выгрузки РЕАЛЬНЫХ значений секретов. Отдельный от
# ADMIN_PASSWORD секрет: раскрытие ключей — самая опасная операция экспорта.
DEV_EXPORT_CODE = os.environ.get("DEV_EXPORT_CODE", "")

# Роли УДС, которым открыт раздел DEV (совпадает с CAN_DEV в backend/uds)
CAN_DEV_ROLES = {"developer", "deputy", "head"}

# Секреты проекта — имена, которые реально использует backend (см. get_secrets).
# Значения не хранятся тут — читаются из os.environ в момент запроса.
SECRET_NAMES = [
    "DATABASE_URL", "MAIN_DB_SCHEMA",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
    "ADMIN_PASSWORD", "CRON_SECRET", "TOKEN_SECRET",
    "GIGACHAT_AUTH_KEY", "OPENROUTER_API_KEY",
    "YANDEXGPT_API_KEY", "YANDEXGPT_FOLDER_ID",
    "YANDEX_CLIENT_ID", "YANDEX_CLIENT_SECRET",
    "VK_CLIENT_ID", "VK_CLIENT_SECRET",
    "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY",
    "YOOKASSA_TEST_SHOP_ID", "YOOKASSA_TEST_SECRET_KEY",
    "ISPMANAGER_URL", "ISPMANAGER_USER", "ISPMANAGER_PASSWORD",
    "MAIL_SMTP_HOST", "MAIL_ENCRYPTION_KEY",
    "UDS_SMTP_HOST", "UDS_SMTP_PORT", "UDS_SMTP_USER", "UDS_SMTP_PASSWORD",
    "SJOU_OPERATOR_PASSWORD",
]

# Известные префиксы папок в S3-бакете "files" (см. put_object по всем функциям)
S3_BUCKET = "files"
S3_PREFIXES = ["materials/", "presentations/", "worksheets/", "projects/", "sjou/applications/"]


def _resp(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


def _text_resp(status: int, text: str, filename: str = None) -> dict:
    headers = {**CORS, "Content-Type": "text/plain; charset=utf-8"}
    if filename:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return {"statusCode": status, "headers": headers, "body": text, "isBase64Encoded": False}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(s: str) -> str:
    import hashlib
    return hashlib.sha256(s.encode()).hexdigest()


def get_caller_role(login: str, token: str, conn):
    """Возвращает panel_role вызывающего, если у него доступ к УДС, иначе None."""
    if not login or not token:
        return None
    expected_admin = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
    if token == expected_admin or (login == "admin" and token.startswith("admin:")):
        return "head"
    cur = conn.cursor()
    cur.execute(f"SELECT is_active, auth_token_hash FROM {SCHEMA}.users WHERE login = %s", (login,))
    row = cur.fetchone()
    if not row:
        return None
    is_active, stored_hash = row
    if not is_active or not stored_hash or hash_password(token) != stored_hash:
        return None
    cur.execute(f"SELECT panel_role FROM {SCHEMA}.panel_operators WHERE login = %s", (login,))
    op = cur.fetchone()
    if not op or not op[0] or op[0] == "removed":
        return None
    return op[0]


def log_action(cur, actor_login, action, details=None):
    cur.execute(
        f"""INSERT INTO {SCHEMA}.uds_audit_log (actor_login, actor_role, action, target_login, details)
            VALUES (%s, %s, %s, %s, %s)""",
        (actor_login, "dev-export", action, None,
         json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else (details or None))
    )


def list_tables(cur) -> list:
    cur.execute(
        """SELECT table_name FROM information_schema.tables
           WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY table_name""",
        (SCHEMA,)
    )
    return [r[0] for r in cur.fetchall()]


def table_row_count(cur, table: str) -> int:
    cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}."{table}"')
    return cur.fetchone()[0]


def table_ddl(cur, table: str) -> str:
    """Генерирует CREATE TABLE из information_schema (без pg_dump — его нет в runtime)."""
    cur.execute(
        """SELECT column_name, data_type, character_maximum_length, numeric_precision,
                  numeric_scale, is_nullable, column_default, udt_name
           FROM information_schema.columns
           WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position""",
        (SCHEMA, table)
    )
    cols = cur.fetchall()
    if not cols:
        return f"-- Таблица {table} не найдена\n"

    cur.execute(
        """SELECT a.attname
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = %s::regclass AND i.indisprimary""",
        (f'{SCHEMA}."{table}"',)
    )
    pk_cols = [r[0] for r in cur.fetchall()]

    lines = []
    for name, dtype, char_len, num_prec, num_scale, nullable, default, udt in cols:
        t = dtype
        if dtype == "character varying":
            t = f"VARCHAR({char_len})" if char_len else "VARCHAR"
        elif dtype == "character":
            t = f"CHAR({char_len})" if char_len else "CHAR"
        elif dtype == "numeric" and num_prec:
            t = f"NUMERIC({num_prec},{num_scale or 0})"
        elif dtype == "timestamp without time zone":
            t = "TIMESTAMP"
        elif dtype == "timestamp with time zone":
            t = "TIMESTAMPTZ"
        elif dtype == "ARRAY":
            t = f"{udt.lstrip('_')}[]"
        elif dtype == "USER-DEFINED":
            t = udt
        else:
            t = dtype.upper()
        parts = [f'  "{name}" {t}']
        if default is not None and "nextval(" not in str(default):
            parts.append(f"DEFAULT {default}")
        elif default is not None:
            parts.append("")  # serial — тип уже несёт autoincrement через SERIAL ниже
        if nullable == "NO":
            parts.append("NOT NULL")
        lines.append(" ".join(p for p in parts if p))
    ddl = f'CREATE TABLE IF NOT EXISTS {SCHEMA}."{table}" (\n' + ",\n".join(lines)
    if pk_cols:
        ddl += f',\n  PRIMARY KEY ({", ".join(chr(34)+c+chr(34) for c in pk_cols)})'
    ddl += "\n);\n"
    return ddl


def table_data_sql(cur, table: str, limit: int = 5000) -> str:
    cur.execute(f'SELECT * FROM {SCHEMA}."{table}" LIMIT %s', (limit,))
    rows = cur.fetchall()
    if not rows:
        return f"-- {table}: нет данных\n"
    col_names = [d.name for d in cur.description]
    cols_sql = ", ".join(f'"{c}"' for c in col_names)
    out = []
    for row in rows:
        values_sql = cur.mogrify(
            "(" + ", ".join(["%s"] * len(row)) + ")", row
        ).decode("utf-8", errors="replace")
        out.append(f'INSERT INTO {SCHEMA}."{table}" ({cols_sql}) VALUES {values_sql};')
    return "\n".join(out) + "\n"


def s3_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cdn_url(key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def handler(event: dict, context) -> dict:
    """DEV: экспорт БД/файлов/секретов проекта для переноса на свой хостинг."""
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
        role = get_caller_role(login, token, conn)
        if not role or role not in CAN_DEV_ROLES:
            return _resp(403, {"error": "Раздел DEV доступен только Разработчику, Зам. Главы и Главе Правления."})

        cur = conn.cursor()

        if action == "tables" and method == "GET":
            tables = list_tables(cur)
            result = [{"table": t, "rows": table_row_count(cur, t)} for t in tables]
            return _resp(200, {"tables": result})

        if action == "schema-all" and method == "GET":
            tables = list_tables(cur)
            ddl = f"-- Дамп структуры схемы {SCHEMA}\n\n"
            ddl += f"CREATE SCHEMA IF NOT EXISTS {SCHEMA};\n\n"
            for t in tables:
                ddl += table_ddl(cur, t) + "\n"
            log_action(cur, login, "dev_export_schema", {"tables": len(tables)})
            conn.commit()
            return _text_resp(200, ddl, filename="schema.sql")

        if action == "table-schema" and method == "GET":
            table = (qs.get("table") or "").strip()
            if not table:
                return _resp(400, {"error": "Укажите table"})
            return _text_resp(200, table_ddl(cur, table), filename=f"{table}_schema.sql")

        if action == "table-data" and method == "GET":
            table = (qs.get("table") or "").strip()
            if not table:
                return _resp(400, {"error": "Укажите table"})
            tables = list_tables(cur)
            if table not in tables:
                return _resp(404, {"error": "Таблица не найдена"})
            sql = table_data_sql(cur, table)
            log_action(cur, login, "dev_export_table_data", {"table": table})
            conn.commit()
            return _text_resp(200, sql, filename=f"{table}_data.sql")

        if action == "files" and method == "GET":
            prefix = (qs.get("prefix") or "").strip()
            marker = (qs.get("marker") or "").strip()
            s3 = s3_client()
            kwargs = {"Bucket": S3_BUCKET, "MaxKeys": 500}
            if prefix:
                kwargs["Prefix"] = prefix
            if marker:
                kwargs["ContinuationToken"] = marker
            resp = s3.list_objects_v2(**kwargs)
            items = [{
                "key": o["Key"], "size": o["Size"],
                "modified": o["LastModified"].isoformat(),
                "url": cdn_url(o["Key"]),
            } for o in resp.get("Contents", [])]
            log_action(cur, login, "dev_export_files", {"prefix": prefix or "all", "count": len(items)})
            conn.commit()
            return _resp(200, {
                "files": items,
                "is_truncated": resp.get("IsTruncated", False),
                "next_marker": resp.get("NextContinuationToken"),
                "known_prefixes": S3_PREFIXES,
            })

        if action == "secrets" and method == "GET":
            items = [{"name": n, "is_set": bool(os.environ.get(n))} for n in SECRET_NAMES]
            return _resp(200, {"secrets": items, "reveal_configured": bool(DEV_EXPORT_CODE)})

        if action == "reveal-secrets" and method == "POST":
            if not DEV_EXPORT_CODE:
                return _resp(400, {"error": "Код подтверждения DEV_EXPORT_CODE не настроен. Обратитесь к разработчику платформы, чтобы создать секрет DEV_EXPORT_CODE."})
            code = (body.get("confirm_code") or "").strip()
            if code != DEV_EXPORT_CODE:
                log_action(cur, login, "dev_export_reveal_secrets_denied", {})
                conn.commit()
                return _resp(403, {"error": "Неверный код подтверждения"})
            items = [{"name": n, "value": os.environ.get(n, "")} for n in SECRET_NAMES if os.environ.get(n)]
            log_action(cur, login, "dev_export_reveal_secrets", {"count": len(items)})
            conn.commit()
            return _resp(200, {"secrets": items})

        if action == "info" and method == "GET":
            tables = list_tables(cur)
            total_rows = sum(table_row_count(cur, t) for t in tables)
            secrets_set = sum(1 for n in SECRET_NAMES if os.environ.get(n))
            s3_count, s3_size = 0, 0
            try:
                s3 = s3_client()
                resp = s3.list_objects_v2(Bucket=S3_BUCKET, MaxKeys=1000)
                s3_count = len(resp.get("Contents", []))
                s3_size = sum(o["Size"] for o in resp.get("Contents", []))
            except Exception:
                pass
            return _resp(200, {
                "schema": SCHEMA,
                "tables_count": len(tables),
                "total_rows": total_rows,
                "s3_bucket": S3_BUCKET,
                "s3_files_count": s3_count,
                "s3_files_size_bytes": s3_size,
                "secrets_total": len(SECRET_NAMES),
                "secrets_set": secrets_set,
            })

        return _resp(404, {"error": f"Неизвестное действие: {action}"})
    finally:
        conn.close()