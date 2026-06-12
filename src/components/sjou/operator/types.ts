export const API = "https://functions.poehali.dev/2188b28c-bef1-4cf5-9016-f25d4b79fa8a";
export const PWD_KEY = "sjou_operator_pwd_v1";
export const OP_NUM_KEY = "sjou_operator_number_v1";

export interface Application {
  id: number;
  oo_full_name: string;
  oo_short_name?: string;
  oo_type: string;
  oo_type_label: string;
  inn: string;
  ogrn?: string;
  legal_address: string;
  actual_address?: string;
  region: string;
  director_name: string;
  contact_name: string;
  contact_position?: string;
  contact_phone: string;
  contact_email: string;
  students_count?: number;
  statement_file_url?: string;
  statement_file_name?: string;
  status: string;
  operator_comment?: string;
  reviewed_at?: string;
  created_at: string;
  oo_admin_login?: string;
  oo_admin_password?: string;
  operator_number?: string;
}

export interface Message {
  id: number;
  direction: string;
  subject?: string;
  body: string;
  operator_number?: string;
  to_email?: string;
  email_sent?: boolean;
  created_at: string;
}

export const STATUS_META: Record<string, { label: string; cls: string; icon: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-amber-100 text-amber-700", icon: "Clock" },
  approved: { label: "Одобрена", cls: "bg-green-100 text-green-700", icon: "CheckCircle2" },
  rejected: { label: "Отклонена", cls: "bg-red-100 text-red-700", icon: "XCircle" },
};

export const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
