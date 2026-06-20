import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms } from "@/lib/api";
import UdsEmployees from "@/pages/uds/UdsEmployees";
import UdsUsers from "@/pages/uds/UdsUsers";
import UdsAuditLog from "@/pages/uds/UdsAuditLog";
import UdsProfile from "@/pages/uds/UdsProfile";

const PANEL_ROLE_LABELS: Record<string, string> = {
  head: "Глава Правления",
  deputy: "Зам. Главы Правления",
  developer: "Разработчик",
  tester_role: "Тестер",
  advisor: "Советник",
  operator: "Оператор ТП",
};

interface Session {
  login: string;
  token: string;
  panel_role: string;
  panel_role_label: string;
  operator_number: number;
  perms: UdsPerms;
}

const LS_KEY = "uds_session_v1";

type Tab = "employees" | "users" | "audit" | "support" | "profile";

export default function UdsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("employees");

  // Восстановление сессии
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        // Проверяем доступ заново
        udsApi.me(s.login, s.token).then(me => {
          if (me.uds_access && me.perms) {
            setSession({ ...s, panel_role: me.panel_role || s.panel_role, perms: me.perms });
          } else {
            localStorage.removeItem(LS_KEY);
          }
        }).catch(() => localStorage.removeItem(LS_KEY));
      }
    } catch { /* ignore */ }
  }, []);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await udsApi.login(loginName.trim(), password);
      const s: Session = {
        login: res.login, token: res.token,
        panel_role: res.panel_role, panel_role_label: res.panel_role_label,
        operator_number: res.operator_number, perms: res.perms,
      };
      setSession(s);
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setSession(null);
    setLoginName(""); setPassword("");
  }, []);

  // ── Форма входа ──────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
              <Icon name="ShieldCheck" size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">УДС</h1>
            <p className="text-sm text-slate-400 mt-1">Управление Движения Системы</p>
          </div>
          <form onSubmit={doLogin} className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Логин сотрудника</label>
              <input
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Логин"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Пароль"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !loginName.trim() || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
            >
              {busy ? <><Icon name="Loader2" size={15} className="animate-spin" /> Вход…</> : <><Icon name="LogIn" size={15} /> Войти</>}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Вход только для сотрудников УДС
            </p>
          </form>
        </div>
      </div>
    );
  }

  const { perms } = session;
  const TABS: { id: Tab; label: string; icon: string; show: boolean }[] = [
    { id: "employees", label: "Сотрудники", icon: "Users", show: true },
    { id: "users", label: "Пользователи", icon: "UserSearch", show: true },
    { id: "audit", label: "Логи действий", icon: "ScrollText", show: true },
    { id: "support", label: "Тех. поддержка", icon: "Headphones", show: perms.can_support },
    { id: "profile", label: "Мой профиль", icon: "UserCog", show: session.login !== "admin" },
  ].filter(t => t.show);

  const onProfileUpdated = (newLogin: string, newToken: string) => {
    const updated = { ...session, login: newLogin, token: newToken };
    setSession(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center bg-blue-600">
            <Icon name="ShieldCheck" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Управление Движения Системы</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{session.login}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                {session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
              </span>
              {session.operator_number != null && (
                <span className="text-[10px] text-muted-foreground font-mono">№{session.operator_number}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
        >
          <Icon name="LogOut" size={13} />
          Выйти
        </button>
      </header>

      <div className="bg-white border-b border-border px-4 md:px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={13} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {tab === "employees" && (
          <UdsEmployees login={session.login} token={session.token} perms={perms} myRole={session.panel_role} />
        )}
        {tab === "users" && (
          <UdsUsers login={session.login} token={session.token} />
        )}
        {tab === "audit" && (
          <UdsAuditLog login={session.login} token={session.token} />
        )}
        {tab === "support" && (
          <div className="text-sm text-muted-foreground p-8 text-center border border-border rounded-lg bg-white">
            <Icon name="Headphones" size={28} className="mx-auto mb-2 text-muted-foreground/50" />
            Раздел технической поддержки. Обращения пользователей обрабатываются здесь.
          </div>
        )}
        {tab === "profile" && (
          <UdsProfile
            login={session.login}
            token={session.token}
            panelRoleLabel={session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
            operatorNumber={session.operator_number}
            onUpdated={onProfileUpdated}
          />
        )}
      </main>
    </div>
  );
}