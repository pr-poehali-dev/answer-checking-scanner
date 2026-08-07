"""
Автоочистка пользовательских данных: всё, что не менялось дольше срока хранения
(по умолчанию 2 месяца), убирается из базы. Срок считается ОТ ДАТЫ ИЗМЕНЕНИЯ
каждой записи — то есть у каждого файла свой отсчёт.

GET  /?action=preview  — сколько записей просрочено (ничего не меняет)
POST /?action=run      — выполнить очистку
GET  /?action=log      — журнал последних очисток
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
RETENTION_DAYS = int(os.environ.get("DATA_RETENTION_DAYS", "60"))

# Таблицы пользовательских данных и колонка с датой изменения.
# У каждой записи свой отсчёт: удаляется та, что не менялась RETENTION_DAYS.
TARGETS = [
    ("teacher_materials", "updated_at", "teacher_login"),
    ("teacher_works", "updated_at", "teacher_login"),
    ("student_results", "updated_at", "teacher_login"),
    ("teacher_activity_log", "created_at", "teacher_login"),
    ("material_downloads", "created_at", None),
    ("ai_token_logs", "created_at", "login"),
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def handler(event: dict, context) -> dict:
    """Автоочистка данных, не изменявшихся дольше срока хранения (2 месяца)."""
    method = event.get("httpMethod", "GET")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = (params.get("action") or "").strip().lower()

    conn = get_conn()
    try:
        cur = conn.cursor()

        # ── preview: сколько записей просрочено ───────────────────────────────
        if action == "preview" and method == "GET":
            items = []
            total = 0
            for table, date_col, _owner in TARGETS:
                cur.execute(
                    f"""SELECT count(*) FROM {SCHEMA}.{table}
                        WHERE {date_col} < NOW() - INTERVAL '{RETENTION_DAYS} days'""")
                n = cur.fetchone()[0]
                items.append({"table": table, "date_column": date_col, "expired": n})
                total += n
            return _resp(200, {
                "retention_days": RETENTION_DAYS,
                "total_expired": total,
                "tables": items,
            })

        # ── log: журнал последних очисток ─────────────────────────────────────
        if action == "log" and method == "GET":
            cur.execute(
                f"""SELECT table_name, owner_login, purged_count, cutoff_at, created_at
                    FROM {SCHEMA}.data_retention_log
                    ORDER BY created_at DESC LIMIT 200""")
            rows = [{
                "table": r[0], "owner_login": r[1], "purged_count": r[2],
                "cutoff_at": str(r[3]) if r[3] else None,
                "created_at": str(r[4]) if r[4] else None,
            } for r in cur.fetchall()]
            return _resp(200, {"retention_days": RETENTION_DAYS, "log": rows})

        # ── run: выполнить очистку ────────────────────────────────────────────
        if action == "run" and method == "POST":
            cur.execute(f"SELECT NOW() - INTERVAL '{RETENTION_DAYS} days'")
            cutoff = cur.fetchone()[0]
            report = []
            total = 0
            for table, date_col, _owner in TARGETS:
                cur.execute(
                    f"""DELETE FROM {SCHEMA}.{table}
                        WHERE {date_col} < %s""", (cutoff,))
                # rowcount может быть -1, если ничего не совпало — нормализуем
                n = cur.rowcount if (cur.rowcount and cur.rowcount > 0) else 0
                total += n
                report.append({"table": table, "purged": n})
                if n:
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.data_retention_log
                            (table_name, purged_count, cutoff_at)
                            VALUES (%s,%s,%s)""", (table, n, cutoff))
            conn.commit()
            return _resp(200, {
                "ok": True,
                "retention_days": RETENTION_DAYS,
                "cutoff_at": str(cutoff),
                "total_purged": total,
                "tables": report,
            })

        return _resp(404, {"error": "Неизвестное действие"})
    finally:
        conn.close()