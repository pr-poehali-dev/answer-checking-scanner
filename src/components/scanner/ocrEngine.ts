// OCR-движок АОУСПТ — реальное распознавание через бэкенд (OpenCV).
// Старая сигнатура сохранена, чтобы не ломать UI.
import { AnalysisDetail, RecognitionResult } from "./upload-types";
import { recognizeApi } from "@/lib/api";

export type OcrProgressCallback = (status: string, progress: number) => void;

export async function recognizeBlank(
  file: File,
  answerKey: string,
  part1Count: number,
  part2Count: number,
  onProgress?: OcrProgressCallback
): Promise<RecognitionResult> {
  const total = (part1Count || 0) + (part2Count || 0) || 20;

  onProgress?.("Загружаю изображение на сервер...", 10);

  // Имитация прогресса пока ждём ответа сервера
  let p = 10;
  const tick = setInterval(() => {
    p = Math.min(85, p + 5);
    onProgress?.("Распознаю кружки A/B/C/D...", p);
  }, 350);

  let resp;
  try {
    resp = await recognizeApi.recognize(file, {
      questionsCount: total,
      answerKey: answerKey || "",
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

  const details: AnalysisDetail[] = (resp.analysis.details || []).map(d => ({
    question: d.q,
    student: d.student,
    key: d.key,
    correct: d.correct,
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
    },
    image_size_kb: Math.round((file.size / 1024) * 10) / 10,
  };
}