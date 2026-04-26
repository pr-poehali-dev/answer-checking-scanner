export function ScoreBar({ value }: { value: number }) {
  const pct = value;
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#3b82f6" : pct >= 36 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all duration-500" />
      </div>
      <span className="mono text-xs font-medium w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export function StatusBadge({ status, grade }: { status: string; grade: string }) {
  if (status === "danger") return <span className="badge-danger">Незачёт</span>;
  if (status === "warning") return <span className="badge-warning">Порог</span>;
  return (
    <span className={grade === "5" ? "badge-success" : grade === "4" ? "badge-info" : "badge-warning"}>
      Оценка {grade}
    </span>
  );
}
