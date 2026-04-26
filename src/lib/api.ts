// API клиент для бэкенда АОУСПТ
const AUTH_URL = "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b";
const BLANK_URL = "https://functions.poehali.dev/5b4fc8cd-8022-458e-acb6-8606c6c8a4f3";
const RECOGNIZE_URL = "https://functions.poehali.dev/de6ae337-82d7-4cc2-ae90-3cf97475be59";

export interface AuthUser {
  role: "admin" | "teacher";
  login: string;
  full_name: string;
  school: string;
  token: string;
}

export interface UserRow {
  id: number;
  login: string;
  full_name: string;
  school: string;
  role: string;
  is_active: boolean;
  created_at: string;
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

  register: (token: string, payload: { login: string; password: string; full_name: string; school?: string; role?: string }) =>
    request<{ success: boolean; id: number; login: string }>("register", {
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
};

export const blankApi = {
  generate: async (params: { workId: string; workTitle: string; perPage: 1 | 2 | 4; questionsCount?: number }) => {
    const res = await fetch(BLANK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка генерации");
    return data as { pdf: string; filename: string; size: number };
  },

  download: async (params: { workId: string; workTitle: string; perPage: 1 | 2 | 4; questionsCount?: number }) => {
    const { pdf, filename } = await blankApi.generate(params);
    const bin = atob(pdf);
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
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      // убираем "data:image/...;base64,"
      const idx = r.indexOf(",");
      resolve(idx >= 0 ? r.slice(idx + 1) : r);
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
};