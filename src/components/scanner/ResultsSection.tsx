import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ScoreBar } from "./shared";
import { useAppStore } from "@/store/appStore";

function gradeColor(g: string) {
  if (g === "5") return "#22c55e";
  if (g === "4") return "#3b82f6";
  if (g === "3") return "#f59e0b";
  return "#ef4444";
}

export function ResultsSection() {
  const { results, students, works } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterWorkId, setFilterWorkId] = useState<string>("all");

  const filtered = results.filter(r => {
    const student = students.find(s => s.code === r.studentCode);
    const matchSearch = !search ||
      (student?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      r.studentCode.includes(search);
    const matchWork = filterWorkId === "all" || r.workId === filterWorkId;
    return matchSearch && matchWork;
  });

  const avg = filtered.length > 0
    ? Math.round(filtered.reduce((a, r) => a + r.score, 0) / filtered.length)
    : 0;
  const maxScore = filtered.length > 0 ? Math.max(...filtered.map(r => r.score)) : 0;
  const grade5 = filtered.filter(r => r.grade === "5").length;

  if (results.length === 0) {
    return (
      <div className="animate-slide-up">
        <div className="border border-dashed border-border rounded-sm p-12 text-center">
          <Icon name="BarChart2" size={36} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-semibold mb-1">Результатов пока нет</p>
          <p className="text-xs text-muted-foreground">Загрузите и распознайте бланки в разделе «Загрузка бланков»</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Всего результатов", value: results.length, icon: "Users" },
          { label: "Средний балл", value: avg, icon: "TrendingUp" },
          { label: "Максимальный балл", value: maxScore, icon: "Award" },
          { label: "Оценок «5»", value: grade5, icon: "Star" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Icon name={s.icon} size={15} className="text-muted-foreground" fallback="Info" />
            </div>
            <p className="text-2xl font-bold mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по фамилии или коду..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring w-56"
          />
        </div>
        <select value={filterWorkId} onChange={e => setFilterWorkId(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">Все работы</option>
          {works.map(w => (
            <option key={w.id} value={w.id}>№{w.id} · {w.type}: {w.subject}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Результаты ({filtered.length})</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["#", "Ученик", "Код", "Работа", "Верных", "Балл", "Оценка", "Дата"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, i) => {
              const student = students.find(s => s.code === r.studentCode);
              const work = works.find(w => w.id === r.workId);
              return (
                <tr key={`${r.workId}-${r.studentCode}`} className="table-row-hover bg-white">
                  <td className="px-4 py-3 text-xs text-muted-foreground mono">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {student?.name ?? <span className="text-muted-foreground italic">Неизвестен</span>}
                    {student && <span className="text-xs text-muted-foreground ml-1">{student.classNum}{student.classLetter}</span>}
                  </td>
                  <td className="px-4 py-3 mono text-xs font-bold text-muted-foreground">{r.studentCode}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {work ? `№${work.id}` : r.workId}
                  </td>
                  <td className="px-4 py-3 w-32"><ScoreBar value={r.totalCount > 0 ? Math.round(r.correctCount / r.totalCount * 100) : 0} /></td>
                  <td className="px-4 py-3 mono text-sm font-semibold text-center">{r.score}/{r.totalCount}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-sm font-bold"
                      style={{ background: gradeColor(r.grade) + "20", color: gradeColor(r.grade) }}>
                      {r.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.scannedAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}