export const CABINET_API = "https://functions.poehali.dev/d6239bf7-69bc-42d8-a561-d51a8070819c";
export const SESSION_KEY = "sjou_oo_session_v1";

export interface OoSession {
  login: string;
  password: string;
  oo_full_name: string;
  contact_name?: string;
}

export interface ClassItem {
  id: number;
  name: string;
  grade?: number;
  homeroom_teacher?: string;
  students_count: number;
}

export interface TeacherItem {
  id: number;
  full_name: string;
  subject?: string;
  email?: string;
  phone?: string;
}

export interface StudentItem {
  id: number;
  full_name: string;
  birth_date?: string;
  parent_name?: string;
  parent_phone?: string;
  class_id?: number;
  class_name?: string;
}

export interface LessonItem {
  id: number;
  subject: string;
  day_of_week: number;
  lesson_number: number;
  room?: string;
  teacher_id?: number;
  teacher_name?: string;
}

export interface JournalStudent {
  id: number;
  full_name: string;
}

export interface JournalGrade {
  id: number;
  student_id: number;
  grade_value: number;
  comment?: string;
}

export const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export function loadSession(): OoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d.login && d.password ? d : null;
  } catch {
    return null;
  }
}

export function saveSession(s: OoSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export async function cabinetCall(
  session: OoSession,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(CABINET_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, login: session.login, password: session.password, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || "Ошибка запроса");
  return data;
}