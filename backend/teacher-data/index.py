"""
Дублирование данных учителя в централизованную БД на нашем хостинге.
Сохраняется только ИНФОРМАЦИЯ (без файлов работ/презентаций/конспектов).

POST /?action=sync-works      — каталог работ учителя (upsert по work_id)
POST /?action=sync-materials  — каталог сгенерированных материалов (upsert)
POST /?action=log-activity    — журнал действий (подключение Я.Диска, синхронизации и т.п.)
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-User-Login",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _s(v, limit=None):
    """Безопасно приводит значение к строке с ограничением длины."""
    if v is None:
        return None
    s = str(v)
    return s[:limit] if limit else s


def handler(event: dict, context) -> dict:
    """Дублирование каталога работ, материалов и журнала действий учителя в БД."""
    method = event.get("httpMethod", "GET")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if method != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    params = event.get("queryStringParameters") or {}
    action = (params.get("action") or "").strip().lower()

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Некорректный JSON"})

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    teacher_login = (headers.get("x-user-login") or body.get("login") or "").strip()
    if not teacher_login:
        return _resp(400, {"error": "Не указан login учителя"})

    # ── POST sync-works: каталог работ ────────────────────────────────────────
    if action == "sync-works":
        works = body.get("works") or []
        if not isinstance(works, list):
            return _resp(400, {"error": "works должен быть массивом"})
        conn = get_conn()
        saved = 0
        try:
            cur = conn.cursor()
            for w in works:
                work_id = _s(w.get("id") or w.get("work_id"), 32)
                if not work_id:
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.teacher_works
                        (teacher_login, work_id, work_type, subject, class_label, work_date,
                         total_questions, part1_count, part2_count, answer_key, max_score,
                         topic, generated_by_ai, updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                        ON CONFLICT (teacher_login, work_id) DO UPDATE SET
                            work_type = EXCLUDED.work_type,
                            subject = EXCLUDED.subject,
                            class_label = EXCLUDED.class_label,
                            work_date = EXCLUDED.work_date,
                            total_questions = EXCLUDED.total_questions,
                            part1_count = EXCLUDED.part1_count,
                            part2_count = EXCLUDED.part2_count,
                            answer_key = EXCLUDED.answer_key,
                            max_score = EXCLUDED.max_score,
                            topic = EXCLUDED.topic,
                            generated_by_ai = EXCLUDED.generated_by_ai,
                            updated_at = now()""",
                    (
                        teacher_login, work_id,
                        _s(w.get("type"), 64), _s(w.get("subject"), 128),
                        _s(w.get("classLabel"), 32), _s(w.get("date"), 32),
                        int(w.get("totalQuestions") or 0), int(w.get("part1Count") or 0),
                        int(w.get("part2Count") or 0), _s(w.get("answerKey"), 128),
                        int(w.get("maxScore") or 0), _s(w.get("topic"), 512),
                        bool(w.get("generatedByAi")),
                    ),
                )
                saved += 1
            conn.commit()
            return _resp(200, {"ok": True, "saved": saved})
        finally:
            conn.close()

    # ── POST sync-materials: каталог материалов ───────────────────────────────
    if action == "sync-materials":
        items = body.get("materials") or []
        if not isinstance(items, list):
            return _resp(400, {"error": "materials должен быть массивом"})
        conn = get_conn()
        saved = 0
        try:
            cur = conn.cursor()
            for m in items:
                mid = _s(m.get("id") or m.get("material_id"), 64)
                mtype = _s(m.get("type") or m.get("material_type"), 32)
                if not mid or not mtype:
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.teacher_materials
                        (teacher_login, material_id, material_type, title, subject,
                         class_label, topic, filename, size_bytes, uploaded_to_yadisk)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (teacher_login, material_type, material_id) DO UPDATE SET
                            title = EXCLUDED.title,
                            subject = EXCLUDED.subject,
                            class_label = EXCLUDED.class_label,
                            topic = EXCLUDED.topic,
                            filename = EXCLUDED.filename,
                            size_bytes = EXCLUDED.size_bytes,
                            uploaded_to_yadisk = EXCLUDED.uploaded_to_yadisk""",
                    (
                        teacher_login, mid, mtype,
                        _s(m.get("title"), 512), _s(m.get("subject"), 128),
                        _s(m.get("classLabel"), 32), _s(m.get("topic"), 512),
                        _s(m.get("filename"), 256), int(m.get("size") or 0),
                        bool(m.get("uploadedToYadisk")),
                    ),
                )
                saved += 1
            conn.commit()
            return _resp(200, {"ok": True, "saved": saved})
        finally:
            conn.close()

    # ── POST log-activity: журнал действий ────────────────────────────────────
    if action == "log-activity":
        act = _s(body.get("action"), 64)
        if not act:
            return _resp(400, {"error": "Не указано action события"})
        details = body.get("details")
        details_str = json.dumps(details, ensure_ascii=False) if details is not None else None
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.teacher_activity_log
                    (teacher_login, action, entity_type, entity_id, details)
                    VALUES (%s,%s,%s,%s,%s)""",
                (
                    teacher_login, act,
                    _s(body.get("entityType"), 32), _s(body.get("entityId"), 64),
                    details_str,
                ),
            )
            conn.commit()
            return _resp(200, {"ok": True})
        finally:
            conn.close()

    return _resp(404, {"error": "Неизвестное действие"})
