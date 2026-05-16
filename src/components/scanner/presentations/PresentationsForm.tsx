import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type PresentationItem } from "@/store/appStore";
import { presentationApi } from "@/lib/api";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";

const PRESENTATIONS_FOLDER = `${ROOT_FOLDER}/Презентации`;
const SLIDE_OPTIONS = [5, 7, 8, 10, 12, 14];
const AUDIENCE_PRESETS = [
  "Ученики 5–6 классов",
  "Ученики 7–8 классов",
  "Ученики 9 класса",
  "Ученики 10–11 классов",
  "Подготовка к ОГЭ",
  "Подготовка к ЕГЭ",
];

function downloadBase64(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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

const STAGE_HINTS: [number, string][] = [
  [0,  "Подключаемся к ИИ…"],
  [5,  "ИИ изучает тему урока…"],
  [15, "Формируем структуру слайдов…"],
  [40, "Генерируем содержание слайдов…"],
  [80, "Подбираем фотографии…"],
  [90, "Собираем PPTX-файл…"],
  [96, "Финальная обработка…"],
];

export function PresentationsForm() {
  const { teacher, yadiskConnected } = useAppStore();

  const synopsisTopic = sessionStorage.getItem("synopsis_topic") || "";
  const synopsisDesc  = sessionStorage.getItem("synopsis_description") || "";
  if (synopsisTopic) {
    sessionStorage.removeItem("synopsis_topic");
    sessionStorage.removeItem("synopsis_description");
  }

  const [topic, setTopic]             = useState(synopsisTopic);
  const [description, setDescription] = useState(synopsisDesc);
  const [audience, setAudience]       = useState(AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = useState(8);
  const [busy, setBusy]               = useState(false);
  const [stage, setStage]             = useState("");
  const [elapsed, setElapsed]         = useState(0);
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Прогреваем GigaChat-токен при открытии вкладки — экономим 15-20 сек на генерации
  useEffect(() => { presentationApi.warmup(); }, []);

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
        { topic: topic.trim(), description: description.trim(), audience, slidesCount,
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
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, result.pptx_b64, true);
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
      appStore.addPresentation(item);
      downloadBase64(result.pptx_b64, result.filename);

      setSuccess(uploadedToYadisk
        ? "Готово! Презентация сохранена на Я.Диск и скачана."
        : yadiskConnected
        ? "Презентация скачана. Проверьте подключение Я.Диска для автозагрузки."
        : "Презентация скачана. Подключите Я.Диск в «Настройках» для автоматической загрузки.");
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать презентацию");
    } finally {
      setBusy(false);
      setStage("");
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
        {/* Тема */}
        <div>
          <label className="text-xs font-bold text-foreground block mb-1.5">
            Тема урока <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !busy && generate()}
            placeholder="Например: Фотосинтез и его роль в природе"
            disabled={busy}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 transition-all"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Тема определяет дизайн-тему — биология получит зелёную, история — золотую и т.д.
          </p>
        </div>

        {/* Описание */}
        <div>
          <label className="text-xs font-bold text-foreground block mb-1.5">
            Описание / контекст <span className="text-muted-foreground font-normal">(необязательно)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="На что сделать акцент, какие подтемы раскрыть, примеры. Чем подробнее — тем точнее результат."
            disabled={busy}
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:opacity-50 transition-all"
          />
        </div>

        {/* Аудитория + слайды */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">Аудитория</label>
            <select
              value={audience}
              onChange={e => setAudience(e.target.value)}
              disabled={busy}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              {AUDIENCE_PRESETS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">
              Слайдов с содержанием
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SLIDE_OPTIONS.map(n => (
                <button key={n} type="button" onClick={() => setSlidesCount(n)} disabled={busy}
                  className={`w-10 h-10 text-sm font-bold rounded-lg border transition-all ${
                    slidesCount === n
                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                      : "border-border hover:border-primary/40 hover:bg-primary/5"
                  } disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              всего {slidesCount + 3} слайда (+ титул, выводы, финал)
            </p>
          </div>
        </div>

        {/* Подпись + Я.Диск */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5 bg-muted/30">
            <Icon name="UserCircle" size={15} className="text-muted-foreground flex-shrink-0" fallback="User" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Подпись на слайдах</p>
              <p className="text-xs font-semibold truncate">{teacher?.name}{teacher?.school ? ` · ${teacher.school}` : ""}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
            yadiskConnected ? "border-green-500/30 bg-green-50" : "border-amber-500/30 bg-amber-50"
          }`}>
            <Icon name={yadiskConnected ? "CloudCheck" : "CloudOff"} size={15}
              className={yadiskConnected ? "text-green-600 flex-shrink-0" : "text-amber-600 flex-shrink-0"}
              fallback="Cloud" />
            <div className="min-w-0">
              <p className={`text-[10px] ${yadiskConnected ? "text-green-700" : "text-amber-700"}`}>
                {yadiskConnected ? "Я.Диск подключён — файл сохранится автоматически" : "Я.Диск не подключён — только скачается"}
              </p>
            </div>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2.5">
            <Icon name="CircleAlert" size={15} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Успех */}
        {success && (
          <div className="rounded-lg border border-green-500/30 bg-green-50 px-4 py-3 flex items-start gap-2.5">
            <Icon name="CircleCheck" size={15} className="text-green-600 flex-shrink-0 mt-0.5" fallback="CheckCircle" />
            <p className="text-xs text-green-700 leading-relaxed">{success}</p>
          </div>
        )}

        {/* Прогресс */}
        {busy && (
          <div className="rounded-xl border border-primary/20 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0D1B3E08, #1B3A6B10)" }}>
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-xs font-semibold text-primary">{displayStage}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {Math.floor(elapsed / 60) > 0
                    ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
                    : `${elapsed} сек`}
                </span>
              </div>
              <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                  style={{ width: `${Math.min(progress, 95)}%`,
                    background: "linear-gradient(90deg, #1B3A6B, #00B4D8)" }}>
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <p className="text-[10px] text-primary/50 mt-1.5">
                Шаг 1: ИИ генерирует структуру (~60 сек) → Шаг 2: фото и сборка файла (~15 сек). Не закрывайте страницу.
              </p>
            </div>
            <div className="px-4 py-2 border-t border-primary/10 flex gap-4">
              {["Структура", "Содержание", "Фото", "PPTX"].map((step, i) => {
                const pct = [5, 40, 80, 90][i];
                const done = progress >= pct;
                return (
                  <div key={step} className="flex items-center gap-1">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      done ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {done && <Icon name="Check" size={8} className="text-white" />}
                    </div>
                    <span className={`text-[10px] ${done ? "text-primary font-semibold" : "text-muted-foreground"}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
    </div>
  );
}