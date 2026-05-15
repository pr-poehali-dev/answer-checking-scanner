// API клиент для бэкенда САОУ
const AUTH_URL = "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b";
const BLANK_URL = "https://functions.poehali.dev/5b4fc8cd-8022-458e-acb6-8606c6c8a4f3";
const RECOGNIZE_URL = "https://functions.poehali.dev/de6ae337-82d7-4cc2-ae90-3cf97475be59";
const PRESENTATION_URL = "https://functions.poehali.dev/9aa03e93-715c-41fd-91f4-6d4e79487ed9";
const TEST_URL = "https://functions.poehali.dev/80f9c6ec-e492-47b6-881a-633a41d7e4f4";
const SUBSCRIPTION_URL = "https://functions.poehali.dev/0dc83bdb-3da2-4cb9-b9d9-f0b48cfb25da";

export type UserRole = "admin" | "teacher" | "tester";
export type SubscriptionStatus = "none" | "active" | "expired" | "trial";

export interface SubscriptionInfo {
  subscription_status: SubscriptionStatus;
  subscription_active: boolean;
  subscription_until: string | null;
  trial_active?: boolean;
  trial_expired?: boolean;
  trial_until?: string | null;
  trial_ai_calls_today?: number;
  trial_ai_limit?: number;
}

export interface AuthUser extends SubscriptionInfo {
  role: UserRole;
  login: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  school: string;
  token: string;
}

export interface UserRow extends SubscriptionInfo {
  id: number;
  login: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  school: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  subscription_plan?: string | null;
  last_seen_at?: string | null;
}

async function request<T>(action: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const url = action ? `${AUTH_URL}?action=${action}` : AUTH_URL;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Authorization": token } : {}),
      ...(headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data as T;
}

export const authApi = {
  login: (login: string, password: string) =>
    request<AuthUser>("login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),

  signup: (payload: { first_name: string; last_name: string; email: string; password: string; school?: string }) =>
    request<AuthUser & { id: number; success: boolean }>("signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: (login: string) =>
    request<{ login: string } & SubscriptionInfo>("me", {
      method: "POST",
      body: JSON.stringify({ login }),
    }),

  register: (token: string, payload: { login: string; password: string; full_name: string; school?: string; role?: string }) =>
    request<{ success: boolean; id: number; login: string }>("register", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  grantSubscription: (token: string, payload: { login: string; plan?: string; months?: number; revoke?: boolean }) =>
    request<{ login: string } & SubscriptionInfo & { subscription_plan?: string }>("grant-subscription", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  listUsers: (token: string) =>
    request<{ users: UserRow[] }>("users", { method: "GET", token }),

  toggleUser: (token: string, login: string) =>
    request<{ login: string; is_active: boolean }>("toggle", {
      method: "POST",
      token,
      body: JSON.stringify({ login }),
    }),

  resetPassword: (token: string, login: string, new_password: string) =>
    request<{ success: boolean }>("reset-password", {
      method: "POST",
      token,
      body: JSON.stringify({ login, new_password }),
    }),

  deleteUser: (token: string, login: string) =>
    request<{ success: boolean }>("delete", {
      method: "DELETE",
      token,
      body: JSON.stringify({ login }),
    }),

  updateProfile: (
    token: string,
    payload: {
      login: string;
      first_name: string;
      last_name: string;
      email?: string;
      school?: string;
      current_password?: string;
      new_password?: string;
    }
  ) =>
    request<{ success: boolean; login: string; full_name: string; first_name: string; last_name: string; email?: string; school?: string }>(
      "update-profile",
      { method: "POST", token, body: JSON.stringify(payload) }
    ),

  activateTrial: (login: string) =>
    request<{ success: boolean; trial_active: boolean; trial_until: string; trial_ai_calls_today: number; trial_ai_limit: number }>(
      "activate-trial",
      { method: "POST", body: JSON.stringify({ login }) }
    ),

  checkAiLimit: (login: string) =>
    request<{ allowed: boolean; is_trial?: boolean; trial_ai_calls_today?: number; trial_ai_limit?: number; error?: string }>(
      "check-ai-limit",
      { method: "POST", body: JSON.stringify({ login }) }
    ),

  setRole: (token: string, login: string, role: "teacher" | "tester") =>
    request<{ success: boolean; login: string; role: string }>("set-role", {
      method: "POST",
      token,
      body: JSON.stringify({ login, role }),
    }),

  getMaintenance: () =>
    request<{ sections: string[] }>("maintenance", { method: "GET" }),

  setMaintenance: (token: string, sections: string[]) =>
    request<{ success: boolean; sections: string[] }>("maintenance", {
      method: "POST",
      token,
      body: JSON.stringify({ sections }),
    }),
};

const SYNOPSIS_URL = "https://functions.poehali.dev/c757a5f9-12cd-499d-a66f-79b9f9aeb8d1";

export interface SynopsisResponse {
  text: string;
  word_count: number;
  topic: string;
  subject: string;
  class_num: number;
}

export const synopsisApi = {
  generate: async (
    params: {
      subject: string;
      class_num: number;
      topic: string;
      description?: string;
      teacher_name: string;
      teacher_school: string;
      login?: string;
    },
    onRetry?: (attempt: number) => void,
  ): Promise<SynopsisResponse> => {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 360_000; // 6 минут
    let lastError: Error = new Error("Не удалось создать конспект");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1 && onRetry) onRetry(attempt);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(SYNOPSIS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(data.error || `Ошибка сервера (${res.status})`);
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }
        if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
        return data as SynopsisResponse;
      } catch (e) {
        clearTimeout(timer);
        const err = e as Error;
        if (err.name === "AbortError" || err.message?.includes("network")) {
          lastError = new Error("Превышено время ожидания. Попробуйте ещё раз.");
          if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 2000)); continue; }
        }
        throw err;
      }
    }
    throw lastError;
  },

  updateUrl: (url: string) => {
    (synopsisApi as { _url: string })._url = url;
  },
};

export interface BlankParams {
  workId: string;
  workTitle: string;
  perPage: 1 | 2 | 4;
  questionsCount?: number;
  optionsCount?: number;
  subject?: string;
  classLabel?: string;
  date?: string;
  /** @deprecated use questionsCount */
  part1Count?: number;
  /** @deprecated use questionsCount */
  part2Count?: number;
}

export interface BlankResponse {
  pdf_b64: string;
  filename: string;
  questionsCount: number;
  optionsCount: number;
  options: string[];
}

export const blankApi = {
  generate: async (params: BlankParams): Promise<BlankResponse> => {
    const body = {
      workId:         params.workId,
      workTitle:      params.workTitle,
      perPage:        params.perPage,
      questionsCount: params.questionsCount ?? params.part1Count ?? 20,
      optionsCount:   params.optionsCount   ?? 4,
      subject:        params.subject        ?? "",
      classLabel:     params.classLabel     ?? "",
      date:           params.date           ?? "",
    };
    const res = await fetch(BLANK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка генерации");
    // Поддержка старого поля pdf и нового pdf_b64
    if (!data.pdf_b64 && data.pdf) data.pdf_b64 = data.pdf;
    return data as BlankResponse;
  },

  download: async (params: BlankParams) => {
    const { pdf_b64, filename } = await blankApi.generate(params);
    const bin = atob(pdf_b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export interface RecognizeResponse {
  studentCode: string;
  codeConfidence: number[];
  answers: string[];
  answersConfidence: number[];
  averageConfidence: number;
  questionsCount: number;
  analysis: {
    total: number;
    correct: number;
    wrong: number;
    percent: number;
    details: { q: number; student: string; key: string; correct: boolean }[];
    _dbg?: unknown;
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // 1400px — оптимум для GigaChat: буква в клетке ~35px, читается отлично
        // Итоговый размер base64 ~300-600KB — надёжно проходит за таймаут
        const MAX_SIDE = 1400;
        let { width, height } = img;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const scale = MAX_SIDE / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const idx = dataUrl.indexOf(",");
        resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
      };
      img.onerror = () => reject(new Error("Не удалось обработать изображение"));
      img.src = r;
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export const recognizeApi = {
  recognize: async (file: File, params: { questionsCount?: number; answerKey?: string }) => {
    const image = await fileToBase64(file);
    const res = await fetch(RECOGNIZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        questionsCount: params.questionsCount ?? 40,
        answerKey: params.answerKey ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Ошибка распознавания (${res.status})`);
    }
    return data as RecognizeResponse;
  },

  // Пересчёт по уже распознанным ответам с новым ключом (без изображения)
  reanalyze: async (answers: string[], answerKey: string, studentCode?: string) => {
    const res = await fetch(RECOGNIZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, answerKey, studentCode: studentCode ?? "" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка пересчёта");
    return data as RecognizeResponse;
  },
};

export interface PresentationOutline {
  subtitle: string;
  slides: { title: string; bullets: string[] }[];
  conclusion: string[];
}

export interface PresentationResponse {
  pptx_b64: string;
  filename: string;
  size: number;
  outline: PresentationOutline;
}

export const presentationApi = {
  generate: async (
    params: {
      topic: string;
      description?: string;
      slidesCount?: number;
      audience?: string;
      teacherName: string;
      teacherSchool: string;
      login?: string;
    },
    onRetry?: (attempt: number) => void,
  ): Promise<PresentationResponse> => {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 240_000; // 4 минуты на попытку

    let lastError: Error = new Error("Не удалось создать презентацию");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1 && onRetry) onRetry(attempt);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(PRESENTATION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: params.topic,
            description: params.description ?? "",
            audience: params.audience ?? "",
            slidesCount: params.slidesCount ?? 8,
            teacherName: params.teacherName,
            teacherSchool: params.teacherSchool,
            login: params.login ?? "",
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data.error || `Ошибка генерации (${res.status})`;
          // 429 и 504 — ретраим, остальные — сразу бросаем
          if (res.status === 429 || res.status === 504 || res.status === 502 || res.status === 503) {
            lastError = new Error(msg);
            if (attempt < MAX_ATTEMPTS) {
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
          }
          throw new Error(msg);
        }
        return data as PresentationResponse;
      } catch (e) {
        const err = e as Error;
        // AbortError (наш таймаут 4 мин) или сетевая ошибка — ретраим
        if (err.name === "AbortError" || err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          lastError = new Error("ИИ-сервис не успел ответить — пробуем ещё раз…");
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error("ИИ-сервис не отвечает. Попробуйте ещё раз через несколько минут.");
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError;
  },
};

export type WorkTypeName = "Тест" | "Проверочная работа" | "Контрольная работа";

export interface TestQuestionPart1 {
  question: string;
  options: string[];
  answer: string;
}

export interface TestQuestionPart2 {
  question: string;
  answer: string;
}

export interface TestResponse {
  docx_b64: string;
  filename: string;
  size: number;
  workId: string;
  workType: WorkTypeName;
  subject: string;
  classNum: number;
  topic: string;
  part1Count: number;
  part2Count: number;
  totalQuestions: number;
  answerKey: string;
  maxScore: number;
  gradeScale: { grade1: number; grade2: number; grade3: number; grade4: number; grade5: number };
  questions: { part1: TestQuestionPart1[]; part2: TestQuestionPart2[] };
}

export const testApi = {
  generate: async (params: {
    workType: WorkTypeName;
    subject: string;
    classNum: number;
    topic: string;
    description?: string;
    part1Count: number;
    part2Count: number;
    teacherName: string;
    teacherSchool: string;
    login?: string;
  }): Promise<TestResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(TEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка генерации (${res.status})`);
      return data as TestResponse;
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        throw new Error("Сервис GigaChat сейчас перегружен. Подождите минуту и попробуйте снова.");
      }
      if (err.message.includes("Failed to fetch")) {
        throw new Error("Не удалось связаться с сервером. Проверьте интернет и попробуйте снова через минуту.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── ОГЭ / ЕГЭ по ФИПИ ──────────────────────────────────────────────────────

const EXAM_URL = "https://functions.poehali.dev/c9f3e9b4-4765-416b-a8ed-59f420df43d8";

export interface ExamTask {
  num: number;
  type: string;
  topic: string;
  points: number;
  instruction: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface ExamResponse {
  docx_b64: string;
  answers_docx_b64: string;
  filename: string;
  answers_filename: string;
  examType: "ОГЭ" | "ЕГЭ";
  subject: string;
  variantNum: number;
  totalTasks: number;
  totalPoints: number;
  tasks: ExamTask[];
  size: number;
}

const BATCH_SIZE = 1;
const BATCH_TIMEOUT_MS = 90_000;

async function examFetch(body: object): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);
  try {
    const res = await fetch(EXAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const examApi = {
  getSubjects: async (examType: "ОГЭ" | "ЕГЭ"): Promise<string[]> => {
    const res = await fetch(`${EXAM_URL}?action=subjects&examType=${encodeURIComponent(examType)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки предметов");
    return data.subjects as string[];
  },

  getStructure: async (examType: "ОГЭ" | "ЕГЭ", subject: string) => {
    return await examFetch({ action: "get_structure", examType, subject }) as {
      partsCount: number;
      parts: { num: number; type: string; topic: string; points: number }[];
    };
  },

  generateBatch: async (
    examType: "ОГЭ" | "ЕГЭ",
    subject: string,
    batchIndices: number[],
    login?: string,
  ): Promise<ExamTask[]> => {
    const data = await examFetch({ action: "generate_batch", examType, subject, batchIndices, login }) as { tasks: ExamTask[] };
    return data.tasks;
  },

  buildDocx: async (
    examType: "ОГЭ" | "ЕГЭ",
    subject: string,
    tasks: ExamTask[],
    variantNum: number,
    teacherName: string,
    teacherSchool: string,
  ): Promise<ExamResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(EXAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build_docx", examType, subject, tasks, variantNum, teacherName, teacherSchool }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка сборки документа (${res.status})`);
      return data as ExamResponse;
    } finally {
      clearTimeout(timer);
    }
  },

  generate: async (
    params: {
      examType: "ОГЭ" | "ЕГЭ";
      subject: string;
      teacherName: string;
      teacherSchool: string;
      login?: string;
    },
    onProgress?: (done: number, total: number, stage: string) => void,
  ): Promise<ExamResponse> => {
    const { examType, subject, teacherName, teacherSchool, login } = params;

    onProgress?.(0, 1, "Загружаем структуру экзамена…");
    const structure = await examApi.getStructure(examType, subject);
    const total = structure.partsCount;
    const variantNum = Math.floor(Math.random() * 99) + 1;

    const allTasks: ExamTask[] = [];
    let done = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batchIndices = Array.from({ length: Math.min(BATCH_SIZE, total - i) }, (_, k) => i + k);
      const batchNums = batchIndices.map(idx => structure.parts[idx]?.num).filter(Boolean);
      onProgress?.(done, total, `Задания ${batchNums.join(", ")}…`);

      let batchTasks: ExamTask[] = [];
      let attempts = 0;
      while (attempts < 3) {
        try {
          batchTasks = await examApi.generateBatch(examType, subject, batchIndices, login);
          break;
        } catch {
          attempts++;
          if (attempts >= 3) throw new Error("Не удалось сгенерировать задания после 3 попыток");
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      allTasks.push(...batchTasks);
      done += batchIndices.length;
      onProgress?.(done, total, `Готово: ${done} из ${total}`);
    }

    onProgress?.(done, total, "Собираем документы…");
    return examApi.buildDocx(examType, subject, allTasks, variantNum, teacherName, teacherSchool);
  },
};

// ── Экзамены ФИПИ (без ИИ) ─────────────────────────────────────────────────

const EXAM_BUILDER_URL = "https://functions.poehali.dev/ca0544b0-8a6e-4b75-9bc6-597435d3d225";

export interface ExamBuilderResponse {
  docx_b64: string;
  answers_docx_b64: string;
  filename: string;
  answers_filename: string;
  examType: "ОГЭ" | "ЕГЭ";
  subject: string;
  variantNum: number;
  totalTasks: number;
  totalPoints: number;
  size: number;
}

export const examBuilderApi = {
  getSubjects: async (examType: "ОГЭ" | "ЕГЭ"): Promise<string[]> => {
    const res = await fetch(`${EXAM_BUILDER_URL}?action=subjects&examType=${encodeURIComponent(examType)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки предметов");
    return (data.subjects || []) as string[];
  },

  generate: async (params: {
    examType: "ОГЭ" | "ЕГЭ";
    subject: string;
    teacherName: string;
    teacherSchool: string;
    variantNum?: number;
  }): Promise<ExamBuilderResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(EXAM_BUILDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка генерации (${res.status})`);
      return data as ExamBuilderResponse;
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── Подписки АОУСПТ ────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  code: string;
  name: string;
  amount: number;
  months: number;
  description: string;
  popular: boolean;
}

export interface PaymentRow {
  id: number;
  plan: string;
  amount: number;
  months: number;
  provider: string;
  status: string;
  source: string;
  granted_by: string | null;
  created_at: string;
  paid_at: string | null;
  subscription_until: string | null;
}

async function subRequest<T>(action: string, options: RequestInit & { login?: string } = {}): Promise<T> {
  const { login, headers, ...rest } = options;
  const url = `${SUBSCRIPTION_URL}?action=${action}`;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(login ? { "X-User-Login": login } : {}),
      ...(headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as T;
}

export const subscriptionApi = {
  plans: () =>
    subRequest<{ plans: SubscriptionPlan[]; available: boolean }>("plans", { method: "GET" }),

  create: (login: string, plan: string, return_url: string) =>
    subRequest<{ payment_id: string; confirmation_url: string; status: string; amount: number; plan: string }>(
      "create",
      {
        method: "POST",
        login,
        body: JSON.stringify({ plan, login, return_url }),
      }
    ),

  check: (payment_id: string) =>
    subRequest<{ status: string; subscription_until?: string; subscription_active: boolean }>(
      "check",
      {
        method: "POST",
        body: JSON.stringify({ payment_id }),
      }
    ),

  history: (login: string) =>
    subRequest<{ history: PaymentRow[] }>("history", {
      method: "GET",
      login,
    }),
};