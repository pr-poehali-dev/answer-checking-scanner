// Клиент для работы с Яндекс.Диском через backend-прокси
const OAUTH_URL = "https://functions.poehali.dev/9eb754b2-58e7-488a-a847-d938764be267";
const PROXY_URL = "https://functions.poehali.dev/6ef07926-3479-451d-b645-5db24ffe7016";

export const ROOT_FOLDER = "АОУСПТ";
export const STUDENTS_FILE = `${ROOT_FOLDER}/students.json`;
export const RESULTS_FOLDER = `${ROOT_FOLDER}/results`;
export const WORKS_FILE = `${ROOT_FOLDER}/works.json`;

export interface YadiskUser {
  login: string | null;
  display_name: string | null;
  default_email: string | null;
}

export interface YadiskTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: YadiskUser;
}

export interface YadiskListItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  modified?: string;
}

function callbackUri(): string {
  return `${window.location.origin}/yadisk-callback`;
}

const LS_AUTH_LOGIN = "aousp_auth_login";
const LS_AUTH_TOKEN = "aousp_auth_token";

export const yadiskOAuth = {
  /** Сохранить данные учителя перед редиректом на Яндекс */
  saveAuthBeforeRedirect: (userLogin: string, authToken: string) => {
    sessionStorage.setItem(LS_AUTH_LOGIN, userLogin);
    sessionStorage.setItem(LS_AUTH_TOKEN, authToken);
  },

  /** Восстановить данные учителя после редиректа */
  loadAuthAfterRedirect: (): { userLogin: string; authToken: string } | null => {
    const userLogin = sessionStorage.getItem(LS_AUTH_LOGIN);
    const authToken = sessionStorage.getItem(LS_AUTH_TOKEN);
    sessionStorage.removeItem(LS_AUTH_LOGIN);
    sessionStorage.removeItem(LS_AUTH_TOKEN);
    if (!userLogin || !authToken) return null;
    return { userLogin, authToken };
  },

  /** Открыть страницу Яндекса для авторизации (через popup или redirect) */
  startAuth: async (state: string = "") => {
    const params = new URLSearchParams({
      action: "auth_url",
      redirect_uri: callbackUri(),
      state,
    });
    const res = await fetch(`${OAUTH_URL}?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Не удалось получить ссылку");
    window.location.href = data.url;
  },

  /** Обменять полученный code на токены + привязать к ЛК */
  exchange: async (code: string, userLogin: string, authToken: string): Promise<YadiskTokens> => {
    const res = await fetch(`${OAUTH_URL}?action=exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: callbackUri(), user_login: userLogin, auth_token: authToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Не удалось получить токен");
      (err as Error & { conflict?: boolean; yadisk_login?: string }).conflict = data.conflict || false;
      (err as Error & { conflict?: boolean; yadisk_login?: string }).yadisk_login = data.yadisk_login || "";
      throw err;
    }
    return data as YadiskTokens;
  },

  /** Получить refresh_token из БД и обменять на живой access_token (для новых устройств) */
  fetchFromDb: async (userLogin: string, authToken: string): Promise<YadiskTokens | null> => {
    try {
      const params = new URLSearchParams({ action: "get-yadisk-token", user_login: userLogin, auth_token: authToken });
      const res = await fetch(`${OAUTH_URL}?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.refresh_token) return null;
      const tokens = await yadiskOAuth.refresh(data.refresh_token);
      tokens.refresh_token = tokens.refresh_token || data.refresh_token;
      if (data.yadisk_login) {
        tokens.user = { login: data.yadisk_login, display_name: data.yadisk_login, default_email: null };
      }
      return tokens;
    } catch {
      return null;
    }
  },

  /** Обновить access_token по refresh_token */
  refresh: async (refresh_token: string): Promise<YadiskTokens> => {
    const res = await fetch(`${OAUTH_URL}?action=refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Не удалось обновить токен");
    return data as YadiskTokens;
  },
};

async function proxyRequest<T>(action: string, options: { method: "GET" | "POST"; token: string; query?: Record<string, string>; body?: unknown }): Promise<T> {
  const params = new URLSearchParams({ action, ...(options.query || {}) });
  const res = await fetch(`${PROXY_URL}?${params}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      "X-Yadisk-Token": options.token,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка Я.Диска (${res.status})`);
  return data as T;
}

export const yadisk = {
  ensureFolder: (token: string, path: string) =>
    proxyRequest<{ ok: boolean; path: string }>("ensure_folder", {
      method: "POST", token, body: { path },
    }),

  uploadText: (token: string, path: string, text: string, overwrite: boolean = true) =>
    proxyRequest<{ ok: boolean; path: string; size: number }>("upload_text", {
      method: "POST", token, body: { path, text, overwrite },
    }),

  uploadBinary: (token: string, path: string, content_b64: string, overwrite: boolean = true) =>
    proxyRequest<{ ok: boolean; path: string; size: number }>("upload", {
      method: "POST", token, body: { path, content_b64, overwrite },
    }),

  downloadText: (token: string, path: string) =>
    proxyRequest<{ text: string; path: string }>("download_text", {
      method: "GET", token, query: { path },
    }),

  downloadBinary: (token: string, path: string) =>
    proxyRequest<{ content_b64: string; path: string; size: number }>("download", {
      method: "GET", token, query: { path },
    }),

  list: (token: string, path: string) =>
    proxyRequest<{ items: YadiskListItem[]; exists: boolean }>("list", {
      method: "GET", token, query: { path },
    }),

  delete: (token: string, path: string) =>
    proxyRequest<{ ok: boolean }>("delete", {
      method: "POST", token, body: { path },
    }),

  /** Проверка валидности токена через попытку получить список корня АОУСПТ */
  ping: async (token: string): Promise<boolean> => {
    try {
      await proxyRequest("list", { method: "GET", token, query: { path: "/" } });
      return true;
    } catch {
      return false;
    }
  },
};

// localStorage helpers — токен привязан к логину учителя
// Ключи содержат логин, чтобы разные ЛК не мешали друг другу

function lsKeys(login: string) {
  const slug = login.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return {
    access:  `aousp_yadisk_access_${slug}`,
    refresh: `aousp_yadisk_refresh_${slug}`,
    user:    `aousp_yadisk_user_${slug}`,
  };
}

/** Удаляет старые ключи без суффикса (миграция со старого формата). */
function clearLegacyKeys() {
  localStorage.removeItem("aousp_yadisk_access");
  localStorage.removeItem("aousp_yadisk_refresh");
  localStorage.removeItem("aousp_yadisk_user");
}

export const yadiskStorage = {
  save: (tokens: YadiskTokens, login: string) => {
    clearLegacyKeys();
    const k = lsKeys(login);
    localStorage.setItem(k.access, tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem(k.refresh, tokens.refresh_token);
    if (tokens.user) localStorage.setItem(k.user, JSON.stringify(tokens.user));
  },
  load: (login: string): { access: string | null; refresh: string | null; user: YadiskUser | null } => {
    const k = lsKeys(login);
    const access = localStorage.getItem(k.access);
    const refresh = localStorage.getItem(k.refresh);
    const userRaw = localStorage.getItem(k.user);
    let user: YadiskUser | null = null;
    if (userRaw) {
      try { user = JSON.parse(userRaw); } catch { user = null; }
    }
    return { access, refresh, user };
  },
  clear: (login: string) => {
    clearLegacyKeys();
    const k = lsKeys(login);
    localStorage.removeItem(k.access);
    localStorage.removeItem(k.refresh);
    localStorage.removeItem(k.user);
  },
};