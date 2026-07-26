import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { authApi, type UserRow, type IpStats } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Учитель",
  student: "Ученик",
  tester: "Тестер",
  admin: "Админ",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminUsersSection() {
  const { teacher } = useAppStore();
  const token = teacher?.authToken ?? "";

  const [tab, setTab] = useState<"users" | "ip">("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [ipStats, setIpStats] = useState<IpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    if (!token) return;
    setLoading(true);
    setError("");
    Promise.all([authApi.listUsers(token), authApi.ipStats(token)])
      .then(([u, ip]) => { setUsers(u.users); setIpStats(ip); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.login.toLowerCase().includes(q)
      || (u.full_name || "").toLowerCase().includes(q)
      || (u.email || "").toLowerCase().includes(q)
      || (u.registration_ip || "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-sm bg-destructive/5 border border-destructive/20">
        <Icon name="AlertCircle" size={16} className="text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border rounded-sm p-3">
          <p className="text-[11px] text-muted-foreground">Всего пользователей</p>
          <p className="text-xl font-bold">{ipStats?.total_users ?? users.length}</p>
        </div>
        <div className="border border-border rounded-sm p-3">
          <p className="text-[11px] text-muted-foreground">Уникальных IP</p>
          <p className="text-xl font-bold">{ipStats?.unique_ips ?? "—"}</p>
        </div>
        <div className="border border-border rounded-sm p-3">
          <p className="text-[11px] text-muted-foreground">Подозрительных IP</p>
          <p className="text-xl font-bold text-orange-600">{ipStats?.suspicious_ips.length ?? 0}</p>
        </div>
        <div className="border border-border rounded-sm p-3">
          <p className="text-[11px] text-muted-foreground">Активаций пробного периода</p>
          <p className="text-xl font-bold">{ipStats?.trial_usage.length ?? 0}</p>
        </div>
      </div>

      {/* Табы */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-sm max-w-xs">
        <button
          onClick={() => setTab("users")}
          className={`py-2 text-xs font-semibold rounded-sm transition-colors ${tab === "users" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Пользователи
        </button>
        <button
          onClick={() => setTab("ip")}
          className={`py-2 text-xs font-semibold rounded-sm transition-colors ${tab === "ip" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Подозрительные IP
        </button>
      </div>

      {tab === "users" ? (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по логину, email, IP..."
              className="w-full pl-9 pr-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="border border-border rounded-sm bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Пользователь</th>
                  <th className="px-3 py-2 font-semibold">Роль</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">IP регистрации</th>
                  <th className="px-3 py-2 font-semibold">Регистрация</th>
                  <th className="px-3 py-2 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{u.full_name || u.login}</p>
                      <p className="text-muted-foreground">{u.login}</p>
                    </td>
                    <td className="px-3 py-2">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1">
                        {u.email || "—"}
                        {u.email && (u.email_confirmed
                          ? <Icon name="CheckCircle2" size={12} className="text-green-600" />
                          : <Icon name="AlertCircle" size={12} className="text-orange-500" />)}
                      </span>
                    </td>
                    <td className="px-3 py-2 mono">{u.registration_ip || "—"}</td>
                    <td className="px-3 py-2">{formatDate(u.created_at)}</td>
                    <td className="px-3 py-2">
                      {u.is_active
                        ? <span className="text-green-600">активен</span>
                        : <span className="text-red-500">заблокирован</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Никого не найдено</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-border rounded-sm bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Icon name="AlertTriangle" size={14} className="text-orange-500" />
                IP-адреса с несколькими аккаунтами
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">С одного IP можно регистрировать много аккаунтов — здесь просто видно, где это происходит</p>
            </div>
            <div className="divide-y divide-border">
              {(ipStats?.suspicious_ips.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground p-4 text-center">Подозрительных IP не обнаружено</p>
              )}
              {ipStats?.suspicious_ips.map(ip => (
                <div key={ip.ip_address} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="mono text-sm font-semibold">{ip.ip_address}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                      {ip.accounts_count} аккаунтов
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ip.logins.join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Первая регистрация: {formatDate(ip.first_seen)} · Последняя: {formatDate(ip.last_seen)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-sm bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Icon name="Gift" size={14} className="text-primary" />
                История активаций пробного периода
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Каждый IP и устройство могут активировать пробный период только один раз</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Логин</th>
                    <th className="px-3 py-2 font-semibold">IP</th>
                    <th className="px-3 py-2 font-semibold">Устройство</th>
                    <th className="px-3 py-2 font-semibold">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ipStats?.trial_usage.map((t, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-semibold">{t.login}</td>
                      <td className="px-3 py-2 mono">{t.ip_address || "—"}</td>
                      <td className="px-3 py-2 mono truncate max-w-[160px]">{t.device_fingerprint || "—"}</td>
                      <td className="px-3 py-2">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                  {(ipStats?.trial_usage.length ?? 0) === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Пока никто не активировал пробный период</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
