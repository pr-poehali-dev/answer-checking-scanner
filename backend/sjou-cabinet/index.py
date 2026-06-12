"""
API личного кабинета администратора образовательной организации (ОО) в СЖОУ.
Все запросы требуют login+password администратора ОО (проверяются по таблице заявок).
POST action=overview         — сводка по организации (счётчики)
POST action=classes_list / class_add / class_delete
POST action=teachers_list / teacher_add / teacher_delete
POST action=students_list / student_add / student_delete
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
APPS = f"{SCHEMA}.sjou_oo_applications"
CLASSES = f"{SCHEMA}.sjou_classes"
TEACHERS = f"{SCHEMA}.sjou_teachers"
STUDENTS = f"{SCHEMA}.sjou_students"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }


def _auth(cur, body: dict):
    """Возвращает application_id если логин/пароль верны и ОО одобрена, иначе None."""
    login = (body.get("login") or "").strip()
    password = (body.get("password") or "").strip()
    if not login or not password:
        return None
    cur.execute(
        f"""SELECT id FROM {APPS}
            WHERE oo_admin_login=%s AND oo_admin_password=%s AND status='approved'""",
        (login, password),
    )
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    """Кабинет администратора ОО: классы, учителя, ученики."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        body = {}

    action = body.get("action", "overview")
    conn = get_conn()
    try:
        cur = conn.cursor()
        app_id = _auth(cur, body)
        if not app_id:
            return _resp(401, {"error": "Неверный логин или пароль"})

        if action == "overview":
            cur.execute(f"SELECT COUNT(*) FROM {CLASSES} WHERE application_id=%s", (app_id,))
            classes_n = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {TEACHERS} WHERE application_id=%s", (app_id,))
            teachers_n = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {STUDENTS} WHERE application_id=%s", (app_id,))
            students_n = cur.fetchone()[0]
            cur.execute(f"SELECT oo_full_name FROM {APPS} WHERE id=%s", (app_id,))
            oo_name = cur.fetchone()[0]
            return _resp(200, {"oo_full_name": oo_name, "classes": classes_n,
                               "teachers": teachers_n, "students": students_n})

        # ── Классы ──
        if action == "classes_list":
            cur.execute(
                f"""SELECT c.id, c.name, c.grade, c.homeroom_teacher,
                    (SELECT COUNT(*) FROM {STUDENTS} s WHERE s.class_id=c.id)
                    FROM {CLASSES} c WHERE c.application_id=%s ORDER BY c.grade, c.name""",
                (app_id,))
            cols = ["id", "name", "grade", "homeroom_teacher", "students_count"]
            return _resp(200, {"classes": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "class_add":
            name = (body.get("name") or "").strip()
            if not name:
                return _resp(400, {"error": "Укажите название класса"})
            grade = body.get("grade")
            try:
                grade = int(grade) if grade not in (None, "") else None
            except (ValueError, TypeError):
                grade = None
            cur.execute(
                f"""INSERT INTO {CLASSES} (application_id, name, grade, homeroom_teacher)
                    VALUES (%s,%s,%s,%s) RETURNING id""",
                (app_id, name, grade, (body.get("homeroom_teacher") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "class_delete":
            cid = body.get("id")
            if not cid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"UPDATE {STUDENTS} SET class_id=NULL WHERE class_id=%s AND application_id=%s", (int(cid), app_id))
            cur.execute(f"DELETE FROM {CLASSES} WHERE id=%s AND application_id=%s", (int(cid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Учителя ──
        if action == "teachers_list":
            cur.execute(
                f"""SELECT id, full_name, subject, email, phone
                    FROM {TEACHERS} WHERE application_id=%s ORDER BY full_name""",
                (app_id,))
            cols = ["id", "full_name", "subject", "email", "phone"]
            return _resp(200, {"teachers": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "teacher_add":
            full_name = (body.get("full_name") or "").strip()
            if not full_name:
                return _resp(400, {"error": "Укажите ФИО учителя"})
            cur.execute(
                f"""INSERT INTO {TEACHERS} (application_id, full_name, subject, email, phone)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, full_name,
                 (body.get("subject") or "").strip() or None,
                 (body.get("email") or "").strip() or None,
                 (body.get("phone") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "teacher_delete":
            tid = body.get("id")
            if not tid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {TEACHERS} WHERE id=%s AND application_id=%s", (int(tid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Ученики ──
        if action == "students_list":
            class_id = body.get("class_id")
            if class_id:
                cur.execute(
                    f"""SELECT s.id, s.full_name, s.birth_date, s.parent_name, s.parent_phone,
                        s.class_id, c.name
                        FROM {STUDENTS} s LEFT JOIN {CLASSES} c ON c.id=s.class_id
                        WHERE s.application_id=%s AND s.class_id=%s ORDER BY s.full_name""",
                    (app_id, int(class_id)))
            else:
                cur.execute(
                    f"""SELECT s.id, s.full_name, s.birth_date, s.parent_name, s.parent_phone,
                        s.class_id, c.name
                        FROM {STUDENTS} s LEFT JOIN {CLASSES} c ON c.id=s.class_id
                        WHERE s.application_id=%s ORDER BY s.full_name""",
                    (app_id,))
            cols = ["id", "full_name", "birth_date", "parent_name", "parent_phone", "class_id", "class_name"]
            return _resp(200, {"students": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "student_add":
            full_name = (body.get("full_name") or "").strip()
            if not full_name:
                return _resp(400, {"error": "Укажите ФИО ученика"})
            class_id = body.get("class_id")
            try:
                class_id = int(class_id) if class_id not in (None, "") else None
            except (ValueError, TypeError):
                class_id = None
            cur.execute(
                f"""INSERT INTO {STUDENTS}
                    (application_id, class_id, full_name, birth_date, parent_name, parent_phone)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, class_id, full_name,
                 (body.get("birth_date") or "").strip() or None,
                 (body.get("parent_name") or "").strip() or None,
                 (body.get("parent_phone") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "student_delete":
            sid = body.get("id")
            if not sid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {STUDENTS} WHERE id=%s AND application_id=%s", (int(sid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        return _resp(400, {"error": "Неизвестное действие"})
    finally:
        conn.close()
