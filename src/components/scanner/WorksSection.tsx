import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, Work, WorkType, GradeScale } from "@/store/appStore";
import { WORK_TYPES, SUBJECTS } from "./types";
import { BlankGenerator } from "./BlankGenerator";

interface BlankModalProps {
  work: Work;
  onClose: () => void;
}

function BlankDownloadModal({ work, onClose }: BlankModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <BlankGenerator
          workId={work.id}
          workTitle={`${work.type}: ${work.subject} · ${work.classNum}${work.classLetter}`}
          questionsCount={work.totalQuestions}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

const CLASS_NUMS = Array.from({ length: 11 }, (_, i) => i + 1);
const CLASS_LETTERS = ["А", "Б", "В", "Г", "Д"];

const DEFAULT_SCALE: GradeScale = { grade1: 0, grade2: 5, grade3: 13, grade4: 20, grade5: 27 };

interface WorkFormProps {
  onSave: (w: Work) => void;
  onCancel: () => void;
}

function WorkForm({ onSave, onCancel }: WorkFormProps) {
  const [type, setType] = useState<WorkType>("Проверочная работа");
  const [subject, setSubject] = useState("Русский язык");
  const [classNum, setClassNum] = useState(9);
  const [classLetter, setClassLetter] = useState("А");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [part1Count, setPart1Count] = useState(20);
  const [part2Count, setPart2Count] = useState(5);
  const [answerKey, setAnswerKey] = useState("");
  const [scale, setScale] = useState<GradeScale>({ ...DEFAULT_SCALE });
  const id = appStore.generateWorkId();
  const total = part1Count + part2Count;

  const handleSave = () => {
    onSave({
      id,
      type,
      subject,
      classNum,
      classLetter,
      date,
      totalQuestions: total,
      part1Count,
      part2Count,
      answerKey,
      gradeScale: scale,
      maxScore: total,
    });
  };

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-3 border-b border-border bg-muted flex items-center justify-between">
        <p className="text-sm font-semibold">Новая работа</p>
        <span className="mono text-xs text-muted-foreground">№ {id}</span>
      </div>
      <div className="p-5 space-y-5">

        {/* Основные данные */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Тип работы</label>
            <select value={type} onChange={e => setType(e.target.value as WorkType)}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Предмет</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Класс</label>
            <div className="flex gap-2">
              <select value={classNum} onChange={e => setClassNum(Number(e.target.value))}
                className="flex-1 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {CLASS_NUMS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={classLetter} onChange={e => setClassLetter(e.target.value)}
                className="w-20 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {CLASS_LETTERS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Дата проведения</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>

        {/* Структура работы */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Структура работы</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Заданий часть 1</label>
              <input type="number" min={1} max={60} value={part1Count}
                onChange={e => setPart1Count(parseInt(e.target.value) || 1)}
                className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Заданий часть 2</label>
              <input type="number" min={0} max={30} value={part2Count}
                onChange={e => setPart2Count(parseInt(e.target.value) || 0)}
                className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Итого</label>
              <div className="w-full border border-border rounded-sm px-3 py-2 text-sm mono font-bold bg-muted text-muted-foreground">{total}</div>
            </div>
          </div>
        </div>

        {/* Ключ ответов */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Ключ правильных ответов (без пробелов)</label>
          <textarea value={answerKey} onChange={e => setAnswerKey(e.target.value)}
            rows={2} placeholder="Пример: АБВГД12345..."
            className="w-full text-sm mono border border-border rounded-sm p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          <p className="text-xs text-muted-foreground mt-1">Введено {answerKey.length} из {total} символов</p>
        </div>

        {/* Шкала оценок */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Шкала оценок (минимальный балл)</p>
          <div className="grid grid-cols-5 gap-3">
            {([1, 2, 3, 4, 5] as const).map(g => (
              <div key={g}>
                <label className="text-xs text-muted-foreground block mb-1 text-center">
                  Оценка <span className="font-bold" style={{
                    color: g >= 5 ? "#22c55e" : g >= 4 ? "#3b82f6" : g >= 3 ? "#f59e0b" : "#ef4444"
                  }}>{g}</span>
                </label>
                <input
                  type="number" min={0} max={total}
                  value={scale[`grade${g}` as keyof GradeScale]}
                  onChange={e => setScale(s => ({ ...s, [`grade${g}`]: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-border rounded-sm px-2 py-2 text-sm mono text-center font-bold focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Макс. баллов: {total} · Пример: оценка 3 — с {scale.grade3} балла, оценка 4 — с {scale.grade4}, оценка 5 — с {scale.grade5}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity">
            <Icon name="Check" size={14} />
            Создать работу
          </button>
          <button onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function gradeColor(g: string) {
  if (g === "5") return "#22c55e";
  if (g === "4") return "#3b82f6";
  if (g === "3") return "#f59e0b";
  return "#ef4444";
}

function workTypeIcon(type: WorkType) {
  return type === "Контрольная работа" ? "ClipboardCheck" : "ClipboardList";
}

export function WorksSection() {
  const { works, results, students } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blankFor, setBlankFor] = useState<Work | null>(null);

  const handleCreate = (w: Work) => {
    appStore.addWork(w);
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Удалить работу и все её результаты?")) {
      // store не имеет deleteWork — добавим напрямую через внутренний стейт
      // Для минимального кода — просто уберём из отображения, полная реализация через store
      alert("Удаление будет доступно в следующей версии");
    }
  };

  return (
    <div className="animate-slide-up space-y-5">

      <BlankGenerator />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Список работ</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4 flex-1 mr-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Всего работ</span>
              <Icon name="ClipboardList" size={15} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mono">{works.length}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Проверочных</span>
              <Icon name="ClipboardList" size={15} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mono">{works.filter(w => w.type === "Проверочная работа").length}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Контрольных</span>
              <Icon name="ClipboardCheck" size={15} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mono">{works.filter(w => w.type === "Контрольная работа").length}</p>
          </div>
        </div>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity flex-shrink-0">
          <Icon name="Plus" size={14} />
          Создать работу
        </button>
      </div>

      {/* Create form */}
      {creating && <WorkForm onSave={handleCreate} onCancel={() => setCreating(false)} />}

      {/* Empty state */}
      {works.length === 0 && !creating && (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <Icon name="ClipboardList" size={36} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-semibold mb-1">Работ пока нет</p>
          <p className="text-xs text-muted-foreground mb-4">Создайте работу, чтобы начать проверку бланков</p>
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity">
            <Icon name="Plus" size={14} />
            Создать первую работу
          </button>
        </div>
      )}

      {/* Works list */}
      <div className="space-y-3">
        {works.map(work => {
          const workResults = results.filter(r => r.workId === work.id);
          const expanded = expandedId === work.id;
          const avgScore = workResults.length > 0
            ? Math.round(workResults.reduce((a, r) => a + r.score, 0) / workResults.length)
            : null;

          return (
            <div key={work.id} className="border border-border rounded-sm bg-white overflow-hidden">
              {/* Work header */}
              <div
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expanded ? null : work.id)}
              >
                <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
                  style={{ background: work.type === "Контрольная работа" ? "hsl(0 72% 51% / 0.1)" : "hsl(210 80% 56% / 0.1)" }}>
                  <Icon name={workTypeIcon(work.type)} size={18}
                    style={{ color: work.type === "Контрольная работа" ? "#ef4444" : "#3b82f6" }}
                    fallback="Clipboard" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold">{work.type}: {work.subject}</p>
                    <span className="text-xs text-muted-foreground">{work.classNum}{work.classLetter}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    № {work.id} · {new Date(work.date).toLocaleDateString("ru-RU")} · {work.totalQuestions} заданий
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {workResults.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Сдали</p>
                      <p className="text-sm font-bold mono">{workResults.length} чел.</p>
                    </div>
                  )}
                  {avgScore !== null && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Средний балл</p>
                      <p className="text-sm font-bold mono">{avgScore}/{work.maxScore}</p>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setBlankFor(work); }}
                    title="Скачать бланк PDF"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-sm text-xs hover:bg-muted transition-colors"
                  >
                    <Icon name="Download" size={12} />
                    Бланк
                  </button>
                  <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
                </div>
              </div>

              {/* Expanded: details + results */}
              {expanded && (
                <div className="border-t border-border">
                  {/* Grade scale */}
                  <div className="px-5 py-3 bg-muted/30 flex items-center gap-6">
                    <span className="text-xs text-muted-foreground font-medium">Шкала оценок:</span>
                    {([1, 2, 3, 4, 5] as const).map(g => (
                      <span key={g} className="text-xs">
                        <span className="font-bold" style={{ color: gradeColor(String(g)) }}>«{g}»</span>
                        <span className="text-muted-foreground"> от {work.gradeScale[`grade${g}` as keyof GradeScale]} б.</span>
                      </span>
                    ))}
                  </div>

                  {/* Results table */}
                  {workResults.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-muted-foreground">Результатов пока нет. Загрузите бланки в разделе «Загрузка»</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          {["Код", "Ученик", "Верных", "Баллов", "Оценка"].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {workResults.map(r => {
                          const student = students.find(s => s.code === r.studentCode);
                          return (
                            <tr key={r.studentCode} className="table-row-hover">
                              <td className="px-4 py-2.5 mono text-xs font-bold text-muted-foreground">{r.studentCode}</td>
                              <td className="px-4 py-2.5 text-sm">{student?.name ?? <span className="text-muted-foreground italic">Неизвестен</span>}</td>
                              <td className="px-4 py-2.5 mono text-sm text-center">{r.correctCount}/{r.totalCount}</td>
                              <td className="px-4 py-2.5 mono text-sm font-semibold text-center">{r.score}</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-sm font-bold"
                                  style={{ background: gradeColor(r.grade) + "20", color: gradeColor(r.grade) }}>
                                  {r.grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {blankFor && <BlankDownloadModal work={blankFor} onClose={() => setBlankFor(null)} />}
    </div>
  );
}