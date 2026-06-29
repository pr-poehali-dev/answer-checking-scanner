import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState } from "@/hooks/usePersistedState";
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

export function PresentationsForm() {
  const { teacher, yadiskConnected } = useAppStore();

  const [topic, setTopic]             = usePersistedState("presentations:topic", "");
  const [description, setDescription] = usePersistedState("presentations:description", "");
  const [audience, setAudience]       = usePersistedState("presentations:audience", AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = usePersistedState("presentations:slidesCount", 8);
  const [customDesign, setCustomDesign] = usePersistedState("presentations:customDesign", false);
  const [busy, setBusy]               = useState(false);
  const [stage, setStage]             = useState("");
  const [elapsed, setElapsed]         = useState(0);
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [redesigning, setRedesigning] = useState(false);
  const [lastDesign, setLastDesign]   = useState<
    { topic: string; rawOutline: object; variant: number; teacherName: string; teacherSchool: string } | null
  >(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Прогреваем GigaChat-токен при открытии вкладки — экономим 15-20 сек на генерации
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

  useEffect(() => {
    if (busy) {
      setElapsed(0);
      setProgress(0);
      timerRef.current = setInterval(() => {
        setElapsed(s => s + 1);
        setProgress(p => {
          if (p < 40) return p + 2.2;
          if (p < 70) return p + 0.9;
          if (p < 88) return p + 0.3;
          return p;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
      setProgress(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [busy]);

  const autoStage = STAGE_HINTS.slice().reverse().find(([p]) => progress >= p)?.[1] ?? "";
  const displayStage = stage || autoStage;

  const generate = async () => {
    if (!topic.trim()) { setError("Укажите тему урока"); return; }
    if (!teacher) return;
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      const result = await presentationApi.generate(
        { topic: topic.trim(), description: description.trim(), audience, slidesCount, customDesign,
          teacherName: teacher.name, teacherSchool: teacher.school, login: teacher.login },
        (s) => setStage(s),
      );

      let yadiskPath: string | null = null;
      let uploadedToYadisk = false;

      if (yadiskConnected && teacher.yadiskToken) {
        try {
          setStage("Загружаем на Яндекс.Диск…");
          await yadisk.ensureFolder(teacher.yadiskToken, PRESENTATIONS_FOLDER);
          const date = new Date().toISOString().slice(0, 10);
          yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, await getPptxBase64(result), true);
          uploadedToYadisk = true;
        } catch (e) {
          console.error("Yadisk upload failed", e);
          setError(`Презентация создана, но не загружена на Я.Диск: ${(e as Error).message}`);
        }
      }

      const item: PresentationItem = {
        id: String(Date.now()), topic: topic.trim(), description: description.trim(),
        audience, slidesCount, filename: result.filename, size: result.size,
        yadiskPath, uploadedToYadisk, createdAt: new Date().toISOString(),
        outline: result.outline,
      };
      if (result.balance_rub !== undefined) {
        appStore.setAiBalance(Math.round(result.balance_rub * 100));
      }

      appStore.addPresentation(item);
      downloadPresentation(result, result.filename);

      // Сохраняем структуру для быстрой пересборки дизайна (только индивидуальный)
      if (result.rawOutline) {
        setLastDesign({
          topic: topic.trim(), rawOutline: result.rawOutline, variant: 1,
          teacherName: teacher.name, teacherSchool: teacher.school,
        });
      } else {
        setLastDesign(null);
      }

      const spentStr = (result.spent_rub ?? 0) > 0 ? ` · Списано: ${result.spent_rub!.toFixed(2)} ₽` : '';
      setSuccess(uploadedToYadisk
        ? `Готово! Презентация сохранена на Я.Диск и скачана.${spentStr}`
        : yadiskConnected
        ? `Презентация скачана.${spentStr}`
        : `Презентация скачана.${spentStr}`);
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать презентацию");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const regenerateDesign = async () => {
    if (!lastDesign || !teacher) return;
    setError(null);
    setSuccess(null);
    setRedesigning(true);
    try {
      const result = await presentationApi.redesign({
        topic: lastDesign.topic,
        teacherName: lastDesign.teacherName,
        teacherSchool: lastDesign.teacherSchool,
        rawOutline: lastDesign.rawOutline,
        designVariant: lastDesign.variant,
      });

      let yadiskPath: string | null = null;
      let uploadedToYadisk = false;
      if (yadiskConnected && teacher.yadiskToken) {
        try {
          await yadisk.ensureFolder(teacher.yadiskToken, PRESENTATIONS_FOLDER);
          const date = new Date().toISOString().slice(0, 10);
          yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, await getPptxBase64(result), true);
          uploadedToYadisk = true;
        } catch (e) {
          console.error("Yadisk upload failed", e);
        }
      }

      appStore.addPresentation({
        id: String(Date.now()), topic: lastDesign.topic, description: "",
        audience, slidesCount, filename: result.filename, size: result.size,
        yadiskPath, uploadedToYadisk, createdAt: new Date().toISOString(),
        outline: result.outline,
      });
      downloadPresentation(result, result.filename);
      setLastDesign({ ...lastDesign, variant: lastDesign.variant + 1 });
      setSuccess("Готов новый вариант дизайна — файл скачан.");
    } catch (e) {
      setError((e as Error).message || "Не удалось обновить дизайн");
    } finally {
      setRedesigning(false);
    }
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
