import Icon from "@/components/ui/icon";

interface ConfirmEmailPanelProps {
  confirmCode: string;
  setConfirmCode: (v: string) => void;
  confirmHint: string;
  error: string;
  loading: boolean;
  resending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onResendCode: () => void;
}

export default function ConfirmEmailPanel({
  confirmCode,
  setConfirmCode,
  confirmHint,
  error,
  loading,
  resending,
  onSubmit,
  onResendCode,
}: ConfirmEmailPanelProps) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <div className="flex items-start gap-2.5 p-3 rounded-sm bg-primary/5 border border-primary/20">
        <Icon name="MailCheck" size={16} className="text-primary flex-shrink-0 mt-0.5" fallback="Mail" />
        <p className="text-xs text-muted-foreground leading-relaxed">{confirmHint}</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Код из письма</label>
        <input
          type="text"
          inputMode="numeric"
          value={confirmCode}
          onChange={e => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          autoFocus
          className="w-full px-3 py-2.5 border border-border rounded-sm text-center text-lg tracking-[0.4em] font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Письмо не пришло? Проверьте папку «Спам» — или нажмите «Отправить код ещё раз» ниже.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || confirmCode.length < 6}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Icon name="CheckCircle2" size={15} />
        )}
        {loading ? "Проверяем..." : "Подтвердить"}
      </button>

      <button
        type="button"
        onClick={onResendCode}
        disabled={resending}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {resending ? "Отправляем..." : "Отправить код ещё раз"}
      </button>
    </form>
  );
}
