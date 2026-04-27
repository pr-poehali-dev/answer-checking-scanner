import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type GeneratedTestItem, type Work } from "@/store/appStore";
import { testApi, type WorkTypeName } from "@/lib/api";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";
import { SUBJECTS } from "./types";

const TESTS_FOLDER = `${ROOT_FOLDER}/Тесты`;

const WORK_TYPES: { value: WorkTypeName; label: string; icon: string; desc: string }[] = [
  { value: "Тест", label: "Тест", icon: "ListChecks", desc: "Короткая проверка по теме" },
  { value: "Проверочная работа", label: "Проверочная", icon: "ClipboardCheck", desc: "Текущий контроль" },
  { value: "Контрольная работа", label: "Контрольная", icon: "FileCheck2", desc: "Итоговый контроль" },
];

const CLASS_LETTERS = ["А", "Б", "В", "Г", "Д"];

function downloadDocx(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}

export function TestsSection() {
  const { teacher, generatedTests, yadiskConnected } = useAppStore();
  const [workType, setWorkType] = useState<WorkTypeName>("Тест");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [classNum, setClassNum] = useState(7);
  const [classLetter, setClassLetter] = useState("А");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [part1Count, setPart1Count] = useState(10);
  const [part2Count, setPart2Count] = useState(2);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) { setError("Укажите тему"); return; }
    if (!teacher) return;
    if (part1Count + part2Count === 0) { setError("Укажите хотя бы один вопрос"); return; }
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      setStage("ИИ составляет вопросы…");
      const result = await testApi.generate({
        workType, subject, classNum,
        topic: topic.trim(),
        description: description.trim(),
        part1Count, part2Count,
        teacherName: teacher.name,
        teacherSchool: teacher.school,
      });

      let yadiskPath: string | null = null;
      let uploadedToYadisk = false;

      if (yadiskConnected && teacher.yadiskToken) {
        try {
          setStage("Загружаем на Яндекс.Диск…");
          await yadisk.ensureFolder(teacher.yadiskToken, TESTS_FOLDER);
          const date = new Date().toISOString().slice(0, 10);
          yadiskPath = `${TESTS_FOLDER}/${date} ${result.filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, result.docx_b64, true);
          uploadedToYadisk = true;
        } catch (e) {
          console.error("Yadisk upload failed", e);
          setError(`Файл создан, но не загружен на Я.Диск: ${(e as Error).message}`);
        }
      }

      // Автоматически создаём работу в разделе «Работы»
      const newWork: Work = {
        id: result.workId,
        type: result.workType,
        subject: result.subject,
        classNum: result.classNum,
        classLetter,
        date: new Date().toISOString().slice(0, 10),
        totalQuestions: result.totalQuestions,
        part1Count: result.part1Count,
        part2Count: result.part2Count,
        answerKey: result.answerKey,
        gradeScale: result.gradeScale,
        maxScore: result.maxScore,
        topic: result.topic,
        generatedByAi: true,
      };
      appStore.addWork(newWork);

      // Сохраняем в историю генераций
      const item: GeneratedTestItem = {
        id: String(Date.now()),
        workId: result.workId,
        workType: result.workType,
        subject: result.subject,
        classNum: result.classNum,
        topic: result.topic,
        description: description.trim(),
        part1Count: result.part1Count,
        part2Count: result.part2Count,
        filename: result.filename,
        size: result.size,
        yadiskPath,
        uploadedToYadisk,
        createdAt: new Date().toISOString(),
        questions: result.questions,
      };
      appStore.addGeneratedTest(item);

      // Скачиваем файл
      downloadDocx(result.docx_b64, result.filename);

      setSuccess(
        `Готово! Работа №${result.workId} добавлена в раздел «Работы». ` +
        (uploadedToYadisk ? `Файл сохранён на Я.Диск.` : `Файл скачан локально.`)
      );
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать работу");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="animate-slide-up space-y-5">
      {/* Hero */}
      <div className="border border-border rounded-sm overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(160 60% 25%) 0%, hsl(160 50% 32%) 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Sparkles" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Тесты, проверочные и контрольные за минуту</h2>
          <p className="text-xs opacity-80">
            ИИ создаст вопросы по теме, рассчитает шкалу оценок и автоматически добавит работу в раздел «Работы»
            с готовыми ответами для сканера. Файл .docx сохранится на Я.Диск.
          </p>
        </div>
      </div>

      {/* Форма */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры работы</p>
        </div>
        <div className="p-5 space-y-4">

          {/* Тип работы */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Тип работы</label>
            <div className="grid grid-cols-3 gap-2">
              {WORK_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWorkType(t.value)}
                  disabled={busy}
                  className={`px-3 py-3 text-left border rounded-sm transition-colors ${
                    workType === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={t.icon} size={14} className={workType === t.value ? "text-primary" : "text-muted-foreground"} fallback="FileText" />
                    <span className={`text-sm font-semibold ${workType === t.value ? "text-primary" : "text-foreground"}`}>
                      {t.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Предмет + Класс */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Предмет</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Класс</label>
              <div className="flex gap-1">
                <select
                  value={classNum}
                  onChange={e => setClassNum(Number(e.target.value))}
                  disabled={busy}
                  className="flex-1 border border-border rounded-sm px-2 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {Array.from({ length: 11 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <select
                  value={classLetter}
                  onChange={e => setClassLetter(e.target.value)}
                  disabled={busy}
                  className="w-16 border border-border rounded-sm px-2 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {CLASS_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Тема */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Тема <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Например: Дроби и проценты"
              disabled={busy}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Описание / акценты
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="На что сделать упор: какие подтемы, типы заданий, уровень сложности"
              disabled={busy}
              rows={3}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
            />
          </div>

          {/* Количество вопросов */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Часть 1: с выбором ответа
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={part1Count}
                onChange={e => setPart1Count(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">4 варианта на каждый вопрос (А/Б/В/Г)</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Часть 2: с развёрнутым ответом
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={part2Count}
                onChange={e => setPart2Count(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Открытые вопросы (по желанию)</p>
            </div>
          </div>

          <div className="border border-dashed border-border rounded-sm p-3 bg-muted/30 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Учитель:</p>
              <p className="font-semibold">{teacher?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Школа:</p>
              <p className="font-semibold">{teacher?.school || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Всего заданий:</p>
              <p className="font-semibold mono">{part1Count + part2Count}</p>
            </div>
          </div>

          <div className={`border rounded-sm px-3 py-2.5 flex items-center gap-2 ${
            yadiskConnected ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"
          }`}>
            <Icon
              name={yadiskConnected ? "CloudCheck" : "CloudOff"}
              size={14}
              className={yadiskConnected ? "text-green-600" : "text-amber-600"}
              fallback="Cloud"
            />
            <span className="text-xs">
              {yadiskConnected
                ? <>Я.Диск подключён — файл попадёт в папку <span className="mono font-semibold">{TESTS_FOLDER}</span></>
                : "Я.Диск не подключён — файл только скачается. Подключите в «Настройках» для автозагрузки."}
            </span>
          </div>

          {error && (
            <div className="border border-destructive/40 bg-destructive/5 rounded-sm px-3 py-2.5 flex items-start gap-2">
              <Icon name="CircleAlert" size={14} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="border border-green-500/40 bg-green-500/5 rounded-sm px-3 py-2.5 flex items-start gap-2">
              <Icon name="CircleCheck" size={14} className="text-green-600 flex-shrink-0 mt-0.5" fallback="CheckCircle" />
              <p className="text-xs text-green-700">{success}</p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={busy || !topic.trim() || (part1Count + part2Count === 0)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Icon name={busy ? "Loader2" : "Sparkles"} size={15} className={busy ? "animate-spin" : ""} />
            {busy ? (stage || "Генерация…") : `Создать ${workType.toLowerCase()}`}
          </button>
        </div>
      </div>

      {/* История */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">История генераций</p>
          <span className="text-xs text-muted-foreground">{generatedTests.length}</span>
        </div>

        {generatedTests.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="FileText" size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">Здесь появятся созданные работы</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {generatedTests.map(t => (
              <TestRow key={t.id} item={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TestRow({ item }: { item: GeneratedTestItem }) {
  const [expanded, setExpanded] = useState(false);

  const onDelete = () => {
    if (confirm(`Удалить работу №${item.workId} из истории генераций? Сама работа в разделе «Работы» останется.`)) {
      appStore.removeGeneratedTest(item.id);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(160 60% 25% / 0.08)" }}>
          <Icon name="FileText" size={16} style={{ color: "hsl(160 60% 25%)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold mono px-2 py-0.5 rounded-sm bg-muted">№{item.workId}</span>
            <p className="text-sm font-semibold truncate">{item.topic}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{item.workType}</span>
            <span>·</span>
            <span>{item.subject}</span>
            <span>·</span>
            <span>{item.classNum} класс</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="ListChecks" size={11} />
              {item.part1Count + item.part2Count} зад. ({item.part1Count}+{item.part2Count})
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="HardDrive" size={11} />
              {formatBytes(item.size)}
            </span>
            {item.uploadedToYadisk ? (
              <span className="inline-flex items-center gap-1 text-green-600">
                <Icon name="CloudCheck" size={11} fallback="Cloud" />
                На Я.Диске
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Icon name="CloudOff" size={11} fallback="Cloud" />
                Не загружено
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Вопросы и ответы"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="Удалить"
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-12 space-y-3 pb-1">
          {item.questions.part1.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5 text-foreground">Часть 1 (с выбором ответа)</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                {item.questions.part1.map((q, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-foreground">{q.question}</span>
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-700 rounded-sm font-semibold">
                      Ответ: {q.answer}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.questions.part2.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5 text-foreground">Часть 2 (развёрнутый ответ)</p>
              <ol start={item.questions.part1.length + 1} className="space-y-1.5 list-decimal list-inside">
                {item.questions.part2.map((q, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-foreground">{q.question}</span>
                    {q.answer && (
                      <p className="ml-5 mt-0.5 text-muted-foreground italic">→ {q.answer}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.yadiskPath && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              <Icon name="Folder" size={11} className="inline -mt-0.5 mr-1" />
              {item.yadiskPath}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default TestsSection;
