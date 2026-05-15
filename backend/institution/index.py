"""
API для управления Образовательными Учреждениями (ОУ).
POST /register-institution — регистрация нового ОУ
POST /login-institution — вход администратора ОУ
POST /me-institution — получить данные текущего пользователя ОУ
POST /create-staff — создать профиль сотрудника (директор/зам директора)
GET /staff — получить список сотрудников ОУ
POST /update-staff — обновить данные сотрудника
POST /delete-staff — удалить сотрудника из ОУ
"""
import json
import os
import re
import hashlib
import psycopg2
from datetime import datetime

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")

POSITIONS = ["director", "vice_director", "counselor", "teacher"]
POSITION_LABELS = {
    "director": "Директор",
    "vice_director": "Зам. директора",
    "counselor": "Советник",
    "teacher": "Педагог",
}
MANAGEMENT_POSITIONS = {"director", "vice_director"}

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def translit(s: str) -> str:
    s = (s or '').strip().lower()
    out = []
    for ch in s:
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isalnum():
            out.append(ch)
    return re.sub(r'[^a-z0-9]', '', ''.join(out))


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }


def get_auth_token(login: str, password: str) -> str:
    return f"ou:{hash_password(login + password + 'ou_salt')}"


def check_ou_token(headers: dict, cur) -> dict | None:
    """Проверяет токен ОУ-администратора, возвращает данные пользователя или None."""
    token = (headers.get("x-authorization") or "").strip()
    if not token.startswith("ou:"):
        return None
    cur.execute(
        f"""SELECT u.id, u.login, u.full_name, u.first_name, u.last_name,
                   u.institution_id, u.institution_position, u.subject,
                   u.password_hash, i.name as institution_name,
                   i.director_full_name, i.vice_director_full_name, i.admin_ou_role
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.institutions i ON u.institution_id = i.id
            WHERE u.login = (
                SELECT login FROM {SCHEMA}.users
                WHERE CONCAT('ou:', encode(sha256((login || password_hash || 'ou_salt')::bytea), 'hex')) = %s
                LIMIT 1
            ) AND u.institution_id IS NOT NULL""",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0], "login": row[1], "full_name": row[2],
        "first_name": row[3], "last_name": row[4],
        "institution_id": row[5], "institution_position": row[6],
        "subject": row[7], "institution_name": row[9],
        "director_full_name": row[10], "vice_director_full_name": row[11],
        "admin_ou_role": row[12],
    }


def generate_staff_login(full_name: str, cur) -> str:
    parts = full_name.strip().split()
    last = translit(parts[0]) if parts else "staff"
    first_char = translit(parts[1])[0] if len(parts) > 1 else ""
    base = (last + first_char)[:32] or "staff"
    candidate = base
    n = 1
    while True:
        cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        n += 1
        candidate = f"{base}{n}"


def handler(event: dict, context) -> dict:
    """Управление Образовательными Учреждениями САОУ."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            body = {}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    action = (qs.get("action") or body.get("action") or "").strip().lower()

    # ── POST register-institution ─────────────────────────────────────────────
    if method == "POST" and action == "register-institution":
        name = (body.get("name") or "").strip()
        region = (body.get("region") or "").strip()
        inn = (body.get("inn") or "").strip()
        director = (body.get("director_full_name") or "").strip()
        vice_director = (body.get("vice_director_full_name") or "").strip()
        admin_login = (body.get("admin_login") or "").strip()
        admin_password = (body.get("admin_password") or "").strip()
        admin_ou_role = (body.get("admin_ou_role") or "director").strip()
        email = (body.get("email") or "").strip().lower()

        if not all([name, region, inn, director, vice_director, admin_login, admin_password, email]):
            return _resp(400, {"error": "Все поля обязательны"})
        if len(inn) not in (10, 12) or not inn.isdigit():
            return _resp(400, {"error": "ИНН должен содержать 10 или 12 цифр"})
        if len(admin_password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})
        if admin_ou_role not in ("director", "vice_director"):
            return _resp(400, {"error": "Некорректная роль администратора"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT 1 FROM {SCHEMA}.institutions WHERE inn = %s", (inn,))
            if cur.fetchone():
                return _resp(409, {"error": "ОУ с таким ИНН уже зарегистрировано"})
            cur.execute(f"SELECT 1 FROM {SCHEMA}.institutions WHERE email = %s", (email,))
            if cur.fetchone():
                return _resp(409, {"error": "Этот email уже используется"})
            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (admin_login,))
            if cur.fetchone():
                return _resp(409, {"error": "Этот логин уже занят"})

            cur.execute(
                f"""INSERT INTO {SCHEMA}.institutions
                    (name, region, inn, director_full_name, vice_director_full_name,
                     admin_login, admin_ou_role, email)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (name, region, inn, director, vice_director, admin_login, admin_ou_role, email)
            )
            institution_id = cur.fetchone()[0]

            full_name = director if admin_ou_role == "director" else vice_director
            token = get_auth_token(admin_login, admin_password)

            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, role, school,
                     institution_id, institution_position, created_by, subscription_status)
                    VALUES (%s, %s, %s, 'ou_admin', %s, %s, %s, 'self', 'none') RETURNING id""",
                (admin_login, hash_password(admin_password), full_name, name,
                 institution_id, admin_ou_role)
            )
            user_id = cur.fetchone()[0]
            conn.commit()

            return _resp(200, {
                "success": True,
                "user_id": user_id,
                "institution_id": institution_id,
                "login": admin_login,
                "full_name": full_name,
                "role": "ou_admin",
                "institution_position": admin_ou_role,
                "institution_name": name,
                "token": token,
            })
        except Exception as e:
            conn.rollback()
            return _resp(500, {"error": str(e)})
        finally:
            conn.close()

    # ── POST login-institution ────────────────────────────────────────────────
    if method == "POST" and action == "login-institution":
        login = (body.get("login") or "").strip()
        password = (body.get("password") or "").strip()
        if not login or not password:
            return _resp(400, {"error": "Укажите логин и пароль"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.id, u.login, u.full_name, u.first_name, u.last_name,
                           u.institution_id, u.institution_position, u.subject,
                           i.name, i.director_full_name, i.vice_director_full_name, i.admin_ou_role
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.institutions i ON u.institution_id = i.id
                    WHERE u.login = %s AND u.password_hash = %s
                      AND u.institution_id IS NOT NULL AND u.is_active = true""",
                (login, hash_password(password))
            )
            row = cur.fetchone()
            if not row:
                return _resp(401, {"error": "Неверный логин или пароль"})

            position = row[6]
            is_manager = position in MANAGEMENT_POSITIONS

            token = get_auth_token(login, password)
            return _resp(200, {
                "success": True,
                "id": row[0],
                "login": row[1],
                "full_name": row[2],
                "first_name": row[3],
                "last_name": row[4],
                "role": "ou_admin" if is_manager else "ou_staff",
                "institution_id": row[5],
                "institution_position": position,
                "subject": row[7],
                "institution_name": row[8],
                "token": token,
                "is_manager": is_manager,
            })
        finally:
            conn.close()

    # ── POST create-staff ─────────────────────────────────────────────────────
    if method == "POST" and action == "create-staff":
        auth_token = (headers.get("x-authorization") or "").strip()
        login_val = (body.get("auth_login") or "").strip()
        password_val = (body.get("auth_password") or "").strip()

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.id, u.institution_id, u.institution_position
                    FROM {SCHEMA}.users u
                    WHERE u.login = %s AND u.password_hash = %s
                      AND u.institution_id IS NOT NULL AND u.is_active = true""",
                (login_val, hash_password(password_val))
            )
            admin_row = cur.fetchone()
            if not admin_row or admin_row[2] not in MANAGEMENT_POSITIONS:
                return _resp(403, {"error": "Доступ запрещён. Только директор или зам. директора могут управлять сотрудниками"})

            institution_id = admin_row[1]

            full_name = (body.get("full_name") or "").strip()
            login_staff = (body.get("login") or "").strip()
            password_staff = (body.get("password") or "").strip()
            position = (body.get("position") or "").strip()
            subject = (body.get("subject") or "").strip()

            if not full_name or not login_staff or not password_staff or not position:
                return _resp(400, {"error": "Все обязательные поля должны быть заполнены"})
            if position not in POSITIONS:
                return _resp(400, {"error": "Некорректная должность"})
            if position == "teacher" and not subject:
                return _resp(400, {"error": "Укажите предмет для педагога"})
            if len(password_staff) < 6:
                return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE login = %s", (login_staff,))
            if cur.fetchone():
                return _resp(409, {"error": "Этот логин уже занят"})

            cur.execute(
                f"""SELECT 1 FROM {SCHEMA}.institutions WHERE id = %s""",
                (institution_id,)
            )
            inst = cur.fetchone()
            if not inst:
                return _resp(404, {"error": "ОУ не найдено"})

            cur.execute(f"SELECT name FROM {SCHEMA}.institutions WHERE id = %s", (institution_id,))
            inst_name = cur.fetchone()[0]

            is_manager = position in MANAGEMENT_POSITIONS
            role = "ou_admin" if is_manager else "ou_staff"

            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (login, password_hash, full_name, role, school,
                     institution_id, institution_position, subject,
                     created_by, subscription_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'none') RETURNING id""",
                (login_staff, hash_password(password_staff), full_name, role,
                 inst_name, institution_id, position,
                 subject if position == "teacher" else None,
                 login_val)
            )
            staff_id = cur.fetchone()[0]
            conn.commit()

            return _resp(200, {
                "success": True,
                "id": staff_id,
                "login": login_staff,
                "full_name": full_name,
                "position": position,
                "subject": subject if position == "teacher" else None,
            })
        except Exception as e:
            conn.rollback()
            return _resp(500, {"error": str(e)})
        finally:
            conn.close()

    # ── GET staff ─────────────────────────────────────────────────────────────
    if method == "GET" and action == "staff":
        login_val = (qs.get("auth_login") or "").strip()
        password_val = (qs.get("auth_password") or "").strip()

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.institution_id
                    FROM {SCHEMA}.users u
                    WHERE u.login = %s AND u.password_hash = %s
                      AND u.institution_id IS NOT NULL AND u.is_active = true""",
                (login_val, hash_password(password_val))
            )
            row = cur.fetchone()
            if not row:
                return _resp(403, {"error": "Доступ запрещён"})

            institution_id = row[0]
            cur.execute(
                f"""SELECT id, login, full_name, institution_position, subject, is_active, created_at
                    FROM {SCHEMA}.users
                    WHERE institution_id = %s
                    ORDER BY institution_position, full_name""",
                (institution_id,)
            )
            staff = []
            for r in cur.fetchall():
                pos = r[3]
                subj = r[4]
                label = POSITION_LABELS.get(pos, pos)
                if pos == "teacher" and subj:
                    label = f"Педагог ({subj})"
                staff.append({
                    "id": r[0],
                    "login": r[1],
                    "full_name": r[2],
                    "position": pos,
                    "position_label": label,
                    "subject": subj,
                    "is_active": r[5],
                    "created_at": r[6].isoformat() if r[6] else None,
                })
            return _resp(200, {"staff": staff, "institution_id": institution_id})
        finally:
            conn.close()

    # ── POST delete-staff ─────────────────────────────────────────────────────
    if method == "POST" and action == "delete-staff":
        login_val = (body.get("auth_login") or "").strip()
        password_val = (body.get("auth_password") or "").strip()
        staff_id = body.get("staff_id")

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.institution_id, u.institution_position
                    FROM {SCHEMA}.users u
                    WHERE u.login = %s AND u.password_hash = %s
                      AND u.institution_id IS NOT NULL AND u.is_active = true""",
                (login_val, hash_password(password_val))
            )
            admin_row = cur.fetchone()
            if not admin_row or admin_row[1] not in MANAGEMENT_POSITIONS:
                return _resp(403, {"error": "Доступ запрещён"})

            institution_id = admin_row[0]
            cur.execute(
                f"""UPDATE {SCHEMA}.users SET is_active = false
                    WHERE id = %s AND institution_id = %s""",
                (staff_id, institution_id)
            )
            conn.commit()
            return _resp(200, {"success": True})
        except Exception as e:
            conn.rollback()
            return _resp(500, {"error": str(e)})
        finally:
            conn.close()

    # ── GET collective ────────────────────────────────────────────────────────
    if method == "GET" and action == "collective":
        login_val = (qs.get("auth_login") or "").strip()
        password_val = (qs.get("auth_password") or "").strip()

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""SELECT u.institution_id
                    FROM {SCHEMA}.users u
                    WHERE u.login = %s AND u.password_hash = %s
                      AND u.institution_id IS NOT NULL AND u.is_active = true""",
                (login_val, hash_password(password_val))
            )
            row = cur.fetchone()
            if not row:
                return _resp(403, {"error": "Доступ запрещён"})

            institution_id = row[0]
            cur.execute(
                f"""SELECT full_name, institution_position, subject
                    FROM {SCHEMA}.users
                    WHERE institution_id = %s AND is_active = true
                    ORDER BY institution_position, full_name""",
                (institution_id,)
            )
            members = []
            for r in cur.fetchall():
                pos = r[1]
                subj = r[2]
                label = POSITION_LABELS.get(pos, pos)
                if pos == "teacher" and subj:
                    label = f"Педагог ({subj})"
                members.append({
                    "full_name": r[0],
                    "position": pos,
                    "position_label": label,
                    "subject": subj,
                })
            return _resp(200, {"members": members})
        finally:
            conn.close()

    return _resp(404, {"error": "Маршрут не найден"})
