import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Учитель", student: "Ученик", tester: "Тестер", admin: "Админ",
};

export default function UdsUsers({ login, token }: { login: string; token: string }) {
  const [users, setUsers] = useState<UdsUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<UdsUser | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.users(login, token, query.trim() || undefined);
      setUsers(res.users);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(""); }, [load]);

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold mb-2">Пользователи</h2>
        <div className="relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по ФИО, логину, email, телефону…"
            className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <Icon name="Loader2" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        </div>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {users.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Никого не найдено</p>
        )}
        {users.map(u => (
          <button key={u.login} onClick={() => setSelected(u)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Icon name={u.role === "student" ? "Backpack" : "User"} size={15} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{u.full_name || u.login}</p>
              <p className="text-xs text-muted-foreground truncate">
                {u.login} · {ROLE_LABELS[u.role] || u.role}
                {u.study_group ? ` · ${u.study_group}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!u.is_active && <span className="text-[10px] text-red-500 font-medium">заблок.</span>}
              {u.role === "student" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${u.bound ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-500"}`}>
                  {u.bound ? "привязан" : "не привязан"}
                </span>
              )}
              {u.panel_role && <Icon name="ShieldCheck" size={13} className="text-blue-500" />}
            </div>
          </button>
        ))}
      </div>

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetail({ user, onClose }: { user: UdsUser; onClose: () => void }) {
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("ru-RU") : "—";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white">
          <div>
            <p className="text-sm font-bold">{user.full_name || user.login}</p>
            <p className="text-xs text-muted-foreground">{user.login}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          <Info label="Роль" value={ROLE_LABELS[user.role] || user.role} />
          <Info label="Статус" value={user.is_active ? "Активен" : "Заблокирован"} />
          <Info label="Эл. почта" value={user.email || "—"} />
          <Info label="Телефон" value={user.phone || "—"} />
          <Info label="Класс/группа" value={user.study_group || "—"} />
          <Info label="Панельная роль" value={user.panel_role || "—"} />
          <Info label="Подписка" value={user.subscription_status} />
          <Info label="Подписка до" value={fmt(user.subscription_until)} />
          <Info label="Создан" value={fmt(user.created_at)} />
          <Info label="Создал" value={user.created_by || "—"} />
          <Info label="Последний вход" value={fmt(user.last_seen_at)} />
          {user.role === "student" && (
            <Info label="Привязка" value={user.bound ? `да (${user.bind_code})` : "нет"} />
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
