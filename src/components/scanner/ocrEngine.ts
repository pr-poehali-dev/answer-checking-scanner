// OCR-движок САОУ — распознавание бланков через Yandex Vision OCR на бэкенде.
// Операция платная: списывается с ИИ-баланса учителя, поэтому нужен его логин.
import { AnalysisDetail, RecognitionResult } from "./upload-types";
import { recognizeApi } from "@/lib/api";

export type OcrProgressCallback = (status: string, progress: number) => void;

export async function recognizeBlank(
  file: File,
  answerKey: string,
  part1Count: number,
  part2Count: number,
  onProgress?: OcrProgressCallback,
  optionsCount?: number,
  login?: string
): Promise<RecognitionResult> {
  const total = (part1Count || 0) + (part2Count || 0) || 20;

  onProgress?.("Подготавливаю изображение...", 10);

  // Имитация прогресса пока ждём ответа сервера (GigaChat до 25с)
  let p = 10;
  const messages = [
    "Отправляю бланк на распознавание...",
    "ИИ читает разметку бланка...",
    "Определяю отмеченные ответы...",
    "Читаю QR-код ученика...",
    "Почти готово, ещё немного...",
  ];
  let msgIdx = 0;
  const tick = setInterval(() => {
    p = Math.min(88, p + 3);
    if (p % 15 === 0 && msgIdx < messages.length - 1) msgIdx++;
    onProgress?.(messages[msgIdx], p);
  }, 600);

  let resp;
  try {
    resp = await recognizeApi.recognize(file, {
      questionsCount: total,
      optionsCount: optionsCount || 4,
      answerKey: answerKey || "",
      login,
    });
  } catch (e) {
    clearInterval(tick);
    throw e instanceof Error ? e : new Error("Ошибка распознавания");
  }
  clearInterval(tick);

  onProgress?.("Анализирую результаты...", 92);

  const all = resp.answers || [];
  const answers_part1 = all.slice(0, part1Count);
  const answers_part2 = all.slice(part1Count, part1Count + part2Count);

  // Backend возвращает: {q, answer, correct (строка-ключ), ok (bool)}
  const details: AnalysisDetail[] = (resp.analysis.details || []).map(d => ({
    question: d.q,
    student: d.answer ?? "",
    key: d.correct ?? "",
    correct: d.ok ?? false,
    part: d.q <= part1Count ? 1 : 2,
  }));

  onProgress?.("Готово!", 100);

  return {
    student_code: resp.studentCode || "",
    answers_part1,
    answers_part2,
    all_answers: all,
    analysis: {
      total: resp.analysis.total,
      correct: resp.analysis.correct,
      wrong: resp.analysis.wrong,
      percent: resp.analysis.percent,
      score_raw: resp.analysis.correct,
      score_scaled: resp.analysis.correct,
      details,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _dbg: (resp as unknown as any)._debug ?? { analyze: resp.analysis._dbg, ocr: (resp as unknown as any).debug },
    },
    image_size_kb: Math.round((file.size / 1024) * 10) / 10,
    spent_rub: resp.spentRub,
    balance_rub: resp.balanceRub,
  };
}