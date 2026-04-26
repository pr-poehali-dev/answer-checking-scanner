import { createWorker } from "tesseract.js";
import { AnalysisDetail, RecognitionResult } from "./upload-types";

export type OcrProgressCallback = (status: string, progress: number) => void;

// PSM константы напрямую (без импорта enum — надёжнее)
const PSM_SINGLE_CHAR = "10";
const PSM_SINGLE_LINE = "7";
const PSM_SINGLE_BLOCK = "6";

// ─── Замены похожих символов ──────────────────────────────────────────────────
const LATIN_TO_CYR: Record<string, string> = {
  "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н",
  "I": "И", "K": "К", "M": "М", "O": "О", "P": "Р",
  "T": "Т", "X": "Х", "Y": "У", "Z": "З",
  "a": "А", "b": "В", "c": "С", "e": "Е", "o": "О",
  "p": "Р", "x": "Х", "y": "У", "z": "З", "k": "К",
};

function normalizeChar(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  for (const ch of trimmed) {
    const up = ch.toUpperCase();
    if (/[А-ЯЁ]/.test(up)) return up;
    if (/[0-9]/.test(ch)) return ch;
    const mapped = LATIN_TO_CYR[ch];
    if (mapped) return mapped;
  }
  return "";
}

function cleanText(raw: string): string {
  let result = "";
  for (const ch of raw) {
    const up = ch.toUpperCase();
    if (/[А-ЯЁ]/.test(up)) { result += up; continue; }
    if (/[0-9]/.test(ch)) { result += ch; continue; }
    const mapped = LATIN_TO_CYR[ch];
    if (mapped) result += mapped;
  }
  return result;
}

// ─── Подготовка изображения ───────────────────────────────────────────────────

async function fileToCanvas(file: File, scale = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Бинаризация — повышаем контраст
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = gray < 150 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось загрузить изображение"));
    };
    img.src = url;
  });
}

function cropToCanvas(
  src: HTMLCanvasElement,
  x: number, y: number,
  w: number, h: number,
  padding = 4
): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = Math.max(w + padding * 2, 32);
  dst.height = Math.max(h + padding * 2, 32);
  const ctx = dst.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, x, y, w, h, padding, padding, w, h);
  return dst;
}

// ─── Основная функция ─────────────────────────────────────────────────────────

export async function recognizeBlank(
  file: File,
  answerKey: string,
  part1Count: number,
  part2Count: number,
  onProgress?: OcrProgressCallback
): Promise<RecognitionResult> {
  const totalQuestions = part1Count + part2Count;

  onProgress?.("Загружаю и улучшаю изображение...", 5);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await fileToCanvas(file, 2);
  } catch (err) {
    throw new Error("Не удалось загрузить изображение. Используйте JPG или PNG.");
  }

  const W = canvas.width;
  const H = canvas.height;

  onProgress?.("Запускаю OCR (русский язык)...", 12);

  const worker = await createWorker("rus", 1, {
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist:
        "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя" +
        "0123456789" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    });

    // ─── Код ученика ──────────────────────────────────────────────────────────
    onProgress?.("Распознаю код ученика...", 18);

    let studentCode = "00000";
    try {
      const codeZone = cropToCanvas(canvas, 0, 0, W, Math.round(H * 0.20), 8);
      await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_BLOCK });
      const { data: codeData } = await worker.recognize(codeZone);
      const codeClean = cleanText(codeData.text ?? "");
      const codeMatch = codeClean.match(/\d{5}/);
      if (codeMatch) {
        studentCode = codeMatch[0];
      } else {
        const digits = codeClean.replace(/\D/g, "");
        studentCode = digits.slice(0, 5).padEnd(5, "0");
      }
    } catch {
      studentCode = "00000";
    }

    // ─── Часть 1 — клетки ────────────────────────────────────────────────────
    onProgress?.("Распознаю ответы части 1...", 25);

    const p1StartY = Math.round(H * 0.30);
    const p1EndY = part2Count > 0 ? Math.round(H * 0.65) : Math.round(H * 0.82);
    const p1H = p1EndY - p1StartY;

    const cols = part1Count <= 8 ? part1Count
      : part1Count <= 16 ? 8
      : part1Count <= 20 ? 10
      : 13;
    const rows = Math.ceil(part1Count / cols);
    const cellW = Math.round(W / cols);
    const cellH = Math.round(p1H / rows);

    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_CHAR });

    const answers_part1: string[] = [];
    for (let i = 0; i < part1Count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cx = col * cellW + Math.round(cellW * 0.25);
      const cy = p1StartY + row * cellH + Math.round(cellH * 0.20);
      const cw = Math.max(Math.round(cellW * 0.50), 10);
      const ch = Math.max(Math.round(cellH * 0.60), 10);

      let charResult = "";
      try {
        const cell = cropToCanvas(canvas, cx, cy, cw, ch, 6);
        const { data } = await worker.recognize(cell);
        charResult = normalizeChar(data.text ?? "");
      } catch {
        charResult = "";
      }
      answers_part1.push(charResult);

      if (i % 4 === 0) {
        onProgress?.(
          `Часть 1: задание ${i + 1} из ${part1Count}`,
          Math.round(25 + (i / part1Count) * 50)
        );
      }
    }

    // ─── Часть 2 — строки ────────────────────────────────────────────────────
    onProgress?.("Распознаю ответы части 2...", 78);

    const answers_part2: string[] = [];
    if (part2Count > 0) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_LINE });

      const p2StartY = Math.round(H * 0.67);
      const p2EndY = Math.round(H * 0.88);
      const lineH = Math.round((p2EndY - p2StartY) / part2Count);

      for (let i = 0; i < part2Count; i++) {
        try {
          const ly = p2StartY + i * lineH + Math.round(lineH * 0.15);
          const lh = Math.max(Math.round(lineH * 0.70), 10);
          const lx = Math.round(W * 0.04);
          const lw = Math.round(W * 0.92);
          const lineCanvas = cropToCanvas(canvas, lx, ly, lw, lh, 4);
          const { data } = await worker.recognize(lineCanvas);
          answers_part2.push(cleanText(data.text ?? ""));
        } catch {
          answers_part2.push("");
        }
      }
    }

    onProgress?.("Анализирую результаты...", 93);

    const allAnswers = [...answers_part1, ...answers_part2];
    const analysis = analyzeAnswers(allAnswers, answerKey, part1Count);

    onProgress?.("Готово!", 100);

    return {
      student_code: studentCode,
      answers_part1,
      answers_part2,
      all_answers: allAnswers,
      analysis,
      image_size_kb: Math.round(file.size / 1024 * 10) / 10,
    };

  } finally {
    try { await worker.terminate(); } catch { /* игнорируем */ }
  }
}

// ─── Анализ ───────────────────────────────────────────────────────────────────

function analyzeAnswers(
  studentAnswers: string[],
  answerKey: string,
  part1Count: number
): RecognitionResult["analysis"] {
  const keyChars = cleanText(answerKey).split("");

  const details: AnalysisDetail[] = studentAnswers.map((ans, i) => {
    const key = keyChars[i] ?? "";
    const correct = ans !== "" && key !== "" && ans === key;
    return { question: i + 1, student: ans, key, correct, part: i < part1Count ? 1 : 2 };
  });

  const correct = details.filter(d => d.correct).length;
  const total = studentAnswers.length;
  const score_scaled = rawToScaled(correct, total);

  return {
    total,
    correct,
    wrong: total - correct,
    score_raw: correct,
    score_scaled,
    percent: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    details,
  };
}

function rawToScaled(raw: number, total: number): number {
  if (total === 0) return 0;
  const r = raw / total;
  if (r >= 0.97) return 96;
  if (r >= 0.95) return 89;
  if (r >= 0.86) return 75;
  if (r >= 0.72) return 64;
  if (r >= 0.53) return 52;
  if (r >= 0.31) return 36;
  if (r >= 0.16) return 24;
  return 0;
}
