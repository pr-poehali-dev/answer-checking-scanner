"""
Материалы — общедоступная база учебных материалов с модерацией через УДС.

Действия (?action=...):
  GET  ?action=list            — список одобренных материалов (публично, с фильтрами)
  GET  ?action=item&id=        — карточка одного материала (публично)
  GET  ?action=access-status   — сколько скачиваний осталось анониму по IP
  POST ?action=upload          — загрузить материал (учитель/ученик, X-Authorization)
  POST ?action=download        — получить прямую ссылку на файл (с проверкой лимита/подписки)
  GET  ?action=my              — мои загруженные материалы (X-Authorization)
  GET  ?action=moderation      — очередь на модерацию (УДС: Советник/Зам/Глава)
  POST ?action=moderate        — одобрить/отклонить материал (УДС) + бонус автору
"""
import json
import os
import base64
import hashlib
import psycopg2
import boto3
from datetime import datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")

# Анонимам (по IP) можно скачать не более N материалов, дальше — регистрация + подписка 99₽
FREE_DOWNLOADS_LIMIT = 5
# Бонусы автору за одобренный материал
AUTHOR_BONUS = 10
# Роли УДС, которые могут модерировать материалы
MODERATOR_ROLES = {"advisor", "deputy", "head"}
PANEL_ROLE_RANK = {"operator": 1, "advisor": 2, "tester_role": 3, "developer": 4, "deputy": 5, "head": 6}

ALLOWED_EXT = {"pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "jpg", "jpeg", "png", "zip", "txt"}
MAX_FILE_MB = 25

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_token(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cdn_url(key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def get_user(login: str, token: str, conn):
    """Проверяет пользователя по токену.

    Поддерживает два вида токенов:
    1) Обычные пользователи (учитель/ученик/тестер): auth_token_hash = sha256(token).
    2) Сотрудники образовательного учреждения (директор/зам/педагог), вошедшие
       через функцию institution — их токен вида 'ou:sha256(login+password_hash+ou_salt)'.
       Пароль в открытом виде недоступен, поэтому сверяем токен на стороне БД.
    """
    if not login or not token:
        return None
    cur = conn.cursor()
    cur.execute(
        f"""SELECT login, full_name, role, is_active, auth_token_hash,
                   subscription_status, subscription_until
            FROM {SCHEMA}.users WHERE login = %s""",
        (login,),
    )
    row = cur.fetchone()
    if not row:
        return None
    _login, full_name, role, is_active, stored_hash, sub_status, sub_until = row
    if not is_active:
        return None

    ok = False
    # Вариант 1: обычный auth-токен (учитель/ученик/УДС)
    if stored_hash and hash_token(token) == stored_hash:
        ok = True
    # Вариант 2: токен образовательного учреждения (ou:...)
    elif token.startswith("ou:"):
        cur.execute(
            f"""SELECT CONCAT('ou:', encode(
                    sha256((login || password_hash || 'ou_salt')::bytea), 'hex'))
                FROM {SCHEMA}.users WHERE login = %s""",
            (login,),
        )
        ou_row = cur.fetchone()
        if ou_row and ou_row[0] == token:
            ok = True

    if not ok:
        return None

    now = datetime.utcnow()
    sub_active = bool(sub_until and isinstance(sub_until, datetime) and sub_until > now)
    return {
        "login": _login, "full_name": full_name, "role": role,
        "subscription_active": sub_active,
    }


def get_moderator(login: str, token: str, conn):
    """Проверяет сотрудника УДС с правом модерации материалов."""
    user = None
    admin_pass = os.environ.get("ADMIN_PASSWORD", "admin2026")
    expected_admin = f"admin:{hash_token(admin_pass + 'salt_admin')}"
    if token == expected_admin or (login == "admin" and token.startswith("admin:")):
        return {"login": "admin", "full_name": "Глава Правления", "panel_role": "head"}
    cur = conn.cursor()
    cur.execute(
        f"SELECT role, is_active, auth_token_hash, full_name FROM {SCHEMA}.users WHERE login = %s",
        (login,),
    )
    row = cur.fetchone()
    if not row:
        return None
    sys_role, is_active, stored_hash, full_name = row
    if not is_active or not stored_hash or hash_token(token) != stored_hash:
        return None
    cur.execute(
        f"SELECT panel_role, uds_registered FROM {SCHEMA}.panel_operators WHERE login = %s",
        (login,),
    )
    op = cur.fetchone()
    role = "head" if sys_role == "admin" else (op[0] if op else None)
    if not role or role not in MODERATOR_ROLES:
        return None
    return {"login": login, "full_name": full_name or login, "panel_role": role}


def client_ip(event: dict, headers: dict) -> str:
    xff = headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()
    ident = (event.get("requestContext") or {}).get("identity") or {}
    return ident.get("sourceIp") or "0.0.0.0"


def material_row(x):
    return {
        "id": x[0], "title": x[1], "description": x[2], "subject": x[3],
        "grade": x[4], "material_type": x[5], "preview_url": x[6],
        "file_ext": x[7], "file_size": x[8], "author_name": x[9],
        "author_role": x[10], "downloads_count": x[11], "created_at": str(x[12]),
    }


LIST_COLS = """id, title, description, subject, grade, material_type, preview_url,
               file_ext, file_size, author_name, author_role, downloads_count, created_at"""


def handler(event: dict, context) -> dict:
    """Материалы: публичная база с модерацией через УДС, лимит по IP, бонусы авторам."""
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
            body = {}

    login = (body.get("login") or qs.get("login") or "").strip()
    token = (headers.get("x-authorization") or headers.get("authorization") or "").strip()
    ip = client_ip(event, headers)

    conn = get_conn()
    try:
        # ── list — публичный список одобренных материалов ────────────────────
        if action == "list" and method == "GET":
            search = (qs.get("q") or "").strip().lower()
            subject = (qs.get("subject") or "").strip()
            cur = conn.cursor()
            where = ["status = 'approved'"]
            params = []
            if search:
                where.append("(LOWER(title) LIKE %s OR LOWER(description) LIKE %s)")
                params += [f"%{search}%", f"%{search}%"]
            if subject:
                where.append("subject = %s")
                params.append(subject)
            cur.execute(
                f"SELECT {LIST_COLS} FROM {SCHEMA}.materials WHERE {' AND '.join(where)} "
                f"ORDER BY created_at DESC LIMIT 200",
                tuple(params),
            )
            items = [material_row(x) for x in cur.fetchall()]
            cur.execute(f"SELECT DISTINCT subject FROM {SCHEMA}.materials WHERE status='approved' AND subject IS NOT NULL AND subject <> ''")
            subjects = sorted([r[0] for r in cur.fetchall()])
            return _resp(200, {"items": items, "subjects": subjects})

        # ── item — карточка одного материала ─────────────────────────────────
        if action == "item" and method == "GET":
            mid = qs.get("id")
            if not mid:
                return _resp(400, {"error": "Укажите материал"})
            cur = conn.cursor()
            cur.execute(
                f"SELECT {LIST_COLS} FROM {SCHEMA}.materials WHERE id = %s AND status='approved'",
                (mid,),
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {"error": "Материал не найден"})
            return _resp(200, {"item": material_row(row)})

        # ── access-status — сколько бесплатных скачиваний осталось по IP ──────
        if action == "access-status" and method == "GET":
            user = get_user(login, token, conn) if login else None
            if user:
                # Учителя/ученики с подпиской — безлимит; без подписки — тоже лимит
                unlimited = user["subscription_active"]
                return _resp(200, {"authorized": True, "unlimited": unlimited,
                                   "role": user["role"], "limit": FREE_DOWNLOADS_LIMIT})
            cur = conn.cursor()
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.material_downloads WHERE ip_address = %s",
                (ip,),
            )
            used = cur.fetchone()[0] or 0
            return _resp(200, {"authorized": False, "unlimited": False,
                               "used": used, "limit": FREE_DOWNLOADS_LIMIT,
                               "remaining": max(0, FREE_DOWNLOADS_LIMIT - used)})

        # ── upload-url — выдать ссылку для прямой загрузки файла в S3 ─────────
        # Крупные файлы (до 25 МБ) грузятся напрямую в хранилище, минуя лимит
        # тела функции — это устраняет ошибку «не удалось загрузить».
        if action == "upload-url" and method == "POST":
            user = get_user(login, token, conn)
            if not user:
                return _resp(401, {"error": "Войдите в личный кабинет, чтобы загрузить материал"})
            file_name = (body.get("file_name") or "file").strip()[:256]
            ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
            if ext not in ALLOWED_EXT:
                return _resp(400, {"error": f"Недопустимый формат. Разрешено: {', '.join(sorted(ALLOWED_EXT))}"})
            content_types = {
                "pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg",
                "jpeg": "image/jpeg", "txt": "text/plain", "zip": "application/zip",
                "doc": "application/msword",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "ppt": "application/vnd.ms-powerpoint",
                "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "xls": "application/vnd.ms-excel",
                "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
            ctype = content_types.get(ext, "application/octet-stream")
            safe_name = file_name.replace("/", "_").replace("\\", "_")
            key = f"materials/{login}/{int(datetime.utcnow().timestamp())}_{safe_name}"
            try:
                s3 = s3_client()
                put_url = s3.generate_presigned_url(
                    "put_object",
                    Params={"Bucket": "files", "Key": key, "ContentType": ctype},
                    ExpiresIn=600,
                )
            except Exception as e:
                return _resp(500, {"error": f"Не удалось подготовить загрузку: {e}"})
            return _resp(200, {"upload_url": put_url, "file_key": key, "content_type": ctype})

        # ── upload — загрузить материал (учитель/ученик) ─────────────────────
        if action == "upload" and method == "POST":
            user = get_user(login, token, conn)
            if not user:
                return _resp(401, {"error": "Войдите в личный кабинет, чтобы загрузить материал"})
            title = (body.get("title") or "").strip()[:256]
            description = (body.get("description") or "").strip()
            subject = (body.get("subject") or "").strip()[:128]
            grade = (body.get("grade") or "").strip()[:32]
            mtype = (body.get("material_type") or "").strip()[:64]
            file_name = (body.get("file_name") or "file").strip()[:256]
            file_b64 = body.get("file_base64") or ""
            file_key = (body.get("file_key") or "").strip()
            ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
            if ext not in ALLOWED_EXT:
                return _resp(400, {"error": f"Недопустимый формат. Разрешено: {', '.join(sorted(ALLOWED_EXT))}"})

            content_types = {
                "pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg",
                "jpeg": "image/jpeg", "txt": "text/plain", "zip": "application/zip",
            }

            # Путь A: файл уже загружен напрямую в S3 (через upload-url) ─ берём по ключу.
            if file_key:
                if not title:
                    return _resp(400, {"error": "Укажите название"})
                s3 = s3_client()
                try:
                    head = s3.head_object(Bucket="files", Key=file_key)
                    file_size = int(head.get("ContentLength") or 0)
                except Exception:
                    return _resp(400, {"error": "Файл не найден в хранилище. Повторите загрузку."})
                if file_size <= 0:
                    return _resp(400, {"error": "Файл пуст. Повторите загрузку."})
                if file_size > MAX_FILE_MB * 1024 * 1024:
                    return _resp(400, {"error": f"Файл больше {MAX_FILE_MB} МБ"})
                key = file_key
                data_len = file_size
            # Путь B: небольшой файл передан прямо в теле (base64) ─ прежний способ.
            else:
                if not title or not file_b64:
                    return _resp(400, {"error": "Укажите название и прикрепите файл"})
                try:
                    if "," in file_b64:
                        file_b64 = file_b64.split(",", 1)[1]
                    data = base64.b64decode(file_b64)
                except Exception:
                    return _resp(400, {"error": "Не удалось прочитать файл"})
                if len(data) > MAX_FILE_MB * 1024 * 1024:
                    return _resp(400, {"error": f"Файл больше {MAX_FILE_MB} МБ"})
                key = f"materials/{login}/{int(datetime.utcnow().timestamp())}_{file_name}"
                s3 = s3_client()
                s3.put_object(Bucket="files", Key=key, Body=data,
                              ContentType=content_types.get(ext, "application/octet-stream"))
                data_len = len(data)

            file_url = cdn_url(key)
            # Превью: для картинок — сам файл, иначе фронт покажет иконку по типу
            preview_url = file_url if ext in {"png", "jpg", "jpeg"} else None

            cur = conn.cursor()
            cur.execute(
                f"""INSERT INTO {SCHEMA}.materials
                    (author_login, author_name, author_role, title, description, subject,
                     grade, material_type, file_url, file_name, file_ext, file_size,
                     preview_url, status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
                    RETURNING id""",
                (login, user["full_name"], user["role"], title, description, subject,
                 grade, mtype, file_url, file_name, ext, data_len, preview_url),
            )
            mid = cur.fetchone()[0]
            conn.commit()
            return _resp(200, {"ok": True, "id": mid,
                               "message": "Материал отправлен на проверку. После одобрения он появится в базе."})

        # ── my — мои материалы ───────────────────────────────────────────────
        if action == "my" and method == "GET":
            user = get_user(login, token, conn)
            if not user:
                return _resp(401, {"error": "Войдите в личный кабинет"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, title, subject, status, reject_reason, downloads_count,
                           bonus_granted, created_at
                    FROM {SCHEMA}.materials WHERE author_login = %s
                    ORDER BY created_at DESC LIMIT 100""",
                (login,),
            )
            items = [{"id": x[0], "title": x[1], "subject": x[2], "status": x[3],
                      "reject_reason": x[4], "downloads_count": x[5],
                      "bonus_granted": x[6], "created_at": str(x[7])} for x in cur.fetchall()]
            return _resp(200, {"items": items})

        # ── download — получить прямую ссылку с проверкой лимита/подписки ─────
        if action == "download" and method == "POST":
            mid = body.get("id")
            if not mid:
                return _resp(400, {"error": "Укажите материал"})
            cur = conn.cursor()
            cur.execute(
                f"SELECT file_url, file_name, status FROM {SCHEMA}.materials WHERE id = %s",
                (mid,),
            )
            m = cur.fetchone()
            if not m or m[2] != "approved":
                return _resp(404, {"error": "Материал не найден"})
            file_url, file_name = m[0], m[1]

            user = get_user(login, token, conn) if login else None
            # Учителя/ученики с активной подпиской Основная САОУ — безлимит
            if user and user["subscription_active"]:
                pass
            else:
                # Считаем скачивания по IP
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.material_downloads WHERE ip_address = %s",
                    (ip,),
                )
                used = cur.fetchone()[0] or 0
                if used >= FREE_DOWNLOADS_LIMIT:
                    return _resp(402, {
                        "error": "limit_reached",
                        "message": "Вы скачали 5 материалов. Оформите подписку 99 ₽/мес или войдите с подпиской САОУ, чтобы продолжить.",
                        "limit": FREE_DOWNLOADS_LIMIT,
                    })

            cur.execute(
                f"""INSERT INTO {SCHEMA}.material_downloads (material_id, ip_address, downloader_login)
                    VALUES (%s, %s, %s)""",
                (mid, ip, login or None),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.materials SET downloads_count = downloads_count + 1 WHERE id = %s",
                (mid,),
            )
            conn.commit()
            return _resp(200, {"ok": True, "file_url": file_url, "file_name": file_name})

        # ── moderation — очередь материалов на проверку (УДС) ────────────────
        if action == "moderation" and method == "GET":
            mod = get_moderator(login, token, conn)
            if not mod:
                return _resp(403, {"error": "Доступно Советникам, Заму и Главе УДС"})
            cur = conn.cursor()
            cur.execute(
                f"""SELECT id, title, description, subject, grade, material_type,
                           file_url, file_name, file_ext, preview_url, author_name,
                           author_role, author_login, created_at
                    FROM {SCHEMA}.materials WHERE status = 'pending'
                    ORDER BY created_at ASC LIMIT 200""",
            )
            items = [{"id": x[0], "title": x[1], "description": x[2], "subject": x[3],
                      "grade": x[4], "material_type": x[5], "file_url": x[6],
                      "file_name": x[7], "file_ext": x[8], "preview_url": x[9],
                      "author_name": x[10], "author_role": x[11], "author_login": x[12],
                      "created_at": str(x[13])} for x in cur.fetchall()]
            return _resp(200, {"items": items})

        # ── moderate — одобрить/отклонить материал + бонус автору ────────────
        if action == "moderate" and method == "POST":
            mod = get_moderator(login, token, conn)
            if not mod:
                return _resp(403, {"error": "Доступно Советникам, Заму и Главе УДС"})
            mid = body.get("id")
            approve = bool(body.get("approve"))
            reason = (body.get("reason") or "").strip()[:500]
            if not mid:
                return _resp(400, {"error": "Укажите материал"})
            cur = conn.cursor()
            cur.execute(
                f"SELECT author_login, author_role, status, bonus_granted FROM {SCHEMA}.materials WHERE id = %s",
                (mid,),
            )
            m = cur.fetchone()
            if not m:
                return _resp(404, {"error": "Материал не найден"})
            author_login, author_role, status, bonus_granted = m
            if status != "pending":
                return _resp(409, {"error": "Материал уже проверен"})

            new_status = "approved" if approve else "rejected"
            cur.execute(
                f"""UPDATE {SCHEMA}.materials
                    SET status = %s, moderator_login = %s, moderator_name = %s,
                        reject_reason = %s, moderated_at = NOW()
                    WHERE id = %s""",
                (new_status, mod["login"], mod["full_name"], reason or None, mid),
            )
            granted = False
            # Бонус автору-учителю за одобренный материал (один раз)
            if approve and not bonus_granted and author_role == "teacher":
                cur.execute(
                    f"""UPDATE {SCHEMA}.users
                        SET ai_tokens_balance = ai_tokens_balance + %s,
                            ai_tokens_gifted = ai_tokens_gifted + %s
                        WHERE login = %s""",
                    (AUTHOR_BONUS, AUTHOR_BONUS, author_login),
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.materials SET bonus_granted = TRUE WHERE id = %s",
                    (mid,),
                )
                granted = True
            conn.commit()
            return _resp(200, {"ok": True, "status": new_status,
                               "bonus_granted": granted, "bonus": AUTHOR_BONUS if granted else 0})

        return _resp(404, {"error": f"Неизвестное действие: {action}"})
    finally:
        conn.close()