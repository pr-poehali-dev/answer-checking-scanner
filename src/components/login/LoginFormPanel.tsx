import Icon from "@/components/ui/icon";

interface LoginFormPanelProps {
  login: string;
  setLogin: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPass: boolean;
  setShowPass: (v: boolean | ((prev: boolean) => boolean)) => void;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

export default function LoginFormPanel({
  login,
  setLogin,
  password,
  setPassword,
  showPass,
  setShowPass,
  error,
  loading,
  onSubmit,
  onForgotPassword,
}: LoginFormPanelProps) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
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
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-[11px] text-muted-foreground hover:text-primary transition-colors mt-1.5"
        >
          Забыли пароль?
        </button>
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
  );
}
