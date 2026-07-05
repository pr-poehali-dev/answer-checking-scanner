export type Section =
  | "upload"
  | "results"
  | "students"
  | "works"
  | "presentations"
  | "worksheets"
  | "tests"
  | "synopsis"
  | "exams"
  | "fipiExams"
  | "chat"
  | "settings"
  | "collective"
  | "support"
  | "myResults"
  | "materials"
  | "project";

export const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "works", label: "Работы", icon: "ClipboardList" },
  { id: "upload", label: "Загрузка бланков", icon: "Upload" },
  { id: "results", label: "Результаты", icon: "BarChart2" },
  { id: "students", label: "Ученики", icon: "Users" },
  { id: "tests", label: "Тесты", icon: "FileText" },
  { id: "worksheets", label: "Рабочие листы", icon: "FileSpreadsheet" },
  { id: "synopsis", label: "Конспекты", icon: "BookOpen" },
  { id: "presentations", label: "Презентации", icon: "Presentation" },
  { id: "exams", label: "ОГЭ / ЕГЭ", icon: "GraduationCap" },
  { id: "fipiExams", label: "Экзамены ФИПИ", icon: "ScrollText" },
  { id: "chat", label: "Чат с ИИ", icon: "MessageSquare" },
  { id: "materials", label: "Мои материалы", icon: "FolderOpen" },
  { id: "support", label: "Тех. поддержка", icon: "Headphones" },
  { id: "settings", label: "Настройки", icon: "Settings" },
];

// Разделы личного кабинета ученика/студента (учебные инструменты)
export const STUDENT_NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "myResults", label: "Мои результаты", icon: "BarChart2" },
  { id: "presentations", label: "Презентации", icon: "Presentation" },
  { id: "chat", label: "Чат с ИИ", icon: "MessageSquare" },
  { id: "tests", label: "Тренировочные тесты", icon: "FileText" },
  { id: "synopsis", label: "Конспекты", icon: "BookOpen" },
  { id: "exams", label: "ОГЭ / ЕГЭ", icon: "GraduationCap" },
  { id: "fipiExams", label: "Варианты ФИПИ", icon: "ScrollText" },
  { id: "project", label: "Проект / Курсовая", icon: "Sparkles" },
  { id: "materials", label: "Мои материалы", icon: "FolderOpen" },
  { id: "support", label: "Тех. поддержка", icon: "Headphones" },
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
  results: "Результаты",
  students: "Список учеников",
  works: "Работы",
  presentations: "Презентации учителя",
  worksheets: "Рабочие листы",
  tests: "Тесты и проверочные работы",
  synopsis: "Конспекты",
  exams: "ОГЭ / ЕГЭ — варианты по ФИПИ",
  fipiExams: "Экзамены ФИПИ — готовые варианты без ИИ",
  chat: "Чат с ИИ",
  support: "Техническая поддержка",
  settings: "Настройки",
  collective: "Коллектив",
  myResults: "Мои результаты",
  materials: "Мои материалы",
  project: "Проект / Курсовая",
};

export const WORK_TYPES = ["Проверочная работа", "Контрольная работа"] as const;

export const SUBJECTS = [
  "Русский язык", "Математика", "Алгебра", "Геометрия", "История",
  "Обществознание", "Биология", "Физика", "Химия", "Информатика",
  "Литература", "География", "Иностранный язык", "Физкультура", "Музыка",
] as const;