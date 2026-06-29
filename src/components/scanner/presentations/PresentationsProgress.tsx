import Icon from "@/components/ui/icon";

interface PresentationsProgressProps {
  error: string | null;
  success: string | null;
  busy: boolean;
  displayStage: string;
  elapsed: number;
  progress: number;
}

export function PresentationsProgress({
  error,
  success,
  busy,
  displayStage,
  elapsed,
  progress,
}: PresentationsProgressProps) {
  return (
    <>
      {/* Ошибка */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2.5">
          <Icon name="CircleAlert" size={15} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
          <p className="text-xs text-destructive leading-relaxed">{error}</p>
        </div>
      )}

      {/* Успех */}
      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-50 px-4 py-3 flex items-start gap-2.5">
          <Icon name="CircleCheck" size={15} className="text-green-600 flex-shrink-0 mt-0.5" fallback="CheckCircle" />
          <p className="text-xs text-green-700 leading-relaxed">{success}</p>
        </div>
      )}

      {/* Прогресс */}
      {busy && (
        <div className="rounded-xl border border-primary/20 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D1B3E08, #1B3A6B10)" }}>
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-primary">{displayStage}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {Math.floor(elapsed / 60) > 0
                  ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
                  : `${elapsed} сек`}
              </span>
            </div>
            <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                style={{ width: `${Math.min(progress, 95)}%`,
                  background: "linear-gradient(90deg, #1B3A6B, #00B4D8)" }}>
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] text-primary/50 mt-1.5">
              Шаг 1: ИИ генерирует структуру (~60 сек) → Шаг 2: фото и сборка файла (~15 сек). Не закрывайте страницу.
            </p>
          </div>
          <div className="px-4 py-2 border-t border-primary/10 flex gap-4">
            {["Структура", "Содержание", "Фото", "PPTX"].map((step, i) => {
              const pct = [5, 40, 80, 90][i];
              const done = progress >= pct;
              return (
                <div key={step} className="flex items-center gap-1">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    done ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {done && <Icon name="Check" size={8} className="text-white" />}
                  </div>
                  <span className={`text-[10px] ${done ? "text-primary font-semibold" : "text-muted-foreground"}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
