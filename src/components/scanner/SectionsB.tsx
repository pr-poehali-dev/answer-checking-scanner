import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ScoreBar, StatusBadge } from "./shared";
import { MOCK_STUDENTS } from "./types";

export function ResultsSection() {
  const [search, setSearch] = useState("");
  const filtered = MOCK_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const avg = Math.round(MOCK_STUDENTS.reduce((a, s) => a + s.scaled, 0) / MOCK_STUDENTS.length);
  const passed = MOCK_STUDENTS.filter(s => s.scaled >= 36).length;

  return (
    <div className="animate-slide-up space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Участников", value: MOCK_STUDENTS.length, icon: "Users" },
          { label: "Средний балл ЕГЭ", value: avg, icon: "TrendingUp" },
          { label: "Преодолели порог", value: `${passed}/${MOCK_STUDENTS.length}`, icon: "Award" },
          { label: "Максимальный балл", value: Math.max(...MOCK_STUDENTS.map(s => s.scaled)), icon: "Star" },
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

      <div className="border border-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">Список учеников</p>
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по фамилии..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring w-48"
            />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["#", "Ученик", "Ответов", "Верных", "Балл ЕГЭ", "Шкала", "Итог"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s, i) => (
              <tr key={s.id} className="table-row-hover bg-white">
                <td className="px-4 py-3 text-xs text-muted-foreground mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                <td className="px-4 py-3 text-sm mono text-center">{s.answers}</td>
                <td className="px-4 py-3 text-sm mono text-center">{s.correct}</td>
                <td className="px-4 py-3 w-40"><ScoreBar value={s.scaled} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.raw} → {s.scaled}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} grade={s.grade} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsSection() {
  const dist = [
    { range: "0–35", label: "Ниже порога", count: 2, color: "#ef4444" },
    { range: "36–59", label: "Удовлетворительно", count: 2, color: "#f59e0b" },
    { range: "60–79", label: "Хорошо", count: 3, color: "#3b82f6" },
    { range: "80–100", label: "Отлично", count: 2, color: "#22c55e" },
  ];
  const maxCount = Math.max(...dist.map(d => d.count));
  const questionStats = Array.from({ length: 16 }, (_, i) => ({
    q: i + 1,
    correct: 55 + ((i * 7 + 3) % 40),
  }));

  return (
    <div className="animate-slide-up space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Распределение баллов</p>
          </div>
          <div className="p-5 space-y-4">
            {dist.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">{d.range} баллов</span>
                  <span className="text-xs text-muted-foreground">{d.count} чел.</span>
                </div>
                <div className="h-6 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm flex items-center pl-2 transition-all duration-700"
                    style={{ width: `${(d.count / maxCount) * 100}%`, background: d.color + "22", border: `1px solid ${d.color}55` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: d.color }}>{d.label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">% верных ответов по заданиям</p>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-32">
              {questionStats.map((q, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm min-h-[4px]"
                    style={{
                      height: `${q.correct}%`,
                      background: q.correct >= 80 ? "#22c55e" : q.correct >= 60 ? "#3b82f6" : q.correct >= 40 ? "#f59e0b" : "#ef4444",
                      opacity: 0.75,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{q.q}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Сводная таблица по классу</p>
        </div>
        <div className="p-4 grid grid-cols-5 gap-4 text-center">
          {[
            { label: "Средний первичный", value: "23.3" },
            { label: "Средний тестовый", value: "61.9" },
            { label: "Медиана", value: "66" },
            { label: "Стандартное откл.", value: "±23.4" },
            { label: "Не преодолели порог", value: "25%" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="text-xl font-bold mono">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExportSection() {
  const reports = [
    { name: "Итоговая ведомость класса", desc: "Список учеников с баллами и оценками", icon: "FileSpreadsheet", formats: ["Excel", "PDF"] },
    { name: "Протокол проверки", desc: "Детальный отчёт по каждому бланку", icon: "ClipboardList", formats: ["PDF"] },
    { name: "Статистика по заданиям", desc: "Процент выполнения каждого задания", icon: "BarChart2", formats: ["Excel", "PDF"] },
    { name: "Сводный отчёт для администрации", desc: "Краткая сводка для руководства", icon: "FileText", formats: ["PDF"] },
  ];

  return (
    <div className="animate-slide-up space-y-5">
      <p className="section-header">Доступные отчёты</p>
      <div className="grid grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <div key={i} className="border border-border rounded-sm bg-white p-5 flex gap-4">
            <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(215 60% 22% / 0.08)" }}>
              <Icon name={r.icon} size={20} className="text-primary" fallback="File" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">{r.name}</p>
              <p className="text-xs text-muted-foreground mb-3">{r.desc}</p>
              <div className="flex gap-2">
                {r.formats.map((f) => (
                  <button key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors">
                    <Icon name="Download" size={12} />
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-sm p-4 bg-muted/30">
        <p className="text-sm font-semibold mb-3">Параметры экспорта</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Класс / группа", value: "11А" },
            { label: "Период", value: "Апрель 2026" },
            { label: "Формат даты", value: "ДД.ММ.ГГГГ" },
          ].map((f, i) => (
            <div key={i}>
              <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
              <div className="border border-border rounded-sm px-3 py-2 text-sm font-medium bg-white">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsSection() {
  return (
    <div className="animate-slide-up space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Параметры теста</p>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: "Количество заданий (часть 1)", value: "26" },
              { label: "Количество заданий (часть 2)", value: "7" },
              { label: "Максимальный первичный балл", value: "54" },
              { label: "Минимальный тестовый балл (порог)", value: "36" },
              { label: "Минимальный балл для поступления", value: "72" },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <label className="text-sm">{f.label}</label>
                <input
                  type="text"
                  defaultValue={f.value}
                  className="border border-border rounded-sm px-3 py-1.5 text-sm mono font-medium w-20 text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Шкала перевода ЕГЭ</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Первичный", "Тестовый", "Уровень"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {[
                [0, 0, "Нет зачёта"], [5, 24, "Ниже порога"], [10, 36, "Порог"],
                [17, 52, "Базовый"], [23, 64, "Повышенный"], [28, 75, "Хороший"],
                [31, 89, "Высокий"], [32, 96, "Максимум"],
              ].map(([raw, sc, lvl], i) => (
                <tr key={i} className="table-row-hover bg-white">
                  <td className="px-4 py-2 mono font-medium">{raw}</td>
                  <td className="px-4 py-2 mono font-bold" style={{ color: Number(sc) >= 80 ? "#22c55e" : Number(sc) >= 52 ? "#3b82f6" : Number(sc) >= 36 ? "#f59e0b" : "#ef4444" }}>{sc}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{lvl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border rounded-sm">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры распознавания</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {[
            { label: "Язык распознавания", value: "Русский + Цифры" },
            { label: "Чувствительность", value: "Высокая" },
            { label: "Исправление перекосов", value: "Авто" },
            { label: "Режим ночного сканера", value: "Выкл" },
          ].map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <label className="text-sm">{f.label}</label>
              <span className="text-sm font-semibold text-primary">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
