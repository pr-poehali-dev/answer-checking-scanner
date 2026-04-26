export type Section =
  | "upload"
  | "recognition"
  | "checking"
  | "results"
  | "analytics"
  | "export"
  | "students"
  | "works"
  | "settings";

export const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "works", label: "Работы", icon: "ClipboardList" },
  { id: "upload", label: "Загрузка бланков", icon: "Upload" },
  { id: "recognition", label: "Распознавание", icon: "ScanLine" },
  { id: "checking", label: "Проверка ответов", icon: "CheckSquare" },
  { id: "results", label: "Результаты", icon: "BarChart2" },
  { id: "analytics", label: "Статистика", icon: "TrendingUp" },
  { id: "export", label: "Экспорт", icon: "FileDown" },
  { id: "students", label: "Ученики", icon: "Users" },
  { id: "settings", label: "Настройки", icon: "Settings" },
];

export const MOCK_STUDENTS = [
  { id: 1, name: "Алексеева Марина В.", answers: 32, correct: 28, raw: 28, scaled: 75, grade: "4", status: "ok" },
  { id: 2, name: "Борисов Дмитрий К.", answers: 32, correct: 24, raw: 24, scaled: 61, grade: "4", status: "ok" },
  { id: 3, name: "Васильева Ольга П.", answers: 32, correct: 31, raw: 31, scaled: 89, grade: "5", status: "ok" },
  { id: 4, name: "Горев Иван С.", answers: 30, correct: 14, raw: 14, scaled: 32, grade: "2", status: "warning" },
  { id: 5, name: "Данилова Екатерина Н.", answers: 32, correct: 27, raw: 27, scaled: 71, grade: "4", status: "ok" },
  { id: 6, name: "Ефимов Артём Р.", answers: 29, correct: 19, raw: 19, scaled: 47, grade: "3", status: "ok" },
  { id: 7, name: "Жукова Светлана И.", answers: 32, correct: 32, raw: 32, scaled: 96, grade: "5", status: "ok" },
  { id: 8, name: "Захаров Никита Л.", answers: 31, correct: 11, raw: 11, scaled: 24, grade: "2", status: "danger" },
];

export const SECTION_TITLES: Record<Section, string> = {
  upload: "Загрузка и сканирование бланков",
  recognition: "Распознавание ответов",
  checking: "Проверка и сравнение ответов",
  results: "Результаты",
  analytics: "Статистика и аналитика",
  export: "Экспорт отчётов",
  students: "Список учеников",
  works: "Работы",
  settings: "Настройки",
};

export const WORK_TYPES = ["Проверочная работа", "Контрольная работа"] as const;

export const SUBJECTS = [
  "Русский язык", "Математика", "Алгебра", "Геометрия", "История",
  "Обществознание", "Биология", "Физика", "Химия", "Информатика",
  "Литература", "География", "Иностранный язык", "Физкультура", "Музыка",
] as const;
