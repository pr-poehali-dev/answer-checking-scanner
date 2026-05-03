# -*- coding: utf-8 -*-
"""
Банк заданий ФИПИ для ОГЭ и ЕГЭ.
Структура: EXAM_BANK[examType][subject] = {
    "structure": [ {num, type, topic, points, instruction, options_count?} ],
    "tasks": { num: [ {question, options, answer, explanation}, ... ] }
}

Для каждого слота (номера задания) хранится массив готовых вариантов.
При генерации варианта мы выбираем случайный элемент из массива для каждого слота.

ИСТОЧНИК: открытые задания ФИПИ (fipi.ru) — формулировки приведены к учебной форме.
"""
from bank_oge import OGE_BANK
from bank_ege import EGE_BANK

EXAM_BANK = {
    "ОГЭ": OGE_BANK,
    "ЕГЭ": EGE_BANK,
}
