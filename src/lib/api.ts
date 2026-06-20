// API клиент для бэкенда САОУ
const AUTH_URL = "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b";
const INSTITUTION_URL = "https://functions.poehali.dev/4e675776-f4dc-4df7-95ce-0dbf2cfbf6d4";
const BLANK_URL = "https://functions.poehali.dev/5b4fc8cd-8022-458e-acb6-8606c6c8a4f3";
const RECOGNIZE_URL = "https://functions.poehali.dev/de6ae337-82d7-4cc2-ae90-3cf97475be59";
const PRESENTATION_URL = "https://functions.poehali.dev/9aa03e93-715c-41fd-91f4-6d4e79487ed9";
const TEST_URL = "https://functions.poehali.dev/80f9c6ec-e492-47b6-881a-633a41d7e4f4";
const SUBSCRIPTION_URL = "https://functions.poehali.dev/0dc83bdb-3da2-4cb9-b9d9-f0b48cfb25da";
const STUDENT_LINK_URL = "https://functions.poehali.dev/23f6c20d-f0bd-4bfb-84fe-75c97564d076";
const UDS_URL = "https://functions.poehali.dev/3f54b399-3af0-45fa-a2b6-0736484f6059";

export type UserRole = "admin" | "teacher" | "tester" | "student";
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
  ai_balance_kopecks?: number;
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

  signup: (payload: { first_name: string; last_name: string; email: string; password: string; school?: string; role?: "teacher" | "student"; study_group?: string }) =>
    request<AuthUser & { id: number; success: boolean }>("signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getLkVisibility: () =>
    request<{ hidden: { teacher: string[]; student: string[] } }>("lk-visibility", { method: "GET" }),

  setLkVisibility: (token: string, role: "teacher" | "student", hidden: string[]) =>
    request<{ success: boolean; role: string; hidden: string[] }>("lk-visibility", {
      method: "POST",
      token,
      body: JSON.stringify({ role, hidden }),
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

  addTokens: (token: string, login: string, amount: number) =>
    request<{ ok: boolean; balance: number }>("add-tokens", {
      method: "POST",
      token,
      body: JSON.stringify({ login, amount }),
    }),

  getMaintenance: () =>
    request<{ sections: string[] }>("maintenance", { method: "GET" }),

  setMaintenance: (token: string, sections: string[]) =>
    request<{ success: boolean; sections: string[] }>("maintenance", {
      method: "POST",
      token,
      body: JSON.stringify({ sections }),
    }),

  getCollectiveByToken: (token: string, login: string) => {
    const url = `${AUTH_URL}?action=collective-by-token&login=${encodeURIComponent(login)}`;
    return fetch(url, { headers: { "X-Authorization": token } })
      .then(r => r.json())
      .then(d => d as { members: { full_name: string; position: string; position_label: string; subject: string | null }[]; has_institution: boolean });
  },

  getTokenLogs: (login: string, limit = 20) => {
    const url = `${AUTH_URL}?action=token-logs&login=${encodeURIComponent(login)}&limit=${limit}`;
    return fetch(url)
      .then(r => r.json())
      .then(d => d as { logs: { action: string; tokens: number; amount_rub: number; balance_rub_after: number; created_at: string }[] });
  },
};

// ── Student Link API (привязка учеников по коду и их результаты) ───────────────

export interface StudentResultRow {
  workId: string;
  workTitle: string | null;
  subject: string | null;
  workDate: string | null;
  correctCount: number;
  totalCount: number;
  score: number;
  grade: string | null;
  scannedAt: string | null;
}

async function slRequest<T>(action: string, method: string, login: string, body?: object): Promise<T> {
  const isGet = method === "GET";
  const url = isGet
    ? `${STUDENT_LINK_URL}?action=${action}&login=${encodeURIComponent(login)}`
    : `${STUDENT_LINK_URL}?action=${action}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-User-Login": login },
    ...(isGet ? {} : { body: JSON.stringify({ login, ...(body || {}) }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as T;
}

export const studentLinkApi = {
  // Учитель: регистрирует коды учеников в БД
  registerCodes: (teacherLogin: string, students: { bindCode: string; studentCode: string; fullName: string; classLabel: string }[]) =>
    slRequest<{ success: boolean; saved: number }>("register-codes", "POST", teacherLogin, { students }),

  // Учитель: синхронизирует результаты
  syncResults: (teacherLogin: string, results: object[]) =>
    slRequest<{ success: boolean; saved: number }>("sync-results", "POST", teacherLogin, { results }),

  // Ученик: привязка по 8-символьному коду
  bind: (studentLogin: string, bindCode: string) =>
    slRequest<{ success: boolean; full_name: string; class_label: string | null }>("bind", "POST", studentLogin, { bindCode }),

  // Ученик: текущая привязка
  myBinding: (studentLogin: string) =>
    slRequest<{ bound: boolean; bind_code?: string; full_name?: string; class_label?: string | null; teacher_login?: string }>("my-binding", "GET", studentLogin),

  // Ученик: свои результаты
  myResults: (studentLogin: string) =>
    slRequest<{ bound: boolean; results: StudentResultRow[] }>("my-results", "GET", studentLogin),
};

// ── УДС API (Управление Движения Системы) ──────────────────────────────────────

export interface UdsPerms {
  can_register: boolean;
  can_assign_roles: string[];
  can_tokens: boolean;
  can_lkview: boolean;
  can_maintenance: boolean;
  can_subscription: boolean;
  can_support: boolean;
  can_block: boolean;
}

export interface UdsEmployee {
  login: string;
  panel_role: string;
  panel_role_label: string;
  operator_number: number;
  assigned_by: string | null;
  assigned_at: string;
  uds_registered: boolean;
  phone: string | null;
  email: string | null;
  iis_code: string | null;
  full_name: string;
  is_active: boolean;
  last_seen_at: string | null;
}

export interface UdsAuditEntry {
  actor_login: string;
  actor_role: string | null;
  action: string;
  target_login: string | null;
  details: string | null;
  created_at: string;
}

export interface UdsUser {
  login: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  subscription_status: string;
  subscription_until: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  created_by: string | null;
  study_group: string | null;
  panel_role: string | null;
  bound: boolean;
  bind_code: string | null;
}

async function udsRequest<T>(action: string, method: string, login: string, token: string, body?: object, query?: Record<string, string>): Promise<T> {
  const isGet = method === "GET";
  const qs = new URLSearchParams({ action });
  if (isGet) { qs.set("login", login); Object.entries(query || {}).forEach(([k, v]) => qs.set(k, v)); }
  const res = await fetch(`${UDS_URL}?${qs.toString()}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Authorization": token },
    ...(isGet ? {} : { body: JSON.stringify({ login, ...(body || {}) }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as T;
}

export const udsApi = {
  login: (loginName: string, password: string) =>
    fetch(`${UDS_URL}?action=uds-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginName, password }),
    }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Ошибка ${r.status}`);
      return d as { ok: boolean; login: string; token: string; panel_role: string; panel_role_label: string; operator_number: number; perms: UdsPerms };
    }),

  me: (login: string, token: string) =>
    udsRequest<{ login: string; panel_role: string | null; panel_role_label: string | null; operator_number: number | null; is_panel: boolean; uds_registered: boolean; uds_access: boolean; perms: UdsPerms | null }>("me", "GET", login, token),

  employees: (login: string, token: string) =>
    udsRequest<{ employees: UdsEmployee[] }>("employees", "GET", login, token),

  employee: (login: string, token: string, targetLogin: string) =>
    udsRequest<{ employee: UdsEmployee; logs: UdsAuditEntry[] }>("employee", "GET", login, token, undefined, { target_login: targetLogin }),

  registerEmployee: (login: string, token: string, payload: { first_name: string; last_name: string; middle_name?: string; email?: string; phone?: string; panel_role: string }) =>
    udsRequest<{ ok: boolean; login: string; password: string; iis_code: string; operator_number: number; full_name: string; panel_role: string }>("register-employee", "POST", login, token, payload),

  setRole: (login: string, token: string, targetLogin: string, panelRole: string) =>
    udsRequest<{ ok: boolean }>("set-role", "POST", login, token, { target_login: targetLogin, panel_role: panelRole }),

  block: (login: string, token: string, targetLogin: string, blocked: boolean) =>
    udsRequest<{ ok: boolean }>("block", "POST", login, token, { target_login: targetLogin, blocked }),

  auditLog: (login: string, token: string, targetLogin?: string) =>
    udsRequest<{ logs: UdsAuditEntry[] }>("audit-log", "GET", login, token, undefined, targetLogin ? { target_login: targetLogin } : {}),

  users: (login: string, token: string, q?: string) =>
    udsRequest<{ users: UdsUser[] }>("users", "GET", login, token, undefined, q ? { q } : {}),

  updateProfile: (login: string, token: string, payload: { current_password: string; new_login?: string; new_password?: string }) =>
    udsRequest<{ ok: boolean; login: string; token: string }>("update-profile", "POST", login, token, payload),
};

// ── Institution API ───────────────────────────────────────────────────────────

async function instRequest<T>(action: string, options: { method?: string; body?: object; authLogin?: string; authPassword?: string } = {}): Promise<T> {
  const { method = "GET", body, authLogin, authPassword } = options;
  const qs = new URLSearchParams({ action });
  if (method === "GET" && authLogin) {
    qs.set("auth_login", authLogin);
    qs.set("auth_password", authPassword || "");
  }
  const res = await fetch(`${INSTITUTION_URL}?${qs.toString()}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as T;
}

export interface InstitutionStaff {
  id: number;
  login: string;
  full_name: string;
  position: string;
  position_label: string;
  subject: string | null;
  is_active: boolean;
  created_at: string | null;
}

export const institutionApi = {
  register: (payload: {
    name: string; region: string; inn: string;
    director_full_name: string; vice_director_full_name: string;
    admin_login: string; admin_password: string; admin_ou_role: string; email: string;
  }) => instRequest<{ success: boolean; user_id: number; institution_id: number; login: string; full_name: string; role: string; institution_position: string; institution_name: string; token: string }>(
    "register-institution", { method: "POST", body: payload }
  ),

  login: (login: string, password: string) =>
    instRequest<{ success: boolean; id: number; login: string; full_name: string; first_name?: string; last_name?: string; role: string; institution_id: number; institution_position: string; subject?: string; institution_name: string; token: string; is_manager: boolean }>(
      "login-institution", { method: "POST", body: { login, password } }
    ),

  createStaff: (authLogin: string, authPassword: string, payload: {
    full_name: string; login: string; password: string; position: string; subject?: string;
  }) => instRequest<{ success: boolean; id: number; login: string; full_name: string; position: string; subject?: string | null }>(
    "create-staff", { method: "POST", body: { auth_login: authLogin, auth_password: authPassword, ...payload } }
  ),

  getStaff: (authLogin: string, authPassword: string) =>
    instRequest<{ staff: InstitutionStaff[]; institution_id: number }>(
      "staff", { method: "GET", authLogin, authPassword }
    ),

  deleteStaff: (authLogin: string, authPassword: string, staffId: number) =>
    instRequest<{ success: boolean }>(
      "delete-staff", { method: "POST", body: { auth_login: authLogin, auth_password: authPassword, staff_id: staffId } }
    ),

  updateStaff: (authLogin: string, authPassword: string, staffId: number, payload: {
    full_name: string; position: string; subject?: string; new_password?: string;
  }) => instRequest<{ success: boolean }>(
    "update-staff", { method: "POST", body: { auth_login: authLogin, auth_password: authPassword, staff_id: staffId, ...payload } }
  ),

  getCollective: (authLogin: string, authPassword: string) =>
    instRequest<{ members: { full_name: string; position: string; position_label: string; subject: string | null }[] }>(
      "collective", { method: "GET", authLogin, authPassword }
    ),
};

const SYNOPSIS_URL = "https://functions.poehali.dev/c757a5f9-12cd-499d-a66f-79b9f9aeb8d1";

export interface SynopsisResponse {
  text: string;
  word_count: number;
  topic: string;
  subject: string;
  class_num: number;
  docx_b64?: string;
  filename?: string;
  spent_rub?: number;
  balance_rub?: number;
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

export interface BlankStudent {
  code: string;       // 5-значный код (зашивается в QR)
  name: string;       // ФИО (печатается готовым)
  classLabel?: string;
}

export interface BlankParams {
  workId: string;
  workTitle: string;
  perPage: 1 | 2 | 4;
  questionsCount?: number;
  optionsCount?: number;
  subject?: string;
  classLabel?: string;
  date?: string;
  students?: BlankStudent[];   // персональные бланки с QR
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
      students:       params.students       ?? [],
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
  spent_rub?: number;
  balance_rub?: number;
  /** Полная структура (с фактами/запросами фото) — для повторной сборки дизайна */
  rawOutline?: object;
}

async function fetchWithTimeout(url: string, body: object, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const presentationApi = {
  /** Прогревает GigaChat-токен заранее, чтобы outline-запрос не тратил на него 15-20 сек */
  warmup: () => {
    fetch(`${PRESENTATION_URL}?action=warmup`).catch(() => {});
  },

  generate: async (
    params: {
      topic: string;
      description?: string;
      slidesCount?: number;
      audience?: string;
      teacherName: string;
      teacherSchool: string;
      login?: string;
      customDesign?: boolean;
    },
    onStage?: (stage: string) => void,
  ): Promise<PresentationResponse> => {
    const topic = params.topic;
    const commonBody = {
      topic,
      description: params.description ?? "",
      audience: params.audience ?? "",
      slidesCount: params.slidesCount ?? 8,
      teacherName: params.teacherName,
      teacherSchool: params.teacherSchool,
      login: params.login ?? "",
      customDesign: params.customDesign ?? false,
    };

    // ── Шаг 1: получаем структуру от GigaChat (до 85 сек) ────────────────
    onStage?.("ИИ генерирует структуру презентации…");
    let outlineData: { outline: object; theme_name: string; theme_payload?: object | null; topic: string; spent_rub?: number; balance_rub?: number };
    try {
      const res1 = await fetchWithTimeout(
        `${PRESENTATION_URL}?action=outline`,
        commonBody,
        580_000, // 580 сек — таймаут платформы 600 сек
      );
      const d1 = await res1.json().catch(() => ({}));
      if (!res1.ok) {
        const msg = d1.error || `Ошибка генерации структуры (${res1.status})`;
        if (res1.status === 504 || res1.status === 502 || res1.status === 503) {
          throw new Error("ИИ-сервис GigaChat не успел ответить. Попробуйте ещё раз или уменьшите количество слайдов.");
        }
        throw new Error(msg);
      }
      outlineData = d1;
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError" || err.message.includes("Failed to fetch")) {
        throw new Error("ИИ-сервис не ответил. Попробуйте ещё раз или уменьшите количество слайдов.");
      }
      throw err;
    }

    // ── Шаг 2: скачиваем фото и собираем PPTX (до 25 сек) ───────────────
    onStage?.("Подбираем фотографии и собираем файл…");
    try {
      const res2 = await fetchWithTimeout(
        `${PRESENTATION_URL}?action=build`,
        {
          topic,
          teacherName: params.teacherName,
          teacherSchool: params.teacherSchool,
          outline: outlineData.outline,
          theme_name: outlineData.theme_name,
          theme_payload: outlineData.theme_payload ?? null,
        },
        30_000, // 30 сек — фото + сборка PPTX
      );
      const d2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(d2.error || `Ошибка сборки PPTX (${res2.status})`);
      const pptxResult = d2 as PresentationResponse;
      pptxResult.spent_rub = outlineData.spent_rub;
      pptxResult.balance_rub = outlineData.balance_rub;
      pptxResult.rawOutline = outlineData.outline;
      return pptxResult;
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError" || err.message.includes("Failed to fetch")) {
        throw new Error("Не удалось собрать файл презентации. Попробуйте ещё раз.");
      }
      throw err;
    }
  },

  /**
   * Пересобирает презентацию с НОВЫМ индивидуальным дизайном, используя уже
   * готовую структуру (без повторного обращения к ИИ — быстро и без списания токенов).
   */
  redesign: async (params: {
    topic: string;
    teacherName: string;
    teacherSchool: string;
    rawOutline: object;
    designVariant: number;
  }): Promise<PresentationResponse> => {
    const res = await fetchWithTimeout(
      `${PRESENTATION_URL}?action=build`,
      {
        topic: params.topic,
        teacherName: params.teacherName,
        teacherSchool: params.teacherSchool,
        outline: params.rawOutline,
        regenDesign: true,
        designVariant: params.designVariant,
      },
      30_000,
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || `Ошибка обновления дизайна (${res.status})`);
    const result = d as PresentationResponse;
    result.rawOutline = params.rawOutline;
    return result;
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
  spent_rub?: number;
  balance_rub?: number;
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
  spent_rub?: number;
  balance_rub?: number;
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(login ? { "X-User-Login": login } : {}),
        ...(headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
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

  buyTokens: (login: string, amount_rub: number, return_url: string) =>
    subRequest<{ payment_id: string; confirmation_url: string; status: string; amount_rub: number }>(
      "buy-tokens",
      {
        method: "POST",
        login,
        body: JSON.stringify({ login, amount_rub, return_url }),
      }
    ),

  checkTokens: (payment_id: string) =>
    subRequest<{ status: string; amount_rub?: number; ai_balance_kopecks?: number; ai_balance_rub?: number }>(
      "check-tokens",
      {
        method: "POST",
        body: JSON.stringify({ payment_id }),
      }
    ),
};

// ── Тех.поддержка ────────────────────────────────────────────────────────────

const SUPPORT_URL = "https://functions.poehali.dev/dba2d455-f3eb-4ea1-8f0f-3e3404670875";

export interface SupportTicket {
  id: number;
  login: string;
  section: string;
  subject: string;
  status: "open" | "taken" | "closed";
  operator_login: string | null;
  operator_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_login: string;
  sender_role: "user" | "operator" | "system";
  body: string;
  created_at: string;
}

export interface PanelOperator {
  login: string;
  panel_role: string;
  panel_role_label: string;
  operator_number: number;
  assigned_by: string | null;
  assigned_at: string;
  full_name: string;
}

async function supReq<T>(
  action: string,
  options: { method?: string; body?: object; login: string; token: string; qs?: Record<string, string> } = { login: "", token: "" }
): Promise<T> {
  const { method = "GET", body, login, token, qs = {} } = options;
  // login всегда передаём в query string — для GET он не попадает в body
  const params = new URLSearchParams({ action, login, ...qs });
  const res = await fetch(`${SUPPORT_URL}?${params.toString()}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
    },
    ...(body ? { body: JSON.stringify({ ...body, login }) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`);
  return data as T;
}

export const supportApi = {
  createTicket: (login: string, token: string, section: string, subject: string, body: string) =>
    supReq<{ ok: boolean; ticket_id: number }>("create-ticket", {
      method: "POST", login, token,
      body: { section, subject, body },
    }),

  myTickets: (login: string, token: string) =>
    supReq<{ tickets: SupportTicket[] }>("my-tickets", { login, token }),

  ticketMessages: (login: string, token: string, ticket_id: number) =>
    supReq<{ ticket: SupportTicket; messages: SupportMessage[] }>("ticket-messages", {
      login, token, qs: { ticket_id: String(ticket_id) },
    }),

  sendMessage: (login: string, token: string, ticket_id: number, body: string) =>
    supReq<{ ok: boolean }>("send-message", {
      method: "POST", login, token,
      body: { ticket_id, body },
    }),

  // Операторские
  allTickets: (login: string, token: string, status = "open") =>
    supReq<{ tickets: SupportTicket[] }>("all-tickets", { login, token, qs: { status } }),

  takeTicket: (login: string, token: string, ticket_id: number) =>
    supReq<{ ok: boolean; operator_number: number }>("take-ticket", {
      method: "POST", login, token, body: { ticket_id },
    }),

  closeTicket: (login: string, token: string, ticket_id: number) =>
    supReq<{ ok: boolean }>("close-ticket", {
      method: "POST", login, token, body: { ticket_id },
    }),

  opSendMessage: (login: string, token: string, ticket_id: number, body: string) =>
    supReq<{ ok: boolean }>("op-send-message", {
      method: "POST", login, token, body: { ticket_id, body },
    }),

  operators: (login: string, token: string) =>
    supReq<{ operators: PanelOperator[] }>("operators", { login, token }),

  assignOperator: (login: string, token: string, target_login: string, panel_role: string) =>
    supReq<{ ok: boolean }>("assign-operator", {
      method: "POST", login, token, body: { target_login, panel_role },
    }),

  removeOperator: (login: string, token: string, target_login: string) =>
    supReq<{ ok: boolean }>("remove-operator", {
      method: "POST", login, token, body: { target_login },
    }),
};