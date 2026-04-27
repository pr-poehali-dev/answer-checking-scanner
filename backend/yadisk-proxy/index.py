"""
Прокси к Яндекс.Диску — обходит CORS и упрощает работу из фронта.
Заголовок X-Yadisk-Token — OAuth-токен учителя.

POST /?action=ensure_folder body: {path}             — создать папку (рекурсивно)
POST /?action=upload        body: {path, content_b64, overwrite?} — загрузить файл (base64)
POST /?action=upload_text   body: {path, text, overwrite?}        — загрузить текстовый файл
GET  /?action=download&path=...                                   — скачать файл (вернёт base64)
GET  /?action=download_text&path=...                              — скачать текстовый файл (вернёт строку)
GET  /?action=list&path=...                                       — список файлов в папке
POST /?action=delete        body: {path}                          — удалить файл/папку
"""
import json
import os
import base64
import urllib.parse
import urllib.request
import urllib.error

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Yadisk-Token",
}

API = "https://cloud-api.yandex.net/v1/disk"


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def _yreq(method: str, url: str, token: str, data: bytes = None, extra_headers: dict = None) -> tuple:
    """Запрос к API Я.Диска. Возвращает (status, body_bytes)."""
    headers = {"Authorization": f"OAuth {token}"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _ensure_folder_recursive(token: str, folder_path: str) -> dict:
    """Создаёт папку, рекурсивно создавая родительские. Если уже есть — ок."""
    parts = [p for p in folder_path.strip("/").split("/") if p]
    current = ""
    for p in parts:
        current = f"{current}/{p}" if current else p
        url = f"{API}/resources?path={urllib.parse.quote(current)}"
        status, body = _yreq("PUT", url, token)
        # 201 — создано, 409 — уже существует
        if status not in (201, 409):
            try:
                err = json.loads(body.decode())
            except Exception:
                err = {"raw": body.decode(errors="ignore")}
            return {"ok": False, "status": status, "error": err}
    return {"ok": True, "path": current}


def handler(event: dict, context) -> dict:
    """Прокси-функция к API Яндекс.Диска для приложения АОУСПТ."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = (qs.get("action") or "").strip().lower()

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    token = headers.get("x-yadisk-token", "").strip()
    if not token:
        return _resp(401, {"error": "Нет токена Я.Диска"})

    body = {}
    if event.get("body"):
        raw = event["body"]
        if event.get("isBase64Encoded"):
            try:
                raw = base64.b64decode(raw).decode()
            except Exception:
                raw = ""
        try:
            body = json.loads(raw) if raw else {}
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            body = {}

    # Создать папку (рекурсивно)
    if method == "POST" and action == "ensure_folder":
        path = (body.get("path") or "").strip()
        if not path:
            return _resp(400, {"error": "path обязателен"})
        result = _ensure_folder_recursive(token, path)
        if not result["ok"]:
            return _resp(400, {"error": "Не удалось создать папку", "details": result})
        return _resp(200, result)

    # Загрузить файл (через получение upload-URL)
    if method == "POST" and action in ("upload", "upload_text"):
        path = (body.get("path") or "").strip()
        overwrite = bool(body.get("overwrite", True))
        if not path:
            return _resp(400, {"error": "path обязателен"})

        if action == "upload_text":
            text = body.get("text", "")
            if not isinstance(text, str):
                return _resp(400, {"error": "text должен быть строкой"})
            payload = text.encode("utf-8")
        else:
            content_b64 = body.get("content_b64", "")
            if not content_b64:
                return _resp(400, {"error": "content_b64 обязателен"})
            try:
                payload = base64.b64decode(content_b64)
            except Exception:
                return _resp(400, {"error": "content_b64 невалидный"})

        # Авто-создание родительской папки
        if "/" in path.strip("/"):
            parent = "/".join(path.strip("/").split("/")[:-1])
            if parent:
                _ensure_folder_recursive(token, parent)

        # 1) Получить upload URL
        url = f"{API}/resources/upload?path={urllib.parse.quote(path)}&overwrite={'true' if overwrite else 'false'}"
        status, raw = _yreq("GET", url, token)
        if status != 200:
            try:
                err = json.loads(raw.decode())
            except Exception:
                err = {"raw": raw.decode(errors="ignore")}
            return _resp(status, {"error": "Не удалось получить upload-URL", "details": err})
        info = json.loads(raw.decode())
        href = info.get("href")
        if not href:
            return _resp(500, {"error": "Я.Диск не вернул upload-URL"})

        # 2) Залить содержимое (PUT)
        req2 = urllib.request.Request(href, data=payload, method="PUT")
        try:
            with urllib.request.urlopen(req2, timeout=60) as r2:
                up_status = r2.status
        except urllib.error.HTTPError as e:
            return _resp(e.code, {"error": "Ошибка загрузки", "details": e.read().decode(errors="ignore")})

        return _resp(200, {"ok": True, "path": path, "size": len(payload), "status": up_status})

    # Скачать файл
    if method == "GET" and action in ("download", "download_text"):
        path = (qs.get("path") or "").strip()
        if not path:
            return _resp(400, {"error": "path обязателен"})

        url = f"{API}/resources/download?path={urllib.parse.quote(path)}"
        status, raw = _yreq("GET", url, token)
        if status != 200:
            try:
                err = json.loads(raw.decode())
            except Exception:
                err = {"raw": raw.decode(errors="ignore")}
            return _resp(status, {"error": "Не удалось получить download-URL", "details": err})
        info = json.loads(raw.decode())
        href = info.get("href")
        if not href:
            return _resp(500, {"error": "Я.Диск не вернул download-URL"})

        try:
            with urllib.request.urlopen(href, timeout=60) as r2:
                content = r2.read()
        except urllib.error.HTTPError as e:
            return _resp(e.code, {"error": "Ошибка скачивания"})

        if action == "download_text":
            try:
                return _resp(200, {"text": content.decode("utf-8"), "path": path})
            except UnicodeDecodeError:
                return _resp(400, {"error": "Файл не текстовый"})
        return _resp(200, {"content_b64": base64.b64encode(content).decode(), "path": path, "size": len(content)})

    # Список файлов в папке
    if method == "GET" and action == "list":
        path = (qs.get("path") or "/").strip()
        url = f"{API}/resources?path={urllib.parse.quote(path)}&limit=200"
        status, raw = _yreq("GET", url, token)
        if status == 404:
            return _resp(200, {"items": [], "exists": False})
        if status != 200:
            try:
                err = json.loads(raw.decode())
            except Exception:
                err = {"raw": raw.decode(errors="ignore")}
            return _resp(status, {"error": "Не удалось получить список", "details": err})
        info = json.loads(raw.decode())
        embedded = info.get("_embedded", {}) or {}
        items = embedded.get("items", []) or []
        return _resp(200, {
            "items": [{
                "name": it.get("name"),
                "path": it.get("path"),
                "type": it.get("type"),
                "size": it.get("size"),
                "modified": it.get("modified"),
            } for it in items],
            "exists": True,
        })

    # Удалить
    if method == "POST" and action == "delete":
        path = (body.get("path") or "").strip()
        if not path:
            return _resp(400, {"error": "path обязателен"})
        url = f"{API}/resources?path={urllib.parse.quote(path)}&permanently=true"
        status, raw = _yreq("DELETE", url, token)
        if status not in (202, 204, 404):
            try:
                err = json.loads(raw.decode())
            except Exception:
                err = {"raw": raw.decode(errors="ignore")}
            return _resp(status, {"error": "Не удалось удалить", "details": err})
        return _resp(200, {"ok": True})

    return _resp(404, {"error": "Неизвестное действие"})
