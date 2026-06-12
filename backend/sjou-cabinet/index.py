"""
API личного кабинета администратора образовательной организации (ОО) в СЖОУ.
Все запросы требуют login+password администратора ОО (проверяются по таблице заявок).
POST action=overview         — сводка по организации (счётчики)
POST action=classes_list / class_add / class_delete
POST action=teachers_list / teacher_add / teacher_delete
POST action=students_list / student_add / student_delete
POST action=lessons_list / lesson_add / lesson_delete   — расписание
POST action=journal / grade_set / grade_delete          — журнал оценок
POST action=homework_list / homework_add / homework_delete
POST action=announce_list / announce_add / announce_delete
При добавлении учителя/ученика автоматически создаётся аккаунт (логин/пароль).
"""
import json
import os
import secrets
import string
import re
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

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def _translit(s: str) -> str:
    out = []
    for ch in (s or '').strip().lower():
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isalnum():
            out.append(ch)
    return re.sub(r'[^a-z0-9]', '', ''.join(out))


def _gen_password(length: int = 8) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _gen_account(cur, app_id: int, role: str, full_name: str,
                 teacher_id=None, student_id=None) -> tuple:
    """Создаёт аккаунт с уникальным логином и паролем. Возвращает (account_id, login, password)."""
    prefix = {"teacher": "t", "student": "s", "parent": "p"}.get(role, "u")
    base = (_translit(full_name) or role)[:20]
    candidate = f"{prefix}_{base}"
    n = 1
    while True:
        cur.execute(f"SELECT 1 FROM {ACCOUNTS} WHERE login=%s", (candidate,))
        if not cur.fetchone():
            break
        n += 1
        candidate = f"{prefix}_{base}{n}"
    password = _gen_password()
    cur.execute(
        f"""INSERT INTO {ACCOUNTS}
            (application_id, role, login, password, full_name, teacher_id, student_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (app_id, role, candidate, password, full_name, teacher_id, student_id),
    )
    return cur.fetchone()[0], candidate, password


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
            rows = cur.fetchall()
            cols = ["id", "full_name", "subject", "email", "phone"]
            teachers = [dict(zip(cols, r)) for r in rows]
            cur.execute(
                f"SELECT teacher_id, login, password FROM {ACCOUNTS} WHERE application_id=%s AND role='teacher'",
                (app_id,))
            accmap = {r[0]: {"login": r[1], "password": r[2]} for r in cur.fetchall()}
            for t in teachers:
                acc = accmap.get(t["id"])
                t["login"] = acc["login"] if acc else None
                t["password"] = acc["password"] if acc else None
            return _resp(200, {"teachers": teachers})

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
            _, acc_login, acc_pwd = _gen_account(cur, app_id, "teacher", full_name, teacher_id=new_id)
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id, "login": acc_login, "password": acc_pwd})

        if action == "teacher_delete":
            tid = body.get("id")
            if not tid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {ACCOUNTS} WHERE teacher_id=%s AND application_id=%s", (int(tid), app_id))
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
            students = [dict(zip(cols, r)) for r in cur.fetchall()]
            # Аккаунт ученика
            cur.execute(
                f"SELECT student_id, login, password FROM {ACCOUNTS} WHERE application_id=%s AND role='student'",
                (app_id,))
            smap = {r[0]: {"login": r[1], "password": r[2]} for r in cur.fetchall()}
            # Аккаунты родителей по детям
            cur.execute(
                f"""SELECT pc.student_id, a.login, a.password
                    FROM {PARENT_CHILDREN} pc JOIN {ACCOUNTS} a ON a.id=pc.parent_account_id
                    WHERE a.application_id=%s""",
                (app_id,))
            pmap = {}
            for sid, plogin, ppwd in cur.fetchall():
                pmap.setdefault(sid, {"login": plogin, "password": ppwd})
            for s in students:
                acc = smap.get(s["id"])
                s["login"] = acc["login"] if acc else None
                s["password"] = acc["password"] if acc else None
                pacc = pmap.get(s["id"])
                s["parent_login"] = pacc["login"] if pacc else None
                s["parent_password"] = pacc["password"] if pacc else None
            return _resp(200, {"students": students})

        if action == "student_add":
            full_name = (body.get("full_name") or "").strip()
            if not full_name:
                return _resp(400, {"error": "Укажите ФИО ученика"})
            class_id = body.get("class_id")
            try:
                class_id = int(class_id) if class_id not in (None, "") else None
            except (ValueError, TypeError):
                class_id = None
            parent_name = (body.get("parent_name") or "").strip() or None
            cur.execute(
                f"""INSERT INTO {STUDENTS}
                    (application_id, class_id, full_name, birth_date, parent_name, parent_phone)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, class_id, full_name,
                 (body.get("birth_date") or "").strip() or None,
                 parent_name,
                 (body.get("parent_phone") or "").strip() or None))
            new_id = cur.fetchone()[0]
            # Аккаунт ученика
            _, s_login, s_pwd = _gen_account(cur, app_id, "student", full_name, student_id=new_id)
            result = {"ok": True, "id": new_id, "login": s_login, "password": s_pwd}
            # Аккаунт родителя (привязан к ребёнку), создаём если указано имя родителя
            if parent_name:
                p_acc_id, p_login, p_pwd = _gen_account(cur, app_id, "parent", parent_name)
                cur.execute(
                    f"INSERT INTO {PARENT_CHILDREN} (parent_account_id, student_id) VALUES (%s,%s)",
                    (p_acc_id, new_id))
                result["parent_login"] = p_login
                result["parent_password"] = p_pwd
            conn.commit()
            return _resp(200, result)

        if action == "student_delete":
            sid = body.get("id")
            if not sid:
                return _resp(400, {"error": "Нужен id"})
            sid = int(sid)
            # Удаляем оценки, ДЗ-связи отсутствуют, аккаунт ученика и родительские связи
            cur.execute(
                f"""DELETE FROM {PARENT_CHILDREN} WHERE student_id=%s
                    AND parent_account_id IN (SELECT id FROM {ACCOUNTS} WHERE application_id=%s)""",
                (sid, app_id))
            # Удаляем родительские аккаунты, у которых не осталось детей
            cur.execute(
                f"""DELETE FROM {ACCOUNTS} WHERE role='parent' AND application_id=%s
                    AND id NOT IN (SELECT parent_account_id FROM {PARENT_CHILDREN})""",
                (app_id,))
            cur.execute(f"DELETE FROM {GRADES} WHERE student_id=%s AND application_id=%s", (sid, app_id))
            cur.execute(f"DELETE FROM {ACCOUNTS} WHERE student_id=%s AND application_id=%s", (sid, app_id))
            cur.execute(f"DELETE FROM {STUDENTS} WHERE id=%s AND application_id=%s", (sid, app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Расписание ──
        if action == "lessons_list":
            class_id = body.get("class_id")
            if not class_id:
                return _resp(400, {"error": "Нужен class_id"})
            cur.execute(
                f"""SELECT l.id, l.subject, l.day_of_week, l.lesson_number, l.room,
                    l.teacher_id, t.full_name
                    FROM {LESSONS} l LEFT JOIN {TEACHERS} t ON t.id=l.teacher_id
                    WHERE l.application_id=%s AND l.class_id=%s
                    ORDER BY l.day_of_week, l.lesson_number""",
                (app_id, int(class_id)))
            cols = ["id", "subject", "day_of_week", "lesson_number", "room", "teacher_id", "teacher_name"]
            return _resp(200, {"lessons": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "lesson_add":
            class_id = body.get("class_id")
            subject = (body.get("subject") or "").strip()
            day = body.get("day_of_week")
            num = body.get("lesson_number")
            if not class_id or not subject or day in (None, "") or num in (None, ""):
                return _resp(400, {"error": "Укажите класс, предмет, день и номер урока"})
            teacher_id = body.get("teacher_id")
            try:
                teacher_id = int(teacher_id) if teacher_id not in (None, "") else None
            except (ValueError, TypeError):
                teacher_id = None
            cur.execute(
                f"""INSERT INTO {LESSONS}
                    (application_id, class_id, teacher_id, subject, day_of_week, lesson_number, room)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, int(class_id), teacher_id, subject, int(day), int(num),
                 (body.get("room") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "lesson_delete":
            lid = body.get("id")
            if not lid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {LESSONS} WHERE id=%s AND application_id=%s", (int(lid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Журнал оценок ──
        if action == "journal":
            # Список учеников класса + их оценки по предмету на дату
            class_id = body.get("class_id")
            subject = (body.get("subject") or "").strip()
            date = (body.get("grade_date") or "").strip()
            if not class_id or not subject:
                return _resp(400, {"error": "Укажите класс и предмет"})
            cur.execute(
                f"""SELECT id, full_name FROM {STUDENTS}
                    WHERE application_id=%s AND class_id=%s ORDER BY full_name""",
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

        if action == "grade_set":
            class_id = body.get("class_id")
            student_id = body.get("student_id")
            subject = (body.get("subject") or "").strip()
            date = (body.get("grade_date") or "").strip()
            value = body.get("grade_value")
            if not class_id or not student_id or not subject or not date or value in (None, ""):
                return _resp(400, {"error": "Не хватает данных для оценки"})
            try:
                value = int(value)
            except (ValueError, TypeError):
                return _resp(400, {"error": "Оценка должна быть числом"})
            if value < 1 or value > 5:
                return _resp(400, {"error": "Оценка должна быть от 1 до 5"})
            cur.execute(
                f"""INSERT INTO {GRADES}
                    (application_id, student_id, class_id, subject, grade_value, grade_date, comment)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, int(student_id), int(class_id), subject, value, date,
                 (body.get("comment") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "grade_delete":
            gid = body.get("id")
            if not gid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {GRADES} WHERE id=%s AND application_id=%s", (int(gid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Домашние задания ──
        if action == "homework_list":
            class_id = body.get("class_id")
            if not class_id:
                return _resp(400, {"error": "Нужен class_id"})
            cur.execute(
                f"""SELECT id, subject, due_date, text, author_name, created_at
                    FROM {HOMEWORK} WHERE application_id=%s AND class_id=%s
                    ORDER BY due_date DESC, id DESC""",
                (app_id, int(class_id)))
            cols = ["id", "subject", "due_date", "text", "author_name", "created_at"]
            return _resp(200, {"homework": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "homework_add":
            class_id = body.get("class_id")
            subject = (body.get("subject") or "").strip()
            due = (body.get("due_date") or "").strip()
            text = (body.get("text") or "").strip()
            if not class_id or not subject or not due or not text:
                return _resp(400, {"error": "Укажите класс, предмет, дату и текст задания"})
            cur.execute(
                f"""INSERT INTO {HOMEWORK} (application_id, class_id, subject, due_date, text, author_name)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, int(class_id), subject, due, text, (body.get("author_name") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "homework_delete":
            hid = body.get("id")
            if not hid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {HOMEWORK} WHERE id=%s AND application_id=%s", (int(hid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        # ── Объявления ──
        if action == "announce_list":
            cur.execute(
                f"""SELECT a.id, a.class_id, c.name, a.title, a.body, a.author_name, a.created_at
                    FROM {ANNOUNCE} a LEFT JOIN {CLASSES} c ON c.id=a.class_id
                    WHERE a.application_id=%s ORDER BY a.created_at DESC""",
                (app_id,))
            cols = ["id", "class_id", "class_name", "title", "body", "author_name", "created_at"]
            return _resp(200, {"announcements": [dict(zip(cols, r)) for r in cur.fetchall()]})

        if action == "announce_add":
            title = (body.get("title") or "").strip()
            text = (body.get("body") or "").strip()
            if not title or not text:
                return _resp(400, {"error": "Укажите заголовок и текст"})
            class_id = body.get("class_id")
            try:
                class_id = int(class_id) if class_id not in (None, "") else None
            except (ValueError, TypeError):
                class_id = None
            cur.execute(
                f"""INSERT INTO {ANNOUNCE} (application_id, class_id, title, body, author_name)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                (app_id, class_id, title, text, (body.get("author_name") or "").strip() or None))
            new_id = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": new_id})

        if action == "announce_delete":
            aid = body.get("id")
            if not aid:
                return _resp(400, {"error": "Нужен id"})
            cur.execute(f"DELETE FROM {ANNOUNCE} WHERE id=%s AND application_id=%s", (int(aid), app_id))
            conn.commit()
            return _resp(200, {"ok": True})

        return _resp(400, {"error": "Неизвестное действие"})
    finally:
        conn.close()