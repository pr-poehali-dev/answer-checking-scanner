import { createWorker, PSM } from "tesseract.js";
import { AnalysisDetail, RecognitionResult } from "./upload-types";

export type OcrProgressCallback = (status: string, progress: number) => void;

const VALID_CHARS = /[А-ЯЁа-яё0-9]/;

// ─── Предобработка изображения ───────────────────────────────────────────────

/**
 * Загружает файл в ImageBitmap
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Рисует изображение на canvas с улучшением контраста для OCR.
 * Возвращает canvas и масштаб.
 */
function prepareCanvas(img: HTMLImageElement, scale = 3): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;

  // Масштабируем
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Повышаем контраст: grayscale + threshold
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Порог — всё тёмнее 140 → чёрное, светлее → белое
    const val = gray < 140 ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Вырезает регион из canvas в отдельный canvas (для распознавания одной клетки)
 */
function cropCanvas(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const ctx = dst.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  return dst;
}

/**
 * Конвертирует canvas в Blob
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("canvas toBlob failed")), "image/png");
  });
}

// ─── Нормализация OCR символов ────────────────────────────────────────────────

/**
 * Карта замен похожих символов (латинские → кириллические и т.д.)
 */
const CHAR_MAP: Record<string, string> = {
  // Латинские буквы → кириллица
  "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н",
  "I": "И", "K": "К", "M": "М", "O": "О", "P": "Р",
  "T": "Т", "X": "Х", "Y": "У",
  "a": "А", "b": "В", "c": "С", "e": "Е", "o": "О",
  "p": "Р", "x": "Х", "y": "У",
  // Цифры-буквы
  "0": "О", // иногда O распознаётся как 0 — оставим как есть
  // Частые ошибки
  "З": "З", "з": "З",
};

function normalizeChar(raw: string): string {
  const c = raw.trim().toUpperCase();
  if (!c) return "";
  // Проверяем кириллицу и цифры напрямую
  if (/[А-ЯЁ]/.test(c)) return c;
  if (/[0-9]/.test(c)) return c;
  // Пытаемся заменить
  const mapped = CHAR_MAP[raw.trim()];
  if (mapped) return mapped;
  // Ещё одна попытка — взять первый валидный символ из строки
  for (const ch of c) {
    if (/[А-ЯЁ0-9]/.test(ch)) return ch;
  }
  return "";
}

function cleanOcrText(raw: string): string {
  return raw.toUpperCase().split("").filter(c => VALID_CHARS.test(c)).join("");
}

function extractStudentCode(text: string): string {
  // Ищем 5 цифр подряд
  const match = text.match(/\d{5}/);
  if (match) return match[0];
  const digits = text.replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : digits.padEnd(5, "0");
}

// ─── Детекция области клеток по структуре бланка ────────────────────────────

/**
 * Ищет строки с тёмными пикселями — помогает найти зоны с клетками
 */
function findDarkRows(canvas: HTMLCanvasElement, threshold = 80, minDark = 5): number[] {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] < threshold) darkCount++;
    }
    if (darkCount >= minDark) rows.push(y);
  }
  return rows;
}

/**
 * Группирует соседние числа в диапазоны [start, end]
 */
function groupRanges(nums: number[], gap = 5): [number, number][] {
  if (!nums.length) return [];
  const ranges: [number, number][] = [];
  let start = nums[0], prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - prev > gap) {
      ranges.push([start, prev]);
      start = nums[i];
    }
    prev = nums[i];
  }
  ranges.push([start, prev]);
  return ranges;
}

// ─── OCR одного региона ───────────────────────────────────────────────────────

async function recognizeChar(
  worker: Awaited<ReturnType<typeof createWorker>>,
  canvas: HTMLCanvasElement
): Promise<string> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], "cell.png", { type: "image/png" });
  const { data } = await worker.recognize(file);
  const text = (data.text ?? "").trim();
  return normalizeChar(text);
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

  onProgress?.("Загружаю изображение...", 5);
  const img = await loadImage(file);

  onProgress?.("Улучшаю качество изображения...", 10);
  const canvas = prepareCanvas(img, 3);
  const W = canvas.width;
  const H = canvas.height;

  onProgress?.("Запускаю движок распознавания...", 15);

  // Два воркера: один для одиночных символов (PSM.SINGLE_CHAR), один для строк
  const workerChar = await createWorker("rus", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.(`Распознаю символы... ${Math.round(m.progress * 100)}%`, Math.round(20 + m.progress * 50));
      }
    },
  });

  try {
    // PSM.SINGLE_CHAR — лучший режим для одиночных букв в клетках
    await workerChar.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_CHAR,
      tessedit_char_whitelist: "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789",
    });

    onProgress?.("Ищу область с ответами...", 25);

    // ─── Стратегия: делим бланк на зоны ──────────────────────────────────────
    // Верхняя ~15% — код ученика (5 цифр)
    // Средняя часть — часть 1 (клетки)
    // Нижняя часть — часть 2 (строки)

    const codeZoneH = Math.round(H * 0.18);
    const answersStartY = Math.round(H * 0.35);
    const part1EndY = part2Count > 0 ? Math.round(H * 0.70) : Math.round(H * 0.85);

    // ─── Код ученика ─────────────────────────────────────────────────────────
    onProgress?.("Распознаю код ученика...", 30);

    const codeCanvas = cropCanvas(canvas, Math.round(W * 0.2), Math.round(H * 0.08), Math.round(W * 0.6), codeZoneH);
    const codeBlob = await canvasToBlob(codeCanvas);
    const codeFile = new File([codeBlob], "code.png", { type: "image/png" });

    // Для кода используем PSM.SINGLE_LINE
    await workerChar.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const { data: codeData } = await workerChar.recognize(codeFile);
    const codeRaw = cleanOcrText(codeData.text ?? "");
    const studentCode = extractStudentCode(codeRaw);

    onProgress?.("Распознаю ответы части 1...", 40);

    // ─── Часть 1: клетки с ответами ──────────────────────────────────────────
    // Подбираем ширину клетки исходя из количества заданий в строке
    const cols = part1Count <= 10 ? part1Count : part1Count <= 20 ? 10 : part1Count <= 26 ? 13 : 8;
    const rows1 = Math.ceil(part1Count / cols);

    const cellAreaW = W;
    const cellAreaH = part1EndY - answersStartY;
    const cellW = Math.round(cellAreaW / cols);
    const cellH = Math.round(cellAreaH / rows1);
    // Отступ внутри клетки — берём центральные 60% чтобы не захватывать рамку
    const padX = Math.round(cellW * 0.3);
    const padY = Math.round(cellH * 0.2);

    await workerChar.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR });

    const answers_part1: string[] = [];
    for (let i = 0; i < part1Count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cellW + padX;
      const cy = answersStartY + row * cellH + padY;
      const cw = cellW - padX * 2;
      const ch = cellH - padY * 2;

      if (cw > 0 && ch > 0) {
        const cell = cropCanvas(canvas, cx, cy, cw, ch);
        const char = await recognizeChar(workerChar, cell);
        answers_part1.push(char);
      } else {
        answers_part1.push("");
      }

      if (i % 5 === 0) {
        onProgress?.(`Распознаю часть 1: задание ${i + 1}/${part1Count}`, Math.round(40 + (i / part1Count) * 35));
      }
    }

    onProgress?.("Распознаю ответы части 2...", 78);

    // ─── Часть 2: строки ─────────────────────────────────────────────────────
    const answers_part2: string[] = [];
    if (part2Count > 0) {
      await workerChar.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
      const part2AreaY = part1EndY + Math.round(H * 0.03);
      const part2AreaH = H - part2AreaY - Math.round(H * 0.05);
      const lineH = Math.round(part2AreaH / part2Count);

      for (let i = 0; i < part2Count; i++) {
        const ly = part2AreaY + i * lineH + Math.round(lineH * 0.1);
        const lh = Math.round(lineH * 0.8);
        const lx = Math.round(W * 0.05);
        const lw = Math.round(W * 0.9);

        if (lh > 0) {
          const lineCanvas = cropCanvas(canvas, lx, ly, lw, lh);
          const blob = await canvasToBlob(lineCanvas);
          const lineFile = new File([blob], `line${i}.png`, { type: "image/png" });
          const { data: lineData } = await workerChar.recognize(lineFile);
          const cleaned = cleanOcrText(lineData.text ?? "");
          answers_part2.push(cleaned || "");
        } else {
          answers_part2.push("");
        }
      }
    }

    onProgress?.("Анализирую результаты...", 92);

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
    await workerChar.terminate();
  }
}

// ─── Анализ ответов ───────────────────────────────────────────────────────────

function analyzeAnswers(
  studentAnswers: string[],
  answerKey: string,
  part1Count: number
): RecognitionResult["analysis"] {
  const keyChars = answerKey.toUpperCase().replace(/[^А-ЯЁ0-9]/g, "").split("");
  const details: AnalysisDetail[] = studentAnswers.map((ans, i) => {
    const key = keyChars[i] ?? "";
    const correct = ans !== "" && key !== "" && ans === key;
    return { question: i + 1, student: ans, key, correct, part: i < part1Count ? 1 : 2 };
  });

  const correct = details.filter(d => d.correct).length;
  const total = studentAnswers.length;
  const score_raw = correct;
  const score_scaled = rawToScaled(score_raw, total);

  return {
    total,
    correct,
    wrong: total - correct,
    score_raw,
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
