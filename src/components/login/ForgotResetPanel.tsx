import Icon from "@/components/ui/icon";

interface ForgotResetPanelProps {
  mode: "forgot" | "reset";
  forgotLogin: string;
  setForgotLogin: (v: string) => void;
  forgotHint: string;
  resetCode: string;
  setResetCode: (v: string) => void;
  resetNewPass: string;
  setResetNewPass: (v: string) => void;
  showResetPass: boolean;
  setShowResetPass: (v: boolean | ((prev: boolean) => boolean)) => void;
  resetSuccess: boolean;
  error: string;
  loading: boolean;
  resending: boolean;
  onForgotSubmit: (e: React.FormEvent) => void;
  onResetSubmit: (e: React.FormEvent) => void;
  onResendResetCode: () => void;
  onGoToLoginAfterReset: () => void;
}

export default function ForgotResetPanel({
  mode,
  forgotLogin,
  setForgotLogin,
  forgotHint,
  resetCode,
  setResetCode,
  resetNewPass,
  setResetNewPass,
  showResetPass,
  setShowResetPass,
  resetSuccess,
  error,
  loading,
  resending,
  onForgotSubmit,
  onResetSubmit,
  onResendResetCode,
  onGoToLoginAfterReset,
}: ForgotResetPanelProps) {
  if (mode === "forgot") {
    return (
      <form onSubmit={onForgotSubmit} className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Укажите логин или email, указанный при регистрации — мы вышлем код для сброса пароля.
        </p>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Логин или email</label>
          <div className="relative">
            <Icon name="User" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={forgotLogin}
              onChange={e => setForgotLogin(e.target.value)}
              placeholder="ivanovi или ivanov@school.ru"
              autoComplete="username"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
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
          disabled={loading || !forgotLogin.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Icon name="Send" size={15} />
          )}
          {loading ? "Отправляем..." : "Отправить код"}
        </button>
      </form>
    );
  }

  // mode === "reset"
  if (resetSuccess) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-2.5 p-3 rounded-sm bg-green-50 border border-green-200">
          <Icon name="CheckCircle2" size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-800 leading-relaxed">
            Пароль успешно изменён. Теперь вы можете войти с новым паролем.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToLoginAfterReset}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <Icon name="LogIn" size={15} />
          Войти
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onResetSubmit} className="p-6 space-y-4">
      <div className="flex items-start gap-2.5 p-3 rounded-sm bg-primary/5 border border-primary/20">
        <Icon name="MailCheck" size={16} className="text-primary flex-shrink-0 mt-0.5" fallback="Mail" />
        <p className="text-xs text-muted-foreground leading-relaxed">{forgotHint}</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Код из письма</label>
        <input
          type="text"
          inputMode="numeric"
          value={resetCode}
          onChange={e => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          autoFocus
          className="w-full px-3 py-2.5 border border-border rounded-sm text-center text-lg tracking-[0.4em] font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Новый пароль</label>
        <div className="relative">
          <Icon name="Lock" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showResetPass ? "text" : "password"}
            value={resetNewPass}
            onChange={e => setResetNewPass(e.target.value)}
            placeholder="Не менее 8 символов"
            autoComplete="new-password"
            className="w-full pl-9 pr-10 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowResetPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={showResetPass ? "EyeOff" : "Eye"} size={14} />
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
        disabled={loading || resetCode.length < 6 || resetNewPass.length < 8}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Icon name="CheckCircle2" size={15} />
        )}
        {loading ? "Сохраняем..." : "Сменить пароль"}
      </button>

      <button
        type="button"
        onClick={onResendResetCode}
        disabled={resending}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {resending ? "Отправляем..." : "Отправить код ещё раз"}
      </button>
    </form>
  );
}
