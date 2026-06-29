import { ROOT_FOLDER } from "@/lib/yadisk";

export const PRESENTATIONS_FOLDER = `${ROOT_FOLDER}/Презентации`;
export const SLIDE_OPTIONS = [5, 7, 8, 10, 12, 14];
// Примерные оттенки для мини-превью индивидуальной палитры (генерируется на сервере)
export const DESIGN_SWATCHES = ["#1E1B4B", "#7C3AED", "#EC4899", "#F59E0B", "#06B6D4"];
export const AUDIENCE_PRESETS = [
  "Ученики 5–6 классов",
  "Ученики 7–8 классов",
  "Ученики 9 класса",
  "Ученики 10–11 классов",
  "Подготовка к ОГЭ",
  "Подготовка к ЕГЭ",
];

export function triggerDownload(href: string, filename: string, revoke?: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 1500);
}

export function downloadBase64(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename, url);
}

/** Скачивает презентацию: сначала по прямой ссылке, иначе из base64. */
export function downloadPresentation(result: { pptx_url?: string; pptx_b64?: string }, filename: string) {
  if (result.pptx_url) {
    triggerDownload(result.pptx_url, filename);
  } else if (result.pptx_b64) {
    downloadBase64(result.pptx_b64, filename);
  } else {
    throw new Error("Файл презентации не получен. Попробуйте ещё раз.");
  }
}

/** Возвращает base64 файла: из ответа или скачивая по ссылке (нужно для Я.Диска). */
export async function getPptxBase64(result: { pptx_url?: string; pptx_b64?: string }): Promise<string> {
  if (result.pptx_b64) return result.pptx_b64;
  if (result.pptx_url) {
    const res = await fetch(result.pptx_url);
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  throw new Error("Файл презентации не получен");
}

export const STAGE_HINTS: [number, string][] = [
  [0,  "Подключаемся к ИИ…"],
  [5,  "ИИ изучает тему урока…"],
  [15, "Формируем структуру слайдов…"],
  [40, "Генерируем содержание слайдов…"],
  [80, "Подбираем фотографии…"],
  [90, "Собираем PPTX-файл…"],
  [96, "Финальная обработка…"],
];
