// Лёгкий доступ к сессии учителя/ученика для публичной страницы материалов
const SESSION_KEY = "aousp_session_v1";

export interface MaterialsSession {
  login: string;
  token: string;
  role: string;
  name: string;
  subscriptionActive: boolean;
}

export function getMaterialsSession(): MaterialsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.authToken || !d.login) return null;
    return {
      login: d.login,
      token: d.authToken,
      role: d.role || "teacher",
      name: d.name || d.login,
      subscriptionActive: !!d.subscriptionActive,
    };
  } catch {
    return null;
  }
}
