// API клиент для бэкенда АОУСПТ
const AUTH_URL = "https://functions.poehali.dev/b08ae7cf-6c0b-4178-acc9-4b62b2c2a61b";

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

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${AUTH_URL}${path}`, {
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
    request<AuthUser>("/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),

  register: (token: string, payload: { login: string; password: string; full_name: string; school?: string; role?: string }) =>
    request<{ success: boolean; id: number; login: string }>("/register", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  listUsers: (token: string) =>
    request<{ users: UserRow[] }>("/users", { method: "GET", token }),

  toggleUser: (token: string, login: string) =>
    request<{ login: string; is_active: boolean }>("/toggle", {
      method: "POST",
      token,
      body: JSON.stringify({ login }),
    }),

  resetPassword: (token: string, login: string, new_password: string) =>
    request<{ success: boolean }>("/reset-password", {
      method: "POST",
      token,
      body: JSON.stringify({ login, new_password }),
    }),

  deleteUser: (token: string, login: string) =>
    request<{ success: boolean }>("/delete", {
      method: "DELETE",
      token,
      body: JSON.stringify({ login }),
    }),
};
