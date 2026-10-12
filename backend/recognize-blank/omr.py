"""
Чтение бланка «САОУ» по фотографии: поиск четырёх угловых меток, выравнивание
перспективы и измерение закраски каждого кружка. Нейросети и платные сервисы
не используются — только арифметика над пикселями, поэтому результат
предсказуем и бесплатен.

Шаги:
  1. найти на фото чёрные квадраты (метки) и выбрать четвёрку, которая
     по пропорциям совпадает с бланком (большая метка — левый верхний угол,
     поэтому фото можно держать вверх ногами или боком);
  2. по четырём меткам вычислить преобразование «миллиметры бланка → пиксели фото»;
  3. вокруг каждого кружка снять небольшой участок, уточнить центр по кольцу и
     посчитать долю тёмной краски внутри кружка;
  4. по закраске определить ответ в каждой строке и цифры кода.
"""
import base64
import io
import itertools
import math

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

import geometry as G


class OmrError(Exception):
    """Ошибка, которую можно показать пользователю как есть."""
    status = 422


class BadImageError(OmrError):
    """Файл не является читаемой картинкой."""
    status = 400


FILL_MIN = 0.14
FILL_OK = 0.25
REL_MARK = 0.5
MAX_B64 = 22_000_000


def load_gray(image_b64: str, max_side: int = 2400) -> np.ndarray:
    if not image_b64 or len(image_b64) > MAX_B64:
        raise BadImageError("Файл не загрузился или слишком большой. Загрузите фото бланка (JPG или PNG).")
    if image_b64.startswith("data:") and "," in image_b64[:120]:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_b64)
        im = Image.open(io.BytesIO(raw))
        im.load()
        im = ImageOps.exif_transpose(im).convert("L")
    except Exception:
        raise BadImageError("Не удалось прочитать изображение. Загрузите фото бланка (JPG или PNG).")
    w, h = im.size
    k = max(w, h) / max_side
    if k > 1:
        im = im.resize((max(1, round(w / k)), max(1, round(h / k))), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32)


def find_squares(g: np.ndarray) -> list:
    """Тёмные сплошные квадраты: [(x, y, сторона_px)]."""
    h, w = g.shape
    s0 = min(h, w)
    win = max(31, int(s0 * 0.12)) | 1
    bg = ndi.uniform_filter(g, size=win, mode="nearest")
    mask = g < bg * 0.55
    mask = ndi.binary_opening(mask, structure=np.ones((3, 3), bool))
    lab, n = ndi.label(mask, structure=np.ones((3, 3), int))
    if n == 0:
        return []
    lo, hi = 0.012 * s0, 0.20 * s0
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None:
            continue
        bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if not (lo <= bw <= hi and lo <= bh <= hi):
            continue
        if not 0.6 <= bw / bh <= 1.67:
            continue
        ys, xs = np.nonzero(lab[sl] == i)
        area = len(ys)
        if area < 0.45 * bw * bh:
            continue
        if area < 30:
            continue
        pts = np.stack([xs - xs.mean(), ys - ys.mean()], 1).astype(np.float64)
        cov = pts.T @ pts / area
        det = np.linalg.det(cov)
        if det < 1e-6:
            continue
        r2w = np.einsum("ij,jk,ik->i", pts, np.linalg.inv(cov), pts)
        if float(r2w.max()) >= 5.0:
            out.append((xs.mean() + sl[1].start, ys.mean() + sl[0].start, math.sqrt(area)))
    return out[:80]


def _d(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def match_quads(cands: list, w_mm: float, h_mm: float) -> list:
    """Четвёрки меток, похожие на бланк. [(ошибка, tl, tr, bl, br)] по возрастанию ошибки.

    Для каждой тройки перебираются все способы назвать её «правый верх / левый низ /
    правый низ» и берётся тот, у которого пропорции расстояний между метками лучше
    всего совпадают с настоящим бланком. Это работает и для узких высоких бланков.
    """
    e = G.marker_centers(w_mm, h_mm)
    names = ("tl", "tr", "bl", "br")
    pairs = [("tl", "tr"), ("tl", "bl"), ("tr", "br"), ("bl", "br"), ("tr", "bl")]
    ref_diag = _d(e["tl"], e["br"])
    ref = {pr: _d(e[pr[0]], e[pr[1]]) / ref_diag for pr in pairs}
    found = []
    for i, c0 in enumerate(cands):
        others = [c for j, c in enumerate(cands)
                  if j != i and 1.04 <= c0[2] / c[2] <= 2.6]
        best = None
        for trio in itertools.combinations(others, 3):
            sizes = [t[2] for t in trio]
            if max(sizes) / min(sizes) > 1.5:
                continue
            for perm in itertools.permutations(trio):
                tr, bl, br = perm
                cross = (tr[0] - c0[0]) * (bl[1] - c0[1]) - (tr[1] - c0[1]) * (bl[0] - c0[0])
                if cross <= 0:
                    continue
                ring = [c0, tr, br, bl]
                signs = []
                for k in range(4):
                    a_, b_, c_ = ring[k], ring[(k + 1) % 4], ring[(k + 2) % 4]
                    signs.append((b_[0] - a_[0]) * (c_[1] - b_[1]) - (b_[1] - a_[1]) * (c_[0] - b_[0]) > 0)
                if not all(signs):
                    continue
                pts = dict(zip(names, (c0, tr, bl, br)))
                dd = _d(c0, br)
                if dd < 1:
                    continue
                err = 0.0
                for pr in pairs:
                    r = _d(pts[pr[0]], pts[pr[1]]) / dd
                    err = max(err, abs(r - ref[pr]) / ref[pr])
                if err > 0.35:
                    continue
                if best is None or err < best[0]:
                    best = (err, c0, tr, bl, br)
        if best:
            found.append(best)
    found.sort(key=lambda x: x[0])
    return found


def homography(src: list, dst: list) -> np.ndarray:
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(a, dtype=np.float64))
    m = vt[-1].reshape(3, 3)
    return m / m[2, 2]


def sample_patches(g, hm, centers, half, step=0.2):
    k = int(round(2 * half / step)) + 1
    offs = (np.arange(k) - (k - 1) / 2) * step
    gx, gy = np.meshgrid(offs, offs)
    c = np.asarray(centers, dtype=np.float64)
    x = c[:, 0, None, None] + gx[None]
    y = c[:, 1, None, None] + gy[None]
    pts = np.stack([x.ravel(), y.ravel(), np.ones(x.size)], 0)
    q = hm @ pts
    u, v = q[0] / q[2], q[1] / q[2]
    vals = ndi.map_coordinates(g, [v, u], order=1, mode="nearest")
    return vals.reshape(len(c), k, k), gx, gy


def fill_scores(patches, gx, gy, radius, half, max_shift=1.1):
    """Доля тёмной краски в центре кружка (0 — пусто, ~0.7–0.9 — закрашено)."""
    flat = patches.reshape(len(patches), -1)
    paper = np.maximum(np.percentile(flat, 90, axis=1), 30.0)[:, None, None]
    d = np.clip(1.0 - patches / paper, 0.0, 1.0)
    win = (np.hypot(gx, gy) <= half)[None]
    w = d * win
    mass = w.sum((1, 2))
    safe = np.maximum(mass, 1e-6)
    cx = (w * gx[None]).sum((1, 2)) / safe
    cy = (w * gy[None]).sum((1, 2)) / safe
    ok = mass > 10
    cx = np.where(ok, np.clip(cx, -max_shift, max_shift), 0.0)
    cy = np.where(ok, np.clip(cy, -max_shift, max_shift), 0.0)
    rr = np.hypot(gx[None] - cx[:, None, None], gy[None] - cy[:, None, None])
    inner = rr <= radius * 0.62
    fill = (d * inner).sum((1, 2)) / np.maximum(inner.sum((1, 2)), 1)
    return fill, mass


def _join(nums):
    return ", ".join(str(n) for n in nums)


def read_blank(image_b64: str, n_q: int, n_opts: int) -> dict:
    g = load_gray(image_b64)
    per, cs, rs = G.choose_layout(n_q, n_opts)
    w_mm, h_mm = G.slot_size(cs, rs)

    cands = find_squares(g)
    if len(cands) < 4:
        raise OmrError(
            "Не нашли чёрные квадраты по углам бланка. Сфотографируйте бланк целиком "
            "так, чтобы все четыре квадрата были видны, при ровном свете и без бликов."
        )
    quads = match_quads(cands, w_mm, h_mm)
    if not quads:
        raise OmrError(
            "Фото не похоже на бланк с такими настройками. Проверьте, что количество вопросов и "
            "вариантов ответа в работе совпадает с напечатанным бланком, и снимите бланк целиком."
        )
    best = quads[0]
    ids = {id(c) for c in best[1:]}
    for other in quads[1:]:
        if other[0] < 0.08 and not ids & {id(c) for c in other[1:]}:
            raise OmrError(
                "На фото больше одного бланка. Отрежьте бланки по пунктирным линиям и "
                "сфотографируйте каждый отдельно."
            )

    _, tl, tr, bl, br = best
    e = G.marker_centers(w_mm, h_mm)
    hm = homography([e["tl"], e["tr"], e["bl"], e["br"]],
                    [(m[0], m[1]) for m in (tl, tr, bl, br)])

    half_a = 3.2
    bub = G.answer_bubbles(w_mm, h_mm, n_q, n_opts)
    pa, gx, gy = sample_patches(g, hm, [(b[2], b[3]) for b in bub], half_a)
    fa, mass_a = fill_scores(pa, gx, gy, G.BUB_R, half_a)
    if float((mass_a > 12).mean()) < 0.5:
        raise OmrError(
            "Не удалось совместить фото с бланком: кружки не найдены. Снимите бланк ровнее, "
            "целиком и чётче, либо проверьте, что бланк напечатан без масштабирования."
        )
    fills = fa.reshape(n_q, n_opts)

    half_c = 2.2
    cb = G.code_bubbles()
    pc, cgx, cgy = sample_patches(g, hm, [(b[2], b[3]) for b in cb], half_c)
    fc, _ = fill_scores(pc, cgx, cgy, G.CODE_R, half_c, max_shift=0.6)
    code_f = fc.reshape(G.CODE_LEN, G.CODE_DIGITS)

    opts = G.OPT_LABELS[:n_opts]
    answers, confs = [], []
    empty, multi, weak = [], [], []
    for q in range(n_q):
        row = fills[q]
        mx = float(row.max())
        if mx < FILL_MIN:
            answers.append("")
            confs.append(0.0)
            empty.append(q + 1)
            continue
        marked = [j for j in range(n_opts) if row[j] >= max(FILL_MIN, REL_MARK * mx)]
        if len(marked) > 1:
            answers.append("*")
            confs.append(0.0)
            multi.append(q + 1)
            continue
        answers.append(opts[marked[0]])
        confs.append(round(min(1.0, mx / 0.6), 2))
        if mx < FILL_OK:
            weak.append(q + 1)

    digits, bad_pos = [], []
    for p in range(G.CODE_LEN):
        row = code_f[p]
        order = np.argsort(row)[::-1]
        top, second = float(row[order[0]]), float(row[order[1]])
        if top < FILL_MIN or second >= REL_MARK * top:
            digits.append("?")
            bad_pos.append(p + 1)
        else:
            digits.append(str(int(order[0])))

    warnings = []
    if bad_pos:
        warnings.append(f"Код ученика: не удалось прочитать цифру в строках {_join(bad_pos)}. "
                        "В каждой строке должен быть закрашен ровно один кружок.")
    if multi:
        warnings.append(f"Вопросы {_join(multi)}: закрашено больше одного кружка, ответ не засчитан.")
    if weak:
        warnings.append(f"Вопросы {_join(weak)}: кружок закрашен слабо, проверьте ответ.")
    if empty:
        warnings.append(f"Вопросы {_join(empty)}: ответ не отмечен.")

    return {
        "code": "".join(digits),
        "answers": answers,
        "confidences": confs,
        "warnings": warnings,
        "layout": {"perSheet": per, "slotMm": [round(w_mm, 1), round(h_mm, 1)]},
    }
