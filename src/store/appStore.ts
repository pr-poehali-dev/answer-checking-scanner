// Глобальное хранилище приложения АОУСПТ
// Все данные хранятся ТОЛЬКО в памяти браузера и на Яндекс Диске учителя
import { authApi } from "@/lib/api";
import { yadisk, yadiskStorage, ROOT_FOLDER, STUDENTS_FILE, WORKS_FILE, type YadiskUser } from "@/lib/yadisk";

export type UserRole = "admin" | "teacher";

export type SubscriptionStatus = "none" | "active" | "expired";

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
}

export interface Student {
  code: string; // 5-значный код
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

export type AppState = {
  teacher: Teacher | null;
  students: Student[];
  works: Work[];
  results: StudentResult[];
  presentations: PresentationItem[];
  generatedTests: GeneratedTestItem[];
  yadiskConnected: boolean;
  yadiskUser: YadiskUser | null;
  yadiskSyncing: boolean;
  yadiskLastSync: string | null;
};

// Начальное состояние
let state: AppState = {
  teacher: null,
  students: [],
  works: [],
  results: [],
  presentations: [],
  generatedTests: [],
  yadiskConnected: false,
  yadiskUser: null,
  yadiskSyncing: false,
  yadiskLastSync: null,
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
      state = {
        ...state,
        teacher: {
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
        },
      };
      notify();
      if (user.role === "teacher") {
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

  signup: async (payload: { first_name: string; last_name: string; email: string; password: string }): Promise<
    { ok: true; role: UserRole; login: string } | { ok: false; error: string }
  > => {
    try {
      const user = await authApi.signup(payload);
      state = {
        ...state,
        teacher: {
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
        },
      };
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
      state = {
        ...state,
        teacher: {
          ...state.teacher,
          subscriptionStatus: data.subscription_status,
          subscriptionActive: !!data.subscription_active,
          subscriptionUntil: data.subscription_until,
        },
      };
      notify();
    } catch (e) {
      console.warn("refreshSubscription failed:", e);
    }
  },

  logout: () => {
    state = { ...state, teacher: null };
    notify();
  },

  addStudent: (student: Student) => {
    state = { ...state, students: [...state.students, student] };
    notify();
  },

  updateStudent: (code: string, updated: Partial<Student>) => {
    state = {
      ...state,
      students: state.students.map(s => s.code === code ? { ...s, ...updated } : s),
    };
    notify();
  },

  removeStudent: (code: string) => {
    state = { ...state, students: state.students.filter(s => s.code !== code) };
    notify();
  },

  setStudents: (students: Student[]) => {
    state = { ...state, students };
    notify();
  },

  generateStudentCode: (): string => {
    const used = new Set(state.students.map(s => s.code));
    let code: string;
    do {
      code = String(Math.floor(10000 + Math.random() * 90000));
    } while (used.has(code));
    return code;
  },

  addWork: (work: Work) => {
    state = { ...state, works: [...state.works, work] };
    notify();
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

  connectYadisk: (token: string, user: YadiskUser | null = null) => {
    state = {
      ...state,
      yadiskConnected: true,
      yadiskUser: user,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: token } : null,
    };
    notify();
  },

  disconnectYadisk: () => {
    yadiskStorage.clear();
    state = {
      ...state,
      yadiskConnected: false,
      yadiskUser: null,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: null } : null,
    };
    notify();
  },

  /** Восстанавливает подключение Я.Диска из localStorage (вызывать после login). */
  restoreYadisk: async (): Promise<boolean> => {
    const { access, user } = yadiskStorage.load();
    if (!access) return false;
    const ok = await yadisk.ping(access);
    if (!ok) {
      yadiskStorage.clear();
      return false;
    }
    state = {
      ...state,
      yadiskConnected: true,
      yadiskUser: user,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: access } : null,
    };
    notify();
    return true;
  },

  /** Сохранить учеников и работы на Я.Диск учителя. */
  syncToYadisk: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const token = state.teacher?.yadiskToken;
    if (!token) return { ok: false, error: "Я.Диск не подключён" };

    state = { ...state, yadiskSyncing: true };
    notify();
    try {
      await yadisk.ensureFolder(token, ROOT_FOLDER);
      const studentsJson = JSON.stringify({
        students: state.students,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      await yadisk.uploadText(token, STUDENTS_FILE, studentsJson, true);
      const worksJson = JSON.stringify({
        works: state.works,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      await yadisk.uploadText(token, WORKS_FILE, worksJson, true);
      state = { ...state, yadiskSyncing: false, yadiskLastSync: new Date().toISOString() };
      notify();
      return { ok: true };
    } catch (e) {
      state = { ...state, yadiskSyncing: false };
      notify();
      return { ok: false, error: (e as Error).message || "Ошибка синхронизации" };
    }
  },

  /** Загрузить учеников и работы с Я.Диска учителя. */
  loadFromYadisk: async (): Promise<{ ok: true; studentsCount: number; worksCount: number } | { ok: false; error: string }> => {
    const token = state.teacher?.yadiskToken;
    if (!token) return { ok: false, error: "Я.Диск не подключён" };

    state = { ...state, yadiskSyncing: true };
    notify();
    try {
      let students: Student[] = state.students;
      let works: Work[] = state.works;

      try {
        const r = await yadisk.downloadText(token, STUDENTS_FILE);
        const parsed = JSON.parse(r.text);
        if (Array.isArray(parsed.students)) students = parsed.students;
      } catch {
        // файла может не быть — игнорируем
      }
      try {
        const r = await yadisk.downloadText(token, WORKS_FILE);
        const parsed = JSON.parse(r.text);
        if (Array.isArray(parsed.works)) works = parsed.works;
      } catch {
        // файла может не быть — игнорируем
      }

      state = {
        ...state,
        students,
        works,
        yadiskSyncing: false,
        yadiskLastSync: new Date().toISOString(),
      };
      notify();
      return { ok: true, studentsCount: students.length, worksCount: works.length };
    } catch (e) {
      state = { ...state, yadiskSyncing: false };
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
};

// Хук для использования в компонентах
import { useState, useEffect } from "react";

export function useAppStore(): AppState {
  const [s, setS] = useState<AppState>(appStore.getState());
  useEffect(() => {
    return appStore.subscribe(() => setS({ ...appStore.getState() }));
  }, []);
  return s;
}