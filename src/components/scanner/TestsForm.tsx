import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type GeneratedTestItem, type Work } from "@/store/appStore";
import { testApi, type WorkTypeName } from "@/lib/api";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";
import { SUBJECTS } from "./types";

export const TESTS_FOLDER = `${ROOT_FOLDER}/Тесты`;

export const WORK_TYPES: { value: WorkTypeName; label: string; icon: string; desc: string }[] = [
  { value: "Тест", label: "Тест", icon: "ListChecks", desc: "Короткая проверка по теме" },
  { value: "Проверочная работа", label: "Проверочная", icon: "ClipboardCheck", desc: "Текущий контроль" },
  { value: "Контрольная работа", label: "Контрольная", icon: "FileCheck2", desc: "Итоговый контроль" },
];

export const CLASS_LETTERS = ["А", "Б", "В", "Г", "Д"];

export function downloadDocx(b64: string, filename: string) {
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

export function TestsForm() {
  const { teacher, yadiskConnected } = useAppStore();

  // Предзаполнение из конспекта (если пришли из раздела «Конспекты»)
  const synTopic = sessionStorage.getItem("synopsis_test_topic") || "";
  const synSubject = sessionStorage.getItem("synopsis_test_subject") || "";
  const synClass = Number(sessionStorage.getItem("synopsis_test_class") || "0");
  const synDesc = sessionStorage.getItem("synopsis_test_description") || "";
  if (synTopic) {
    sessionStorage.removeItem("synopsis_test_topic");
    sessionStorage.removeItem("synopsis_test_subject");
    sessionStorage.removeItem("synopsis_test_class");
    sessionStorage.removeItem("synopsis_test_description");
  }

  const [workType, setWorkType] = useState<WorkTypeName>("Тест");
  const [subject, setSubject] = useState<string>(synSubject || SUBJECTS[0]);
  const [classNum, setClassNum] = useState(synClass || 7);
  const [classLetter, setClassLetter] = useState("А");
  const [topic, setTopic] = useState(synTopic);
  const [description, setDescription] = useState(synDesc);
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
        login: teacher.login,
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
  );
}