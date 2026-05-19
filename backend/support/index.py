"""
Чат технической поддержки АОУСПТ.
Действия через ?action=...

Пользователь (ЛК):
  POST ?action=create-ticket   — создать обращение {section, subject, body}
  GET  ?action=my-tickets      — мои обращения
  GET  ?action=ticket-messages&ticket_id=N — сообщения тикета
  POST ?action=send-message    — отправить сообщение {ticket_id, body}

Оператор ПУ (X-Authorization: admin:... или panel-operator):
  GET  ?action=all-tickets     — все открытые тикеты
  POST ?action=take-ticket     — взять заявку {ticket_id}
  POST ?action=close-ticket    — закрыть заявку {ticket_id}
  POST ?action=op-send-message — отправить сообщение от оператора {ticket_id, body}

  GET  ?action=operators       — список операторов ПУ
  POST ?action=assign-operator — назначить роль ПУ {login, panel_role}
  POST ?action=remove-operator — снять роль ПУ {login}
"""
import json
import os
import hashlib
from datetime import datetime
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin2026")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

# Иерархия ролей ПУ (чем выше индекс — тем выше роль)
PANEL_ROLE_RANK = {
    "operator": 1,   # Оператор ТП
    "advisor":  2,   # Советник
    "tester_role": 3,  # Тестер (роль ПУ, не путать с system tester)
    "developer": 4,  # Разработчик
    "deputy":   5,   # Зам Главы Правления
    "head":     6,   # Глава Правления (= admin)
}

PANEL_ROLE_LABELS = {
    "head":      "Глава Правления",
    "deputy":    "Зам. Главы Правления",
    "developer": "Разработчик",
    "tester_role": "Тестер",
    "advisor":   "Советник",
    "operator":  "Оператор ТП",
}

SUPPORT_SECTIONS = [
    "upload", "works", "results", "students", "tests",
    "synopsis", "presentations", "exams", "chat", "subscription", "other"
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


def get_caller(headers: dict, conn) -> dict | None:
    """Возвращает {login, panel_role, operator_number} или None."""
    token = headers.get("x-authorization", "")
    if not token:
        return None

    # Admin токен
    expected_admin = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
    if token == expected_admin or token.startswith("admin:"):
        cur = conn.cursor()
        cur.execute(
            f"SELECT panel_role, operator_number FROM {SCHEMA}.panel_operators WHERE login = 'admin'",
        )
        row = cur.fetchone()
        panel_role = row[0] if row else "head"
        op_num = row[1] if row else 1
        return {"login": "admin", "panel_role": panel_role, "operator_number": op_num, "is_panel": True}

    # Teacher/tester токен — формат "teacher:{hash}"
    if ":" not in token:
        return None
    parts = token.split(":", 1)
    role_prefix = parts[0]
    if role_prefix not in ("teacher", "admin"):
        return None

    # Ищем пользователя по токену (любой активный)
    cur = conn.cursor()
    cur.execute(
        f"""SELECT u.login, u.role, u.password_hash, po.panel_role, po.operator_number
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.panel_operators po ON po.login = u.login
            WHERE u.is_active = TRUE""",
    )
    token_hash = parts[1]
    for row in cur.fetchall():
        login, sys_role, pw_hash, panel_role, op_num = row
        expected = hash_password(login + pw_hash[:16] + "salt_v2")
        # Пробуем оба варианта токена
        expected_old = f"teacher:{hash_password(login + pw_hash + 'salt')}"
        if token == expected_old or token == f"{sys_role}:{hash_password(login + pw_hash + 'salt')}":
            return {
                "login": login,
                "panel_role": panel_role,
                "operator_number": op_num,
                "is_panel": panel_role is not None,
                "sys_role": sys_role,
            }
    return None


def get_caller_by_login(login: str, token: str, conn) -> dict | None:
    """Проверяем токен через auth_token_hash в таблице users."""
    if not login or not token:
        return None

    # Admin — несъёмные права
    expected_admin = f"admin:{hash_password(ADMIN_PASSWORD + 'salt_admin')}"
    if token == expected_admin or (login == "admin" and token.startswith("admin:")):
        cur = conn.cursor()
        cur.execute(f"SELECT operator_number FROM {SCHEMA}.panel_operators WHERE login = 'admin'")
        row = cur.fetchone()
        op_num = row[0] if row else 1
        return {"login": "admin", "panel_role": "head",
                "operator_number": op_num, "is_panel": True,
                "sys_role": "admin", "is_admin": True}

    cur = conn.cursor()
    cur.execute(
        f"SELECT role, is_active, auth_token_hash FROM {SCHEMA}.users WHERE login = %s",
        (login,)
    )
    row = cur.fetchone()
    if not row:
        return None
    sys_role, is_active, stored_token_hash = row
    if not is_active:
        return None

    # Проверяем токен: hash(token) должен совпасть с сохранённым
    if not stored_token_hash or hash_password(token) != stored_token_hash:
        return None

    cur.execute(
        f"SELECT panel_role, operator_number FROM {SCHEMA}.panel_operators WHERE login = %s",
        (login,)
    )
    op_row = cur.fetchone()
    active_panel_role = None
    active_op_num = None
    if op_row and op_row[0] and op_row[0] != "removed":
        active_panel_role = op_row[0]
        active_op_num = op_row[1]

    # sys_role == "admin" — несъёмные права head
    if sys_role == "admin":
        active_panel_role = "head"
        active_op_num = active_op_num or 1

    return {
        "login": login,
        "panel_role": active_panel_role,
        "operator_number": active_op_num,
        "is_panel": active_panel_role is not None,
        "is_admin": sys_role == "admin",
        "sys_role": sys_role,
    }


def next_operator_number(conn) -> int:
    cur = conn.cursor()
    cur.execute(f"SELECT COALESCE(MAX(operator_number), 0) + 1 FROM {SCHEMA}.panel_operators")
    return cur.fetchone()[0]


def serialize_ticket(row) -> dict:
    (tid, login, section, subject, status, op_login, op_num, created_at, updated_at) = row
    return {
        "id": tid, "login": login, "section": section, "subject": subject,
        "status": status, "operator_login": op_login, "operator_number": op_num,
        "created_at": str(created_at), "updated_at": str(updated_at),
    }


def serialize_message(row) -> dict:
    (mid, ticket_id, sender_login, sender_role, body, created_at) = row
    return {
        "id": mid, "ticket_id": ticket_id, "sender_login": sender_login,
        "sender_role": sender_role, "body": body, "created_at": str(created_at),
    }


def handler(event: dict, context) -> dict:
    """Чат технической поддержки АОУСПТ."""
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
        caller = get_caller_by_login(login, token, conn)

        # ── GET sections — публичный список разделов ─────────────────────────
        if action == "sections":
            return _resp(200, {"sections": SUPPORT_SECTIONS})

        # ── POST create-ticket ───────────────────────────────────────────────
        if action == "create-ticket" and method == "POST":
            if not caller:
                return _resp(401, {"error": "Требуется авторизация"})
            section = (body.get("section") or "other").strip()
            subject = (body.get("subject") or "").strip()
            first_body = (body.get("body") or "").strip()
            if not subject:
                return _resp(400, {"error": "Укажите тему обращения"})
            if not first_body:
                return _resp(400, {"error": "Опишите проблему"})

            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_tickets (login, section, subject, status)
                    VALUES (%s, %s, %s, 'open') RETURNING id""",
                (caller["login"], section, subject)
            )
            ticket_id = cur.fetchone()[0]
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_login, sender_role, body)
                    VALUES (%s, %s, 'user', %s)""",
                (ticket_id, caller["login"], first_body)
            )
            conn.commit()
            return _resp(200, {"ok": True, "ticket_id": ticket_id})

        # ── GET my-tickets ───────────────────────────────────────────────────
        if action == "my-tickets" and method == "GET":
            if not caller:
                return _resp(401, {"error": "Требуется авторизация"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, login, section, subject, status, operator_login, operator_number,
                           created_at, updated_at
                    FROM {SCHEMA}.support_tickets
                    WHERE login = %s ORDER BY updated_at DESC LIMIT 50""",
                (caller["login"],)
            )
            tickets = [serialize_ticket(r) for r in cur.fetchall()]
            return _resp(200, {"tickets": tickets})

        # ── GET ticket-messages ──────────────────────────────────────────────
        if action == "ticket-messages" and method == "GET":
            if not caller:
                return _resp(401, {"error": "Требуется авторизация"})
            ticket_id = qs.get("ticket_id") or body.get("ticket_id")
            if not ticket_id:
                return _resp(400, {"error": "Укажите ticket_id"})
            cur = conn.cursor()
            # Проверяем доступ
            cur.execute(
                f"SELECT login FROM {SCHEMA}.support_tickets WHERE id = %s", (ticket_id,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Тикет не найден"})
            if row[0] != caller["login"] and not caller.get("is_panel"):
                return _resp(403, {"error": "Нет доступа"})

            cur.execute(
                f"""SELECT id, ticket_id, sender_login, sender_role, body, created_at
                    FROM {SCHEMA}.support_messages WHERE ticket_id = %s ORDER BY created_at""",
                (ticket_id,)
            )
            msgs = [serialize_message(r) for r in cur.fetchall()]
            # Инфо о тикете
            cur.execute(
                f"""SELECT id, login, section, subject, status, operator_login, operator_number,
                           created_at, updated_at FROM {SCHEMA}.support_tickets WHERE id = %s""",
                (ticket_id,)
            )
            ticket = serialize_ticket(cur.fetchone())
            return _resp(200, {"ticket": ticket, "messages": msgs})

        # ── POST send-message (пользователь) ────────────────────────────────
        if action == "send-message" and method == "POST":
            if not caller:
                return _resp(401, {"error": "Требуется авторизация"})
            ticket_id = body.get("ticket_id")
            msg_body = (body.get("body") or "").strip()
            if not ticket_id or not msg_body:
                return _resp(400, {"error": "Укажите ticket_id и body"})
            cur = conn.cursor()
            cur.execute(
                f"SELECT login, status FROM {SCHEMA}.support_tickets WHERE id = %s", (ticket_id,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Тикет не найден"})
            if row[0] != caller["login"]:
                return _resp(403, {"error": "Нет доступа"})
            if row[1] == "closed":
                return _resp(400, {"error": "Тикет закрыт"})
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_login, sender_role, body)
                    VALUES (%s, %s, 'user', %s)""",
                (ticket_id, caller["login"], msg_body)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET updated_at = NOW() WHERE id = %s",
                (ticket_id,)
            )
            conn.commit()
            return _resp(200, {"ok": True})

        # ── GET operators — доступен любому авторизованному (нужен для проверки роли при входе) ──
        if action == "operators" and method == "GET":
            if not caller:
                return _resp(401, {"error": "Требуется авторизация"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT po.login, po.panel_role, po.operator_number, po.assigned_by, po.assigned_at,
                           u.full_name
                    FROM {SCHEMA}.panel_operators po
                    LEFT JOIN {SCHEMA}.users u ON u.login = po.login
                    WHERE po.panel_role IS NOT NULL AND po.panel_role != 'removed'
                    ORDER BY po.operator_number"""
            )
            ops = []
            for r in cur.fetchall():
                ops.append({
                    "login": r[0],
                    "panel_role": r[1],
                    "panel_role_label": PANEL_ROLE_LABELS.get(r[1], r[1]),
                    "operator_number": r[2],
                    "assigned_by": r[3],
                    "assigned_at": str(r[4]),
                    "full_name": r[5] or r[0],
                })
            return _resp(200, {"operators": ops})

        # ────── ОПЕРАТОРСКИЕ ДЕЙСТВИЯ ─────────────────────────────────────
        if not caller or not caller.get("is_panel"):
            return _resp(403, {"error": "Доступ только для операторов ПУ"})

        is_admin_caller = bool(caller.get("is_admin"))
        caller_rank = PANEL_ROLE_RANK.get("head", 6) if is_admin_caller else PANEL_ROLE_RANK.get(caller.get("panel_role") or "operator", 1)

        # ── GET all-tickets ──────────────────────────────────────────────────
        if action == "all-tickets" and method == "GET":
            status_filter = qs.get("status") or "open"
            cur = conn.cursor()
            if status_filter == "all":
                cur.execute(
                    f"""SELECT id, login, section, subject, status, operator_login, operator_number,
                               created_at, updated_at FROM {SCHEMA}.support_tickets
                        ORDER BY status ASC, updated_at DESC LIMIT 200"""
                )
            else:
                cur.execute(
                    f"""SELECT id, login, section, subject, status, operator_login, operator_number,
                               created_at, updated_at FROM {SCHEMA}.support_tickets
                        WHERE status = %s ORDER BY updated_at DESC LIMIT 200""",
                    (status_filter,)
                )
            tickets = [serialize_ticket(r) for r in cur.fetchall()]
            return _resp(200, {"tickets": tickets})

        # ── POST take-ticket ─────────────────────────────────────────────────
        if action == "take-ticket" and method == "POST":
            ticket_id = body.get("ticket_id")
            if not ticket_id:
                return _resp(400, {"error": "Укажите ticket_id"})
            cur = conn.cursor()
            cur.execute(f"SELECT status FROM {SCHEMA}.support_tickets WHERE id = %s", (ticket_id,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Тикет не найден"})
            if row[0] != "open":
                return _resp(400, {"error": "Тикет уже взят или закрыт"})

            op_num = caller.get("operator_number") or 0
            cur.execute(
                f"""UPDATE {SCHEMA}.support_tickets
                    SET status = 'taken', operator_login = %s, operator_number = %s, updated_at = NOW()
                    WHERE id = %s""",
                (caller["login"], op_num, ticket_id)
            )
            # Системное сообщение пользователю
            op_label = PANEL_ROLE_LABELS.get(caller.get("panel_role") or "operator", "Оператор")
            sys_msg = f"Ваше обращение принято. Оператор №{op_num} ({op_label}) подключился к чату."
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_login, sender_role, body)
                    VALUES (%s, %s, 'system', %s)""",
                (ticket_id, caller["login"], sys_msg)
            )
            conn.commit()
            return _resp(200, {"ok": True, "operator_number": op_num})

        # ── POST close-ticket ────────────────────────────────────────────────
        if action == "close-ticket" and method == "POST":
            ticket_id = body.get("ticket_id")
            if not ticket_id:
                return _resp(400, {"error": "Укажите ticket_id"})
            cur = conn.cursor()
            cur.execute(
                f"""UPDATE {SCHEMA}.support_tickets SET status = 'closed', updated_at = NOW()
                    WHERE id = %s""", (ticket_id,)
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_login, sender_role, body)
                    VALUES (%s, %s, 'system', 'Обращение закрыто оператором.')""",
                (ticket_id, caller["login"])
            )
            conn.commit()
            return _resp(200, {"ok": True})

        # ── POST op-send-message (оператор → пользователь) ──────────────────
        if action == "op-send-message" and method == "POST":
            ticket_id = body.get("ticket_id")
            msg_body = (body.get("body") or "").strip()
            if not ticket_id or not msg_body:
                return _resp(400, {"error": "Укажите ticket_id и body"})
            cur = conn.cursor()
            cur.execute(f"SELECT status FROM {SCHEMA}.support_tickets WHERE id = %s", (ticket_id,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Тикет не найден"})
            if row[0] == "closed":
                return _resp(400, {"error": "Тикет закрыт"})
            cur.execute(
                f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_login, sender_role, body)
                    VALUES (%s, %s, 'operator', %s)""",
                (ticket_id, caller["login"], msg_body)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET updated_at = NOW() WHERE id = %s", (ticket_id,)
            )
            conn.commit()
            return _resp(200, {"ok": True})

        # Admin и Глава Правления не зависят от иерархии — полные права
        is_head_caller = is_admin_caller or caller_rank >= PANEL_ROLE_RANK.get("head", 6)

        # ── POST assign-operator ─────────────────────────────────────────────
        if action == "assign-operator" and method == "POST":
            target_login = (body.get("target_login") or "").strip()
            panel_role = (body.get("panel_role") or "operator").strip()

            if not target_login:
                return _resp(400, {"error": "Укажите target_login"})

            # Пустая роль = снять
            if panel_role == "":
                cur = conn.cursor()
                cur.execute(f"SELECT login FROM {SCHEMA}.panel_operators WHERE login = %s", (target_login,))
                if cur.fetchone():
                    cur.execute(
                        f"UPDATE {SCHEMA}.panel_operators SET panel_role = 'removed', assigned_by = %s WHERE login = %s",
                        (caller["login"], target_login)
                    )
                    conn.commit()
                return _resp(200, {"ok": True})

            if panel_role not in PANEL_ROLE_RANK:
                return _resp(400, {"error": f"Неверная роль. Доступны: {list(PANEL_ROLE_RANK.keys())}"})

            # Глава Правления может выдать любую роль (в т.ч. равную себе)
            if not is_head_caller:
                target_rank = PANEL_ROLE_RANK[panel_role]
                if target_rank > caller_rank:
                    return _resp(403, {"error": "Нельзя выдать роль выше своей"})

            cur = conn.cursor()
            cur.execute(f"SELECT login FROM {SCHEMA}.users WHERE login = %s", (target_login,))
            if not cur.fetchone():
                return _resp(404, {"error": "Пользователь не найден"})

            cur.execute(f"SELECT panel_role FROM {SCHEMA}.panel_operators WHERE login = %s", (target_login,))
            existing = cur.fetchone()

            if existing:
                # Глава может изменить любого
                if not is_head_caller:
                    existing_rank = PANEL_ROLE_RANK.get(existing[0], 0)
                    if existing_rank > caller_rank:
                        return _resp(403, {"error": "Нельзя изменить роль вышестоящего"})
                cur.execute(
                    f"""UPDATE {SCHEMA}.panel_operators
                        SET panel_role = %s, assigned_by = %s, assigned_at = NOW()
                        WHERE login = %s""",
                    (panel_role, caller["login"], target_login)
                )
            else:
                op_num = next_operator_number(conn)
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.panel_operators (login, panel_role, operator_number, assigned_by)
                        VALUES (%s, %s, %s, %s)""",
                    (target_login, panel_role, op_num, caller["login"])
                )
            conn.commit()
            return _resp(200, {"ok": True})

        # ── POST remove-operator ─────────────────────────────────────────────
        if action == "remove-operator" and method == "POST":
            target_login = (body.get("target_login") or "").strip()
            if not target_login:
                return _resp(400, {"error": "Укажите target_login"})
            cur = conn.cursor()
            cur.execute(f"SELECT panel_role FROM {SCHEMA}.panel_operators WHERE login = %s", (target_login,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Оператор не найден"})
            # Глава может снять любого
            if not is_head_caller:
                target_rank = PANEL_ROLE_RANK.get(row[0], 0)
                if target_rank > caller_rank:
                    return _resp(403, {"error": "Нельзя снять вышестоящего"})
            cur.execute(
                f"UPDATE {SCHEMA}.panel_operators SET panel_role = 'removed', assigned_by = %s WHERE login = %s",
                (caller["login"], target_login)
            )
            conn.commit()
            return _resp(200, {"ok": True})

        return _resp(404, {"error": f"Неизвестный action: {action}"})

    finally:
        conn.close()