import type { PresentationThemePayload } from "@/lib/api";

export interface ReadyTemplate {
  id: string;
  name: string;
  dark: string;
  accent: string;
  accent2: string;
  bg: string;
  layout: string;
  fonts: number;
  bullet: string;
}

export const READY_TEMPLATES: ReadyTemplate[] = [
  { id: "ocean", name: "Океан", dark: "#091E42", accent: "#00B4D8", accent2: "#48CAE4", bg: "#F0F6FC", layout: "left_header", fonts: 0, bullet: "▸" },
  { id: "forest", name: "Лес", dark: "#0F2D1F", accent: "#2DC65F", accent2: "#D4A017", bg: "#F0F7F1", layout: "split_diagonal", fonts: 1, bullet: "●" },
  { id: "sunset", name: "Закат", dark: "#3D0C02", accent: "#E89A0C", accent2: "#C0392B", bg: "#FDF3E8", layout: "top_banner", fonts: 1, bullet: "◆" },
  { id: "cosmos", name: "Космос", dark: "#1A1336", accent: "#7C3AFF", accent2: "#00E5FF", bg: "#F4F2FF", layout: "sidebar_dark", fonts: 3, bullet: "›" },
  { id: "coral", name: "Коралл", dark: "#18222F", accent: "#FF5E4B", accent2: "#00D4C8", bg: "#F8F5F2", layout: "ribbon", fonts: 2, bullet: "▪" },
  { id: "arctic", name: "Арктика", dark: "#0A2A4A", accent: "#4FC3F7", accent2: "#B3E5FC", bg: "#F5F9FF", layout: "center_frame", fonts: 0, bullet: "—" },
  { id: "dawn", name: "Рассвет", dark: "#2C176E", accent: "#FF8C42", accent2: "#FFD166", bg: "#FEF9F0", layout: "corner_tag", fonts: 2, bullet: "●" },
  { id: "mono", name: "Монохром", dark: "#101010", accent: "#E53E3E", accent2: "#FFD700", bg: "#FAFAFA", layout: "stacked_bar", fonts: 5, bullet: "▪" },
  { id: "lavender", name: "Лаванда", dark: "#3B1F5C", accent: "#B57BEE", accent2: "#F4A6D7", bg: "#F8F3FF", layout: "left_header", fonts: 1, bullet: "◆" },
  { id: "mint", name: "Мята", dark: "#0B3B3A", accent: "#1FC8A9", accent2: "#A7F3D0", bg: "#F0FBF9", layout: "top_banner", fonts: 6, bullet: "›" },
  { id: "bordeaux", name: "Бордо", dark: "#4A0E1F", accent: "#D4AF37", accent2: "#E26D5C", bg: "#FBF3F2", layout: "split_diagonal", fonts: 4, bullet: "◆" },
  { id: "graphite", name: "Графит", dark: "#22262B", accent: "#4DA3FF", accent2: "#9AA5B1", bg: "#F3F5F7", layout: "sidebar_dark", fonts: 3, bullet: "▸" },
  { id: "lime", name: "Лайм", dark: "#2B3A0E", accent: "#A3E635", accent2: "#FACC15", bg: "#F9FBEA", layout: "ribbon", fonts: 5, bullet: "●" },
  { id: "peach", name: "Персик", dark: "#4A2A1F", accent: "#FF9A76", accent2: "#FFD3A5", bg: "#FFF6EE", layout: "center_frame", fonts: 2, bullet: "●" },
  { id: "indigo", name: "Индиго", dark: "#14213D", accent: "#FCA311", accent2: "#5C7AEA", bg: "#F4F6FB", layout: "stacked_bar", fonts: 7, bullet: "▸" },
  { id: "raspberry", name: "Малина", dark: "#4A0D33", accent: "#EC4899", accent2: "#FBBF24", bg: "#FDF2F8", layout: "corner_tag", fonts: 0, bullet: "◆" },
  { id: "sand", name: "Песок", dark: "#3E2F1C", accent: "#C8A165", accent2: "#8C6D46", bg: "#FAF6EE", layout: "top_banner", fonts: 4, bullet: "—" },
  { id: "emerald", name: "Изумруд", dark: "#053B2E", accent: "#10B981", accent2: "#FDE68A", bg: "#ECFDF5", layout: "left_header", fonts: 6, bullet: "▸" },
  { id: "neon", name: "Неон", dark: "#0B0F2A", accent: "#22D3EE", accent2: "#F472B6", bg: "#F1F5FF", layout: "split_diagonal", fonts: 3, bullet: "›" },
  { id: "steel", name: "Сталь", dark: "#1F2937", accent: "#F97316", accent2: "#94A3B8", bg: "#F8FAFC", layout: "ribbon", fonts: 7, bullet: "▪" },
];

const FONT_PAIRS = [
  ["Montserrat", "Calibri"], ["Georgia", "Calibri"], ["Trebuchet MS", "Trebuchet MS"], ["Bahnschrift", "Segoe UI"],
  ["Cambria", "Cambria"], ["Segoe UI Black", "Segoe UI"], ["Verdana", "Verdana"], ["Franklin Gothic Medium", "Calibri"],
];

function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
  const c = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0");
  return `${c(0)}${c(2)}${c(4)}`;
}

/** Превращает готовый шаблон в тему для компонентов предпросмотра (те же формулы, что на сервере). */
export function templateToTheme(t: ReadyTemplate): PresentationThemePayload {
  const [ft, fb] = FONT_PAIRS[t.fonts % FONT_PAIRS.length];
  const dark = t.dark.replace("#", "");
  return {
    name: `tpl_${t.id}`, label: "", layout: t.layout, font_title: ft, font_body: fb, bullet_marker: t.bullet,
    bg: t.bg.replace("#", ""), title_bg: dark, accent: dark,
    accent2: t.accent.replace("#", ""), accent3: t.accent2.replace("#", ""),
    text: mix(t.dark, "#000000", 0.35), muted: mix(t.dark, "#ffffff", 0.45),
    white: "FFFFFF", title_sub: mix(t.accent2, "#ffffff", 0.45), stripe: t.accent.replace("#", ""),
    card_bg: mix(t.accent, "#ffffff", 0.88),
  };
}

export const SAMPLE_SLIDE = {
  title: "Заголовок слайда",
  bullets: [
    "Первый тезис — здесь будет ключевая мысль урока",
    "Второй тезис — аргумент или важный факт по теме",
    "Третий тезис — пример, дата или определение",
    "Четвёртый тезис — вывод для учеников",
  ],
};

export type DesignMode = "template" | "custom";

export const PRESENTATION_MODES = [
  {
    id: "thesis" as const,
    title: "Тезисная",
    desc: "Ключевые мысли и аргументы в сжатой форме — по 5 тезисов на слайде.",
    icon: "ListChecks",
  },
  {
    id: "detailed" as const,
    title: "Подробная",
    desc: "С определениями и понятиями: «Термин — определение» на каждом слайде.",
    icon: "BookOpen",
  },
  {
    id: "mixed" as const,
    title: "Тезисная + подробная",
    desc: "ИИ сам решит, какие слайды раскрыть подробно, а какие дать тезисно, и напишет план.",
    icon: "Layers",
  },
];
