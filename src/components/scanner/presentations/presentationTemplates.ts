export interface ReadyTemplate {
  id: string;
  name: string;
  dark: string;
  accent: string;
  accent2: string;
  bg: string;
}

export const READY_TEMPLATES: ReadyTemplate[] = [
  { id: "ocean", name: "Океан", dark: "#091E42", accent: "#00B4D8", accent2: "#48CAE4", bg: "#F0F6FC" },
  { id: "forest", name: "Лес", dark: "#0F2D1F", accent: "#2DC65F", accent2: "#D4A017", bg: "#F0F7F1" },
  { id: "sunset", name: "Закат", dark: "#3D0C02", accent: "#E89A0C", accent2: "#C0392B", bg: "#FDF3E8" },
  { id: "cosmos", name: "Космос", dark: "#1A1336", accent: "#7C3AFF", accent2: "#00E5FF", bg: "#F4F2FF" },
  { id: "coral", name: "Коралл", dark: "#18222F", accent: "#FF5E4B", accent2: "#00D4C8", bg: "#F8F5F2" },
  { id: "arctic", name: "Арктика", dark: "#0A2A4A", accent: "#4FC3F7", accent2: "#B3E5FC", bg: "#F5F9FF" },
  { id: "dawn", name: "Рассвет", dark: "#2C176E", accent: "#FF8C42", accent2: "#FFD166", bg: "#FEF9F0" },
  { id: "mono", name: "Монохром", dark: "#101010", accent: "#E53E3E", accent2: "#FFD700", bg: "#FAFAFA" },
  { id: "lavender", name: "Лаванда", dark: "#3B1F5C", accent: "#B57BEE", accent2: "#F4A6D7", bg: "#F8F3FF" },
  { id: "mint", name: "Мята", dark: "#0B3B3A", accent: "#1FC8A9", accent2: "#A7F3D0", bg: "#F0FBF9" },
  { id: "bordeaux", name: "Бордо", dark: "#4A0E1F", accent: "#D4AF37", accent2: "#E26D5C", bg: "#FBF3F2" },
  { id: "graphite", name: "Графит", dark: "#22262B", accent: "#4DA3FF", accent2: "#9AA5B1", bg: "#F3F5F7" },
  { id: "lime", name: "Лайм", dark: "#2B3A0E", accent: "#A3E635", accent2: "#FACC15", bg: "#F9FBEA" },
  { id: "peach", name: "Персик", dark: "#4A2A1F", accent: "#FF9A76", accent2: "#FFD3A5", bg: "#FFF6EE" },
  { id: "indigo", name: "Индиго", dark: "#14213D", accent: "#FCA311", accent2: "#5C7AEA", bg: "#F4F6FB" },
  { id: "raspberry", name: "Малина", dark: "#4A0D33", accent: "#EC4899", accent2: "#FBBF24", bg: "#FDF2F8" },
  { id: "sand", name: "Песок", dark: "#3E2F1C", accent: "#C8A165", accent2: "#8C6D46", bg: "#FAF6EE" },
  { id: "emerald", name: "Изумруд", dark: "#053B2E", accent: "#10B981", accent2: "#FDE68A", bg: "#ECFDF5" },
  { id: "neon", name: "Неон", dark: "#0B0F2A", accent: "#22D3EE", accent2: "#F472B6", bg: "#F1F5FF" },
  { id: "steel", name: "Сталь", dark: "#1F2937", accent: "#F97316", accent2: "#94A3B8", bg: "#F8FAFC" },
];

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
