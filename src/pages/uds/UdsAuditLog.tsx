import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsAuditEntry } from "@/lib/api";

// Русские названия панельных ролей — для расшифровки details ({"panel_role": "head", ...})
const ROLE_LABELS: Record<string, string> = {
  head: "Глава Правления", deputy: "Зам. Главы Правления",
  developer: "Разработчик", tester_role: "Тестер",
  advisor: "Советник", operator: "Оператор ТП",
};
const SUBROLE_LABELS: Record<string, string> = { curator: "Куратор", manager: "Менеджер" };

// Полное описание каждого кода действия: заголовок, иконка, цвет фона иконки
const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  cert_login: { label: "Вход по электронной подписи", icon: "FileSignature", color: "blue" },
  update_profile: { label: "Изменение своего логина/пароля", icon: "UserCog", color: "blue" },
  register_employee: { label: "Регистрация сотрудника УДС", icon: "UserPlus", color: "green" },
  remove_role: { label: "Снятие панельной роли", icon: "ShieldOff", color: "red" },
  set_role: { label: "Изменение панельной роли", icon: "Shield", color: "blue" },
  block: { label: "Блокировка сотрудника", icon: "Lock", color: "red" },
  unblock: { label: "Разблокировка сотрудника", icon: "LockOpen", color: "green" },
  delete_employee_permanent: { label: "Удаление сотрудника (безвозвратно)", icon: "UserX", color: "red" },
  set_subrole: { label: "Назначение подроли (куратор/менеджер)", icon: "Badge", color: "purple" },
  set_curator: { label: "Назначение куратора сотруднику", icon: "UserCheck", color: "purple" },
  transfer_direct: { label: "Передача подопечного другому куратору", icon: "ArrowRightLeft", color: "purple" },
  transfer_request: { label: "Запрос на передачу подопечного", icon: "Send", color: "purple" },
  transfer_accepted: { label: "Передача подопечного принята", icon: "CheckCircle2", color: "green" },
  transfer_declined: { label: "Передача подопечного отклонена", icon: "XCircle", color: "red" },
  view_consents: { label: "Просмотр согласий пользователей", icon: "Eye", color: "gray" },
  view_all_data: { label: "Просмотр ВСЕХ данных пользователя", icon: "Database", color: "orange" },
  grant_tokens: { label: "Начисление ИИ-токенов пользователю", icon: "Coins", color: "green" },
  revoke_subscription: { label: "Отзыв подписки у пользователя", icon: "CalendarX", color: "red" },
  grant_subscription: { label: "Выдача/продление подписки", icon: "CalendarCheck", color: "green" },
  block_user: { label: "Блокировка пользователя", icon: "UserX", color: "red" },
  unblock_user: { label: "Разблокировка пользователя", icon: "UserCheck", color: "green" },
  reset_user_password: { label: "Сброс пароля пользователя", icon: "KeyRound", color: "orange" },
  lk_visibility: { label: "Изменение видимости разделов ЛК", icon: "EyeOff", color: "blue" },
  maintenance: { label: "Технические работы (вкл/выкл)", icon: "Wrench", color: "orange" },
  assign_cert: { label: "Назначение выпуска сертификата", icon: "FilePlus2", color: "blue" },
  cert_agree: { label: "Согласие сотрудника на выпуск сертификата", icon: "FileCheck2", color: "blue" },
  cert_issued: { label: "Сертификат выпущен", icon: "BadgeCheck", color: "green" },
  revoke_cert: { label: "Отзыв сертификата", icon: "FileX2", color: "red" },
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-500",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-500",
  purple: "bg-purple-50 text-purple-600",
  orange: "bg-orange-50 text-orange-500",
  gray: "bg-gray-100 text-gray-500",
};

/** Разбирает код действия (учитывает динамические transfer_accepted/transfer_declined). */
function actionMeta(action: string) {
  return ACTION_META[action] || { label: action, icon: "Activity", color: "gray" };
}

/** Превращает JSON из details в человекочитаемую русскую строку. */
function describeDetails(action: string, raw: string | null): string {
  if (!raw) return "";
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw);
  } catch {
    return raw;
  }
  const parts: string[] = [];
  const roleLabel = (v: unknown) => (typeof v === "string" ? (ROLE_LABELS[v] || v) : String(v));

  switch (action) {
    case "update_profile":
      if (d.login_changed) parts.push("логин изменён");
      if (d.password_changed) parts.push("пароль изменён");
      break;
    case "register_employee":
      parts.push(`роль: ${roleLabel(d.panel_role)}`);
      if (d.operator_number != null) parts.push(`№${d.operator_number}`);
      if (d.mail) parts.push(`почта: ${d.mail}`);
      if (d.subrole) parts.push(`подроль: ${SUBROLE_LABELS[String(d.subrole)] || d.subrole}`);
      if (d.curator) parts.push(`куратор: ${d.curator}`);
      break;
    case "set_role":
      parts.push(`новая роль: ${roleLabel(d.panel_role)}`);
      break;
    case "set_subrole":
      parts.push(d.subrole ? `подроль: ${SUBROLE_LABELS[String(d.subrole)] || d.subrole}` : "подроль снята");
      break;
    case "set_curator":
      parts.push(d.curator ? `куратор: ${d.curator}` : "куратор снят");
      break;
    case "transfer_direct":
    case "transfer_request":
      if (d.to) parts.push(`кому: ${d.to}`);
      break;
    case "transfer_accepted":
    case "transfer_declined":
      if (d.from) parts.push(`от: ${d.from}`);
      if (d.to) parts.push(`кому: ${d.to}`);
      break;
    case "view_consents":
      if (d.q) parts.push(`поиск: «${d.q}»`);
      if (d.context) parts.push(`раздел: ${d.context}`);
      break;
    case "view_all_data":
      parts.push(`пользователь: ${d.target}`);
      break;
    case "grant_tokens":
      parts.push(`сумма: ${d.amount_rub} ₽`);
      break;
    case "grant_subscription":
      parts.push(`на ${d.months} мес.`);
      break;
    case "lk_visibility":
      parts.push(`роль: ${d.role === "teacher" ? "Учитель" : d.role === "student" ? "Ученик" : String(d.role)}`);
      if (Array.isArray(d.hidden)) parts.push(d.hidden.length ? `скрыто: ${d.hidden.join(", ")}` : "всё видимо");
      break;
    case "maintenance":
      if (Array.isArray(d.sections)) parts.push(d.sections.length ? `разделы: ${d.sections.join(", ")}` : "техработы выключены");
      break;
    case "cert_agree":
      if (d.container_type) parts.push(`носитель: ${d.container_type}`);
      break;
    case "cert_issued":
      if (d.serial) parts.push(`серийный №: ${d.serial}`);
      break;
    case "revoke_cert":
      if (d.reason) parts.push(`причина: ${d.reason}`);
      break;
    default: {
      // Неизвестное действие — показываем ключи как есть, но без технического JSON
      for (const [k, v] of Object.entries(d)) {
        if (v === null || v === undefined || v === "") continue;
        parts.push(`${k}: ${v}`);
      }
    }
  }
  return parts.join(" · ");
}

export default function UdsAuditLog({ login, token }: { login: string; token: string }) {
  const [logs, setLogs] = useState<UdsAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.auditLog(login, token);
      setLogs(res.logs);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Журнал действий ({logs.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Хранятся, пока есть место. Последние 300 записей.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50">
          <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {logs.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Записей пока нет</p>
        )}
        {logs.map((l, i) => {
          const meta = actionMeta(l.action);
          const detailsText = describeDetails(l.action, l.details);
          return (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${COLOR_CLASSES[meta.color]}`}>
                <Icon name={meta.icon} size={14} fallback="Activity" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Совершил: <span className="font-medium text-foreground/80">{l.actor_login}</span>
                  {l.actor_role ? ` (${ROLE_LABELS[l.actor_role] || l.actor_role})` : ""}
                  {l.target_login && l.target_login !== l.actor_login ? <> · над пользователем: <span className="font-medium text-foreground/80">{l.target_login}</span></> : ""}
                </p>
                {detailsText && (
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">{detailsText}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
