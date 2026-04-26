import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { authApi, UserRow } from "@/lib/api";

export default function AdminPanel() {
  const { teacher } = useAppStore();
  const token = teacher?.authToken || "";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Форма создания
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newSchool, setNewSchool] = useState("АОУСПТ");

  // Сброс пароля
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");

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
      setNewLogin("");
      setNewPassword("");
      setNewName("");
      setNewSchool("АОУСПТ");
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
    try {
      await authApi.toggleUser(token, login);
      await loadUsers();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (login: string) => {
    if (!confirm(`Удалить учителя «${login}»? Действие необратимо.`)) return;
    setError("");
    try {
      await authApi.deleteUser(token, login);
      await loadUsers();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReset = async (login: string) => {
    if (!resetPass || resetPass.length < 6) {
      setError("Новый пароль должен быть минимум 6 символов");
      return;
    }
    setError("");
    try {
      await authApi.resetPassword(token, login, resetPass);
      setResetFor(null);
      setResetPass("");
      alert(`Пароль для «${login}» обновлён`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
            <Icon name="Shield" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Панель администратора</h1>
            <p className="text-xs text-muted-foreground mt-0.5">АОУСПТ · управление учителями</p>
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

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Top actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Учителя ({users.length})</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Создавайте учётные записи учителей и выдавайте логины с паролями</p>
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
              {showForm ? "Отмена" : "Добавить учителя"}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Форма добавления */}
        {showForm && (
          <form onSubmit={handleCreate} className="border border-border rounded-sm bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold">Новый учитель</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">ФИО</label>
                <input
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Иванова Наталья Петровна"
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Школа</label>
                <input
                  value={newSchool}
                  onChange={e => setNewSchool(e.target.value)}
                  placeholder="АОУСПТ"
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Логин</label>
                <input
                  required
                  value={newLogin}
                  onChange={e => setNewLogin(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  placeholder="ivanova"
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Пароль (мин. 6 символов)</label>
                <div className="flex gap-1">
                  <input
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••"
                    className="flex-1 px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring mono"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(generatePassword())}
                    title="Сгенерировать"
                    className="px-2 border border-border rounded-sm text-xs hover:bg-muted"
                  >
                    <Icon name="Wand2" size={13} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted"
              >Отмена</button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Создаём..." : "Создать"}
              </button>
            </div>
          </form>
        )}

        {/* Таблица учителей */}
        <div className="border border-border rounded-sm bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Логин</th>
                <th className="px-3 py-2 text-left font-semibold">ФИО</th>
                <th className="px-3 py-2 text-left font-semibold">Школа</th>
                <th className="px-3 py-2 text-left font-semibold">Роль</th>
                <th className="px-3 py-2 text-left font-semibold">Статус</th>
                <th className="px-3 py-2 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Учителей пока нет. Добавьте первого.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 mono">{u.login}</td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.school}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {u.role === "admin" ? "АДМИН" : "УЧИТЕЛЬ"}
                    </span>
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
                      <button
                        onClick={() => { setResetFor(u.login); setResetPass(""); }}
                        title="Сбросить пароль"
                        className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
                      ><Icon name="KeyRound" size={13} /></button>
                      <button
                        onClick={() => handleToggle(u.login)}
                        title={u.is_active ? "Заблокировать" : "Разблокировать"}
                        className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
                      ><Icon name={u.is_active ? "Lock" : "Unlock"} size={13} /></button>
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleDelete(u.login)}
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

        {/* Модалка сброса пароля */}
        {resetFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetFor(null)}>
            <div className="bg-white rounded-sm border border-border max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-1">Сброс пароля</h3>
              <p className="text-xs text-muted-foreground mb-4">для <span className="mono font-bold">{resetFor}</span></p>
              <div className="flex gap-1 mb-4">
                <input
                  autoFocus
                  value={resetPass}
                  onChange={e => setResetPass(e.target.value)}
                  placeholder="Новый пароль (мин. 6 символов)"
                  className="flex-1 px-3 py-2 border border-border rounded-sm text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setResetPass(generatePassword())}
                  className="px-2 border border-border rounded-sm text-xs hover:bg-muted"
                ><Icon name="Wand2" size={13} /></button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setResetFor(null)}
                  className="px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted"
                >Отмена</button>
                <button
                  onClick={() => handleReset(resetFor)}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90"
                >Сохранить</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
