"""
Экзамены ФИПИ: генерация полного варианта ОГЭ или ЕГЭ из встроенного банка заданий.
Без ИИ. Мгновенно. Каждое задание выбирается случайно из готовой коллекции
заданий по соответствующему номеру в структуре ФИПИ.

POST / body:
{
  "examType": "ОГЭ" | "ЕГЭ",
  "subject": str,
  "teacherName": str,
  "teacherSchool": str,
  "variantNum": int (optional)
}
Возвращает: { docx_b64, answers_docx_b64, filename, answers_filename, ... }

GET ?action=subjects&examType=ОГЭ|ЕГЭ -> список предметов
"""
import json
import io
import re
import base64
import random

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from bank import EXAM_BANK

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


# ─── DOCX HELPERS ────────────────────────────────────────────────────────────

def set_font(run, name="Times New Roman", size=12, bold=False, italic=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = color
    r = run._r
    rPr = r.get_or_add_rPr()
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), name)
    rFonts.set(qn("w:hAnsi"), name)
    rPr.insert(0, rFonts)


def add_para(doc, text, size=12, bold=False, italic=False, align=None, color=None, indent_cm=0):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    if indent_cm:
        p.paragraph_format.left_indent = Cm(indent_cm)
    run = p.add_run(text)
    set_font(run, size=size, bold=bold, italic=italic, color=color)
    return p


# ─── ВЫБОР ЗАДАНИЙ ──────────────────────────────────────────────────────────

def build_variant_tasks(exam_type: str, subject: str) -> list:
    """Берёт банк по предмету, для каждого слота выбирает случайное задание."""
    info = EXAM_BANK.get(exam_type, {}).get(subject)
    if not info:
        return []
    tasks = []
    for slot in info["structure"]:
        num = slot["num"]
        bank = info["tasks"].get(num, [])
        if not bank:
            # fallback-плейсхолдер чтобы не пропускать слот
            picked = {
                "question": f"[Задание по теме «{slot['topic']}». Решите согласно инструкции.]",
                "options": [],
                "answer": "—",
                "explanation": f"Тема: {slot['topic']}",
            }
        else:
            picked = random.choice(bank)
        tasks.append({
            "num": num,
            "type": slot["type"],
            "topic": slot["topic"],
            "points": slot["points"],
            "instruction": slot["instruction"],
            "question": picked.get("question", ""),
            "options": picked.get("options", []),
            "answer": str(picked.get("answer", "")),
            "explanation": picked.get("explanation", ""),
        })
    return tasks


# ─── DOCX: ВАРИАНТ ──────────────────────────────────────────────────────────

def build_variant_docx(exam_type: str, subject: str, tasks: list,
                       teacher_name: str, teacher_school: str,
                       variant_num: int) -> bytes:
    doc = Document()
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(1.5)

    if teacher_school:
        add_para(doc, teacher_school, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, f"Вариант № {variant_num}", size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph()
    add_para(doc, exam_type, size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, subject.upper(), size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph()
    add_para(doc, f"Учитель: {teacher_name}    Дата: ____________    Класс: ____________",
             size=11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph()

    add_para(doc, "Инструкция по выполнению работы", size=12, bold=True)
    instr = (
        "На выполнение экзаменационной работы отводится время в соответствии с регламентом "
        f"{exam_type}. Работа состоит из нескольких частей. К каждому заданию с кратким ответом "
        "запишите ответ в отведённое поле. К заданиям с развёрнутым ответом запишите полное "
        "решение. Желаем успеха!"
    )
    add_para(doc, instr, size=11, italic=True)
    doc.add_paragraph()

    current_part = None
    for task in tasks:
        t_type = task["type"]
        if t_type in ("choice", "multi") and current_part != "A":
            current_part = "A"
            doc.add_paragraph()
            add_para(doc, "Часть 1", size=13, bold=True, color=RGBColor(0x1A, 0x56, 0x9C))
            add_para(doc, "Задания с выбором ответа.", size=11, italic=True)
        elif t_type == "short" and current_part != "B":
            current_part = "B"
            doc.add_paragraph()
            add_para(doc, "Часть 2", size=13, bold=True, color=RGBColor(0x1A, 0x56, 0x9C))
            add_para(doc, "Задания с кратким ответом.", size=11, italic=True)
        elif t_type in ("long", "essay") and current_part != "C":
            current_part = "C"
            doc.add_paragraph()
            add_para(doc, "Часть 3", size=13, bold=True, color=RGBColor(0x1A, 0x56, 0x9C))
            add_para(doc, "Задания с развёрнутым ответом.", size=11, italic=True)

        doc.add_paragraph()
        # № задания + тема + балл
        p_num = doc.add_paragraph()
        run_num = p_num.add_run(f"Задание {task['num']}. ")
        set_font(run_num, size=12, bold=True)
        run_topic = p_num.add_run(f"{task['topic']}  ")
        set_font(run_topic, size=11, italic=True, color=RGBColor(0x44, 0x44, 0x44))
        run_pts = p_num.add_run(f"[{task['points']} б.]")
        set_font(run_pts, size=11, italic=True, color=RGBColor(0x88, 0x88, 0x88))

        add_para(doc, task["instruction"], size=11, italic=True)
        if task.get("question"):
            add_para(doc, task["question"], size=12)

        if task.get("options"):
            for opt in task["options"]:
                add_para(doc, str(opt), size=12, indent_cm=1)

        if t_type in ("choice", "multi", "short"):
            add_para(doc, "Ответ: ______________________________________",
                     size=11, italic=True, color=RGBColor(0x80, 0x80, 0x80))
        elif t_type in ("long", "essay"):
            add_para(doc, "Запишите решение и ответ:", size=11, italic=True)
            for _ in range(6):
                add_para(doc, "_" * 90, size=10, color=RGBColor(0xCC, 0xCC, 0xCC))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ─── DOCX: ОТВЕТЫ ───────────────────────────────────────────────────────────

def build_answers_docx(exam_type: str, subject: str, tasks: list,
                       teacher_name: str, variant_num: int) -> bytes:
    doc = Document()
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(1.5)

    add_para(doc, f"ОТВЕТЫ К ВАРИАНТУ {variant_num}",
             size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, f"{exam_type}  ·  {subject}",
             size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, f"Составил: {teacher_name}",
             size=11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph()

    add_para(doc, "ОТВЕТЫ И КРИТЕРИИ ОЦЕНИВАНИЯ", size=12, bold=True)
    doc.add_paragraph()

    for task in tasks:
        add_para(doc, f"Задание {task['num']}. {task['topic']}  [{task['points']} б.]",
                 size=12, bold=True)
        if task.get("answer"):
            add_para(doc, f"Ответ: {task['answer']}", size=12, color=RGBColor(0x0A, 0x66, 0x0A))
        if task.get("explanation"):
            add_para(doc, f"Пояснение: {task['explanation']}",
                     size=11, italic=True, color=RGBColor(0x44, 0x44, 0x44))
        doc.add_paragraph()

    total_points = sum(t["points"] for t in tasks)
    doc.add_paragraph()
    add_para(doc, "ШКАЛА ПЕРЕВОДА БАЛЛОВ", size=12, bold=True)
    add_para(doc, f"Максимальный балл: {total_points}", size=12)
    add_para(doc, f"«5» — {int(total_points * 0.85)}–{total_points} баллов", size=12)
    add_para(doc, f"«4» — {int(total_points * 0.70)}–{int(total_points * 0.84)} баллов", size=12)
    add_para(doc, f"«3» — {int(total_points * 0.50)}–{int(total_points * 0.69)} баллов", size=12)
    add_para(doc, f"«2» — 0–{int(total_points * 0.49)} баллов", size=12)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ─── HANDLER ────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """
    Генерация полного варианта ОГЭ/ЕГЭ из банка заданий ФИПИ — без ИИ.

    GET ?action=subjects&examType=ОГЭ|ЕГЭ -> список предметов.
    POST { examType, subject, teacherName, teacherSchool, variantNum? } -> docx_b64, answers_docx_b64.
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": ""}

    if event.get("httpMethod") == "GET":
        qs = event.get("queryStringParameters") or {}
        action = qs.get("action", "")
        if action == "subjects":
            exam_type = qs.get("examType", "ОГЭ")
            subjects = sorted(EXAM_BANK.get(exam_type, {}).keys())
            return _resp(200, {"subjects": subjects})
        return _resp(200, {
            "oge_subjects": sorted(EXAM_BANK.get("ОГЭ", {}).keys()),
            "ege_subjects": sorted(EXAM_BANK.get("ЕГЭ", {}).keys()),
        })

    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Метод не поддерживается"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Некорректный JSON"})

    exam_type = (body.get("examType") or "").strip()
    subject = (body.get("subject") or "").strip()
    teacher_name = (body.get("teacherName") or "Учитель").strip()
    teacher_school = (body.get("teacherSchool") or "").strip()
    variant_num = body.get("variantNum")
    try:
        variant_num = int(variant_num) if variant_num else random.randint(1, 99)
    except Exception:
        variant_num = random.randint(1, 99)

    if exam_type not in ("ОГЭ", "ЕГЭ"):
        return _resp(400, {"error": "Укажите тип экзамена: ОГЭ или ЕГЭ"})
    if not subject:
        return _resp(400, {"error": "Укажите предмет"})

    info = EXAM_BANK.get(exam_type, {}).get(subject)
    if not info:
        available = sorted(EXAM_BANK.get(exam_type, {}).keys())
        return _resp(400, {
            "error": f"Предмет «{subject}» недоступен для {exam_type}. Доступны: {', '.join(available)}"
        })

    tasks = build_variant_tasks(exam_type, subject)
    if not tasks:
        return _resp(500, {"error": "В банке нет заданий по этому предмету"})

    variant_bytes = build_variant_docx(exam_type, subject, tasks,
                                       teacher_name, teacher_school, variant_num)
    answers_bytes = build_answers_docx(exam_type, subject, tasks,
                                       teacher_name, variant_num)

    safe_subject = re.sub(r"[^\w\-]", "_", subject)
    filename = f"{exam_type}_{safe_subject}_вариант_{variant_num:02d}.docx"
    answers_filename = f"{exam_type}_{safe_subject}_ответы_{variant_num:02d}.docx"
    total_points = sum(t["points"] for t in tasks)

    return _resp(200, {
        "docx_b64": base64.b64encode(variant_bytes).decode(),
        "answers_docx_b64": base64.b64encode(answers_bytes).decode(),
        "filename": filename,
        "answers_filename": answers_filename,
        "examType": exam_type,
        "subject": subject,
        "variantNum": variant_num,
        "totalTasks": len(tasks),
        "totalPoints": total_points,
        "size": len(variant_bytes),
    })
