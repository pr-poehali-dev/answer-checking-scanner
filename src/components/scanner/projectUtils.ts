// Скачивание файлов проекта (DOCX / PDF) из base64
export function downloadBase64File(b64: string, filename: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";

export interface WorkTypeMeta {
  id: "project" | "referat" | "coursework" | "report" | "essay" | "text";
  label: string;
  icon: string;
  volume: string;
  desc: string;
}

export const WORK_TYPE_LIST: WorkTypeMeta[] = [
  { id: "project", label: "Индивидуальный проект", icon: "FolderKanban", volume: "10–20 страниц", desc: "Итоговый проект по ФГОС" },
  { id: "referat", label: "Реферат", icon: "FileText", volume: "10–15 страниц", desc: "Обзор темы по источникам" },
  { id: "coursework", label: "Курсовая работа", icon: "GraduationCap", volume: "20–25 страниц", desc: "Учебно-научное исследование" },
  { id: "report", label: "Доклад", icon: "Megaphone", volume: "10–15 страниц", desc: "Выступление по теме" },
  { id: "essay", label: "Сочинение", icon: "PenLine", volume: "от 300 слов", desc: "Авторское рассуждение" },
  { id: "text", label: "Текст", icon: "AlignLeft", volume: "15–20 страниц", desc: "Развёрнутый текст по теме" },
];
