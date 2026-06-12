"""
API единого входа и кабинетов участников ОО в СЖОУ (учитель, ученик, родитель).
POST action=login            — вход по логину/паролю (любая роль: admin/teacher/student/parent)
Учитель:
  action=t_classes / t_journal / t_grade_set / t_grade_delete
  action=t_schedule / t_homework_list / t_homework_add / t_homework_delete
  action=t_announce_list / t_announce_add / t_announce_delete
Ученик:
  action=s_dashboard (оценки, расписание, ДЗ, объявления)
Родитель:
  action=p_children / p_child_dashboard
Все запросы (кроме login) требуют login+password.
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
LESSONS = f"{SCHEMA}.sjou_lessons"
GRADES = f"{SCHEMA}.sjou_grades"
ACCOUNTS = f"{SCHEMA}.sjou_accounts"
PARENT_CHILDREN = f"{SCHEMA}.sjou_parent_children"
HOMEWORK = f"{SCHEMA}.sjou_homework"
ANNOUNCE = f"{SCHEMA}.sjou_announcements"

WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }


def _auth(cur, body: dict):
    """Возвращает dict с данными аккаунта или None. Роли: admin/teacher/student/parent."""
    login = (body.get("login") or "").strip()
    password = (body.get("password") or "").strip()
    if not login or not password:
        return None
    # Сначала проверяем админа ОО
    cur.execute(
        f"""SELECT id, oo_full_name FROM {APPS}
            WHERE oo_admin_login=%s AND oo_admin_password=%s AND status='approved'""",
        (login, password))
    row = cur.fetchone()
    if row:
        return {"role": "admin", "application_id": row[0], "oo_full_name": row[1],
                "account_id": None, "full_name": "Администратор", "teacher_id": None, "student_id": None}
    # Затем участников
    cur.execute(
        f"""SELECT a.id, a.role, a.application_id, a.full_name, a.teacher_id, a.student_id, ap.oo_full_name
            FROM {ACCOUNTS} a JOIN {APPS} ap ON ap.id=a.application_id
            WHERE a.login=%s AND a.password=%s AND ap.status='approved'""",
        (login, password))
    row = cur.fetchone()
    if row:
        return {"account_id": row[0], "role": row[1], "application_id": row[2],
                "full_name": row[3], "teacher_id": row[4], "student_id": row[5],
                "oo_full_name": row[6]}
    return None


def _classes(cur, app_id):
    cur.execute(f"SELECT id, name FROM {CLASSES} WHERE application_id=%s ORDER BY grade, name", (app_id,))
    return [{"id": r[0], "name": r[1]} for r in cur.fetchall()]


def _student_dashboard(cur, app_id, student_id):
    cur.execute(f"SELECT class_id, full_name FROM {STUDENTS} WHERE id=%s AND application_id=%s",
                (student_id, app_id))
    srow = cur.fetchone()
    if not srow:
        return {"error": "Ученик не найден"}
    class_id, full_name = srow
    class_name = None
    schedule = []
    homework = []
    if class_id:
        cur.execute(f"SELECT name FROM {CLASSES} WHERE id=%s", (class_id,))
        cn = cur.fetchone()
        class_name = cn[0] if cn else None
        cur.execute(
            f"""SELECT l.subject, l.day_of_week, l.lesson_number, l.room, t.full_name
                FROM {LESSONS} l LEFT JOIN {TEACHERS} t ON t.id=l.teacher_id
                WHERE l.class_id=%s ORDER BY l.day_of_week, l.lesson_number""",
            (class_id,))
        schedule = [{"subject": r[0], "day_of_week": r[1], "lesson_number": r[2],
                     "room": r[3], "teacher_name": r[4]} for r in cur.fetchall()]
        cur.execute(
            f"""SELECT subject, due_date, text, author_name FROM {HOMEWORK}
                WHERE class_id=%s ORDER BY due_date DESC, id DESC LIMIT 50""",
            (class_id,))
        homework = [{"subject": r[0], "due_date": r[1], "text": r[2], "author_name": r[3]}
                    for r in cur.fetchall()]
    cur.execute(
        f"""SELECT subject, grade_value, grade_date, comment FROM {GRADES}
            WHERE student_id=%s ORDER BY grade_date DESC, id DESC LIMIT 200""",
        (student_id,))
    grades = [{"subject": r[0], "grade_value": r[1], "grade_date": r[2], "comment": r[3]}
              for r in cur.fetchall()]
    # Объявления: для класса ученика или всей школы
    cur.execute(
        f"""SELECT title, body, author_name, created_at FROM {ANNOUNCE}
            WHERE application_id=%s AND (class_id IS NULL OR class_id=%s)
            ORDER BY created_at DESC LIMIT 50""",
        (app_id, class_id))
    announcements = [{"title": r[0], "body": r[1], "author_name": r[2], "created_at": r[3]}
                     for r in cur.fetchall()]
    return {"full_name": full_name, "class_name": class_name, "schedule": schedule,
            "homework": homework, "grades": grades, "announcements": announcements,
            "weekdays": WEEKDAYS}


def handler(event: dict, context) -> dict:
    """Единый вход и кабинеты учителя/ученика/родителя СЖОУ."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        body = {}

    action = body.get("action", "login")
    conn = get_conn()
    try:
        cur = conn.cursor()
        acc = _auth(cur, body)
        if not acc:
            return _resp(401, {"error": "Неверный логин или пароль"})
        app_id = acc["application_id"]

        if action == "login":
            return _resp(200, {"ok": True, "role": acc["role"],
                               "full_name": acc["full_name"],
                               "oo_full_name": acc["oo_full_name"]})

        # ── УЧИТЕЛЬ ──
        if action == "t_classes":
            return _resp(200, {"classes": _classes(cur, app_id)})

        if action == "t_schedule":
            cur.execute(
                f"""SELECT l.id, l.class_id, c.name, l.subject, l.day_of_week, l.lesson_number, l.room
                    FROM {LESSONS} l JOIN {CLASSES} c ON c.id=l.class_id
                    WHERE l.application_id=%s
                    ORDER BY l.day_of_week, l.lesson_number""",
                (app_id,))
            cols = ["id", "class_id", "class_name", "subject", "day_of_week", "lesson_number", "room"]
            return _resp(200, {"lessons": [dict(zip(cols, r)) for r in cur.fetchall()],
                               "weekdays": WEEKDAYS})

        if action == "t_journal":
            class_id = body.get("class_id")
            subject = (body.get("subject") or "").strip()
            date = (body.get("grade_date") or "").strip()
            if not class_id or not subject:
                return _resp(400, {"error": "Укажите класс и предмет"})
            cur.execute(
                f"SELECT id, full_name FROM {STUDENTS} WHERE application_id=%s AND class_id=%s ORDER BY full_name",
                (app_id, int(class_id)))
            students = [{"id": r[0], "full_name": r[1]} for r in cur.fetchall()]
            if date:
                cur.execute(
                    f"""SELECT id, student_id, grade_value, comment FROM {GRADES}
                        WHERE application_id=%s AND class_id=%s AND subject=%s AND grade_date=%s""",
                    (app_id, int(class_id), subject, date))
            else:
                cur.execute(
                    f"""SELECT id, student_id, grade_value, comment FROM {GRADES}
                        WHERE application_id=%s AND class_id=%s AND subject=%s""",
                    (app_id, int(class_id), subject))
            grades = [{"id": r[0], "student_id": r[1], "grade_value": r[2], "comment": r[3]}
                      for r in cur.fetchall()]
            return _resp(200, {"students": students, "grades": grades})

        if action == "t_grade_set":
            class_id = body.get("class_id")
            student_id = body.get("student_id")
            subject = (body.get("subject") or "").strip()
            date = (body.get("grade_date") or "").strip()
            value = body.get("grade_value")
            if not class_id or not student_id or not subject or not date or value in (None, ""):
                return _resp(400, {"error": "Не хватает данных"})
            try:
                value = int(value)
            except (ValueError, TypeError):
                return _resp(400, {"error": "Оценка должна быть числом"})
            if value < 1 or value > 5:
                return _resp(400, {"error": "Оценка от 1 до 5"})
            cur.execute(
                f"""INSERT INTO {GRADES}
                    (application_id, student_id, class_id, subject, grade_value, grade_date, comment)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, int(student_id), int(class_id), subject, value, date,
                 (body.get("comment") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "t_grade_delete":
            gid = body.get("id")
            if not gid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {GRADES} WHERE id=%s AND application_id=%s", (int(gid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        if action == "t_homework_list":
            class_id = body.get("class_id")
            if not class_id:
                return _resp(400, {"error": "Нужен class_id"})
            cur.execute(
                f"""SELECT id, subject, due_date, text, author_name FROM {HOMEWORK}
                    WHERE application_id=%s AND class_id=%s ORDER BY due_date DESC, id DESC""",
                (app_id, int(class_id)))
            cols = ["id", "subject", "due_date", "text", "author_name"]
            return _resp(200, {"homework": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "t_homework_add":
            class_id = body.get("class_id")
            subject = (body.get("subject") or "").strip()
            due = (body.get("due_date") or "").strip()
            text = (body.get("text") or "").strip()
            if not class_id or not subject or not due or not text:
                return _resp(400, {"error": "Заполните класс, предмет, дату и текст"})
            cur.execute(
                f"""INSERT INTO {HOMEWORK} (application_id, class_id, subject, due_date, text, author_name)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, int(class_id), subject, due, text, acc["full_name"]))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "t_homework_delete":
            hid = body.get("id")
            if not hid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {HOMEWORK} WHERE id=%s AND application_id=%s", (int(hid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        if action == "t_announce_list":
            cur.execute(
                f"""SELECT a.id, a.class_id, c.name, a.title, a.body, a.author_name, a.created_at
                    FROM {ANNOUNCE} a LEFT JOIN {CLASSES} c ON c.id=a.class_id
                    WHERE a.application_id=%s ORDER BY a.created_at DESC""",
                (app_id,))
            cols = ["id", "class_id", "class_name", "title", "body", "author_name", "created_at"]
            return _resp(200, {"announcements": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "t_announce_add":
            title = (body.get("title") or "").strip()
            text = (body.get("body") or "").strip()
            if not title or not text:
                return _resp(400, {"error": "Заполните заголовок и текст"})
            class_id = body.get("class_id")
            try:
                class_id = int(class_id) if class_id not in (None, "") else None
            except (ValueError, TypeError):
                class_id = None
            cur.execute(
                f"""INSERT INTO {ANNOUNCE} (application_id, class_id, title, body, author_name)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, class_id, title, text, acc["full_name"]))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "t_announce_delete":
            aid = body.get("id")
            if not aid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {ANNOUNCE} WHERE id=%s AND application_id=%s", (int(aid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── УЧЕНИК ──
        if action == "s_dashboard":
            if not acc.get("student_id"):
                return _resp(403, {"error": "Это не ученический аккаунт"})
            return _resp(200, _student_dashboard(cur, app_id, acc["student_id"]))

        # ── РОДИТЕЛЬ ──
        if action == "p_children":
            if acc["role"] != "parent":
                return _resp(403, {"error": "Это не родительский аккаунт"})
            cur.execute(
                f"""SELECT s.id, s.full_name, c.name
                    FROM {PARENT_CHILDREN} pc JOIN {STUDENTS} s ON s.id=pc.student_id
                    LEFT JOIN {CLASSES} c ON c.id=s.class_id
                    WHERE pc.parent_account_id=%s ORDER BY s.full_name""",
                (acc["account_id"],))
            children = [{"id": r[0], "full_name": r[1], "class_name": r[2]} for r in cur.fetchall()]
            return _resp(200, {"children": children})

        if action == "p_child_dashboard":
            if acc["role"] != "parent":
                return _resp(403, {"error": "Это не родительский аккаунт"})
            student_id = body.get("student_id")
            if not student_id:
                return _resp(400, {"error": "Нужен student_id"})
            # Проверяем, что ребёнок принадлежит этому родителю
            cur.execute(
                f"SELECT 1 FROM {PARENT_CHILDREN} WHERE parent_account_id=%s AND student_id=%s",
                (acc["account_id"], int(student_id)))
            if not cur.fetchone():
                return _resp(403, {"error": "Нет доступа к этому ученику"})
            return _resp(200, _student_dashboard(cur, app_id, int(student_id)))

        return _resp(400, {"error": "Неизвестное действие"})
    finally:
        conn.close()
