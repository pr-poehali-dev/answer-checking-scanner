"""
OAuth-интеграция с Яндекс.Диском для учителей АОУСПТ.
GET  /?action=auth_url&redirect_uri=...&state=... — получить URL для авторизации
POST /?action=exchange  body: {code, redirect_uri} — обменять код на токены
POST /?action=refresh   body: {refresh_token}     — обновить access-токен
"""
import json
import os
import urllib.parse
import urllib.request
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def handler(event: dict, context) -> dict:
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

    # Получить URL для редиректа на Яндекс
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

    # Обменять код на токены
    if method == "POST" and action == "exchange":
        code = (body.get("code") or "").strip()
        redirect_uri = (body.get("redirect_uri") or "").strip()
        if not code:
            return _resp(400, {"error": "code обязателен"})
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

        # Получим инфо о пользователе для отображения подключённого аккаунта
        access = tokens.get("access_token", "")
        user_info = {}
        if access:
            try:
                req2 = urllib.request.Request(
                    "https://login.yandex.ru/info?format=json",
                    headers={"Authorization": f"OAuth {access}"},
                )
                with urllib.request.urlopen(req2, timeout=10) as r2:
                    user_info = json.loads(r2.read().decode())
            except Exception:
                user_info = {}

        return _resp(200, {
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_in": tokens.get("expires_in"),
            "user": {
                "login": user_info.get("login"),
                "display_name": user_info.get("display_name") or user_info.get("real_name") or user_info.get("login"),
                "default_email": user_info.get("default_email"),
            },
        })

    # Обновить access по refresh
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

    return _resp(404, {"error": "Неизвестное действие"})
