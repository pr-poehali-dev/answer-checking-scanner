import { useState } from "react";
import Icon from "@/components/ui/icon";
import { UserRow } from "@/lib/api";

const PANEL_ROLES = [
  { value: "",             label: "— нет —" },
  { value: "operator",     label: "Оператор ТП" },
  { value: "advisor",      label: "Советник" },
  { value: "tester_role",  label: "Тестер" },
  { value: "developer",    label: "Разработчик" },
  { value: "deputy",       label: "Зам. Главы" },
  { value: "head",         label: "Глава Правления" },
];

interface Props {
  users: UserRow[];
  loading: boolean;
  formatSubUntil: (iso: string | null) => string;
  formatLastSeen: (iso: string | null | undefined) => string;
  onSubscription: (u: UserRow) => void;
  onResetPassword: (login: string) => void;
  onToggle: (login: string) => void;
  onDelete: (login: string) => void;
  onSetRole: (login: string, role: "teacher" | "tester") => void;
  onTokens: (u: UserRow) => void;
  onSetPanelRole: (login: string, panelRole: string) => void;
  panelRoles: Record<string, string>; // login → panel_role
  currentPanelRole: string; // роль текущего оператора (для ограничений)
  isHead: boolean; // Глава Правления — без ограничений
}

export default function AdminUsersTable({
  users,
  loading,
  formatSubUntil,
  formatLastSeen,
  onSubscription,
  onResetPassword,
  onToggle,
  onDelete,
  onSetRole,
  onTokens,
  onSetPanelRole,
  panelRoles,
  isHead,
}: Props) {
  const [panelRoleEdit, setPanelRoleEdit] = useState<string | null>(null);

  const PANEL_RANK: Record<string, number> = {
    operator: 1, advisor: 2, tester_role: 3, developer: 4, deputy: 5, head: 6,
  };

  const PANEL_LABEL: Record<string, string> = {
    operator: "Оператор ТП", advisor: "Советник", tester_role: "Тестер",
    developer: "Разработчик", deputy: "Зам. Главы", head: "Глава Правления",
  };

  return (
    <div className="border border-border rounded-sm bg-white overflow-hidden overflow-x-auto">
      <table className="w-full text-xs min-w-[900px]">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Логин / Роль</th>
            <th className="px-3 py-2 text-left font-semibold">ФИО</th>
            <th className="px-3 py-2 text-left font-semibold">Подписка</th>
            <th className="px-3 py-2 text-left font-semibold">Токены ИИ</th>
            <th className="px-3 py-2 text-left font-semibold">Роль ПУ</th>
            <th className="px-3 py-2 text-left font-semibold">Был в сети</th>
            <th className="px-3 py-2 text-left font-semibold">Статус</th>
            <th className="px-3 py-2 text-right font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && !loading && (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Пользователей пока нет.</td></tr>
          )}
          {users.map(u => {
            const currentPR = panelRoles[u.login] || "";
            const isEditing = panelRoleEdit === u.login;

            return (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                {/* Логин / Роль */}
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{u.login}</span>
                  {u.role === "admin" && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-primary/10 text-primary">ADMIN</span>
                  )}
                  {u.role === "tester" && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-purple-100 text-purple-700">TESTER</span>
                  )}
                </td>

                {/* ФИО */}
                <td className="px-3 py-2">
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-muted-foreground">{u.email || ""}</p>
                </td>

                {/* Подписка */}
                <td className="px-3 py-2">
                  {u.role === "admin" || u.role === "tester" ? (
                    <span className="inline-flex items-center gap-1 text-purple-600">
                      <Icon name="Infinity" size={12} />бессрочный
                    </span>
                  ) : u.subscription_active && u.subscription_status !== "trial" ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <Icon name="CircleCheck" size={12} fallback="CheckCircle" />
                      до {formatSubUntil(u.subscription_until)}
                    </span>
                  ) : u.subscription_status === "trial" || u.trial_active ? (
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <Icon name="Gift" size={12} />
                      пробный до {formatSubUntil(u.trial_until ?? null)}
                    </span>
                  ) : u.trial_expired ? (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Icon name="Clock" size={12} />trial истёк
                    </span>
                  ) : u.subscription_status === "expired" ? (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Icon name="Clock" size={12} />истекла {formatSubUntil(u.subscription_until)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Icon name="CircleX" size={12} fallback="X" />нет
                    </span>
                  )}
                </td>

                {/* Токены */}
                <td className="px-3 py-2">
                  <button onClick={() => onTokens(u)} title="Начислить токены ИИ"
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group">
                    <Icon name="Coins" size={11} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className={`font-semibold tabular-nums ${(u.ai_tokens_balance ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {(u.ai_tokens_balance ?? 0).toLocaleString("ru-RU")}
                    </span>
                    <Icon name="Plus" size={10} className="text-muted-foreground/50 group-hover:text-primary" />
                  </button>
                </td>

                {/* Роль ПУ */}
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <select
                        defaultValue={currentPR}
                        autoFocus
                        onChange={e => {
                          onSetPanelRole(u.login, e.target.value);
                          setPanelRoleEdit(null);
                        }}
                        onBlur={() => setPanelRoleEdit(null)}
                        className="border border-primary rounded-sm px-1.5 py-1 text-[11px] focus:outline-none"
                      >
                        {PANEL_ROLES.filter(r => {
                          if (isHead) return true;
                          return true; // Глава Правления сам решает
                        }).map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : currentPR ? (
                    <button
                      onClick={() => isHead && setPanelRoleEdit(u.login)}
                      title={isHead ? "Изменить роль ПУ" : ""}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        isHead ? "cursor-pointer hover:border-blue-400" : "cursor-default"
                      } bg-blue-50 text-blue-700 border-blue-100`}
                    >
                      <Icon name="Shield" size={10} />
                      {PANEL_LABEL[currentPR] ?? currentPR}
                      {isHead && <Icon name="ChevronDown" size={9} className="opacity-50" />}
                    </button>
                  ) : (
                    isHead ? (
                      <button
                        onClick={() => setPanelRoleEdit(u.login)}
                        className="text-[10px] text-muted-foreground hover:text-blue-600 transition-colors flex items-center gap-1"
                      >
                        <Icon name="Plus" size={10} />
                        Назначить
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )
                  )}
                </td>

                {/* Был в сети */}
                <td className="px-3 py-2 text-muted-foreground">
                  {formatLastSeen(u.last_seen_at)}
                </td>

                {/* Статус */}
                <td className="px-3 py-2">
                  {u.is_active ? (
                    <span className="text-green-600 inline-flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Активен</span>
                  ) : (
                    <span className="text-muted-foreground inline-flex items-center gap-1"><Icon name="Ban" size={12} /> Заблокирован</span>
                  )}
                </td>

                {/* Действия */}
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    {u.role !== "admin" && (
                      <>
                        <button onClick={() => onSubscription(u)} title="Управление подпиской"
                          className="p-1.5 hover:bg-primary/10 rounded-sm text-muted-foreground hover:text-primary">
                          <Icon name="Crown" size={13} fallback="Star" />
                        </button>
                        <button
                          onClick={() => onSetRole(u.login, u.role === "tester" ? "teacher" : "tester")}
                          title={u.role === "tester" ? "Снять роль тестера" : "Назначить тестером"}
                          className={`p-1.5 rounded-sm transition-colors ${u.role === "tester" ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "hover:bg-purple-50 text-muted-foreground hover:text-purple-700"}`}
                        >
                          <Icon name="FlaskConical" size={13} fallback="TestTube" />
                        </button>
                      </>
                    )}
                    <button onClick={() => onResetPassword(u.login)} title="Сбросить пароль"
                      className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground">
                      <Icon name="KeyRound" size={13} />
                    </button>
                    <button onClick={() => onToggle(u.login)}
                      title={u.is_active ? "Заблокировать" : "Разблокировать"}
                      className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground">
                      <Icon name={u.is_active ? "Lock" : "Unlock"} size={13} />
                    </button>
                    {u.role !== "admin" && (
                      <button onClick={() => onDelete(u.login)} title="Удалить"
                        className="p-1.5 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive">
                        <Icon name="Trash2" size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
