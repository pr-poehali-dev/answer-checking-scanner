import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { taskRunner, useTaskState } from "@/lib/taskRunner";
import { appStore, useAppStore, type PresentationItem } from "@/store/appStore";
import { presentationApi } from "@/lib/api";
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

const TASK_KEY = "gen:presentations";
const REDESIGN_KEY = "gen:presentations-redesign";

export function PresentationsForm() {
  const { teacher, yadiskConnected, storageMode } = useAppStore();

  const [topic, setTopic]             = usePersistedState("presentations:topic", "");
  const [description, setDescription] = usePersistedState("presentations:description", "");
  const [audience, setAudience]       = usePersistedState("presentations:audience", AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = usePersistedState("presentations:slidesCount", 8);
  const [customDesign, setCustomDesign] = usePersistedState("presentations:customDesign", false);
  const task = useTaskState(TASK_KEY);
  const redesignTask = useTaskState(REDESIGN_KEY);
  const busy = task.running;
  const elapsed = task.elapsed;
  const progress = task.progress;
  const error = task.error || redesignTask.error;
  const success = task.success || redesignTask.success;
  const redesigning = redesignTask.running;
  const [lastDesign, setLastDesign]   = useState<
    { topic: string; rawOutline: object; variant: number; teacherName: string; teacherSchool: string } | null
  >(null);

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

  const generate = () => {
    if (busy) return;
    if (!topic.trim()) { taskRunner.run({ key: TASK_KEY, run: async () => { throw new Error("Укажите тему урока"); } }); return; }
    if (!teacher) return;

    const params = {
      topic: topic.trim(), description: description.trim(),
      audience, slidesCount, customDesign,
      teacherName: teacher.name, teacherSchool: teacher.school, login: teacher.login,
      yadiskToken: teacher.yadiskToken,
      useYadisk: storageMode === "yadisk" && yadiskConnected && !!teacher.yadiskToken,
    };

    setLastDesign(null);
    setTopic("");
    setDescription("");
    clearPersistedState("presentations:topic");
    clearPersistedState("presentations:description");

    taskRunner.run({
      key: TASK_KEY,
      autoProgress: true,
      run: async (handle) => {
        const result = await presentationApi.generate(
          { topic: params.topic, description: params.description, audience: params.audience,
            slidesCount: params.slidesCount, customDesign: params.customDesign,
            teacherName: params.teacherName, teacherSchool: params.teacherSchool, login: params.login },
          (s) => handle.setStage(s),
        );

        let yadiskPath: string | null = null;
        let uploadedToYadisk = false;

        if (params.useYadisk && params.yadiskToken) {
          try {
            handle.setStage("Загружаем на Яндекс.Диск…");
            await yadisk.ensureFolder(params.yadiskToken, PRESENTATIONS_FOLDER);
            const date = new Date().toISOString().slice(0, 10);
            yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
            await yadisk.uploadBinary(params.yadiskToken, yadiskPath, await getPptxBase64(result), true);
            uploadedToYadisk = true;
          } catch (e) {
            console.error("Yadisk upload failed", e);
          }
        }

        const item: PresentationItem = {
          id: String(Date.now()), topic: params.topic, description: params.description,
          audience: params.audience, slidesCount: params.slidesCount, filename: result.filename, size: result.size,
          yadiskPath, uploadedToYadisk, createdAt: new Date().toISOString(),
          outline: result.outline,
        };
        if (result.balance_rub !== undefined) {
          appStore.setAiBalance(Math.round(result.balance_rub * 100));
        }

        appStore.addPresentation(item);
        downloadPresentation(result, result.filename);

        if (result.rawOutline) {
          setLastDesign({
            topic: params.topic, rawOutline: result.rawOutline, variant: 1,
            teacherName: params.teacherName, teacherSchool: params.teacherSchool,
          });
        } else {
          setLastDesign(null);
        }

        const spentStr = (result.spent_rub ?? 0) > 0 ? ` · Списано: ${result.spent_rub!.toFixed(2)} ₽` : '';
        return uploadedToYadisk
          ? `Готово! Презентация сохранена на Я.Диск и скачана.${spentStr}`
          : `Презентация скачана.${spentStr}`;
      },
    });
  };

  const regenerateDesign = () => {
    if (!lastDesign || !teacher || redesigning) return;
    const design = lastDesign;
    const params = {
      audience, slidesCount,
      yadiskToken: teacher.yadiskToken,
      useYadisk: storageMode === "yadisk" && yadiskConnected && !!teacher.yadiskToken,
    };

    taskRunner.run({
      key: REDESIGN_KEY,
      autoProgress: true,
      run: async (handle) => {
        handle.setStage("Создаём новый дизайн…");
        const result = await presentationApi.redesign({
          topic: design.topic,
          teacherName: design.teacherName,
          teacherSchool: design.teacherSchool,
          rawOutline: design.rawOutline,
          designVariant: design.variant,
        });

        let yadiskPath: string | null = null;
        let uploadedToYadisk = false;
        if (params.useYadisk && params.yadiskToken) {
          try {
            await yadisk.ensureFolder(params.yadiskToken, PRESENTATIONS_FOLDER);
            const date = new Date().toISOString().slice(0, 10);
            yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
            await yadisk.uploadBinary(params.yadiskToken, yadiskPath, await getPptxBase64(result), true);
            uploadedToYadisk = true;
          } catch (e) {
            console.error("Yadisk upload failed", e);
          }
        }

        appStore.addPresentation({
          id: String(Date.now()), topic: design.topic, description: "",
          audience: params.audience, slidesCount: params.slidesCount, filename: result.filename, size: result.size,
          yadiskPath, uploadedToYadisk, createdAt: new Date().toISOString(),
          outline: result.outline,
        });
        downloadPresentation(result, result.filename);
        setLastDesign({ ...design, variant: design.variant + 1 });
        return "Готов новый вариант дизайна — файл скачан.";
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
          customDesign={customDesign}
          setCustomDesign={setCustomDesign}
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

        {/* Сгенерировать заново дизайн (только после индивидуального дизайна) */}
        {lastDesign && !busy && (
          <button
            onClick={regenerateDesign}
            disabled={redesigning}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-bold rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "#7C3AED", color: "#6D28D9", background: "white" }}
          >
            <Icon name={redesigning ? "Loader2" : "RefreshCw"} size={16}
              className={redesigning ? "animate-spin" : ""} fallback="Sparkles" />
            {redesigning ? "Создаём новый дизайн…" : "Сгенерировать заново дизайн"}
          </button>
        )}
        {lastDesign && !busy && (
          <p className="text-[10px] text-muted-foreground text-center -mt-3">
            Тот же материал — новое уникальное оформление. Без повторного списания.
          </p>
        )}
      </div>
    </div>
  );
}