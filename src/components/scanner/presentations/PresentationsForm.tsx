import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { taskRunner, useTaskState } from "@/lib/taskRunner";
import { appStore, useAppStore, type PresentationItem } from "@/store/appStore";
import { presentationApi, type PresentationOutlineFull, type PresentationThemePayload } from "@/lib/api";
import { yadisk } from "@/lib/yadisk";
import {
  PRESENTATIONS_FOLDER,
  AUDIENCE_PRESETS,
  STAGE_HINTS,
  downloadPresentation,
  getPptxBase64,
} from "./presentationUtils";
import { PresentationsFormFields } from "./PresentationsFormFields";
import { PresentationsProgress } from "./PresentationsProgress";
import { PresentationEditor } from "./PresentationEditor";

const TASK_KEY = "gen:presentations";
const BUILD_KEY = "gen:presentations-build";

export function PresentationsForm() {
  const { teacher, yadiskConnected, storageMode } = useAppStore();

  const [topic, setTopic]             = usePersistedState("presentations:topic", "");
  const [description, setDescription] = usePersistedState("presentations:description", "");
  const [audience, setAudience]       = usePersistedState("presentations:audience", AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = usePersistedState("presentations:slidesCount", 8);
  const task = useTaskState(TASK_KEY);
  const buildTask = useTaskState(BUILD_KEY);
  const busy = task.running;
  const elapsed = task.elapsed;
  const progress = task.progress;
  const error = task.error || buildTask.error;
  const success = task.success || buildTask.success;

  // Данные для редактора: структура + варианты дизайна, полученные после генерации
  const [editorData, setEditorData] = useState<{
    topic: string; outline: PresentationOutlineFull; themeOptions: PresentationThemePayload[];
    audience: string; slidesCount: number; teacherName: string; teacherSchool: string;
  } | null>(null);

  // Прогреваем токен при открытии вкладки — экономим 15-20 сек на генерации
  useEffect(() => { presentationApi.warmup(); }, []);

  // Предзаполнение из конспекта (если пришли из раздела «Конспекты») — приоритет над черновиком
  useEffect(() => {
    const synopsisTopic = sessionStorage.getItem("synopsis_topic") || "";
    const synopsisDesc = sessionStorage.getItem("synopsis_description") || "";
    if (synopsisTopic) {
      setTopic(synopsisTopic);
      setDescription(synopsisDesc);
      sessionStorage.removeItem("synopsis_topic");
      sessionStorage.removeItem("synopsis_description");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoStage = STAGE_HINTS.slice().reverse().find(([p]) => progress >= p)?.[1] ?? "";
  const displayStage = task.stage || autoStage;

  // Шаг 1: генерируем структуру + варианты дизайна, затем открываем редактор
  const generate = () => {
    if (busy) return;
    if (!topic.trim()) { taskRunner.run({ key: TASK_KEY, run: async () => { throw new Error("Укажите тему урока"); } }); return; }
    if (!teacher) return;

    const params = {
      topic: topic.trim(), description: description.trim(),
      audience, slidesCount,
      teacherName: teacher.name, teacherSchool: teacher.school, login: teacher.login,
    };

    setTopic("");
    setDescription("");
    clearPersistedState("presentations:topic");
    clearPersistedState("presentations:description");

    taskRunner.run({
      key: TASK_KEY,
      autoProgress: true,
      run: async (handle) => {
        handle.setStage("ИИ генерирует структуру презентации…");
        const result = await presentationApi.generateOutline({
          topic: params.topic, description: params.description,
          audience: params.audience, slidesCount: params.slidesCount, login: params.login,
        });

        if (result.balance_rub !== undefined) {
          appStore.setAiBalance(Math.round(result.balance_rub * 100));
        }

        setEditorData({
          topic: params.topic, outline: result.outline, themeOptions: result.theme_options,
          audience: params.audience, slidesCount: params.slidesCount,
          teacherName: params.teacherName, teacherSchool: params.teacherSchool,
        });

        const spentStr = (result.spent_rub ?? 0) > 0 ? ` · Списано: ${(result.spent_rub ?? 0).toFixed(2)} ₽` : '';
        return `Структура готова — отредактируйте текст и оформление, затем скачайте.${spentStr}`;
      },
    });
  };

  // Шаг 2: собираем PPTX из (возможно отредактированной) структуры и выбранной темы
  const handleDownload = (outline: PresentationOutlineFull, theme: PresentationThemePayload) => {
    if (!editorData || !teacher || buildTask.running) return;
    const data = editorData;

    taskRunner.run({
      key: BUILD_KEY,
      autoProgress: true,
      run: async (handle) => {
        handle.setStage("Подбираем фотографии и собираем файл…");
        const result = await presentationApi.build({
          topic: data.topic, teacherName: data.teacherName, teacherSchool: data.teacherSchool,
          outline, themePayload: theme,
        });

        let yadiskPath: string | null = null;
        let uploadedToYadisk = false;
        const useYadisk = storageMode === "yadisk" && yadiskConnected && !!teacher.yadiskToken;

        if (useYadisk && teacher.yadiskToken) {
          try {
            handle.setStage("Загружаем на Яндекс.Диск…");
            await yadisk.ensureFolder(teacher.yadiskToken, PRESENTATIONS_FOLDER);
            const date = new Date().toISOString().slice(0, 10);
            yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
            await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, await getPptxBase64(result), true);
            uploadedToYadisk = true;
          } catch (e) {
            console.error("Yadisk upload failed", e);
          }
        }

        const item: PresentationItem = {
          id: String(Date.now()), topic: data.topic, description: "",
          audience: data.audience, slidesCount: data.slidesCount, filename: result.filename, size: result.size,
          yadiskPath, uploadedToYadisk, createdAt: new Date().toISOString(),
          outline: result.outline,
        };
        appStore.addPresentation(item);
        downloadPresentation(result, result.filename);
        setEditorData(null);

        return uploadedToYadisk
          ? "Готово! Презентация сохранена на Я.Диск и скачана."
          : "Презентация скачана.";
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
          <p className="text-sm font-bold">Параметры урока</p>
          <p className="text-[10px] text-muted-foreground">Заполните тему — остальное ИИ сделает сам</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <PresentationsFormFields
          topic={topic}
          setTopic={setTopic}
          description={description}
          setDescription={setDescription}
          audience={audience}
          setAudience={setAudience}
          slidesCount={slidesCount}
          setSlidesCount={setSlidesCount}
          busy={busy}
          generate={generate}
          teacher={teacher}
          yadiskConnected={yadiskConnected}
        />

        <PresentationsProgress
          error={error}
          success={success}
          busy={busy}
          displayStage={displayStage}
          elapsed={elapsed}
          progress={progress}
        />

        {/* Кнопка */}
        <button
          onClick={generate}
          disabled={busy || !topic.trim()}
          className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: busy ? undefined : "linear-gradient(135deg, #0D1B3E, #1B3A6B)",
            color: "white", boxShadow: busy ? undefined : "0 4px 15px rgba(13,27,62,0.3)" }}
        >
          <Icon name={busy ? "Loader2" : "Wand2"} size={16} className={busy ? "animate-spin" : ""} fallback="Sparkles" />
          {busy ? "Генерация идёт…" : "Создать презентацию"}
        </button>
      </div>

      {editorData && (
        <PresentationEditor
          topic={editorData.topic}
          outline={editorData.outline}
          themeOptions={editorData.themeOptions}
          busy={buildTask.running}
          onDownload={handleDownload}
          onClose={() => setEditorData(null)}
        />
      )}
    </div>
  );
}