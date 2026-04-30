import Icon from "@/components/ui/icon";
import { UserRow } from "@/lib/api";

interface Props {
  users: UserRow[];
  loading: boolean;
  formatSubUntil: (iso: string | null) => string;
  formatLastSeen: (iso: string | null | undefined) => string;
  onSubscription: (u: UserRow) => void;
  onResetPassword: (login: string) => void;
  onToggle: (login: string) => void;
  onDelete: (login: string) => void;
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
}: Props) {
  return (
    <div className="border border-border rounded-sm bg-white overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Логин</th>
            <th className="px-3 py-2 text-left font-semibold">ФИО</th>
            <th className="px-3 py-2 text-left font-semibold">Email</th>
            <th className="px-3 py-2 text-left font-semibold">Подписка / Trial</th>
            <th className="px-3 py-2 text-left font-semibold">Был в сети</th>
            <th className="px-3 py-2 text-left font-semibold">Статус</th>
            <th className="px-3 py-2 text-right font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && !loading && (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Учителей пока нет. Добавьте первого.</td></tr>
          )}
          {users.map(u => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-3 py-2">
                <span className="font-mono text-xs">{u.login}</span>
                {u.role === "admin" && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-primary/10 text-primary">ADMIN</span>
                )}
              </td>
              <td className="px-3 py-2">{u.full_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{u.email || "—"}</td>
              <td className="px-3 py-2">
                {u.role === "admin" ? (
                  <span className="text-muted-foreground">—</span>
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
                    <Icon name="Clock" size={12} />
                    trial истёк
                  </span>
                ) : u.subscription_status === "expired" ? (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Icon name="Clock" size={12} />
                    истекла {formatSubUntil(u.subscription_until)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Icon name="CircleX" size={12} fallback="X" />
                    нет
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatLastSeen(u.last_seen_at)}
              </td>
              <td className="px-3 py-2">
                {u.is_active ? (
                  <span className="text-green-600 inline-flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Активен</span>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1"><Icon name="Ban" size={12} /> Заблокирован</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-1">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => onSubscription(u)}
                      title="Управление подпиской АОУСПТ"
                      className="p-1.5 hover:bg-primary/10 rounded-sm text-muted-foreground hover:text-primary"
                    ><Icon name="Crown" size={13} fallback="Star" /></button>
                  )}
                  <button
                    onClick={() => onResetPassword(u.login)}
                    title="Сбросить пароль"
                    className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
                  ><Icon name="KeyRound" size={13} /></button>
                  <button
                    onClick={() => onToggle(u.login)}
                    title={u.is_active ? "Заблокировать" : "Разблокировать"}
                    className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
                  ><Icon name={u.is_active ? "Lock" : "Unlock"} size={13} /></button>
                  {u.role !== "admin" && (
                    <button
                      onClick={() => onDelete(u.login)}
                      title="Удалить"
                      className="p-1.5 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive"
                    ><Icon name="Trash2" size={13} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
