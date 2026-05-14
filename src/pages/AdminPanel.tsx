import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { authApi, UserRow } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";
import AdminCreateForm from "@/pages/admin/AdminCreateForm";
import AdminUsersTable from "@/pages/admin/AdminUsersTable";
import AdminSubscriptionModal from "@/pages/admin/AdminSubscriptionModal";
import AdminResetPasswordModal from "@/pages/admin/AdminResetPasswordModal";
import AdminMaintenancePanel from "@/pages/admin/AdminMaintenancePanel";

type Tab = "users" | "maintenance";

export default function AdminPanel() {
  const { teacher } = useAppStore();
  const token = teacher?.authToken || "";
  const [tab, setTab]         = useState<Tab>("users");
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy]       = useState(false);

  const [newLogin, setNewLogin]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName]         = useState("");
  const [newSchool, setNewSchool]     = useState("АОУСПТ");

  const [resetFor, setResetFor]   = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");

  const [subFor, setSubFor]       = useState<UserRow | null>(null);
  const [subMonths, setSubMonths] = useState<number>(1);
  const [subBusy, setSubBusy]     = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.listUsers(token);
      setUsers(data.users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadUsers();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authApi.register(token, {
        login: newLogin.trim(),
        password: newPassword,
        full_name: newName.trim(),
        school: newSchool.trim() || "АОУСПТ",
        role: "teacher",
      });
      setNewLogin(""); setNewPassword(""); setNewName(""); setNewSchool("АОУСПТ");
      setShowForm(false);
      await loadUsers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (login: string) => {
    setError("");
    try { await authApi.toggleUser(token, login); await loadUsers(); }
    catch (e) { setError((e as Error).message); }
  };

  const handleDelete = async (login: string) => {
    if (!confirm(`Удалить учителя «${login}»? Действие необратимо.`)) return;
    setError("");
    try { await authApi.deleteUser(token, login); await loadUsers(); }
    catch (e) { setError((e as Error).message); }
  };

  const handleReset = async (login: string) => {
    if (!resetPass || resetPass.length < 6) { setError("Новый пароль должен быть минимум 6 символов"); return; }
    setError("");
    try {
      await authApi.resetPassword(token, login, resetPass);
      setResetFor(null); setResetPass("");
      alert(`Пароль для «${login}» обновлён`);
    } catch (e) { setError((e as Error).message); }
  };

  const handleGrantSubscription = async (login: string, months: number, revoke = false) => {
    setSubBusy(true); setError("");
    try {
      await authApi.grantSubscription(token, { login, months, revoke });
      setSubFor(null); await loadUsers();
    } catch (e) { setError((e as Error).message); }
    finally { setSubBusy(false); }
  };

  const handleSetRole = async (login: string, role: "teacher" | "tester") => {
    setError("");
    try {
      await authApi.setRole(token, login, role);
      await loadUsers();
    } catch (e) { setError((e as Error).message); }
  };

  const formatSubUntil = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatLastSeen = (iso: string | null | undefined) => {
    if (!iso) return "никогда";
    const d = new Date(iso); const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "только что";
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} д назад`;
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "users",       label: "Учителя",         icon: "Users" },
    { id: "maintenance", label: "Тех. работы",      icon: "Construction" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
            <Icon name="Shield" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Панель администратора</h1>
            <p className="text-xs text-muted-foreground mt-0.5">АОУСПТ · управление системой</p>
          </div>
        </div>
        <button
          onClick={() => appStore.logout()}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
        >
          <Icon name="LogOut" size={13} />
          Выйти
        </button>
      </header>

      {/* Вкладки */}
      <div className="bg-white border-b border-border px-4 md:px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(""); }}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={13} fallback="Circle" />
              {t.label}
              {t.id === "maintenance" && (
                <span className="ml-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-orange-100 text-orange-600">
                  ТО
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* ── Вкладка: Учителя ── */}
        {tab === "users" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Учителя ({users.length})</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Создавайте учётные записи, выдавайте подписки и роли
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadUsers}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
                  Обновить
                </button>
                <button
                  onClick={() => { setShowForm(s => !s); setError(""); }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
                >
                  <Icon name={showForm ? "X" : "UserPlus"} size={13} />
                  {showForm ? "Отмена" : "Добавить"}
                </button>
              </div>
            </div>

            {/* Подсказка про тестера */}
            <div className="flex items-start gap-2 p-3 rounded-sm bg-purple-50 border border-purple-100">
              <Icon name="FlaskConical" size={14} className="text-purple-500 flex-shrink-0 mt-0.5" fallback="TestTube" />
              <p className="text-xs text-purple-700">
                Роль <strong>Тестер</strong> даёт постоянный доступ ко всем разделам без подписки и Я.Диска, включая закрытые на ТО.
                Назначайте колбой <Icon name="FlaskConical" size={11} className="inline mx-0.5" fallback="TestTube" /> в строке пользователя.
              </p>
            </div>

            {showForm && (
              <AdminCreateForm
                busy={busy}
                newLogin={newLogin}
                newPassword={newPassword}
                newName={newName}
                newSchool={newSchool}
                setNewLogin={setNewLogin}
                setNewPassword={setNewPassword}
                setNewName={setNewName}
                setNewSchool={setNewSchool}
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
                onGeneratePassword={generatePassword}
              />
            )}

            <AdminUsersTable
              users={users}
              loading={loading}
              formatSubUntil={formatSubUntil}
              formatLastSeen={formatLastSeen}
              onSubscription={u => { setSubFor(u); setSubMonths(1); }}
              onResetPassword={login => { setResetFor(login); setResetPass(""); }}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSetRole={handleSetRole}
            />
          </>
        )}

        {/* ── Вкладка: Тех. работы ── */}
        {tab === "maintenance" && (
          <AdminMaintenancePanel token={token} />
        )}
      </main>

      {subFor && (
        <AdminSubscriptionModal
          subFor={subFor}
          subMonths={subMonths}
          subBusy={subBusy}
          formatSubUntil={formatSubUntil}
          setSubMonths={setSubMonths}
          onGrant={handleGrantSubscription}
          onClose={() => setSubFor(null)}
        />
      )}

      {resetFor && (
        <AdminResetPasswordModal
          resetFor={resetFor}
          resetPass={resetPass}
          setResetPass={setResetPass}
          onReset={handleReset}
          onClose={() => setResetFor(null)}
          onGeneratePassword={generatePassword}
        />
      )}

      <CompanyFooter variant="full" />
    </div>
  );
}
