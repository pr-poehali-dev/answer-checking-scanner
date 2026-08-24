import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
}

const DEFAULT_TITLE = "САОУ — платформа для учителей и учеников с ИИ-проверкой работ";
const DEFAULT_DESCRIPTION =
  "САОУ — система автоматизации образовательных учреждений: проверка работ по ИИ, генерация тестов, презентаций и конспектов для учителей, тренировочные задания и ИИ-помощник для учеников.";

/**
 * Устанавливает уникальные <title> и meta[name=description] для страницы,
 * возвращая их к дефолтным значениям при размонтировании — важно для SEO
 * (у каждого публичного раздела свой заголовок в результатах поиска).
 */
export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const descTag = document.querySelector('meta[name="description"]');
    const prevDescription = descTag?.getAttribute("content") || "";
    if (description && descTag) {
      descTag.setAttribute("content", description);
    }

    return () => {
      document.title = prevTitle;
      if (descTag) descTag.setAttribute("content", prevDescription);
    };
  }, [title, description]);
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION };