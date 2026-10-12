"""
Проверка бланка ответов «САОУ» по фотографии.
POST / — { image: base64, questionsCount?: 20, optionsCount?: 4, answerKey?: "АБВГ..." }
-> { studentCode, answers[], confidences[], warnings[], analysis, spentRub: 0 }

Бланк читается программно: по четырём чёрным меткам в углах фото
выравнивается, затем измеряется закраска каждого кружка. Нейросеть не
используется, поэтому проверка бесплатна и не списывает ИИ-баланс.

Режим пересчёта: без image, но с answers[] — только сверка с новым ключом.
"""
import json

import omr

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-User-Login",
}

OPTS = ["А", "Б", "В", "Г", "Д", "Е"]
LAT_TO_CYR = {"A": "А", "B": "Б", "C": "В", "D": "Г", "E": "Д", "F": "Е"}


def _resp(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def _normalize_key(answer_key: str) -> list:
    out = []
    for ch in (answer_key or "").upper():
        ch = LAT_TO_CYR.get(ch, ch)
        if ch in OPTS:
            out.append(ch)
    return out


def _analyze(answers: list, answer_key: str) -> dict:
    key = _normalize_key(answer_key)
    details, correct = [], 0
    for i, a in enumerate(answers):
        ka = key[i] if i < len(key) else ""
        ok = bool(ka) and a.upper() == ka
        correct += 1 if ok else 0
        details.append({"q": i + 1, "answer": a, "correct": ka, "ok": ok})
    total = len(answers)
    percent = round(correct / total * 100) if total and key else 0
    return {"total": total, "correct": correct, "wrong": total - correct,
            "percent": percent, "details": details if key else []}


def handler(event: dict, context) -> dict:
    """Распознавание бланка с закрашиваемыми кружками (бесплатно, без ИИ)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            return _resp(400, {"error": "Некорректный JSON"})
    if not isinstance(body, dict):
        return _resp(400, {"error": "Некорректный JSON"})

    try:
        n_q = max(1, min(int(body.get("questionsCount") or body.get("questions_count") or 20), omr.G.MAX_Q))
        n_opts = max(2, min(int(body.get("optionsCount") or body.get("options_count") or 4), 6))
    except (TypeError, ValueError):
        n_q, n_opts = 20, 4
    answer_key = str(body.get("answerKey") or body.get("answer_key") or "").strip()

    image_b64 = body.get("image") or body.get("image_b64") or ""
    if not image_b64:
        answers = body.get("answers") or []
        if not isinstance(answers, list) or not answers:
            return _resp(400, {"error": "Поле image или answers обязательно"})
        answers = [str(a) for a in answers]
        return _resp(200, {
            "studentCode": str(body.get("studentCode") or body.get("student_code") or ""),
            "answers": answers, "confidences": [], "warnings": [],
            "squaresFound": 0, "answerRows": len(answers),
            "analysis": _analyze(answers, answer_key),
        })

    try:
        res = omr.read_blank(image_b64, n_q, n_opts)
    except omr.OmrError as e:
        return _resp(e.status, {"error": str(e)})
    except Exception:
        return _resp(422, {"error": "Не удалось обработать фото. Сфотографируйте бланк целиком, ровно и при хорошем свете."})

    return _resp(200, {
        "studentCode": res["code"],
        "answers": res["answers"],
        "confidences": res["confidences"],
        "warnings": res["warnings"],
        "squaresFound": 4,
        "answerRows": n_q,
        "spentRub": 0,
        "analysis": _analyze(res["answers"], answer_key),
    })
