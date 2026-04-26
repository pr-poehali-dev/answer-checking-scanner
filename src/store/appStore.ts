// Глобальное хранилище приложения АОУСПТ
// Все данные хранятся ТОЛЬКО в памяти браузера и на Яндекс Диске учителя

export interface Teacher {
  login: string;
  name: string;
  school: string;
  yadiskToken: string | null;
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

export type WorkType = "Проверочная работа" | "Контрольная работа";

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

export type AppState = {
  teacher: Teacher | null;
  students: Student[];
  works: Work[];
  results: StudentResult[];
  yadiskConnected: boolean;
};

const DEMO_TEACHER: Teacher = {
  login: "teacher",
  name: "Иванова Наталья Петровна",
  school: "АОУСПТ",
  yadiskToken: null,
};

// Начальное состояние
let state: AppState = {
  teacher: null,
  students: [],
  works: [],
  results: [],
  yadiskConnected: false,
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

  login: (login: string, password: string): boolean => {
    // Простая проверка логин/пароль (в будущем — бэкенд)
    if (login === "teacher" && password === "school2026") {
      state = { ...state, teacher: DEMO_TEACHER };
      notify();
      return true;
    }
    return false;
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

  connectYadisk: (token: string) => {
    state = {
      ...state,
      yadiskConnected: true,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: token } : null,
    };
    notify();
  },

  disconnectYadisk: () => {
    state = {
      ...state,
      yadiskConnected: false,
      teacher: state.teacher ? { ...state.teacher, yadiskToken: null } : null,
    };
    notify();
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
