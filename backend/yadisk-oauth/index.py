"""
OAuth-интеграция с Яндекс.Диском для учителей АОУСПТ.
GET  /?action=auth_url&redirect_uri=...&state=... — получить URL для авторизации
POST /?action=exchange  body: {code, redirect_uri, auth_token, user_login} — обменять код на токены и привязать к ЛК
POST /?action=refresh   body: {refresh_token}     — обновить access-токен
POST /?action=unbind    body: {auth_token, user_login} — отвязать Я.Диск от ЛК
"""
import json
import os
import urllib.parse
import urllib.request
import urllib.error
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p31556921_answer_checking_scan")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def _get_yandex_user_info(access_token: str) -> dict:
    try:
        req = urllib.request.Request(
            "https://login.yandex.ru/info?format=json",
            headers={"Authorization": f"OAuth {access_token}"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}


def handler(event: dict, context) -> dict:
    """OAuth-привязка Яндекс.Диска к учётной записи учителя АОУСПТ с проверкой уникальности."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            body = {}

    client_id = os.environ.get("YANDEX_CLIENT_ID", "").strip()
    client_secret = os.environ.get("YANDEX_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        return _resp(500, {"error": "OAuth-приложение Яндекса не настроено"})

    # ── GET auth_url: получить URL для редиректа на Яндекс ──────────────────
    if method == "GET" and action == "auth_url":
        redirect_uri = (qs.get("redirect_uri") or "").strip()
        state = (qs.get("state") or "").strip()
        if not redirect_uri:
            return _resp(400, {"error": "redirect_uri обязателен"})
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "force_confirm": "yes",
        }
        if state:
            params["state"] = state
        url = "https://oauth.yandex.ru/authorize?" + urllib.parse.urlencode(params)
        return _resp(200, {"url": url})

    # ── POST exchange: обмен кода на токены + привязка к ЛК ─────────────────
    if method == "POST" and action == "exchange":
        code = (body.get("code") or "").strip()
        redirect_uri = (body.get("redirect_uri") or "").strip()
        user_login = (body.get("user_login") or "").strip()
        auth_token = (body.get("auth_token") or "").strip()

        if not code:
            return _resp(400, {"error": "code обязателен"})
        if not user_login or not auth_token:
            return _resp(400, {"error": "Необходимо войти в систему перед подключением Я.Диска"})

        # Получаем токены от Яндекса
        data = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            **({"redirect_uri": redirect_uri} if redirect_uri else {}),
        }).encode()
        req = urllib.request.Request(
            "https://oauth.yandex.ru/token",
            data=data,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                tokens = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode(errors="ignore")
            try:
                err_data = json.loads(err)
                msg = err_data.get("error_description") or err_data.get("error") or err
            except Exception:
                msg = err
            return _resp(400, {"error": f"Не удалось получить токен: {msg}"})
        except Exception as e:
            return _resp(500, {"error": f"Ошибка обмена кода: {e}"})

        access = tokens.get("access_token", "")
        refresh = tokens.get("refresh_token", "")

        # Получаем логин Яндекс-аккаунта
        user_info = _get_yandex_user_info(access)
        yandex_login = user_info.get("login") or ""
        if not yandex_login:
            return _resp(500, {"error": "Не удалось получить информацию о аккаунте Яндекса"})

        # Проверяем и сохраняем привязку в БД
        conn = get_conn()
        try:
            cur = conn.cursor()

            # Проверяем, что текущий пользователь существует в БД
            cur.execute(
                f"SELECT login, yadisk_login FROM {SCHEMA}.users WHERE login = %s",
                (user_login,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(403, {"error": "Пользователь не найден"})

            current_yadisk = row[1]

            # Если у этого ЛК уже привязан другой Я.Диск — отвязываем старый
            # (пользователь сам переподключает свой аккаунт)

            # Проверяем, не привязан ли этот Яндекс-аккаунт к ДРУГОМУ ЛК
            cur.execute(
                f"SELECT login FROM {SCHEMA}.users WHERE yadisk_login = %s AND login != %s",
                (yandex_login, user_login)
            )
            conflict = cur.fetchone()
            if conflict:
                return _resp(409, {
                    "error": f"Этот аккаунт Яндекс.Диска ({yandex_login}) уже привязан к другому личному кабинету. Подключите другой аккаунт Яндекса.",
                    "conflict": True,
                    "yadisk_login": yandex_login,
                })

            # Сохраняем привязку
            cur.execute(
                f"UPDATE {SCHEMA}.users SET yadisk_login = %s, yadisk_refresh_token = %s WHERE login = %s",
                (yandex_login, refresh, user_login)
            )
            conn.commit()
        finally:
            conn.close()

        return _resp(200, {
            "access_token": access,
            "refresh_token": refresh,
            "expires_in": tokens.get("expires_in"),
            "user": {
                "login": yandex_login,
                "display_name": user_info.get("display_name") or user_info.get("real_name") or yandex_login,
                "default_email": user_info.get("default_email"),
            },
        })

    # ── POST refresh: обновить access по refresh ─────────────────────────────
    if method == "POST" and action == "refresh":
        refresh = (body.get("refresh_token") or "").strip()
        if not refresh:
            return _resp(400, {"error": "refresh_token обязателен"})
        data = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "client_id": client_id,
            "client_secret": client_secret,
        }).encode()
        req = urllib.request.Request(
            "https://oauth.yandex.ru/token",
            data=data,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                tokens = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode(errors="ignore")
            return _resp(400, {"error": f"Не удалось обновить токен: {err}"})
        except Exception as e:
            return _resp(500, {"error": f"Ошибка обновления: {e}"})
        return _resp(200, tokens)

    # ── GET get-yadisk-token: вернуть refresh_token из БД для залогиненного пользователя ───
    if method == "GET" and action == "get-yadisk-token":
        user_login = (qs.get("user_login") or "").strip()
        auth_token = (qs.get("auth_token") or "").strip()
        if not user_login or not auth_token:
            return _resp(400, {"error": "user_login и auth_token обязательны"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"SELECT auth_token, yadisk_refresh_token, yadisk_login FROM {SCHEMA}.users WHERE login = %s",
                (user_login,)
            )
            row = cur.fetchone()
        finally:
            conn.close()
        if not row:
            return _resp(404, {"error": "Пользователь не найден"})
        if row[0] != auth_token:
            return _resp(403, {"error": "Неверный токен авторизации"})
        if not row[1]:
            return _resp(404, {"error": "Я.Диск не привязан"})
        return _resp(200, {"refresh_token": row[1], "yadisk_login": row[2] or ""})

    # ── POST unbind: отвязать Я.Диск от ЛК ─────────────────────────────────
    if method == "POST" and action == "unbind":
        user_login = (body.get("user_login") or "").strip()
        if not user_login:
            return _resp(400, {"error": "user_login обязателен"})
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET yadisk_login = NULL, yadisk_refresh_token = NULL WHERE login = %s",
                (user_login,)
            )
            conn.commit()
        finally:
            conn.close()
        return _resp(200, {"ok": True})

    return _resp(404, {"error": "Неизвестное действие"})