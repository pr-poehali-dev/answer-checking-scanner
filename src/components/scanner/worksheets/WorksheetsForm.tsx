import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { taskRunner, useTaskState } from "@/lib/taskRunner";
import { appStore, useAppStore, type WorksheetItem } from "@/store/appStore";
import { worksheetApi } from "@/lib/api";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";
import { SUBJECTS } from "../types";

const TASK_KEY = "gen:worksheets";

export const WORKSHEETS_FOLDER = `${ROOT_FOLDER}/Рабочие листы`;

const CLASS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function triggerDownload(href: string, filename: string, revoke?: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 1500);
}

function downloadWorksheet(result: { docx_url?: string; docx_b64?: string }, filename: string) {
  if (result.docx_url) {
    triggerDownload(result.docx_url, filename);
  } else if (result.docx_b64) {
    const bin = atob(result.docx_b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename, url);
  }
}

async function getDocxBase64(result: { docx_url?: string; docx_b64?: string }): Promise<string> {
  if (result.docx_b64) return result.docx_b64;
  if (result.docx_url) {
    const res = await fetch(result.docx_url);
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  throw new Error("Файл не получен");
}

export function WorksheetsForm() {
  const { teacher, yadiskConnected, storageMode } = useAppStore();

  const [subject, setSubject] = usePersistedState<string>("worksheets:subject", SUBJECTS[0]);
  const [classNum, setClassNum] = usePersistedState("worksheets:classNum", 7);
  const [topic, setTopic] = usePersistedState("worksheets:topic", "");
  const [description, setDescription] = usePersistedState("worksheets:description", "");
  const [tasksCount, setTasksCount] = usePersistedState("worksheets:tasksCount", 6);
  const [withImages, setWithImages] = usePersistedState("worksheets:withImages", true);
  const task = useTaskState(TASK_KEY);
  const busy = task.running;
  const stage = task.stage;
  const error = task.error;
  const success = task.success;

  // Предзаполнение из конспекта (если пришли из раздела «Конспекты») — приоритет над черновиком
  useEffect(() => {
    const synTopic = sessionStorage.getItem("synopsis_worksheet_topic") || "";
    const synSubject = sessionStorage.getItem("synopsis_worksheet_subject") || "";
    const synClass = Number(sessionStorage.getItem("synopsis_worksheet_class") || "0");
    const synDesc = sessionStorage.getItem("synopsis_worksheet_description") || "";
    if (synTopic) {
      setTopic(synTopic);
      if (synSubject) setSubject(synSubject);
      if (synClass) setClassNum(synClass);
      setDescription(synDesc);
      sessionStorage.removeItem("synopsis_worksheet_topic");
      sessionStorage.removeItem("synopsis_worksheet_subject");
      sessionStorage.removeItem("synopsis_worksheet_class");
      sessionStorage.removeItem("synopsis_worksheet_description");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = () => {
    if (busy) return;
    if (!topic.trim()) { taskRunner.run({ key: TASK_KEY, run: async () => { throw new Error("Укажите тему"); } }); return; }
    if (!teacher) return;

    // Захватываем значения формы на момент запуска
    const params = {
      subject, classNum,
      topic: topic.trim(),
      description: description.trim(),
      tasksCount, withImages,
      teacherName: teacher.name,
      teacherSchool: teacher.school,
      login: teacher.login,
      yadiskToken: teacher.yadiskToken,
      useYadisk: storageMode === "yadisk" && yadiskConnected && !!teacher.yadiskToken,
    };

    // Очищаем поля сразу — черновик не мешает следующей генерации
    setTopic("");
    setDescription("");
    clearPersistedState("worksheets:topic");
    clearPersistedState("worksheets:description");

    taskRunner.run({
      key: TASK_KEY,
      run: async (handle) => {
        handle.setStage("ИИ подбирает материал по программе Минпросвещения…");
        const result = await worksheetApi.generate({
          subject: params.subject, classNum: params.classNum,
          topic: params.topic, description: params.description,
          tasksCount: params.tasksCount, withImages: params.withImages,
          teacherName: params.teacherName, teacherSchool: params.teacherSchool,
          login: params.login,
        });

        let yadiskPath: string | null = null;
        let uploadedToYadisk = false;

        if (params.useYadisk && params.yadiskToken) {
          try {
            handle.setStage("Загружаем на Яндекс.Диск…");
            await yadisk.ensureFolder(params.yadiskToken, WORKSHEETS_FOLDER);
            const date = new Date().toISOString().slice(0, 10);
            yadiskPath = `${WORKSHEETS_FOLDER}/${date} ${result.filename}`;
            await yadisk.uploadBinary(params.yadiskToken, yadiskPath, await getDocxBase64(result), true);
            uploadedToYadisk = true;
          } catch (e) {
            console.error("Yadisk upload failed", e);
          }
        }

        const item: WorksheetItem = {
          id: String(Date.now()),
          title: result.title,
          subject: result.subject,
          classNum: result.classNum,
          topic: result.topic,
          description: params.description,
          tasksCount: result.tasksCount,
          imagesAdded: result.imagesAdded,
          filename: result.filename,
          size: result.size,
          yadiskPath,
          uploadedToYadisk,
          createdAt: new Date().toISOString(),
          intro: result.intro,
          conclusion: result.conclusion,
          tasks: result.tasks,
        };
        appStore.addWorksheet(item);

        if (result.balance_rub !== undefined) {
          appStore.setAiBalance(Math.round(result.balance_rub * 100));
        }

        downloadWorksheet(result, result.filename);

        const spentStr = (result.spent_rub ?? 0) > 0 ? ` · Списано: ${result.spent_rub!.toFixed(2)} ₽` : "";
        const imgStr = result.imagesAdded > 0 ? ` · Добавлено иллюстраций: ${result.imagesAdded}` : "";
        return `Готово! Рабочий лист на ${result.tasksCount} заданий создан.${imgStr}${spentStr} ` +
          (uploadedToYadisk ? "Файл сохранён на Я.Диск." : "Файл скачан локально.");
      },
    });
  };

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3" style={{ background: "hsl(var(--muted))" }}>
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="PenLine" size={14} className="text-primary" fallback="Edit" />
        </div>
        <div>
          <p className="text-sm font-bold">Параметры рабочего листа</p>
          <p className="text-[10px] text-muted-foreground">Укажите тему и класс — ИИ составит выполнимые задания с нужными данными</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Предмет + класс */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Предмет</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={busy}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Класс</label>
            <select
              value={classNum}
              onChange={e => setClassNum(Number(e.target.value))}
              disabled={busy}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c} класс</option>)}
            </select>
          </div>
        </div>

        {/* Тема */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Тема урока</label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            disabled={busy}
            placeholder="Например: Обыкновенные дроби"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {/* Описание */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Описание / акцент <span className="font-normal opacity-60">(необязательно)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="На что сделать упор, какие подтемы охватить, уровень сложности…"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {/* Что попадёт в лист */}
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="Layers" size={13} className="text-primary" fallback="List" />
            <p className="text-xs font-bold">Что войдёт в рабочий лист</p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {[
              ["Table2", "Таблицы с данными"],
              ["FileText", "Тексты-источники"],
              ["Map", "Карты и схемы"],
              ["Image", "Фотографии"],
              ["PenLine", "Поля для ответов"],
              ["CircleCheck", "Готов к печати"],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon name={icon} size={12} className="text-primary/70 flex-shrink-0" fallback="Check" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
            Данные прикладываются прямо к заданиям — ученик решает всё на листе, без других источников.
          </p>
        </div>

        {/* Кол-во заданий */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Количество заданий: <span className="text-primary font-bold">{tasksCount}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={tasksCount}
            onChange={e => setTasksCount(Number(e.target.value))}
            disabled={busy}
            className="w-full accent-primary disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>1</span><span>20</span>
          </div>
        </div>

        {/* Иллюстрации */}
        <button
          type="button"
          onClick={() => setWithImages(v => !v)}
          disabled={busy}
          className={`w-full text-left rounded-xl border p-4 transition-all disabled:opacity-50 ${
            withImages ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${withImages ? "bg-primary/15" : "bg-muted"}`}>
              <Icon name="Image" size={18} className={withImages ? "text-primary" : "text-muted-foreground"} fallback="ImagePlus" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${withImages ? "text-primary" : "text-foreground"}`}>Иллюстрации, фото и карты</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                ИИ приложит изображения к заданиям, где они нужны для выполнения
              </p>
            </div>
            <div className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-all ${withImages ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${withImages ? "left-[22px]" : "left-0.5"}`} />
            </div>
          </div>
        </button>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5">
            <Icon name="CircleAlert" size={14} className="flex-shrink-0 mt-0.5" fallback="AlertCircle" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <Icon name="CircleCheck" size={14} className="flex-shrink-0 mt-0.5" fallback="CheckCircle" />
            <span>{success}</span>
          </div>
        )}

        <button
          onClick={generate}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-bold rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name={busy ? "Loader2" : "Sparkles"} size={16} className={busy ? "animate-spin" : ""} fallback="Wand2" />
          {busy ? (stage || "Создаём рабочий лист…") : "Создать рабочий лист"}
        </button>

        {busy && (
          <p className="text-[10px] text-muted-foreground text-center">
            Обычно занимает 20–60 секунд. Подбираем материал и приложения к заданиям.
          </p>
        )}
      </div>
    </div>
  );
}