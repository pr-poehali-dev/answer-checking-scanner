"""
Эталонная сетка бланка ответов — ВОСПРОИЗВОДИТ геометрию backend/generate-blank.
Возвращает относительные координаты центров всех клеток в системе координат
4 якорей зоны ответов. Это позволяет калибровать сетку по реперам на фото
для ЛЮБОГО формата бланка (АБВГ / АБВГД, 12 / 20 вопросов и т.д.).

Система координат шаблона:
  - 4 якоря зоны ответов: TL, TR, BL, BR
  - U = доля по горизонтали: 0.0 = левый якорь, 1.0 = правый якорь
  - V = доля по вертикали:   0.0 = верхний якорь, 1.0 = нижний якорь
Любая клетка задаётся парой (u, v), не зависящей от масштаба/DPI/размера фото.
"""
import math

MM = 1.0  # работаем в мм, scale сокращается в относительных координатах


def _geometry(n_q: int, n_opts: int):
    """
    Повторяет вычисления draw_blank() из generate-blank в относительных единицах.
    Берём бланк per_page=1: x0=0, y0=0, bw, bh — в мм (A4 ≈ 198x285 рабочая зона).
    Точные абсолютные значения не важны — важны ПРОПОРЦИИ между якорями и клетками.
    """
    # A4 рабочая зона при per_page=1 (M=6mm поля)
    bw = 210 - 2 * 6   # 198 мм
    bh = 297 - 2 * 6   # 285 мм
    x0 = 0.0
    sc = 1.0

    def S(v):
        return v * sc

    P = S(4 * MM)

    # Шапка + поля + инструкция (как в генераторе) — нужно для grid_top_y
    HDR = S(6.5 * MM)
    META = S(10.5 * MM)
    INST = S(5.5 * MM)
    HDR_G = S(4.5 * MM)

    cur_y = bh
    cur_y -= HDR
    cur_y -= META
    # HL линия
    cur_y -= INST
    cur_y -= S(0.5 * MM)

    # Сетка вопросов
    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    n_rows = math.ceil(n_q / n_cols)
    col_w = (bw - 2 * P) / n_cols
    num_w = S(7.5 * MM)
    cell_w = min((col_w - num_w) / n_opts, S(8.5 * MM))
    sq = min(cell_w * 0.78, S(5.5 * MM))
    row_h = sq + S(2.0 * MM)
    anc = S(4.5 * MM)

    cur_y -= HDR_G
    cur_y -= S(0.2 * MM)

    grid_top_y = cur_y
    grid_bottom_y = cur_y - n_rows * row_h

    # 4 якоря зоны ответов
    ax_l = x0 + P / 2
    ax_r = x0 + bw - P / 2
    ay_t = grid_top_y + anc / 2 + S(1 * MM)
    ay_b = grid_bottom_y - anc / 2 - S(1 * MM)

    # Центры клеток ответов: (q_idx -> (cx, cy))
    cells = []  # список (q_idx, oi, cx, cy)
    for qi in range(n_q):
        ci = qi // n_rows
        ri = qi % n_rows
        rx = x0 + P + ci * col_w
        ry = grid_top_y - ri * row_h - row_h / 2
        for oi in range(n_opts):
            ox = rx + num_w + oi * cell_w + cell_w / 2
            cells.append((qi, oi, ox, ry))

    return {
        "ax_l": ax_l, "ax_r": ax_r, "ay_t": ay_t, "ay_b": ay_b,
        "cells": cells, "sq": sq, "n_cols": n_cols, "n_rows": n_rows,
        "cell_w": cell_w,
    }


def build_answer_template(n_q: int, n_opts: int):
    """
    Возвращает:
      - rel_cells: список (q_idx, oi, u, v) — относительные координаты клеток
      - rel_sq:    относительный размер квадрата (доля от ширины якорей)
    """
    g = _geometry(n_q, n_opts)
    AW = g["ax_r"] - g["ax_l"]
    AH = g["ay_t"] - g["ay_b"]
    rel_cells = []
    for (qi, oi, cx, cy) in g["cells"]:
        u = (cx - g["ax_l"]) / AW
        v = (g["ay_t"] - cy) / AH
        rel_cells.append((qi, oi, u, v))
    rel_sq = g["sq"] / AW
    return rel_cells, rel_sq


# ── Шаблон зоны КОДА (5 строк × 10 кружков) ────────────────────────────────────
def _geometry_code(n_q: int, n_opts: int):
    bw = 210 - 2 * 6
    bh = 297 - 2 * 6
    x0 = 0.0
    sc = 1.0

    def S(v):
        return v * sc

    P = S(4 * MM)
    HDR = S(6.5 * MM)
    META = S(10.5 * MM)
    INST = S(5.5 * MM)
    HDR_G = S(4.5 * MM)

    n_cols = 1 if n_q <= 15 else (2 if n_q <= 40 else 3)
    n_rows = math.ceil(n_q / n_cols)
    col_w = (bw - 2 * P) / n_cols
    num_w = S(7.5 * MM)
    cell_w = min((col_w - num_w) / n_opts, S(8.5 * MM))
    sq = min(cell_w * 0.78, S(5.5 * MM))
    row_h = sq + S(2.0 * MM)

    cur_y = bh - HDR - META - INST - S(0.5 * MM) - HDR_G - S(0.2 * MM)
    grid_bottom_y = cur_y - n_rows * row_h
    cur_y = grid_bottom_y - S(0.5 * MM)
    # HL линия после сетки
    cur_y -= S(2 * MM)

    # Зона кода
    cr2 = S(1.5 * MM)
    gap_x = cr2 * 2 + S(0.5 * MM)
    gap_y = cr2 * 2 + S(0.8 * MM)
    nw2 = S(5 * MM)
    anc_c = S(3.5 * MM)

    code_top_y = cur_y - S(1 * MM)
    cur_y -= S(2.8 * MM)

    circles = []  # (row, digit, cx, cy)
    code_cur = cur_y
    for row in range(5):
        ry = code_cur - row * gap_y - cr2
        for col in range(10):
            cx = x0 + P + nw2 + col * gap_x + cr2
            circles.append((row, col, cx, ry))

    code_cur2 = cur_y - 5 * gap_y + S(1.5 * MM)  # приблизит. низ
    # Якоря кода (как в генераторе)
    code_bottom_y = cur_y - 5 * gap_y - S(1.5 * MM)
    code_ax_l = x0 + P / 2
    code_ax_r = x0 + bw - P / 2
    code_ay_t = code_top_y - anc_c / 2
    code_ay_b = code_bottom_y + anc_c / 2

    return {
        "ax_l": code_ax_l, "ax_r": code_ax_r,
        "ay_t": code_ay_t, "ay_b": code_ay_b,
        "circles": circles, "cr": cr2,
    }


def build_code_template(n_q: int, n_opts: int):
    """
    Относительные координаты кружков кода в системе 4 якорей зоны кода.
    Возвращает (rel_circles: [(row, digit, u, v)], rel_r).
    """
    g = _geometry_code(n_q, n_opts)
    AW = g["ax_r"] - g["ax_l"]
    AH = g["ay_t"] - g["ay_b"]
    rel = []
    for (row, digit, cx, cy) in g["circles"]:
        u = (cx - g["ax_l"]) / AW
        v = (g["ay_t"] - cy) / AH
        rel.append((row, digit, u, v))
    rel_r = g["cr"] / AW
    return rel, rel_r
