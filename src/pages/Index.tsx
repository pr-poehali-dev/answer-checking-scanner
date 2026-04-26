import { useState } from "react";
import Icon from "@/components/ui/icon";

type Section =
  | "upload"
  | "recognition"
  | "checking"
  | "results"
  | "analytics"
  | "export"
  | "settings";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "upload", label: "Загрузка бланков", icon: "Upload" },
  { id: "recognition", label: "Распознавание", icon: "ScanLine" },
  { id: "checking", label: "Проверка ответов", icon: "CheckSquare" },
  { id: "results", label: "Результаты", icon: "Users" },
  { id: "analytics", label: "Статистика", icon: "BarChart2" },
  { id: "export", label: "Экспорт отчётов", icon: "FileDown" },
  { id: "settings", label: "Настройки", icon: "Settings" },
];

const MOCK_STUDENTS = [
  { id: 1, name: "Алексеева Марина В.", answers: 32, correct: 28, raw: 28, scaled: 75, grade: "4", status: "ok" },
  { id: 2, name: "Борисов Дмитрий К.", answers: 32, correct: 24, raw: 24, scaled: 61, grade: "4", status: "ok" },
  { id: 3, name: "Васильева Ольга П.", answers: 32, correct: 31, raw: 31, scaled: 89, grade: "5", status: "ok" },
  { id: 4, name: "Горев Иван С.", answers: 30, correct: 14, raw: 14, scaled: 32, grade: "2", status: "warning" },
  { id: 5, name: "Данилова Екатерина Н.", answers: 32, correct: 27, raw: 27, scaled: 71, grade: "4", status: "ok" },
  { id: 6, name: "Ефимов Артём Р.", answers: 29, correct: 19, raw: 19, scaled: 47, grade: "3", status: "ok" },
  { id: 7, name: "Жукова Светлана И.", answers: 32, correct: 32, raw: 32, scaled: 96, grade: "5", status: "ok" },
  { id: 8, name: "Захаров Никита Л.", answers: 31, correct: 11, raw: 11, scaled: 24, grade: "2", status: "danger" },
];

function ScoreBar({ value }: { value: number }) {
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

function StatusBadge({ status, grade }: { status: string; grade: string }) {
  if (status === "danger") return <span className="badge-danger">Незачёт</span>;
  if (status === "warning") return <span className="badge-warning">Порог</span>;
  return (
    <span className={grade === "5" ? "badge-success" : grade === "4" ? "badge-info" : "badge-warning"}>
      Оценка {grade}
    </span>
  );
}

function UploadSection() {
  const [files, setFiles] = useState<string[]>([]);
  const mockFiles = ["Бланк_Алексеева.jpg", "Бланк_Борисов.jpg", "Бланк_Васильева.jpg", "Бланк_Горев.jpg"];

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <p className="section-header mb-4">Загрузка бланков ответов</p>
        <div className="upload-zone" onClick={() => setFiles(mockFiles)}>
          <Icon name="ScanLine" size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground mb-1">Перетащите файлы сюда или нажмите для выбора</p>
          <p className="text-sm text-muted-foreground">Поддерживаются форматы JPG, PNG, PDF · до 25 МБ на файл</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity">
              <Icon name="Upload" size={15} />
              Выбрать файлы
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors">
              <Icon name="Camera" size={15} />
              Сканировать
            </button>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="animate-fade-in">
          <p className="section-header mb-3">Загруженные файлы — {files.length} шт.</p>
          <div className="border border-border rounded-sm divide-y divide-border">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 table-row-hover">
                <div className="flex items-center gap-3">
                  <Icon name="FileImage" size={16} className="text-muted-foreground" />
                  <span className="text-sm">{f}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-success">Готов</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Icon name="X" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity">
              <Icon name="Play" size={15} />
              Начать распознавание
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Обработано сегодня", value: "247", icon: "FileCheck" },
          { label: "Среднее время бланка", value: "1.3 сек", icon: "Timer" },
          { label: "Точность распознавания", value: "98.7%", icon: "Target" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Icon name={s.icon} size={16} className="text-muted-foreground" fallback="Info" />
            </div>
            <p className="text-2xl font-bold text-foreground mono">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecognitionSection() {
  const steps = [
    { name: "Выравнивание изображения", status: "done", time: "0.12 с" },
    { name: "Обнаружение ячеек бланка", status: "done", time: "0.31 с" },
    { name: "Распознавание цифр (часть 1)", status: "done", time: "0.45 с" },
    { name: "Распознавание букв (часть 2)", status: "active", time: "..." },
    { name: "Проверка контрольных сумм", status: "pending", time: "—" },
    { name: "Сохранение результатов", status: "pending", time: "—" },
  ];

  return (
    <div className="animate-slide-up space-y-6">
      <p className="section-header">Статус распознавания</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="bg-muted px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium">Бланк_Васильева.jpg</span>
            <span className="badge-success">Часть 1/2</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-8 gap-1.5 mb-4">
              {Array.from({ length: 32 }, (_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-sm flex items-center justify-center text-xs font-mono font-semibold border"
                  style={{
                    background: i < 20 ? "hsl(142 71% 45% / 0.12)" : i < 28 ? "hsl(210 80% 56% / 0.08)" : "hsl(210 20% 94%)",
                    borderColor: i < 20 ? "hsl(142 71% 45% / 0.3)" : i < 28 ? "hsl(210 80% 56% / 0.3)" : "hsl(214 20% 88%)",
                    color: i < 20 ? "hsl(142 71% 35%)" : i < 28 ? "hsl(210 80% 40%)" : "hsl(215 16% 47%)",
                  }}
                >
                  {i < 20 ? String.fromCharCode(1040 + (i % 5)) : i < 28 ? (i % 5 + 1) : "·"}
                </div>
              ))}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(142 71% 45% / 0.3)" }} /> Буква</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(210 80% 56% / 0.3)" }} /> Цифра</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(210 20% 94%)" }} /> Ожидание</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-border bg-white">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: s.status === "done" ? "hsl(142 71% 45%)" : s.status === "active" ? "hsl(210 80% 56%)" : "hsl(210 20% 88%)",
                }}
              >
                {s.status === "done" && <Icon name="Check" size={11} className="text-white" />}
                {s.status === "active" && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>
              <span className="flex-1 text-sm" style={{ color: s.status === "pending" ? "hsl(215 16% 47%)" : "inherit" }}>
                {s.name}
              </span>
              <span className="mono text-xs text-muted-foreground">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckingSection() {
  const [key] = useState("ВАБГД12345АВВБГД678ГДААБ910111213");
  const answers = "ВАБГД12345АВВБГД678ГДААБ910111214";

  return (
    <div className="animate-slide-up space-y-6">
      <p className="section-header">Эталон и ответы ученика</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Ключ ответов</p>
          </div>
          <div className="p-4">
            <textarea
              className="w-full text-sm mono border border-border rounded-sm p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={5}
              defaultValue={key}
            />
            <p className="text-xs text-muted-foreground mt-2">Введите ответы в виде строки или загрузите из файла</p>
            <div className="mt-3 flex gap-2">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:opacity-90 transition-opacity">
                <Icon name="Save" size={13} />
                Сохранить ключ
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors">
                <Icon name="FolderOpen" size={13} />
                Загрузить
              </button>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
            <p className="text-sm font-semibold">Ответы: Васильева О.П.</p>
            <span className="badge-success">31/32 верных</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: 32 }, (_, i) => {
                const correct = key[i] === answers[i];
                return (
                  <div
                    key={i}
                    className="h-9 rounded-sm flex flex-col items-center justify-center border cursor-default"
                    style={{
                      background: correct ? "hsl(142 71% 45% / 0.1)" : "hsl(0 72% 51% / 0.1)",
                      borderColor: correct ? "hsl(142 71% 45% / 0.35)" : "hsl(0 72% 51% / 0.35)",
                    }}
                  >
                    <span className="mono font-semibold text-xs" style={{ color: correct ? "hsl(142 71% 35%)" : "hsl(0 72% 45%)" }}>
                      {answers[i] || "·"}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Настройки шкалирования ЕГЭ/ОГЭ</p>
        </div>
        <div className="p-4 grid grid-cols-4 gap-4">
          {[
            { label: "Тип экзамена", value: "ЕГЭ" },
            { label: "Предмет", value: "Русский язык" },
            { label: "Год", value: "2026" },
            { label: "Порог (мин. баллов)", value: "36" },
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

function ResultsSection() {
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

function AnalyticsSection() {
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

function ExportSection() {
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

function SettingsSection() {
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

const SECTION_COMPONENTS: Record<Section, React.FC> = {
  upload: UploadSection,
  recognition: RecognitionSection,
  checking: CheckingSection,
  results: ResultsSection,
  analytics: AnalyticsSection,
  export: ExportSection,
  settings: SettingsSection,
};

const SECTION_TITLES: Record<Section, string> = {
  upload: "Загрузка и сканирование бланков",
  recognition: "Распознавание ответов",
  checking: "Проверка и сравнение ответов",
  results: "Результаты и список учеников",
  analytics: "Статистика и аналитика",
  export: "Экспорт отчётов",
  settings: "Настройки тестов",
};

export default function Index() {
  const [active, setActive] = useState<Section>("upload");
  const ActiveSection = SECTION_COMPONENTS[active];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: "hsl(var(--sidebar-background))" }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
              <Icon name="ScanLine" size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
              ЕГЭ Сканер
            </span>
          </div>
          <p className="text-xs" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>
            Система проверки тестов
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="section-header px-3 mb-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
            Разделы
          </p>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <Icon name={item.icon} size={16} fallback="Circle" />
              <span className="flex-1">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 px-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "hsl(var(--sidebar-primary) / 0.25)", color: "hsl(var(--sidebar-primary))" }}
            >
              АИ
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>Администратор</p>
              <p className="text-[10px]" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>Школа №47</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border flex-shrink-0">
          <div>
            <h1 className="text-base font-bold leading-none mb-0.5">{SECTION_TITLES[active]}</h1>
            <p className="text-xs text-muted-foreground">Апрель 2026 · ЕГЭ Русский язык · 11А класс</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors">
              <Icon name="RefreshCw" size={13} />
              Обновить
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity">
              <Icon name="Plus" size={13} />
              Новая сессия
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <ActiveSection key={active} />
        </main>
      </div>
    </div>
  );
}
