// Единая карта URL-адресов приложения САОУ.
// Каждый экран/раздел/шаг имеет свой короткий адрес через дефис — для
// метрик, закладок, кнопки "назад" браузера и безопасности (видно, куда
// именно идёт запрос). React Router не поддерживает "/prefix-:param",
// поэтому используются готовые литеральные пути, сгенерированные из
// этих таблиц (см. App.tsx).

import type { Section } from "@/components/scanner/types";
import type { OUSection } from "@/components/institution/OUTypes";

// ── Вход и регистрация ──────────────────────────────────────────────────
export type AuthMode = "landing" | "login" | "signup" | "confirm" | "forgot" | "reset" | "ou-login" | "ou-register";

export const AUTH_MODE_TO_PATH: Record<AuthMode, string> = {
  landing: "/",
  login: "/areg",
  signup: "/areg-reg",
  confirm: "/areg-podtv",
  forgot: "/areg-zabyl",
  reset: "/areg-parol",
  "ou-login": "/ou-vhod",
  "ou-register": "/ou-reg",
};

export const PATH_TO_AUTH_MODE: Record<string, AuthMode> = Object.fromEntries(
  Object.entries(AUTH_MODE_TO_PATH).map(([mode, path]) => [path, mode as AuthMode])
) as Record<string, AuthMode>;

export const AUTH_PATHS = Object.values(AUTH_MODE_TO_PATH);

// ── Кабинет учителя (/lk) ────────────────────────────────────────────────
export const TEACHER_DEFAULT_SECTION: Section = "works";
export const TEACHER_DEFAULT_PATH = "/lk";

export const TEACHER_SECTION_TO_PATH: Record<Section, string> = {
  works: "/lk",
  upload: "/lk-scan",
  results: "/lk-rez",
  students: "/lk-ucheniki",
  worksheets: "/lk-listy",
  tests: "/lk-testy",
  synopsis: "/lk-konspekty",
  presentations: "/lk-prez",
  exams: "/lk-ege",
  fipiExams: "/lk-fipi",
  chat: "/lk-chat",
  support: "/lk-podderzhka",
  settings: "/lk-sgm",
  collective: "/lk-kollektiv",
  myResults: "/lk-rez",
  materials: "/lk-materialy",
  project: "/lk-proekt",
  adminUsers: "/lk-admin",
};

export const PATH_TO_TEACHER_SECTION: Record<string, Section> = Object.fromEntries(
  Object.entries(TEACHER_SECTION_TO_PATH).map(([section, path]) => [path, section as Section])
) as Record<string, Section>;

export const TEACHER_PATHS = Array.from(new Set(Object.values(TEACHER_SECTION_TO_PATH)));

// ── Кабинет ученика (/lk-uch) ────────────────────────────────────────────
export const STUDENT_DEFAULT_SECTION: Section = "myResults";
export const STUDENT_DEFAULT_PATH = "/lk-uch";

export const STUDENT_SECTION_TO_PATH: Record<Section, string> = {
  myResults: "/lk-uch",
  presentations: "/lk-uch-prez",
  chat: "/lk-uch-chat",
  tests: "/lk-uch-testy",
  synopsis: "/lk-uch-konspekty",
  exams: "/lk-uch-ege",
  fipiExams: "/lk-uch-fipi",
  project: "/lk-uch-proekt",
  materials: "/lk-uch-materialy",
  support: "/lk-uch-podderzhka",
  settings: "/lk-uch-sgm",
  // Разделы, которых нет в STUDENT_NAV_ITEMS, но тип Section общий — заглушки на дефолт
  works: "/lk-uch",
  upload: "/lk-uch",
  results: "/lk-uch",
  students: "/lk-uch",
  worksheets: "/lk-uch",
  collective: "/lk-uch",
  adminUsers: "/lk-uch",
};

export const PATH_TO_STUDENT_SECTION: Record<string, Section> = Object.fromEntries(
  Object.entries(STUDENT_SECTION_TO_PATH).map(([section, path]) => [path, section as Section])
) as Record<string, Section>;

export const STUDENT_PATHS = Array.from(new Set(Object.values(STUDENT_SECTION_TO_PATH)));

// ── Кабинет образовательного учреждения (/ou) ────────────────────────────
export const OU_DEFAULT_SECTION: OUSection = "profile";
export const OU_DEFAULT_PATH = "/ou";

export const OU_SECTION_TO_PATH: Record<OUSection, string> = {
  profile: "/ou",
  management: "/ou-uprav",
  collective: "/ou-kollektiv",
};

export const PATH_TO_OU_SECTION: Record<string, OUSection> = Object.fromEntries(
  Object.entries(OU_SECTION_TO_PATH).map(([section, path]) => [path, section as OUSection])
) as Record<string, OUSection>;

export const OU_PATHS = Array.from(new Set(Object.values(OU_SECTION_TO_PATH)));

// ── СЖОУ: вкладки внутри кабинетов ролей ──────────────────────────────────
export type SjouTeacherTab = "journal" | "homework" | "schedule" | "announce";
export const SJOU_TEACHER_TAB_TO_PATH: Record<SjouTeacherTab, string> = {
  journal: "/sjou-teacher",
  homework: "/sjou-teacher-dz",
  schedule: "/sjou-teacher-raspisanie",
  announce: "/sjou-teacher-obyav",
};
export const PATH_TO_SJOU_TEACHER_TAB: Record<string, SjouTeacherTab> = Object.fromEntries(
  Object.entries(SJOU_TEACHER_TAB_TO_PATH).map(([tab, path]) => [path, tab as SjouTeacherTab])
) as Record<string, SjouTeacherTab>;
export const SJOU_TEACHER_PATHS = Object.values(SJOU_TEACHER_TAB_TO_PATH);

export type SjouCabinetTab = "overview" | "classes" | "teachers" | "students" | "schedule" | "journal";
export const SJOU_CABINET_TAB_TO_PATH: Record<SjouCabinetTab, string> = {
  overview: "/sjou-cabinet",
  classes: "/sjou-cabinet-klassy",
  teachers: "/sjou-cabinet-uchitelya",
  students: "/sjou-cabinet-ucheniki",
  schedule: "/sjou-cabinet-raspisanie",
  journal: "/sjou-cabinet-zhurnal",
};
export const PATH_TO_SJOU_CABINET_TAB: Record<string, SjouCabinetTab> = Object.fromEntries(
  Object.entries(SJOU_CABINET_TAB_TO_PATH).map(([tab, path]) => [path, tab as SjouCabinetTab])
) as Record<string, SjouCabinetTab>;
export const SJOU_CABINET_PATHS = Object.values(SJOU_CABINET_TAB_TO_PATH);

export type SjouDashboardTab = "grades" | "schedule" | "homework" | "announce";
export const SJOU_STUDENT_TAB_TO_PATH: Record<SjouDashboardTab, string> = {
  grades: "/sjou-student",
  schedule: "/sjou-student-raspisanie",
  homework: "/sjou-student-dz",
  announce: "/sjou-student-obyav",
};
export const PATH_TO_SJOU_STUDENT_TAB: Record<string, SjouDashboardTab> = Object.fromEntries(
  Object.entries(SJOU_STUDENT_TAB_TO_PATH).map(([tab, path]) => [path, tab as SjouDashboardTab])
) as Record<string, SjouDashboardTab>;
export const SJOU_STUDENT_PATHS = Object.values(SJOU_STUDENT_TAB_TO_PATH);

export const SJOU_PARENT_TAB_TO_PATH: Record<SjouDashboardTab, string> = {
  grades: "/sjou-parent",
  schedule: "/sjou-parent-raspisanie",
  homework: "/sjou-parent-dz",
  announce: "/sjou-parent-obyav",
};
export const PATH_TO_SJOU_PARENT_TAB: Record<string, SjouDashboardTab> = Object.fromEntries(
  Object.entries(SJOU_PARENT_TAB_TO_PATH).map(([tab, path]) => [path, tab as SjouDashboardTab])
) as Record<string, SjouDashboardTab>;
export const SJOU_PARENT_PATHS = Object.values(SJOU_PARENT_TAB_TO_PATH);

// ── УДС: вкладки внутри секретной панели /piot-colldent19 ────────────────
// Базовый путь остаётся прежним (намеренно неочевидным для посторонних),
// остальные вкладки — его короткие суффиксы через дефис.
export type UdsTab = "employees" | "wards" | "users" | "audit" | "consents" | "support" | "profile" | "lkview" | "maintenance" | "mail" | "materials" | "promotion";
export const UDS_BASE_PATH = "/piot-colldent19";
export const UDS_TAB_TO_PATH: Record<UdsTab, string> = {
  employees: "/piot-colldent19",
  wards: "/piot-colldent19-podopech",
  users: "/piot-colldent19-users",
  audit: "/piot-colldent19-audit",
  consents: "/piot-colldent19-soglasiya",
  support: "/piot-colldent19-podderzhka",
  profile: "/piot-colldent19-profil",
  lkview: "/piot-colldent19-lk-vid",
  maintenance: "/piot-colldent19-to",
  mail: "/piot-colldent19-pochta",
  materials: "/piot-colldent19-materialy",
  promotion: "/piot-colldent19-promo",
};
export const PATH_TO_UDS_TAB: Record<string, UdsTab> = Object.fromEntries(
  Object.entries(UDS_TAB_TO_PATH).map(([tab, path]) => [path, tab as UdsTab])
) as Record<string, UdsTab>;
export const UDS_PATHS = Object.values(UDS_TAB_TO_PATH);