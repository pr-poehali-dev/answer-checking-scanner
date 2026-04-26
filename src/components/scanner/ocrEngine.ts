import { createWorker } from "tesseract.js";
import { AnalysisDetail, RecognitionResult } from "./upload-types";

export type OcrProgressCallback = (status: string, progress: number) => void;

// Допустимые символы в ответах: русские буквы А-Я и цифры 1-9
const VALID_CHARS = /[А-ЯЁа-яё0-9]/;
const CYRILLIC_UPPER = /[А-ЯЁ]/;

/**
 * Чистим текст от мусора OCR — оставляем только русские буквы и цифры
 */
function cleanOcrText(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter(c => VALID_CHARS.test(c))
    .join("");
}

/**
 * Пытаемся вычленить 5-значный код ученика из распознанного текста
 */
function extractStudentCode(text: string): string {
  // Ищем первую последовательность из ровно 5 цифр
  const match = text.match(/\b(\d{5})\b/);
  if (match) return match[1];
  // Fallback: первые 5 цифр подряд
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  return "00000";
}

/**
 * Разбиваем очищенный текст на массив ответов по количеству заданий
 * Логика: каждый символ после кода — один ответ
 */
function parseAnswers(text: string, count: number): string[] {
  // Убираем код (первые 5 цифр) из начала
  const withoutCode = text.replace(/^\d{5}/, "").trim();
  const chars = withoutCode.split("").filter(c => VALID_CHARS.test(c));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(chars[i] ?? "");
  }
  return result;
}

/**
 * Сравниваем ответы ученика с ключом
 */
function analyzeAnswers(
  studentAnswers: string[],
  answerKey: string,
  part1Count: number
): RecognitionResult["analysis"] {
  const keyChars = answerKey.toUpperCase().split("");
  const details: AnalysisDetail[] = studentAnswers.map((ans, i) => {
    const key = keyChars[i] ?? "";
    const correct = ans !== "" && key !== "" && ans.toUpperCase() === key.toUpperCase();
    return {
      question: i + 1,
      student: ans,
      key,
      correct,
      part: i < part1Count ? 1 : 2,
    };
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
    percent: total > 0 ? Math.round((correct / total) * 100 * 10) / 10 : 0,
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

/**
 * Основная функция OCR — принимает файл, возвращает результат
 */
export async function recognizeBlank(
  file: File,
  answerKey: string,
  part1Count: number,
  part2Count: number,
  onProgress?: OcrProgressCallback
): Promise<RecognitionResult> {
  const totalQuestions = part1Count + part2Count;

  onProgress?.("Загружаю движок распознавания...", 5);

  const worker = await createWorker("rus+eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.("Распознаю текст...", Math.round(20 + m.progress * 70));
      } else if (m.status === "loading language traineddata") {
        onProgress?.("Загружаю русский язык...", 10);
      } else if (m.status === "initializing api") {
        onProgress?.("Инициализация...", 15);
      }
    },
  });

  try {
    // Настройки под бланк: только нужные символы
    await worker.setParameters({
      tessedit_char_whitelist: "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789",
    });

    onProgress?.("Анализирую изображение...", 25);

    const { data } = await worker.recognize(file);
    const rawText = data.text ?? "";

    onProgress?.("Обрабатываю результат...", 92);

    const cleaned = cleanOcrText(rawText);
    const studentCode = extractStudentCode(cleaned);
    const allAnswers = parseAnswers(cleaned, totalQuestions);
    const answers_part1 = allAnswers.slice(0, part1Count);
    const answers_part2 = allAnswers.slice(part1Count);
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
    await worker.terminate();
  }
}
