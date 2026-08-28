"""
Распознавание бланка ответов через Yandex Vision OCR.

YandexGPT — текстовая модель и изображения читать не умеет, поэтому для
картинок используется отдельный сервис Yandex Cloud — Vision OCR
(https://ocr.api.cloud.yandex.net). Он возвращает найденный текст вместе с
координатами каждого блока/строки/слова, а также распознаёт таблицы.

Задача бланка: понять, КАКАЯ клетка (А/Б/В/Г/Д) закрашена в каждой строке.
OCR сам по себе «крестики» не читает, поэтому работаем так:
  1) отдаём картинку в Vision OCR и получаем координаты ВСЕХ распознанных
     символов — по ним находим номера вопросов (1, 2, 3…) и буквы вариантов
     (А, Б, В, Г) в шапке/строках;
  2) строим сетку клеток из этих координат;
  3) определяем закрашенную клетку по заполненности пикселей внутри клетки.

Тарификация Vision OCR — за страницу, а не за токены. Чтобы вписать её в
общую систему списаний проекта (0.2 коп/токен + наценка 40%), стоимость
страницы переводится в «токен-эквивалент» — см. PAGE_TOKENS_EQUIV.
"""
import os
import json
import base64
import urllib.request
import urllib.error

OCR_URL = "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText"

# Стоимость одной страницы Vision OCR в токен-эквиваленте.
# В проекте ставка списания = 0.2 коп/токен (см. auth/spend-tokens), наценка
# +40% накидывается там же. Страница Vision OCR стоит ~0.13 ₽ = 13 коп, значит
# 13 коп / 0.2 коп = 65 токенов. Дальше spend-tokens сам добавит +40%.
PAGE_TOKENS_EQUIV = 65


class VisionError(RuntimeError):
    """Ошибка обращения к Yandex Vision OCR."""


def _creds() -> tuple[str, str]:
    api_key = os.environ.get("YANDEXGPT_API_KEY", "").strip()
    folder_id = os.environ.get("YANDEXGPT_FOLDER_ID", "").strip()
    if not api_key or not folder_id:
        raise VisionError("YANDEXGPT_API_KEY или YANDEXGPT_FOLDER_ID не заданы")
    return api_key, folder_id


def recognize_text(image_b64: str, timeout: int = 30,
                   model: str = "handwritten") -> dict:
    """Отправляет изображение в Yandex Vision OCR и возвращает сырой ответ.

    image_b64 — картинка в base64 (без префикса data:...).
    model="handwritten" — распознаёт И рукописный, И печатный текст: именно
    он нужен для бланка, где ученик вписывает буквы ответов от руки.
    model="page" — только печатный текст.
    """
    api_key, folder_id = _creds()
    payload = {
        "mimeType": "JPEG",
        "languageCodes": ["ru", "en"],
        "model": model,
        "content": image_b64,
    }
    req = urllib.request.Request(
        OCR_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Api-Key {api_key}",
            "x-folder-id": folder_id,
            "x-data-logging-enabled": "false",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="ignore")[:300] if hasattr(e, "read") else str(e)
        raise VisionError(f"Vision OCR HTTP {e.code}: {text}")
    except Exception as e:
        raise VisionError(f"Vision OCR недоступен: {e}")


def _iter_words(result: dict):
    """Разворачивает ответ Vision OCR в плоский список слов с координатами.

    Формат ответа: result.textAnnotation.blocks[].lines[].words[]
    У каждого слова есть boundingBox с 4 вершинами (x, y в пикселях-строках).
    """
    ann = (result.get("result") or {}).get("textAnnotation") or result.get("textAnnotation") or {}
    for block in ann.get("blocks") or []:
        for line in block.get("lines") or []:
            for word in line.get("words") or []:
                text = (word.get("text") or "").strip()
                if not text:
                    continue
                verts = ((word.get("boundingBox") or {}).get("vertices")) or []
                xs = [int(v.get("x") or 0) for v in verts]
                ys = [int(v.get("y") or 0) for v in verts]
                if not xs or not ys:
                    continue
                yield {
                    "text": text,
                    "x0": min(xs), "x1": max(xs),
                    "y0": min(ys), "y1": max(ys),
                    "cx": (min(xs) + max(xs)) / 2.0,
                    "cy": (min(ys) + max(ys)) / 2.0,
                }


def extract_words(result: dict) -> list:
    """Список распознанных слов с координатами (см. _iter_words)."""
    return list(_iter_words(result))


def extract_lines(result: dict) -> list:
    """Строки бланка в том виде, как их увидел OCR.

    Внутри строки слова идут слева направо, а на бланке строка выглядит как
    «1.  А   11.  Д» — то есть пары «номер вопроса → буква ответа». Разбор по
    строке надёжнее разбора по координатам: порядок слов OCR сохраняет даже
    на кривом фото.
    """
    ann = (result.get("result") or {}).get("textAnnotation") or result.get("textAnnotation") or {}
    lines = []
    for block in ann.get("blocks") or []:
        for line in block.get("lines") or []:
            items = []
            for word in line.get("words") or []:
                text = (word.get("text") or "").strip()
                if not text:
                    continue
                verts = ((word.get("boundingBox") or {}).get("vertices")) or []
                xs = [int(v.get("x") or 0) for v in verts]
                ys = [int(v.get("y") or 0) for v in verts]
                if not xs or not ys:
                    continue
                items.append({
                    "text": text,
                    "x0": min(xs), "x1": max(xs),
                    "y0": min(ys), "y1": max(ys),
                    "cx": (min(xs) + max(xs)) / 2.0,
                    "cy": (min(ys) + max(ys)) / 2.0,
                })
            if items:
                items.sort(key=lambda w: w["cx"])
                lines.append(items)
    return lines


def extract_chars(result: dict) -> list:
    """Список ОТДЕЛЬНЫХ символов с координатами.

    На бланке клетки ответов стоят в несколько колонок, и OCR нередко
    склеивает буквы соседних колонок в одно «слово» («АД» вместо «А» и «Д»)
    с общим прямоугольником. Тогда по координатам слова невозможно понять,
    к какой клетке относится каждая буква.

    Поэтому многосимвольные слова разбиваем на символы: ширина слова делится
    поровну между его символами — для моноширинных рукописных клеток бланка
    это даёт достаточную точность.
    """
    chars = []
    for w in _iter_words(result):
        text = w["text"]
        n = len(text)
        if n <= 1:
            chars.append(w)
            continue
        span = (w["x1"] - w["x0"]) / float(n)
        for i, ch in enumerate(text):
            if not ch.strip():
                continue
            x0 = w["x0"] + i * span
            x1 = x0 + span
            chars.append({
                "text": ch,
                "x0": x0, "x1": x1,
                "y0": w["y0"], "y1": w["y1"],
                "cx": (x0 + x1) / 2.0,
                "cy": w["cy"],
                "from_word": text,
            })
    return chars


def extract_full_text(result: dict) -> str:
    """Весь распознанный текст страницы одной строкой (для отладки/QR-кода)."""
    ann = (result.get("result") or {}).get("textAnnotation") or result.get("textAnnotation") or {}
    return (ann.get("fullText") or "").strip()