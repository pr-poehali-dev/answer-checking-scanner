import { UdsPerms } from "@/lib/api";

export const PANEL_ROLE_LABELS: Record<string, string> = {
  head: "Глава Правления",
  deputy: "Зам. Главы Правления",
  developer: "Разработчик",
  tester_role: "Тестер",
  advisor: "Советник",
  operator: "Оператор ТП",
};

export const SUBROLE_LABELS: Record<string, string> = {
  curator: "Куратор",
  manager: "Менеджер",
};

export interface Session {
  login: string;
  token: string;
  panel_role: string;
  panel_role_label: string;
  operator_number: number;
  perms: UdsPerms;
  subrole_label?: string | null;
  curator_name?: string | null;
  pending_transfers?: number;
}

export const LS_KEY = "uds_session_v3";
export const COOKIE_KEY = "uds_session_v3";
export const COOKIE_DAYS = 30;

export function setCookie(value: string) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(): string | null {
  const match = document.cookie.split("; ").find(r => r.startsWith(COOKIE_KEY + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function removeCookie() {
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// Таймаут сессии — 5 минут простоя
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export type Tab = "employees" | "users" | "audit" | "support" | "profile" | "lkview" | "maintenance" | "mail";