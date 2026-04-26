"""
API авторизации и управления пользователями АОУСПТ.
POST /login — вход учителя или администратора
POST /register — регистрация нового учителя (только для admin)
GET /users — список пользователей (только для admin)
POST /toggle — активировать/деактивировать пользователя (только для admin)
POST /reset-password — сбросить пароль (только для admin)
DELETE /delete — удалить пользователя (только для admin)
"""
import json
import os
import hashlib
import secrets
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
# Пароль администратора (хранится в секрете, fallback для демо)
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin2026")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def check_admin_token(headers: dict) -> bool:
    """Проверяем токен администратора из заголовка X-Authorization."""
    token = headers.get("x-authorization", "")
    return token.startswith("admin:")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/").rstrip("/")
    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            body = {}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}

    # ── POST /login ──────────────────────────────────────────────────────────
    if method == "POST" and path in ("", "/", "/login"):
        login = body.get("login", "").strip()
        password = body.get("password", "")

        if not login or not password:
            return _resp(400, {"error": "Введите логин и пароль"})

        # Проверка администратора (специальный логин)
        if login == "admin" and password == ADMIN_PASSWORD:
            return _resp(200, {
                "role": "admin",
                "login": "admin",
                "full_name": "Администратор АОУСПТ",
                "school": "АОУСПТ",
                "token": f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}",
            })

        # Проверка учителя из БД
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT login, full_name, school, role, is_active FROM {SCHEMA}.users WHERE login = %s AND password_hash = %s",
                (login, hash_password(password))
            )
            row = cur.fetchone()
            if not row:
                return _resp(401, {"error": "Неверный логин или пароль"})
            _, full_name, school, role, is_active = row
            if not is_active:
                return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь к администратору."})
            token = f"teacher:{hash_password(login + password + 'salt')}"
            return _resp(200, {
                "role": role,
                "login": login,
                "full_name": full_name,
                "school": school,
                "token": token,
            })
        finally:
            conn.close()

    # ── POST /register (только admin) ────────────────────────────────────────
    if method == "POST" and path == "/register":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        password = body.get("password", "").strip()
        full_name = body.get("full_name", "").strip()
        school = body.get("school", "АОУСПТ").strip()
        role = body.get("role", "teacher").strip()

        if not login or not password or not full_name:
            return _resp(400, {"error": "Заполните все поля"})
        if role not in ("teacher", "admin"):
            return _resp(400, {"error": "Роль должна быть teacher или admin"})
        if len(password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (login, password_hash, full_name, school, role, created_by) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (login, hash_password(password), full_name, school, role, "admin")
            )
            conn.commit()
            user_id = cur.fetchone()[0]
            return _resp(200, {"success": True, "id": user_id, "login": login})
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            return _resp(409, {"error": f"Логин «{login}» уже занят"})
        finally:
            conn.close()

    # ── GET /users (только admin) ────────────────────────────────────────────
    if method == "GET" and path == "/users":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, login, full_name, school, role, is_active, created_at FROM {SCHEMA}.users ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
            users = [
                {"id": r[0], "login": r[1], "full_name": r[2], "school": r[3],
                 "role": r[4], "is_active": r[5], "created_at": str(r[6])}
                for r in rows
            ]
            return _resp(200, {"users": users})
        finally:
            conn.close()

    # ── POST /toggle (только admin) ───────────────────────────────────────────
    if method == "POST" and path == "/toggle":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        if not login:
            return _resp(400, {"error": "Укажите login"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET is_active = NOT is_active WHERE login = %s RETURNING is_active",
                (login,)
            )
            conn.commit()
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"login": login, "is_active": row[0]})
        finally:
            conn.close()

    # ── POST /reset-password (только admin) ───────────────────────────────────
    if method == "POST" and path == "/reset-password":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        new_password = body.get("new_password", "").strip()
        if not login or not new_password:
            return _resp(400, {"error": "Укажите login и новый пароль"})
        if len(new_password) < 6:
            return _resp(400, {"error": "Пароль должен быть не менее 6 символов"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE login = %s RETURNING id",
                (hash_password(new_password), login)
            )
            conn.commit()
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"success": True})
        finally:
            conn.close()

    # ── DELETE /delete (только admin) ─────────────────────────────────────────
    if method == "DELETE" and path == "/delete":
        if not check_admin_token(headers):
            return _resp(403, {"error": "Нет доступа"})

        login = body.get("login", "").strip()
        if not login or login == "admin":
            return _resp(400, {"error": "Нельзя удалить этого пользователя"})

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {SCHEMA}.users WHERE login = %s RETURNING id", (login,))
            conn.commit()
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})
            return _resp(200, {"success": True})
        finally:
            conn.close()

    return _resp(404, {"error": "Метод не найден"})


def _resp(status: int, data: dict) -> dict:
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(data, ensure_ascii=False),
    }
