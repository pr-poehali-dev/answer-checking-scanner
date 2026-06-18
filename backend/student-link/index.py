"""
Привязка учеников по 8-символьному коду и доступ к результатам.
POST /register-codes  — учитель регистрирует/обновляет коды учеников в БД
POST /sync-results    — учитель синхронизирует результаты в БД
POST /bind            — ученик привязывает свой аккаунт по 8-символьному коду
GET  /my-binding      — текущая привязка ученика
GET  /my-results      — результаты привязанного ученика
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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


def handler(event: dict, context) -> dict:
    """Привязка учеников по коду и выдача их результатов."""
    method = event.get("httpMethod", "GET")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = (params.get("action") or "").strip().lower()
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    user_login = (headers.get("x-user-login") or body.get("login") or "").strip()

    # ── POST register-codes (учитель) ──────────────────────────────────────
    if method == "POST" and action == "register-codes":
        teacher_login = user_login
        students = body.get("students") or []
        if not teacher_login:
            return _resp(400, {"error": "Не указан логин учителя"})
        if not isinstance(students, list):
            return _resp(400, {"error": "students должен быть массивом"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            saved = 0
            for s in students:
                bind_code = str(s.get("bindCode") or "").strip().upper()[:16]
                student_code = str(s.get("studentCode") or "").strip()[:16]
                full_name = str(s.get("fullName") or "").strip()[:256]
                class_label = str(s.get("classLabel") or "").strip()[:32]
                if not bind_code or not student_code or not full_name:
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.student_codes
                        (bind_code, teacher_login, student_code, full_name, class_label)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (teacher_login, student_code) DO UPDATE
                        SET full_name = EXCLUDED.full_name,
                            class_label = EXCLUDED.class_label""",
                    (bind_code, teacher_login, student_code, full_name, class_label or None)
                )
                saved += 1
            conn.commit()
            return _resp(200, {"success": True, "saved": saved})
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": "Код привязки уже используется"})
        finally:
            conn.close()

    # ── POST sync-results (учитель) ────────────────────────────────────────
    if method == "POST" and action == "sync-results":
        teacher_login = user_login
        results = body.get("results") or []
        if not teacher_login:
            return _resp(400, {"error": "Не указан логин учителя"})
        if not isinstance(results, list):
            return _resp(400, {"error": "results должен быть массивом"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            saved = 0
            for r in results:
                student_code = str(r.get("studentCode") or "").strip()[:16]
                work_id = str(r.get("workId") or "").strip()[:32]
                if not student_code or not work_id:
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.student_results
                        (teacher_login, student_code, work_id, work_title, subject, work_date,
                         correct_count, total_count, score, grade, scanned_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, NOW()), NOW())
                        ON CONFLICT (teacher_login, student_code, work_id) DO UPDATE
                        SET work_title = EXCLUDED.work_title,
                            subject = EXCLUDED.subject,
                            work_date = EXCLUDED.work_date,
                            correct_count = EXCLUDED.correct_count,
                            total_count = EXCLUDED.total_count,
                            score = EXCLUDED.score,
                            grade = EXCLUDED.grade,
                            scanned_at = EXCLUDED.scanned_at,
                            updated_at = NOW()""",
                    (
                        teacher_login, student_code, work_id,
                        str(r.get("workTitle") or "")[:256] or None,
                        str(r.get("subject") or "")[:128] or None,
                        str(r.get("workDate") or "")[:32] or None,
                        int(r.get("correctCount") or 0),
                        int(r.get("totalCount") or 0),
                        int(r.get("score") or 0),
                        str(r.get("grade") or "")[:8] or None,
                        r.get("scannedAt") or None,
                    )
                )
                saved += 1
            conn.commit()
            return _resp(200, {"success": True, "saved": saved})
        finally:
            conn.close()

    # ── POST bind (ученик) ─────────────────────────────────────────────────
    if method == "POST" and action == "bind":
        student_login = user_login
        bind_code = str(body.get("bindCode") or "").strip().upper()[:16]
        if not student_login:
            return _resp(400, {"error": "Не авторизованы"})
        if not bind_code:
            return _resp(400, {"error": "Введите код привязки"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, bound_login, full_name, class_label
                    FROM {SCHEMA}.student_codes WHERE bind_code = %s""",
                (bind_code,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Код не найден. Проверьте код у учителя."})
            sc_id, bound_login, full_name, class_label = row
            if bound_login and bound_login != student_login:
                return _resp(409, {"error": "Этот код уже привязан к другому ученику"})

            # Отвязываем этого ученика от прежних кодов, затем привязываем новый
            cur.execute(
                f"UPDATE {SCHEMA}.student_codes SET bound_login = NULL, bound_at = NULL WHERE bound_login = %s",
                (student_login,)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.student_codes SET bound_login = %s, bound_at = NOW() WHERE id = %s",
                (student_login, sc_id)
            )
            conn.commit()
            return _resp(200, {
                "success": True,
                "full_name": full_name,
                "class_label": class_label,
            })
        finally:
            conn.close()

    # ── GET my-binding (ученик) ────────────────────────────────────────────
    if method == "GET" and action == "my-binding":
        student_login = (params.get("login") or user_login).strip()
        if not student_login:
            return _resp(400, {"error": "Не указан логин"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT bind_code, full_name, class_label, teacher_login
                    FROM {SCHEMA}.student_codes WHERE bound_login = %s LIMIT 1""",
                (student_login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(200, {"bound": False})
            return _resp(200, {
                "bound": True,
                "bind_code": row[0],
                "full_name": row[1],
                "class_label": row[2],
                "teacher_login": row[3],
            })
        finally:
            conn.close()

    # ── GET my-results (ученик) ────────────────────────────────────────────
    if method == "GET" and action == "my-results":
        student_login = (params.get("login") or user_login).strip()
        if not student_login:
            return _resp(400, {"error": "Не указан логин"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT teacher_login, student_code FROM {SCHEMA}.student_codes
                    WHERE bound_login = %s LIMIT 1""",
                (student_login,)
            )
            link = cur.fetchone()
            if not link:
                return _resp(200, {"bound": False, "results": []})
            teacher_login, student_code = link
            cur.execute(
                f"""SELECT work_id, work_title, subject, work_date, correct_count, total_count,
                           score, grade, scanned_at
                    FROM {SCHEMA}.student_results
                    WHERE teacher_login = %s AND student_code = %s
                    ORDER BY scanned_at DESC""",
                (teacher_login, student_code)
            )
            results = []
            for r in cur.fetchall():
                results.append({
                    "workId": r[0],
                    "workTitle": r[1],
                    "subject": r[2],
                    "workDate": r[3],
                    "correctCount": r[4],
                    "totalCount": r[5],
                    "score": r[6],
                    "grade": r[7],
                    "scannedAt": r[8].isoformat() if r[8] else None,
                })
            return _resp(200, {"bound": True, "results": results})
        finally:
            conn.close()

    return _resp(404, {"error": "Неизвестное действие"})
