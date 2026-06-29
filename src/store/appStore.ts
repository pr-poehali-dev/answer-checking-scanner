// Глобальное хранилище приложения САОУ
import { authApi } from "@/lib/api";
import { yadisk, yadiskOAuth, yadiskStorage, ROOT_FOLDER, STUDENTS_FILE, WORKS_FILE, type YadiskUser } from "@/lib/yadisk";

// ── Персистентность сессии ─────────────────────────────────────────────────
const SESSION_KEY = "aousp_session_v1";

function saveSession(teacher: Teacher) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      login: teacher.login,
      name: teacher.name,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      school: teacher.school,
      role: teacher.role,
      authToken: teacher.authToken,
      subscriptionStatus: teacher.subscriptionStatus,
      subscriptionActive: teacher.subscriptionActive,
      subscriptionUntil: teacher.subscriptionUntil,
      trialActive: teacher.trialActive,
      trialExpired: teacher.trialExpired,
      trialUntil: teacher.trialUntil,
      trialAiCallsToday: teacher.trialAiCallsToday,
      trialAiLimit: teacher.trialAiLimit,
      aiTokensKopecks: teacher.aiTokensKopecks,
    }));
  } catch { /* ignore */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function loadSession(): Teacher | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.authToken || !d.login) return null;
    return {
      login: d.login,
      name: d.name || "",
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      school: d.school || "",
      role: d.role || "teacher",
      authToken: d.authToken,
      yadiskToken: null,
      subscriptionStatus: d.subscriptionStatus || "none",
      subscriptionActive: !!d.subscriptionActive,
      subscriptionUntil: d.subscriptionUntil || null,
      trialActive: !!d.trialActive,
      trialExpired: !!d.trialExpired,
      trialUntil: d.trialUntil || null,
      trialAiCallsToday: d.trialAiCallsToday || 0,
      trialAiLimit: d.trialAiLimit || 5,
      aiTokensKopecks: d.aiTokensKopecks || 0,
    };
  } catch { return null; }
}

// ── Автосохранение на Я.Диск (дебаунс 2.5 сек) ──────────────────────────────
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _autoSaveEnabled = false; // включается только после первой загрузки данных

function _scheduleAutoSave() {
  if (!_autoSaveEnabled) return;
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    const { yadiskConnected, yadiskSyncing, teacher } = state;
    if (yadiskConnected && !yadiskSyncing && teacher?.yadiskToken) {
      appStore.syncToYadisk();
    }
  }, 2500);
}

export type UserRole = "admin" | "teacher" | "tester" | "student";

export type SubscriptionStatus = "none" | "active" | "expired" | "trial";

export interface Teacher {
  login: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  school: string;
  role: UserRole;
  authToken: string;
  yadiskToken: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionActive: boolean;
  subscriptionUntil: string | null;
  trialActive: boolean;
  trialExpired: boolean;
  trialUntil: string | null;
  trialAiCallsToday: number;
  trialAiLimit: number;
  aiTokensKopecks: number;
}

export interface Student {
  code: string; // 5-значный код (для бланков / OCR)
  bindCode?: string; // 8-символьный код привязки ученика к своему ЛК
  name: string;
  classNum: number; // 1-11
  classLetter: string; // А,Б,В...
}

export interface GradeScale {
  grade1: number;
  grade2: number;
  grade3: number;
  grade4: number;
  grade5: number;
}

export type WorkType = "Проверочная работа" | "Контрольная работа" | "Тест";

export interface Work {
  id: string; // индивидуальный номер работы (6 цифр)
  type: WorkType;
  subject: string;
  classNum: number;
  classLetter: string;
  date: string;
  totalQuestions: number;
  part1Count: number;
  part2Count: number;
  answerKey: string;
  gradeScale: GradeScale;
  maxScore: number;
  topic?: string; // тема (опционально, заполняется ИИ-генератором)
  generatedByAi?: boolean; // создана ли работа через ИИ
}

export interface StudentResult {
  workId: string;
  studentCode: string;
  answers: string[];
  correctCount: number;
  totalCount: number;
  score: number;
  grade: string;
  scannedAt: string;
}

export interface PresentationItem {
  id: string;
  topic: string;
  description: string;
  audience: string;
  slidesCount: number;
  filename: string;
  size: number;
  yadiskPath: string | null;
  uploadedToYadisk: boolean;
  createdAt: string;
  outline: {
    subtitle: string;
    slides: { title: string; bullets: string[] }[];
    conclusion: string[];
  };
}

export interface SynopsisItem {
  id: string;
  subject: string;
  classNum: number;
  topic: string;
  description: string;
  text: string;
  wordCount: number;
  createdAt: string;
  docxB64?: string;
  filename?: string;
  spentRub?: number;
  balanceRub?: number;
}

export interface GeneratedTestItem {
  id: string;
  workId: string;
  workType: WorkType;
  subject: string;
  classNum: number;
  topic: string;
  description: string;
  part1Count: number;
  part2Count: number;
  filename: string;
  size: number;
  yadiskPath: string | null;
  uploadedToYadisk: boolean;
  createdAt: string;
  questions: {
    part1: { question: string; options: string[]; answer: string }[];
    part2: { question: string; answer: string }[];
  };
}

export interface WorksheetTable {
  headers: string[];
  rows: string[][];
}

export interface WorksheetTask {
  number: number;
  type: string;
  instruction: string;
  content: string;
  table?: WorksheetTable | null;
  answer_lines: number;
  image_query?: string;
}

export interface WorksheetItem {
  id: string;
  title: string;
  subject: string;
  classNum: number;
  topic: string;
  description: string;
  tasksCount: number;
  imagesAdded: number;
  filename: string;
  size: number;
  yadiskPath: string | null;
  uploadedToYadisk: boolean;
  createdAt: string;
  intro: string;
  tasks: WorksheetTask[];
}

export type AppState = {
  teacher: Teacher | null;
  students: Student[];
  works: Work[];
  results: StudentResult[];
  presentations: PresentationItem[];
  generatedTests: GeneratedTestItem[];
  worksheets: WorksheetItem[];
  synopses: SynopsisItem[];
  yadiskConnected: boolean;
  yadiskUser: YadiskUser | null;
  yadiskSyncing: boolean;
  yadiskLastSync: string | null;
  maintenanceSections: string[];
  hiddenSections: { teacher: string[]; student: string[] };
};

// Начальное состояние — восстанавливаем сессию из localStorage
const _restoredTeacher = loadSession();

let state: AppState = {
  teacher: _restoredTeacher,
  students: [],
  works: [],
  results: [],
  presentations: [],
  generatedTests: [],
  worksheets: [],
  synopses: [],
  yadiskConnected: false,
  yadiskUser: null,
  yadiskSyncing: false,
  yadiskLastSync: null,
  maintenanceSections: [],
  hiddenSections: { teacher: [], student: [] },
};

type Listener = () => void;
const listeners: Listener[] = [];

function notify() {
  listeners.forEach(l => l());
}

export const appStore = {
  getState: (): AppState => state,

  subscribe: (listener: Listener) => {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },

  login: async (login: string, password: string): Promise<{ ok: true; role: UserRole } | { ok: false; error: string }> => {
    try {
      const user = await authApi.login(login.trim(), password);
      const newTeacher: Teacher = {
        login: user.login,
        name: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        school: user.school,
        role: user.role,
        authToken: user.token,
        yadiskToken: null,
        subscriptionStatus: user.subscription_status || "none",
        subscriptionActive: !!user.subscription_active,
        subscriptionUntil: user.subscription_until,
        trialActive: !!user.trial_active,
        trialExpired: !!user.trial_expired,
        trialUntil: user.trial_until || null,
        trialAiCallsToday: user.trial_ai_calls_today || 0,
        trialAiLimit: user.trial_ai_limit || 5,
        aiTokensKopecks: (user as unknown as { ai_balance_kopecks?: number }).ai_balance_kopecks || 0,
      };
      saveSession(newTeacher);
      state = { ...state, teacher: newTeacher };
      notify();
      if (user.role === "teacher" || user.role === "student") {
        // Сбрасываем Я.Диск-состояние от предыдущего пользователя (защита от смешения аккаунтов)
        state = {
          ...state,
          yadiskConnected: false,
          yadiskUser: null,
          yadiskSyncing: false,
          yadiskLastSync: null,
        };
        notify();
        appStore.restoreYadisk().then((restored) => {
          if (restored) {
            appStore.loadFromYadisk();
          }
        });
      }
      return { ok: true, role: user.role };
    } catch (e) {
      return { ok: false, error: (e as Error).message || "Ошибка входа" };
    }
  },

  signup: async (payload: { first_name: string; last_name: string; email: string; password: string; role?: "teacher" | "student"; study_group?: string }): Promise<
    { ok: true; role: UserRole; login: string } | { ok: false; error: string }
  > => {
    try {
      const user = await authApi.signup(payload);
      const signupTeacher: Teacher = {
        login: user.login,
        name: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        school: user.school,
        role: user.role,
        authToken: user.token,
        yadiskToken: null,
        subscriptionStatus: user.subscription_status || "none",
        subscriptionActive: !!user.subscription_active,
        subscriptionUntil: user.subscription_until,
        trialActive: !!user.trial_active,
        trialExpired: !!user.trial_expired,
        trialUntil: user.trial_until || null,
        trialAiCallsToday: user.trial_ai_calls_today || 0,
        trialAiLimit: user.trial_ai_limit || 5,
        aiTokensKopecks: 0,
      };
      saveSession(signupTeacher);
      state = { ...state, teacher: signupTeacher };
      notify();
      return { ok: true, role: user.role, login: user.login };
    } catch (e) {
      return { ok: false, error: (e as Error).message || "Ошибка регистрации" };
    }
  },

  refreshSubscription: async (): Promise<void> => {
    if (!state.teacher || state.teacher.role === "admin") return;
    try {
      const data = await authApi.me(state.teacher.login);
      const updatedTeacher = {
        ...state.teacher,
        subscriptionStatus: data.subscription_status,
        subscriptionActive: !!data.subscription_active,
        subscriptionUntil: data.subscription_until,
        trialActive: !!data.trial_active,
        trialExpired: !!data.trial_expired,
        trialUntil: data.trial_until || null,
        trialAiCallsToday: data.trial_ai_calls_today || 0,
        trialAiLimit: data.trial_ai_limit || 5,
        aiTokensKopecks: (data as unknown as { ai_balance_kopecks?: number }).ai_balance_kopecks ?? state.teacher!.aiTokensKopecks,
      };
      saveSession(updatedTeacher);
      state = { ...state, teacher: updatedTeacher };
      notify();
    } catch (e) {
      console.warn("refreshSubscription failed:", e);
    }
  },

  setAiBalance: (kopecks: number) => {
    if (!state.teacher) return;
    const updated = { ...state.teacher, aiTokensKopecks: kopecks };
    saveSession(updated);
    state = { ...state, teacher: updated };
    notify();
  },

  activateTrial: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!state.teacher) return { ok: false, error: "Не авторизован" };
    try {
      const data = await authApi.activateTrial(state.teacher.login);
      state = {
        ...state,
        teacher: {
          ...state.teacher,
          subscriptionStatus: "trial",
          subscriptionActive: true,
          trialActive: true,
          trialExpired: false,
          trialUntil: data.trial_until,
          trialAiCallsToday: 0,
          trialAiLimit: data.trial_ai_limit,
        },
      };
      notify();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message || "Ошибка активации" };
    }
  },

  logout: () => {
    const login = state.teacher?.login || "";
    if (login) yadiskStorage.clear(login);
    clearSession();
    state = {
      ...state,
      teacher: null,
      yadiskConnected: false,
      yadiskUser: null,
      yadiskSyncing: false,
      yadiskLastSync: null,
      students: [],
      works: [],
      results: [],
      presentations: [],
      generatedTests: [],
      worksheets: [],
      synopses: [],
    };
    notify();
  },

  updateTeacherProfile: (fields: Partial<Pick<Teacher, "name" | "firstName" | "lastName" | "email" | "school">>) => {
    if (!state.teacher) return;
    const updated = { ...state.teacher, ...fields };
    saveSession(updated);
    state = { ...state, teacher: updated };
    notify();
  },

  addStudent: (student: Student) => {
    state = { ...state, students: [...state.students, student] };
    notify();
    _scheduleAutoSave();
    appStore.syncStudentCodesToDb();
  },

  updateStudent: (code: string, updated: Partial<Student>) => {
    state = {
      ...state,
      students: state.students.map(s => s.code === code ? { ...s, ...updated } : s),
    };
    notify();
    _scheduleAutoSave();
    appStore.syncStudentCodesToDb();
  },

  removeStudent: (code: string) => {
    state = { ...state, students: state.students.filter(s => s.code !== code) };
    notify();
    _scheduleAutoSave();
  },

  setStudents: (students: Student[]) => {
    // Бэкфилл кода привязки для учеников без него
    const used = new Set(students.map(s => s.bindCode).filter(Boolean) as string[]);
    const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const withBind = students.map(s => {
      if (s.bindCode) return s;
      let bc: string;
      do {
        bc = "";
        for (let i = 0; i < 8; i++) bc += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      } while (used.has(bc));
      used.add(bc);
      return { ...s, bindCode: bc };
    });
    state = { ...state, students: withBind };
    notify();
    _scheduleAutoSave();
    appStore.syncStudentCodesToDb();
  },

  generateStudentCode: (): string => {
    const used = new Set(state.students.map(s => s.code));
    let code: string;
    do {
      code = String(Math.floor(10000 + Math.random() * 90000));
    } while (used.has(code));
    return code;
  },

  // 8-символьный код привязки (буквы+цифры, без похожих символов 0/O/1/I)
  generateBindCode: (): string => {
    const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const used = new Set(state.students.map(s => s.bindCode).filter(Boolean));
    let code: string;
    do {
      code = "";
      for (let i = 0; i < 8; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    } while (used.has(code));
    return code;
  },

  addWork: (work: Work) => {
    state = { ...state, works: [...state.works, work] };
    notify();
    _scheduleAutoSave();
  },

  generateWorkId: (): string => {
    const used = new Set(state.works.map(w => w.id));
    let id: string;
    do {
      id = String(Math.floor(100000 + Math.random() * 900000));
    } while (used.has(id));
    return id;
  },

  addResult: (result: StudentResult) => {
    // Заменяем если уже есть результат этого ученика для этой работы
    const filtered = state.results.filter(
      r => !(r.workId === result.workId && r.studentCode === result.studentCode)
    );
    state = { ...state, results: [...filtered, result] };
    notify();
    _scheduleAutoSave();
    appStore.syncResultsToDb();
  },

  addPresentation: (item: PresentationItem) => {
    state = { ...state, presentations: [item, ...state.presentations] };
    notify();
  },

  removePresentation: (id: string) => {
    state = { ...state, presentations: state.presentations.filter(p => p.id !== id) };
    notify();
  },

  addGeneratedTest: (item: GeneratedTestItem) => {
    state = { ...state, generatedTests: [item, ...state.generatedTests] };
    notify();
  },

  removeGeneratedTest: (id: string) => {
    state = { ...state, generatedTests: state.generatedTests.filter(t => t.id !== id) };
    notify();
  },

  addWorksheet: (item: WorksheetItem) => {
    state = { ...state, worksheets: [item, ...state.worksheets] };
    notify();
  },

  removeWorksheet: (id: string) => {
    state = { ...state, worksheets: state.worksheets.filter(w => w.id !== id) };
    notify();
  },

  addSynopsis: (item: SynopsisItem) => {
    state = { ...state, synopses: [item, ...state.synopses] };
    notify();
  },

  removeSynopsis: (id: string) => {
    state = { ...state, synopses: state.synopses.filter(s => s.id !== id) };
    notify();
  },

  connectYadisk: (token: string, user: YadiskUser | null = null) => {
    state = {
      ...state,
      yadiskConnected: true,
      yadiskUser: user,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: token } : null,
    };
    notify();
    // После подключения — загружаем данные (автосохранение включится там)
    appStore.loadFromYadisk();
  },

  disconnectYadisk: () => {
    yadiskStorage.clear(state.teacher?.login || "");
    state = {
      ...state,
      yadiskConnected: false,
      yadiskUser: null,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: null } : null,
    };
    notify();
  },

  /** Восстанавливает подключение Я.Диска — сначала из localStorage, потом из БД (любое устройство). */
  restoreYadisk: async (): Promise<boolean> => {
    const teacher = state.teacher;
    const login = teacher?.login || "";
    if (!login) return false;
    localStorage.removeItem("aousp_yadisk_access");
    localStorage.removeItem("aousp_yadisk_refresh");
    localStorage.removeItem("aousp_yadisk_user");

    // 1. Пробуем токен из localStorage
    const { access, refresh, user } = yadiskStorage.load(login);
    if (access) {
      const ok = await yadisk.ping(access);
      if (ok) {
        state = {
          ...state,
          yadiskConnected: true,
          yadiskUser: user,
          teacher: state.teacher ? { ...state.teacher, yadiskToken: access } : null,
        };
        notify();
        return true;
      }
      // access протух — пробуем обновить через refresh из localStorage
      if (refresh) {
        try {
          const tokens = await yadiskOAuth.refresh(refresh);
          tokens.refresh_token = tokens.refresh_token || refresh;
          yadiskStorage.save({ ...tokens, user: user || undefined }, login);
          state = {
            ...state,
            yadiskConnected: true,
            yadiskUser: user,
            teacher: state.teacher ? { ...state.teacher, yadiskToken: tokens.access_token } : null,
          };
          notify();
          return true;
        } catch { /* протух refresh тоже — идём в БД */ }
      }
      yadiskStorage.clear(login);
    }

    // 2. Нет токенов локально — тянем refresh_token из БД (другое устройство / новый браузер)
    const authToken = teacher?.authToken || "";
    if (!authToken) return false;
    const tokens = await yadiskOAuth.fetchFromDb(login, authToken);
    if (!tokens) return false;
    yadiskStorage.save(tokens, login);
    state = {
      ...state,
      yadiskConnected: true,
      yadiskUser: tokens.user || null,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: tokens.access_token } : null,
    };
    notify();
    return true;
  },

  /** Сохранить учеников, работы и результаты на Я.Диск учителя. */
  syncToYadisk: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const token = state.teacher?.yadiskToken;
    if (!token) return { ok: false, error: "Я.Диск не подключён" };

    state = { ...state, yadiskSyncing: true };
    notify();
    try {
      await yadisk.ensureFolder(token, ROOT_FOLDER);
      const now = new Date().toISOString();

      await yadisk.uploadText(token, STUDENTS_FILE, JSON.stringify({
        students: state.students, exportedAt: now,
      }, null, 2), true);

      await yadisk.uploadText(token, WORKS_FILE, JSON.stringify({
        works: state.works, exportedAt: now,
      }, null, 2), true);

      await yadisk.uploadText(token, `${ROOT_FOLDER}/results.json`, JSON.stringify({
        results: state.results, exportedAt: now,
      }, null, 2), true);

      state = { ...state, yadiskSyncing: false, yadiskLastSync: now };
      notify();
      return { ok: true };
    } catch (e) {
      state = { ...state, yadiskSyncing: false };
      notify();
      return { ok: false, error: (e as Error).message || "Ошибка синхронизации" };
    }
  },

  /** Загрузить учеников, работы и результаты с Я.Диска учителя. */
  loadFromYadisk: async (): Promise<{ ok: true; studentsCount: number; worksCount: number } | { ok: false; error: string }> => {
    const token = state.teacher?.yadiskToken;
    if (!token) return { ok: false, error: "Я.Диск не подключён" };

    state = { ...state, yadiskSyncing: true };
    notify();
    try {
      let students: Student[] = state.students;
      let works: Work[] = state.works;
      let results: StudentResult[] = state.results;

      try {
        const r = await yadisk.downloadText(token, STUDENTS_FILE);
        const parsed = JSON.parse(r.text);
        if (Array.isArray(parsed.students)) students = parsed.students;
      } catch { /* файла нет — ок */ }

      try {
        const r = await yadisk.downloadText(token, WORKS_FILE);
        const parsed = JSON.parse(r.text);
        if (Array.isArray(parsed.works)) works = parsed.works;
      } catch { /* файла нет — ок */ }

      try {
        const r = await yadisk.downloadText(token, `${ROOT_FOLDER}/results.json`);
        const parsed = JSON.parse(r.text);
        if (Array.isArray(parsed.results)) results = parsed.results;
      } catch { /* файла нет — ок */ }

      // Бэкфилл кода привязки (8 симв.) для учеников без него
      {
        const used = new Set(students.map(s => s.bindCode).filter(Boolean) as string[]);
        const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        students = students.map(s => {
          if (s.bindCode) return s;
          let bc: string;
          do {
            bc = "";
            for (let i = 0; i < 8; i++) bc += ALPHA[Math.floor(Math.random() * ALPHA.length)];
          } while (used.has(bc));
          used.add(bc);
          return { ...s, bindCode: bc };
        });
      }

      state = {
        ...state,
        students,
        works,
        results,
        yadiskSyncing: false,
        yadiskLastSync: new Date().toISOString(),
      };
      notify();
      // Включаем автосохранение только после первой загрузки
      _autoSaveEnabled = true;
      // Синхронизируем коды и результаты в общую БД (для доступа учеников)
      appStore.syncStudentCodesToDb();
      appStore.syncResultsToDb();
      return { ok: true, studentsCount: students.length, worksCount: works.length };
    } catch (e) {
      state = { ...state, yadiskSyncing: false };
      // Включаем автосохранение даже если загрузка не удалась
      _autoSaveEnabled = true;
      notify();
      return { ok: false, error: (e as Error).message || "Ошибка загрузки" };
    }
  },

  // Получить результаты по работе
  getResultsForWork: (workId: string): StudentResult[] => {
    return state.results.filter(r => r.workId === workId);
  },

  // Получить ученика по коду
  getStudentByCode: (code: string): Student | undefined => {
    return state.students.find(s => s.code === code);
  },

  // Экспорт учеников в JSON (для Я.Диска)
  exportStudentsJSON: (): string => {
    return JSON.stringify({ students: state.students, exportedAt: new Date().toISOString() }, null, 2);
  },

  // Импорт учеников из JSON (с Я.Диска)
  importStudentsJSON: (json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data.students)) {
        state = { ...state, students: data.students };
        notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /** Загружает список разделов на техническом обслуживании с сервера. */
  loadMaintenance: async () => {
    try {
      const { sections } = await authApi.getMaintenance();
      state = { ...state, maintenanceSections: sections || [] };
      notify();
    } catch { /* ignore */ }
  },

  /** Обновляет список разделов на ТО (только для admin). */
  setMaintenance: async (sections: string[]): Promise<{ ok: boolean; error?: string }> => {
    const token = state.teacher?.authToken || "";
    try {
      await authApi.setMaintenance(token, sections);
      state = { ...state, maintenanceSections: sections };
      notify();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  /** Учитель: синхронизирует коды учеников в общую БД (для привязки учеников). */
  syncStudentCodesToDb: async (): Promise<void> => {
    const t = state.teacher;
    if (!t || (t.role !== "teacher" && t.role !== "tester")) return;
    const payload = state.students
      .filter(s => s.bindCode && s.code && s.name)
      .map(s => ({
        bindCode: s.bindCode as string,
        studentCode: s.code,
        fullName: s.name,
        classLabel: `${s.classNum}${s.classLetter}`,
      }));
    if (!payload.length) return;
    try {
      const { studentLinkApi } = await import("@/lib/api");
      await studentLinkApi.registerCodes(t.login, payload);
    } catch { /* ignore */ }
  },

  /** Учитель: синхронизирует результаты в общую БД (чтобы ученики видели свои). */
  syncResultsToDb: async (): Promise<void> => {
    const t = state.teacher;
    if (!t || (t.role !== "teacher" && t.role !== "tester")) return;
    if (!state.results.length) return;
    const worksById = new Map(state.works.map(w => [w.id, w]));
    const payload = state.results.map(r => {
      const w = worksById.get(r.workId);
      return {
        studentCode: r.studentCode,
        workId: r.workId,
        workTitle: w ? `${w.type}: ${w.subject}` : "",
        subject: w?.subject || "",
        workDate: w?.date || "",
        correctCount: r.correctCount,
        totalCount: r.totalCount,
        score: r.score,
        grade: r.grade,
        scannedAt: r.scannedAt,
      };
    });
    try {
      const { studentLinkApi } = await import("@/lib/api");
      await studentLinkApi.syncResults(t.login, payload);
    } catch { /* ignore */ }
  },

  /** Загружает скрытые админом разделы ЛК по ролям. */
  loadLkVisibility: async () => {
    try {
      const { hidden } = await authApi.getLkVisibility();
      state = {
        ...state,
        hiddenSections: {
          teacher: hidden.teacher || [],
          student: hidden.student || [],
        },
      };
      notify();
    } catch { /* ignore */ }
  },

  /** Сохраняет скрытые разделы для роли (только admin). */
  setLkVisibility: async (role: "teacher" | "student", hidden: string[]): Promise<{ ok: boolean; error?: string }> => {
    const token = state.teacher?.authToken || "";
    try {
      await authApi.setLkVisibility(token, role, hidden);
      state = { ...state, hiddenSections: { ...state.hiddenSections, [role]: hidden } };
      notify();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

// Хук для использования в компонентах
import { useState, useEffect, useRef } from "react";

export function useAppStore(): AppState {
  const [s, setS] = useState<AppState>(appStore.getState());
  const initialized = useRef(false);

  useEffect(() => {
    // Восстанавливаем Я.Диск после перезагрузки страницы (один раз)
    if (!initialized.current && _restoredTeacher?.role === "teacher") {
      initialized.current = true;
      appStore.restoreYadisk().then((restored) => {
        if (restored) appStore.loadFromYadisk();
      });
    }
    return appStore.subscribe(() => setS({ ...appStore.getState() }));
  }, []);

  return s;
}