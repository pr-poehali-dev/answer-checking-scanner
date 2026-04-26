import Icon from "@/components/ui/icon";
import { RecognitionResult } from "./upload-types";

interface Props {
  result: RecognitionResult;
  onReset: () => void;
}

export function RecognitionResults({ result, onReset }: Props) {
  const scoreColor = (s: number) =>
    s >= 80 ? "#22c55e" : s >= 52 ? "#3b82f6" : s >= 36 ? "#f59e0b" : "#ef4444";

  return (
    <div className="animate-fade-in space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Код ученика", value: result.student_code, icon: "Hash" },
          { label: "Верных ответов", value: `${result.analysis.correct}/${result.analysis.total}`, icon: "CheckSquare" },
          { label: "Первичный балл", value: result.analysis.score_raw, icon: "Award" },
          { label: "Тестовый балл ЕГЭ", value: result.analysis.score_scaled, icon: "TrendingUp" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Icon name={s.icon} size={15} className="text-muted-foreground" fallback="Info" />
            </div>
            <p
              className="text-2xl font-bold mono"
              style={s.label === "Тестовый балл ЕГЭ" ? { color: scoreColor(result.analysis.score_scaled) } : {}}
            >{s.value}</p>
          </div>
        ))}
      </div>

      {/* Answers grid part 1 */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-5 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">Часть 1 — распознанные ответы ({result.answers_part1.length} заданий)</p>
          <span className="text-xs text-muted-foreground mono">
            {result.analysis.details.filter(d => d.part === 1 && d.correct).length}/{result.answers_part1.length} верных
          </span>
        </div>
        <div className="p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(13, minmax(0, 1fr))` }}>
            {result.analysis.details.filter(d => d.part === 1).map((d) => (
              <div
                key={d.question}
                title={`№${d.question}: ответ — «${d.student}», ключ — «${d.key}»`}
                className="rounded-sm border flex flex-col items-center justify-center py-1 cursor-default"
                style={{
                  background: d.correct ? "hsl(142 71% 45% / 0.1)" : "hsl(0 72% 51% / 0.1)",
                  borderColor: d.correct ? "hsl(142 71% 45% / 0.35)" : "hsl(0 72% 51% / 0.35)",
                }}
              >
                <span className="text-[9px] text-muted-foreground">{d.question}</span>
                <span className="mono font-bold text-xs leading-tight" style={{ color: d.correct ? "hsl(142 71% 35%)" : "hsl(0 72% 45%)" }}>
                  {d.student || "·"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Answers part 2 */}
      {result.answers_part2.length > 0 && (
        <div className="border border-border rounded-sm bg-white">
          <div className="px-5 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Часть 2 — распознанные ответы ({result.answers_part2.length} заданий)</p>
          </div>
          <div className="divide-y divide-border">
            {result.analysis.details.filter(d => d.part === 2).map((d) => (
              <div key={d.question} className="flex items-center gap-4 px-5 py-3 table-row-hover">
                <div
                  className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: "hsl(215 60% 22% / 0.1)", color: "hsl(215 60% 22%)" }}
                >
                  {d.question}
                </div>
                <span className="flex-1 text-sm mono">{d.student || "—"}</span>
                {d.key && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ключ: <span className="mono">{d.key}</span></span>
                    <span className={d.correct ? "badge-success" : "badge-danger"}>
                      {d.correct ? "Верно" : "Неверно"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="border border-border rounded-sm bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Результат</span>
          <span className="mono text-sm font-bold" style={{ color: scoreColor(result.analysis.score_scaled) }}>
            {result.analysis.score_scaled} баллов ЕГЭ
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${result.analysis.score_scaled}%`,
              background: scoreColor(result.analysis.score_scaled),
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="text-destructive">Порог: 36</span>
          <span>100</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onReset} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors">
          <Icon name="RotateCcw" size={14} />
          Загрузить другой бланк
        </button>
      </div>
    </div>
  );
}
