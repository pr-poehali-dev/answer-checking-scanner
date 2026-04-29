import { useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore } from "@/store/appStore";
import CompanyFooter from "@/components/CompanyFooter";

interface LoginPageProps {
  onLogin: (role: "admin" | "teacher") => void;
  initialMode?: "login" | "signup";
  onBack?: () => void;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? (/[a-z0-9]/.test(c) ? c : ""))
    .join("");
}

function previewLogin(firstName: string, lastName: string): string {
  const f = translit(lastName.trim());
  const i = translit(firstName.trim());
  const base = (f + (i ? i[0] : "")).slice(0, 32);
  return base || "—";
}

type Mode = "login" | "signup";

export default function LoginPage({ onLogin, initialMode = "login", onBack }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);

  // login
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // signup
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [showSignupPass, setShowSignupPass] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedReg, setAgreedReg] = useState(false);

  const generatedLogin = useMemo(
    () => previewLogin(firstName, lastName),
    [firstName, lastName],
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await appStore.login(login.trim(), password);
    setLoading(false);
    if (res.ok) onLogin(res.role);
    else setError(res.error || "Неверный логин или пароль");
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (signupPass.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    setLoading(true);
    const res = await appStore.signup({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password: signupPass,
    });
    setLoading(false);
    if (res.ok) onLogin(res.role);
    else setError(res.error || "Ошибка регистрации");
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {onBack && (
        <div className="px-4 pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeft" size={13} />
            На главную
          </button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4">
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

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-sm mb-3">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`py-2 text-xs font-semibold rounded-sm transition-colors ${
              mode === "login" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`py-2 text-xs font-semibold rounded-sm transition-colors ${
              mode === "signup" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
        <div className="border border-border rounded-sm bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted">
            <p className="text-sm font-semibold text-center">
              {mode === "login" ? "Вход для учителя" : "Регистрация в системе АОУСПТ"}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Логин или email</label>
                <div className="relative">
                  <Icon name="User" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder="ivanovi или ivanov@school.ru"
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
          ) : (
            <form onSubmit={handleSignupSubmit} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Имя</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Иван"
                    className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Фамилия</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Иванов"
                    className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Email</label>
                <div className="relative">
                  <Icon name="Mail" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ivanov@school.ru"
                    autoComplete="email"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Логин (автогенерация) */}
              <div className="p-3 border border-dashed border-border rounded-sm bg-muted/30 flex items-center gap-2">
                <Icon name="UserCheck" size={14} className="text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ваш логин</p>
                  <p className="mono text-sm font-semibold truncate">{generatedLogin}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">сгенерирован автоматически</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showSignupPass ? "text" : "password"}
                    value={signupPass}
                    onChange={e => setSignupPass(e.target.value)}
                    placeholder="Не менее 6 символов"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={showSignupPass ? "EyeOff" : "Eye"} size={14} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
                  <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                После регистрации потребуется оформить подписку <span className="font-semibold">АОУСПТ</span> для доступа к разделам системы.
              </p>

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedReg}
                  onChange={e => setAgreedReg(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-primary cursor-pointer"
                />
                <span className="text-[11px] text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                  Я принимаю условия{" "}
                  <a href="/oferta" target="_blank" className="underline underline-offset-2 hover:text-primary">Договора-оферты</a>
                  {" "}и даю согласие на обработку персональных данных согласно{" "}
                  <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-primary">Политике конфиденциальности</a>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !firstName || !lastName || !email || !signupPass || !agreedReg}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon name="UserPlus" size={15} />
                )}
                {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
              </button>
            </form>
          )}
        </div>


      </div>
      </div>
      <CompanyFooter variant="full" />
    </div>
  );
}