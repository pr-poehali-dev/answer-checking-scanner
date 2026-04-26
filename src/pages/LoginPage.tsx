import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore } from "@/store/appStore";

interface LoginPageProps {
  onLogin: (role: "admin" | "teacher") => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await appStore.login(login.trim(), password);
    setLoading(false);
    if (res.ok) {
      onLogin(res.role);
    } else {
      setError(res.error || "Неверный логин или пароль");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-sm flex items-center justify-center mx-auto mb-4"
            style={{ background: "hsl(var(--sidebar-primary))" }}>
            <Icon name="ScanLine" size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">АОУСПТ</h1>
          <p className="text-sm text-muted-foreground mt-1">Система проверки работ</p>
        </div>

        {/* Form */}
        <div className="border border-border rounded-sm bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted">
            <p className="text-sm font-semibold text-center">Вход для учителя</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Логин</label>
              <div className="relative">
                <Icon name="User" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                  placeholder="Введите логин"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Пароль</label>
              <div className="relative">
                <Icon name="Lock" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showPass ? "EyeOff" : "Eye"} size={14} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
                <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !login || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="LogIn" size={15} />
              )}
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Для получения доступа обратитесь к администратору
        </p>

        <div className="mt-3 p-3 border border-border rounded-sm bg-muted/40 text-center">
          <p className="text-xs text-muted-foreground">Администратор: логин <span className="mono font-bold">admin</span></p>
        </div>
      </div>
    </div>
  );
}