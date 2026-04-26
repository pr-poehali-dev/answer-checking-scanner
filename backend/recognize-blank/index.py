"""
Распознавание отсканированного бланка ответов ЕГЭ/ОГЭ.
Принимает base64-изображение, возвращает код ученика и ответы.
"""
import json
import base64
import os
import re


def handler(event: dict, context) -> dict:
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        image_b64 = body.get("image")
        answer_key = body.get("answer_key", "")
        part1_count = int(body.get("part1_count", 26))
        part2_count = int(body.get("part2_count", 7))

        if not image_b64:
            return {
                "statusCode": 400,
                "headers": cors,
                "body": json.dumps({"error": "Изображение не передано"}),
            }

        image_bytes = base64.b64decode(image_b64)
        image_size = len(image_bytes)

        student_code = _recognize_student_code(image_bytes, image_size)
        answers_part1 = _recognize_part1(image_bytes, image_size, part1_count)
        answers_part2 = _recognize_part2(image_bytes, image_size, part2_count, part1_count)

        all_answers = answers_part1 + answers_part2
        analysis = _analyze_answers(all_answers, answer_key, part1_count)

        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({
                "student_code": student_code,
                "answers_part1": answers_part1,
                "answers_part2": answers_part2,
                "all_answers": all_answers,
                "analysis": analysis,
                "image_size_kb": round(image_size / 1024, 1),
            }, ensure_ascii=False),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }


def _recognize_student_code(image_bytes: bytes, size: int) -> str:
    """
    Симуляция распознавания 5-значного кода ученика из верхней части бланка.
    В продакшене: OpenCV + Tesseract или Vision API.
    """
    seed = size % 90000 + 10000
    return str(seed)


def _recognize_part1(image_bytes: bytes, size: int, count: int) -> list[str]:
    """
    Симуляция распознавания ответов части 1 (буквы А-Д, цифры 1-9).
    В продакшене: детекция ячеек + OCR каждой ячейки.
    """
    cyrillic = ["А", "Б", "В", "Г", "Д"]
    digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    answers = []
    for i in range(count):
        if (size + i) % 3 == 0:
            answers.append(digits[(size + i * 7) % len(digits)])
        else:
            answers.append(cyrillic[(size + i * 3) % len(cyrillic)])
    return answers


def _recognize_part2(image_bytes: bytes, size: int, count: int, offset: int) -> list[str]:
    """
    Симуляция распознавания ответов части 2 (текстовые строки).
    В продакшене: OCR строк после детекции линий.
    """
    templates = [
        "явление", "1917", "реформа", "конституция",
        "экономика", "социализм", "модернизация"
    ]
    answers = []
    for i in range(count):
        answers.append(templates[(size + i + offset) % len(templates)])
    return answers


def _analyze_answers(student_answers: list[str], answer_key: str, part1_count: int) -> dict:
    """
    Сравнение ответов ученика с ключом. Возвращает детальный анализ.
    """
    if not answer_key:
        return {"total": len(student_answers), "correct": 0, "wrong": 0, "details": [], "score_raw": 0}

    key_list = list(answer_key.strip())
    details = []
    correct = 0

    for i, student_ans in enumerate(student_answers):
        key_ans = key_list[i] if i < len(key_list) else ""
        is_correct = student_ans.upper() == key_ans.upper() and key_ans != ""
        if is_correct:
            correct += 1
        details.append({
            "question": i + 1,
            "student": student_ans,
            "key": key_ans,
            "correct": is_correct,
            "part": 1 if i < part1_count else 2,
        })

    total = len(student_answers)
    score_raw = correct
    score_scaled = _raw_to_scaled(score_raw, total)

    return {
        "total": total,
        "correct": correct,
        "wrong": total - correct,
        "score_raw": score_raw,
        "score_scaled": score_scaled,
        "percent": round(correct / total * 100, 1) if total > 0 else 0,
        "details": details,
    }


def _raw_to_scaled(raw: int, total: int) -> int:
    """Приблизительное шкалирование ЕГЭ (Русский язык, 32 первичных = 96 тестовых)."""
    if total == 0:
        return 0
    ratio = raw / total
    if ratio >= 0.97:
        return 96
    if ratio >= 0.95:
        return 89
    if ratio >= 0.86:
        return 75
    if ratio >= 0.72:
        return 64
    if ratio >= 0.53:
        return 52
    if ratio >= 0.31:
        return 36
    if ratio >= 0.16:
        return 24
    return 0
