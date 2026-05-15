import { useState } from "react";
import Icon from "@/components/ui/icon";
import { institutionApi } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";

interface OUUser {
  id: number;
  login: string;
  full_name: string;
  role: string;
  institution_id: number;
  institution_position: string;
  institution_name: string;
  subject?: string;
  token: string;
  is_manager: boolean;
  password: string;
}

interface Props {
  onLogin: (user: OUUser) => void;
  onBack: () => void;
  onRegister: () => void;
}

export default function InstitutionLoginPage({ onLogin, onBack, onRegister }: Props) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await institutionApi.login(login.trim(), password);
      onLogin({ ...res, password });
    } catch (e) {
      setError((e as Error).message || "Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="ArrowLeft" size={13} />
          Назад
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <img
              src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg"
              alt="САОУ"
              className="w-14 h-14 rounded-xl object-contain mx-auto mb-3"
            />
            <h1 className="text-lg font-bold text-foreground">Вход для сотрудника ОУ</h1>
            <p className="text-xs text-muted-foreground mt-1">Образовательное учреждение</p>
          </div>

          <div className="border border-border rounded-sm bg-white shadow-sm">
            <div className="px-6 py-3 border-b border-border bg-muted">
              <p className="text-sm font-semibold text-center">Вход в систему</p>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Icon name="LogIn" size={15} />}
                {loading ? "Вход..." : "Войти"}
              </button>
            </form>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Нет аккаунта ОУ?{" "}
              <button onClick={onRegister} className="text-primary hover:underline font-medium">
                Зарегистрировать учреждение
              </button>
            </p>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}
