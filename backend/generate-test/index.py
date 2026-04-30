"""
Генерация контрольной/проверочной работы или теста через GigaChat в .docx.
POST / body: {
  workType: "Тест" | "Проверочная работа" | "Контрольная работа",
  subject, classNum, topic, description?,
  part1Count: int (тестовые вопросы с вариантами),
  part2Count: int (открытые вопросы),
  teacherName, teacherSchool
}
Возвращает: {docx_b64, filename, workId, part1Count, part2Count, totalQuestions, answerKey, gradeScale, questions[]}
"""
import json
import os
import io
import re
import ssl
import time
import uuid
import base64
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta

AUTH_URL = os.environ.get("AUTH_FUNCTION_URL", "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b")

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

_TOKEN_CACHE = {"token": None, "expires_at": None}


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
        "isBase64Encoded": False,
    }


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def get_gigachat_token() -> str:
    now = datetime.utcnow()
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] and _TOKEN_CACHE["expires_at"] > now:
        return _TOKEN_CACHE["token"]
    auth_key = os.environ.get("GIGACHAT_AUTH_KEY", "").strip()
    if not auth_key:
        raise RuntimeError("GIGACHAT_AUTH_KEY не задан")
    rq_uid = str(uuid.uuid4())
    data = urllib.parse.urlencode({"scope": "GIGACHAT_API_PERS"}).encode()
    req = urllib.request.Request(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        data=data, method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": rq_uid,
            "Authorization": f"Basic {auth_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as r:
        body = json.loads(r.read().decode())
    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GigaChat не вернул access_token")
    expires_in_ms = body.get("expires_at")
    if expires_in_ms:
        expires_at = datetime.utcfromtimestamp(expires_in_ms / 1000) - timedelta(minutes=2)
    else:
        expires_at = now + timedelta(minutes=25)
    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = expires_at
    return token


def _gigachat_call_once(messages: list, max_tokens: int, temperature: float, model: str, req_timeout: int) -> str:
    token = get_gigachat_token()
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    req = urllib.request.Request(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Connection": "close",
        },
    )
    with urllib.request.urlopen(req, timeout=req_timeout, context=_ssl_ctx()) as r:
        body = json.loads(r.read().decode())
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError(f"GigaChat вернул пустой ответ")
    return choices[0].get("message", {}).get("content", "").strip()


def gigachat_chat(messages: list, max_tokens: int = 2400, temperature: float = 0.4, req_timeout: int = 25, max_retries: int = 3) -> str:
    last_err = None
    for model in ("GigaChat-2", "GigaChat", "GigaChat-Lite"):
        for attempt in range(1, max_retries + 1):
            try:
                return _gigachat_call_once(messages, max_tokens, temperature, model, req_timeout)
            except urllib.error.HTTPError as e:
                err_text = e.read().decode(errors='ignore')[:300] if hasattr(e, 'read') else str(e)
                if e.code in (401, 403):
                    raise RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
                if e.code == 404:
                    last_err = RuntimeError(f"MODEL_NOT_FOUND: {err_text}")
                    break  # пробуем следующую модель
                last_err = RuntimeError(f"GigaChat HTTP {e.code}: {err_text}")
                if attempt < max_retries:
                    time.sleep(2.0)
                    continue
                break
            except Exception as e:
                msg = str(e)
                last_err = RuntimeError(f"GigaChat недоступен: {e}")
                is_conn_err = (
                    "remote end closed" in msg.lower()
                    or "remotedisconnected" in msg.lower()
                    or "connection reset" in msg.lower()
                )
                _TOKEN_CACHE["token"] = None
                _TOKEN_CACHE["expires_at"] = None
                if is_conn_err:
                    time.sleep(2.0)
                    break  # соединение оборвано — пробуем следующую модель
                if attempt < max_retries:
                    time.sleep(2.0)
                    continue
                break
    raise last_err if last_err else RuntimeError("GigaChat: не удалось получить ответ")


def extract_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence:
        text = fence.group(1)
    else:
        s = text.find("{")
        e = text.rfind("}")
        if s >= 0 and e > s:
            text = text[s:e + 1]
    return json.loads(text)


# ─── ГЕНЕРАЦИЯ ВОПРОСОВ ─────────────────────────────────────────────────────

LETTERS = ["А", "Б", "В", "Г", "Д"]


def generate_questions(work_type: str, subject: str, class_num: int, topic: str, description: str,
                       part1_count: int, part2_count: int) -> dict:
    """Запрашивает у GigaChat вопросы. Возвращает dict с part1, part2."""
    system = (
        "Ты учитель-методист, составляющий проверочные работы по школьной программе РФ. "
        "Создавай корректные с точки зрения предмета вопросы, соответствующие уровню класса. "
        "Возвращай СТРОГО JSON без markdown-обёртки."
    )

    parts_desc = []
    if part1_count > 0:
        parts_desc.append(
            f'"part1": [{{"question":"Текст вопроса","options":["вариант А","вариант Б","вариант В","вариант Г"],"answer":"А"}}] '
            f'— РОВНО {part1_count} элементов, по 4 варианта ответа в каждом. answer — буква (А/Б/В/Г).'
        )
    if part2_count > 0:
        parts_desc.append(
            f'"part2": [{{"question":"Текст открытого вопроса","answer":"Краткий правильный ответ или решение"}}] '
            f'— РОВНО {part2_count} элементов с открытым ответом (без вариантов).'
        )

    user = (
        f"Тип работы: {work_type}\n"
        f"Предмет: {subject}\n"
        f"Класс: {class_num}\n"
        f"Тема: {topic}\n"
        f"Описание/контекст: {description or '—'}\n\n"
        "Составь работу. Верни ТОЛЬКО JSON:\n"
        "{\n  " + ",\n  ".join(parts_desc) + "\n}\n"
        "Вопросы должны быть разнообразные, проверять понимание темы. "
        "Не повторяй вопросы. Используй понятный школьнику язык."
    )

    max_tok = min(140 * (part1_count + part2_count) + 400, 3200)
    raw = gigachat_chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tok,
        temperature=0.4,
    )
    try:
        data = extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Не удалось разобрать ответ ИИ: {e}. Ответ: {raw[:300]}")

    # Нормализация
    part1 = []
    for q in (data.get("part1") or [])[:part1_count]:
        text = (q.get("question") or "").strip()
        opts = q.get("options") or []
        ans = (q.get("answer") or "").strip().upper()[:1]
        if not text or len(opts) < 2 or ans not in LETTERS:
            continue
        # Нормализуем опции до 4 (если меньше — добиваем, если больше — обрезаем)
        opts = [str(o).strip() for o in opts][:4]
        while len(opts) < 4:
            opts.append("—")
        # Если ответ за пределами доступных опций
        if LETTERS.index(ans) >= len(opts):
            ans = "А"
        part1.append({"question": text, "options": opts, "answer": ans})

    part2 = []
    for q in (data.get("part2") or [])[:part2_count]:
        text = (q.get("question") or "").strip()
        ans = str(q.get("answer") or "").strip()
        if not text:
            continue
        part2.append({"question": text, "answer": ans})

    if not part1 and not part2:
        raise RuntimeError("ИИ не вернул ни одного валидного вопроса")

    return {"part1": part1, "part2": part2}


# ─── DOCX BUILDER ──────────────────────────────────────────────────────────

def _set_cell_bg(cell, color_hex: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color_hex)
    tc_pr.append(shd)


def build_docx(work_type: str, subject: str, class_num: int, topic: str,
               part1: list, part2: list, work_id: str,
               teacher_name: str, teacher_school: str,
               grade_scale: dict, max_score: int) -> bytes:
    doc = Document()

    # Стили базовые
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)

    # Поля страницы
    for section in doc.sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2.0)
        section.right_margin = Cm(1.5)

    # ── Шапка ──
    header = doc.add_paragraph()
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = header.add_run(teacher_school or "Учебное заведение")
    run.bold = True
    run.font.size = Pt(11)

    # ── Заголовок работы ──
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(6)
    title.paragraph_format.space_after = Pt(2)
    r1 = title.add_run(f"{work_type.upper()}")
    r1.bold = True
    r1.font.size = Pt(16)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.paragraph_format.space_after = Pt(2)
    r2 = sub.add_run(f"по предмету «{subject}» · {class_num} класс")
    r2.font.size = Pt(13)

    topic_p = doc.add_paragraph()
    topic_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    topic_p.paragraph_format.space_after = Pt(10)
    r3 = topic_p.add_run(f"Тема: {topic}")
    r3.italic = True
    r3.font.size = Pt(12)

    # Метаданные таблицей: № работы, дата, ФИО ученика
    meta = doc.add_table(rows=2, cols=4)
    meta.style = "Light Grid Accent 1"
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_cells = meta.rows[0].cells
    meta_cells[0].text = "№ работы"
    meta_cells[1].text = "Дата"
    meta_cells[2].text = "Класс"
    meta_cells[3].text = "ФИО ученика"
    val_cells = meta.rows[1].cells
    val_cells[0].text = work_id
    val_cells[1].text = "____.____.________"
    val_cells[2].text = f"{class_num} _____"
    val_cells[3].text = "____________________________"
    for cell in meta_cells:
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(10)
        _set_cell_bg(cell, "E8EEF5")
    for cell in val_cells:
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.font.size = Pt(11)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # ── Инструкция ──
    instr = doc.add_paragraph()
    instr.paragraph_format.space_after = Pt(8)
    r = instr.add_run("Инструкция: ")
    r.bold = True
    parts_text = []
    if part1:
        parts_text.append(f"в части 1 ({len(part1)} зад.) выберите один правильный вариант ответа")
    if part2:
        parts_text.append(f"в части 2 ({len(part2)} зад.) дайте развёрнутый ответ")
    instr.add_run(". ".join(parts_text) + ". Время выполнения определяет учитель.")

    # ── Часть 1 ──
    if part1:
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(6)
        h.paragraph_format.space_after = Pt(4)
        rh = h.add_run(f"Часть 1. Тестовые задания с выбором ответа")
        rh.bold = True
        rh.font.size = Pt(13)

        for i, q in enumerate(part1, start=1):
            qp = doc.add_paragraph()
            qp.paragraph_format.space_before = Pt(4)
            qp.paragraph_format.space_after = Pt(2)
            qp.paragraph_format.left_indent = Cm(0)
            r = qp.add_run(f"{i}. ")
            r.bold = True
            qp.add_run(q["question"])

            for letter, opt in zip(LETTERS, q["options"]):
                op = doc.add_paragraph()
                op.paragraph_format.left_indent = Cm(0.8)
                op.paragraph_format.space_after = Pt(0)
                r1 = op.add_run(f"{letter})  ")
                r1.bold = True
                op.add_run(opt)

    # ── Часть 2 ──
    if part2:
        if part1:
            doc.add_paragraph().paragraph_format.space_after = Pt(4)
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(6)
        h.paragraph_format.space_after = Pt(4)
        rh = h.add_run(f"Часть 2. Задания с развёрнутым ответом")
        rh.bold = True
        rh.font.size = Pt(13)

        start = len(part1) + 1
        for i, q in enumerate(part2, start=0):
            qp = doc.add_paragraph()
            qp.paragraph_format.space_before = Pt(4)
            qp.paragraph_format.space_after = Pt(2)
            r = qp.add_run(f"{start + i}. ")
            r.bold = True
            qp.add_run(q["question"])
            # Линии для ответа
            for _ in range(3):
                lp = doc.add_paragraph("_" * 95)
                lp.paragraph_format.space_after = Pt(0)

    # ── Разрыв страницы перед ответами ──
    doc.add_page_break()

    # ── Ключи ответов ──
    key_h = doc.add_paragraph()
    key_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    key_h.paragraph_format.space_after = Pt(8)
    rk = key_h.add_run("ОТВЕТЫ (для учителя)")
    rk.bold = True
    rk.font.size = Pt(15)

    info = doc.add_paragraph()
    info.alignment = WD_ALIGN_PARAGRAPH.CENTER
    info.paragraph_format.space_after = Pt(10)
    info.add_run(f"{work_type} · {subject} · {class_num} класс · Тема: {topic} · № работы: {work_id}").italic = True

    if part1:
        h = doc.add_paragraph()
        h.paragraph_format.space_after = Pt(4)
        rh = h.add_run("Часть 1 (ответы)")
        rh.bold = True
        rh.font.size = Pt(13)

        # Таблица ответов части 1
        cols = min(10, len(part1))
        rows_needed = (len(part1) + cols - 1) // cols
        ans_table = doc.add_table(rows=rows_needed * 2, cols=cols)
        ans_table.style = "Light Grid Accent 1"
        for i in range(rows_needed):
            for j in range(cols):
                idx = i * cols + j
                if idx >= len(part1):
                    break
                num_cell = ans_table.cell(i * 2, j)
                ans_cell = ans_table.cell(i * 2 + 1, j)
                num_cell.text = str(idx + 1)
                ans_cell.text = part1[idx]["answer"]
                _set_cell_bg(num_cell, "E8EEF5")
                for p in num_cell.paragraphs:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in p.runs:
                        run.bold = True
                        run.font.size = Pt(10)
                for p in ans_cell.paragraphs:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in p.runs:
                        run.bold = True
                        run.font.size = Pt(11)
        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    if part2:
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(6)
        h.paragraph_format.space_after = Pt(4)
        rh = h.add_run("Часть 2 (примерные ответы)")
        rh.bold = True
        rh.font.size = Pt(13)

        start = len(part1) + 1
        for i, q in enumerate(part2):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            r = p.add_run(f"{start + i}. ")
            r.bold = True
            p.add_run(q["answer"] or "—")

    # ── Шкала оценок ──
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(10)
    h.paragraph_format.space_after = Pt(4)
    rh = h.add_run("Шкала оценивания")
    rh.bold = True
    rh.font.size = Pt(13)

    note = doc.add_paragraph()
    note.paragraph_format.space_after = Pt(4)
    note.add_run(f"Максимум баллов: ").bold = False
    r = note.add_run(str(max_score))
    r.bold = True
    note.add_run(" (по 1 баллу за каждый правильный ответ)")

    scale_table = doc.add_table(rows=2, cols=5)
    scale_table.style = "Light Grid Accent 1"
    headers = scale_table.rows[0].cells
    headers[0].text = "«2»"
    headers[1].text = "«3»"
    headers[2].text = "«4»"
    headers[3].text = "«5»"
    headers[4].text = "Макс."
    vals = scale_table.rows[1].cells
    vals[0].text = f"0–{grade_scale['grade2'] - 1}" if grade_scale['grade2'] > 0 else "0"
    vals[1].text = f"{grade_scale['grade3']}–{grade_scale['grade4'] - 1}"
    vals[2].text = f"{grade_scale['grade4']}–{grade_scale['grade5'] - 1}"
    vals[3].text = f"{grade_scale['grade5']}–{max_score}"
    vals[4].text = str(max_score)
    for cell in headers:
        _set_cell_bg(cell, "E8EEF5")
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(11)
    for cell in vals:
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.font.size = Pt(11)

    # ── Подпись учителя ──
    foot = doc.add_paragraph()
    foot.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    foot.paragraph_format.space_before = Pt(20)
    if teacher_name:
        rf = foot.add_run(f"Составитель: {teacher_name}")
        rf.italic = True
        rf.font.size = Pt(11)

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


# ─── ШКАЛА ОЦЕНОК ──────────────────────────────────────────────────────────

def compute_grade_scale(max_score: int) -> dict:
    """Стандартная школьная шкала: 50% — 3, 70% — 4, 90% — 5."""
    return {
        "grade1": 0,
        "grade2": max(1, round(max_score * 0.30)),
        "grade3": max(2, round(max_score * 0.50)),
        "grade4": max(3, round(max_score * 0.70)),
        "grade5": max(4, round(max_score * 0.90)),
    }


def safe_filename(s: str, max_len: int = 60) -> str:
    s = re.sub(r"[\\/:*?\"<>|]+", " ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:max_len] or "Работа"


def generate_work_id() -> str:
    """6-значный номер работы (как в appStore)."""
    import random
    return str(random.randint(100000, 999999))


# ─── HANDLER ───────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Генерирует .docx-файл проверочной/контрольной работы или теста с помощью GigaChat."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    if method != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    body = {}
    raw = event.get("body") or ""
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

    work_type = (body.get("workType") or "Тест").strip()
    if work_type not in ("Тест", "Проверочная работа", "Контрольная работа"):
        work_type = "Тест"
    login = (body.get("login") or "").strip()
    subject = (body.get("subject") or "").strip()
    topic = (body.get("topic") or "").strip()
    description = (body.get("description") or "").strip()
    teacher_name = (body.get("teacherName") or "").strip()
    teacher_school = (body.get("teacherSchool") or "").strip()

    try:
        class_num = int(body.get("classNum") or 5)
    except (TypeError, ValueError):
        class_num = 5
    class_num = max(1, min(class_num, 11))

    try:
        part1_count = int(body.get("part1Count") or 0)
    except (TypeError, ValueError):
        part1_count = 0
    part1_count = max(0, min(part1_count, 30))

    try:
        part2_count = int(body.get("part2Count") or 0)
    except (TypeError, ValueError):
        part2_count = 0
    part2_count = max(0, min(part2_count, 10))

    if not subject:
        return _resp(400, {"error": "Укажите предмет"})
    if not topic:
        return _resp(400, {"error": "Укажите тему"})
    if part1_count + part2_count == 0:
        return _resp(400, {"error": "Должен быть хотя бы один вопрос (часть 1 или часть 2)"})

    # Проверяем лимит AI-запросов для trial-пользователей
    if login:
        try:
            limit_req = urllib.request.Request(
                f"{AUTH_URL}?action=check-ai-limit",
                data=json.dumps({"login": login}).encode("utf-8"),
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(limit_req, timeout=10) as r:
                limit_data = json.loads(r.read().decode())
            if not limit_data.get("allowed"):
                return _resp(429, {"error": limit_data.get("error", "Достигнут лимит ИИ-запросов")})
        except urllib.error.HTTPError as e:
            err_body = json.loads(e.read().decode() or "{}")
            if e.code == 429:
                return _resp(429, {"error": err_body.get("error", "Достигнут лимит ИИ-запросов на сегодня")})
        except Exception:
            pass

    try:
        questions = generate_questions(work_type, subject, class_num, topic, description, part1_count, part2_count)
    except Exception as e:
        msg = str(e)
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return _resp(504, {"error": "Сервис GigaChat сейчас перегружен. Подождите минуту и попробуйте снова."})
        return _resp(500, {"error": f"Ошибка генерации вопросов: {msg}"})

    part1 = questions["part1"]
    part2 = questions["part2"]
    actual_p1 = len(part1)
    actual_p2 = len(part2)
    total = actual_p1 + actual_p2
    max_score = total
    grade_scale = compute_grade_scale(max_score)

    work_id = generate_work_id()

    try:
        docx_bytes = build_docx(
            work_type=work_type,
            subject=subject,
            class_num=class_num,
            topic=topic,
            part1=part1,
            part2=part2,
            work_id=work_id,
            teacher_name=teacher_name,
            teacher_school=teacher_school,
            grade_scale=grade_scale,
            max_score=max_score,
        )
    except Exception as e:
        return _resp(500, {"error": f"Ошибка сборки .docx: {e}"})

    # Ключ ответов части 1 в формате "АБВГ..." (для appStore.work.answerKey)
    answer_key = "".join(q["answer"] for q in part1)

    filename = f"{safe_filename(work_type)} · {safe_filename(subject)} · {class_num} класс · {safe_filename(topic, 40)}.docx"

    return _resp(200, {
        "docx_b64": base64.b64encode(docx_bytes).decode(),
        "filename": filename,
        "size": len(docx_bytes),
        "workId": work_id,
        "workType": work_type,
        "subject": subject,
        "classNum": class_num,
        "topic": topic,
        "part1Count": actual_p1,
        "part2Count": actual_p2,
        "totalQuestions": total,
        "answerKey": answer_key,
        "maxScore": max_score,
        "gradeScale": grade_scale,
        "questions": {
            "part1": part1,
            "part2": part2,
        },
    })