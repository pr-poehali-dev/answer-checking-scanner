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

// Превью тем — соответствуют бэкенду
const THEME_PREVIEWS = [
  { name: "ocean",  label: "Океан",    from: "#091E42", to: "#00B4D8", accent: "#48CAE4" },
  { name: "forest", label: "Лес",      from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  { name: "sunset", label: "Закат",    from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  { name: "slate",  label: "Квант",    from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  { name: "coral",  label: "Лаборат.", from: "#18222F", to: "#FF5E4B", accent: "#00D4C8" },
  { name: "arctic", label: "Арктика",  from: "#0A2A4A", to: "#4FC3F7", accent: "#E0F7FA" },
  { name: "dawn",   label: "Рассвет",  from: "#2C176E", to: "#FF8C42", accent: "#FFD166" },
  { name: "mono",   label: "Моно",     from: "#101010", to: "#E53E3E", accent: "#FFD700" },
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

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}

export function PresentationsSection() {
  const { teacher, presentations, yadiskConnected } = useAppStore();

  const synopsisTopic = sessionStorage.getItem("synopsis_topic") || "";
  const synopsisDesc  = sessionStorage.getItem("synopsis_description") || "";
  if (synopsisTopic) {
    sessionStorage.removeItem("synopsis_topic");
    sessionStorage.removeItem("synopsis_description");
  }

  const [topic, setTopic]           = useState(synopsisTopic);
  const [description, setDescription] = useState(synopsisDesc);
  const [audience, setAudience]     = useState(AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = useState(8);
  const [busy, setBusy]             = useState(false);
  const [stage, setStage]           = useState("");
  const [elapsed, setElapsed]       = useState(0);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const STAGE_HINTS: [number, string][] = [
    [0,  "Подключаемся к ИИ…"],
    [5,  "ИИ изучает тему урока…"],
    [20, "Формируем структуру слайдов…"],
    [45, "Генерируем содержание…"],
    [60, "Подбираем фотографии…"],
    [75, "Собираем PPTX-файл…"],
    [88, "Финальная обработка…"],
  ];
  const autoStage = STAGE_HINTS.slice().reverse().find(([p]) => progress >= p)?.[1] ?? "";
  const displayStage = stage || autoStage;

  const generate = async () => {
    if (!topic.trim()) { setError("Укажите тему урока"); return; }
    if (!teacher) return;
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      setStage("ИИ готовит структуру презентации…");
      const result = await presentationApi.generate(
        { topic: topic.trim(), description: description.trim(), audience, slidesCount,
          teacherName: teacher.name, teacherSchool: teacher.school, login: teacher.login },
        (attempt) => setStage(`Повторная попытка ${attempt} из 3 — ИИ-сервис занят…`),
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
    <div className="animate-slide-up space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden" style={{
        background: "linear-gradient(135deg, #0D1B3E 0%, #1B3A6B 50%, #0D4080 100%)",
        minHeight: 140,
      }}>
        {/* Декоративные слайды-превью */}
        <div className="absolute right-0 top-0 bottom-0 w-72 overflow-hidden opacity-30 pointer-events-none hidden md:flex items-center gap-2 pr-4">
          {THEME_PREVIEWS.slice(0, 4).map((t, i) => (
            <div key={t.name} className="flex-shrink-0 w-24 h-16 rounded-md shadow-xl"
              style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
                transform: `rotate(${[-4, 2, -3, 5][i]}deg) translateY(${[4, -6, 2, -8][i]}px)` }}>
              <div className="h-3 w-full rounded-t-md" style={{ background: t.accent, opacity: 0.6 }} />
              <div className="px-1.5 pt-1 space-y-1">
                <div className="h-1.5 rounded-full bg-white/30 w-3/4" />
                <div className="h-1 rounded-full bg-white/20 w-full" />
                <div className="h-1 rounded-full bg-white/20 w-2/3" />
              </div>
            </div>
          ))}
        </div>

        <div className="relative px-6 py-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,200,0,0.25)" }}>
              <Icon name="Sparkles" size={13} className="text-yellow-300" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest opacity-70">ИИ-генератор презентаций</span>
          </div>
          <h2 className="text-xl font-bold mb-1 max-w-md">
            Красивые презентации за 60 секунд
          </h2>
          <p className="text-xs opacity-65 max-w-sm leading-relaxed">
            8 уникальных дизайн-тем, реальные фотографии, структура по ФГОС.
            Каждая презентация — стильная и непохожая на остальные.
          </p>

          {/* Темы-чипы */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {THEME_PREVIEWS.map(t => (
              <div key={t.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: `linear-gradient(90deg, ${t.from}CC, ${t.to}99)`, border: `1px solid ${t.accent}44` }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.accent }} />
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Форма ─────────────────────────────────────────────────────────── */}
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
                  GigaChat работает над содержанием — обычно 2–5 минут. Не закрывайте страницу.
                </p>
              </div>
              <div className="px-4 py-2 border-t border-primary/10 flex gap-4">
                {["Структура", "Содержание", "Фото", "PPTX"].map((step, i) => {
                  const pct = [5, 45, 65, 80][i];
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

      {/* ── История ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--muted))" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="History" size={15} className="text-muted-foreground" />
            <p className="text-sm font-bold">История презентаций</p>
          </div>
          {presentations.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {presentations.length}
            </span>
          )}
        </div>

        {presentations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0D1B3E10, #00B4D820)" }}>
              <Icon name="Presentation" size={26} className="text-primary/50" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Здесь появятся ваши презентации</p>
            <p className="text-xs text-muted-foreground">Создайте первую — займёт около минуты</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {presentations.slice().reverse().map(p => (
              <PresentationCard key={p.id} item={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Карточка презентации ────────────────────────────────────────────────────

const TOPIC_THEMES: Record<string, { from: string; to: string; accent: string }> = {
  биол: { from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  экол: { from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  истор: { from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  литер: { from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  физик: { from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  матем: { from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  хими: { from: "#18222F", to: "#FF5E4B", accent: "#00D4C8" },
  геогр: { from: "#0A2A4A", to: "#4FC3F7", accent: "#E0F7FA" },
  искусств: { from: "#2C176E", to: "#FF8C42", accent: "#FFD166" },
  default: { from: "#091E42", to: "#00B4D8", accent: "#48CAE4" },
};

function getTopicTheme(topic: string) {
  const t = topic.toLowerCase();
  for (const [kw, colors] of Object.entries(TOPIC_THEMES)) {
    if (kw !== "default" && t.includes(kw)) return colors;
  }
  return TOPIC_THEMES.default;
}

function PresentationCard({ item }: { item: PresentationItem }) {
  const [expanded, setExpanded] = useState(false);
  const th = getTopicTheme(item.topic);

  const onDelete = () => {
    if (confirm(`Удалить «${item.topic}» из истории? Файл на Я.Диске останется.`)) {
      appStore.removePresentation(item.id);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        {/* Цветная миниатюра */}
        <div className="w-12 h-12 rounded-xl flex-shrink-0 relative overflow-hidden shadow-sm"
          style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}>
          <div className="absolute top-0 left-0 right-0 h-2" style={{ background: th.accent, opacity: 0.7 }} />
          <div className="absolute inset-x-1.5 top-3 space-y-0.5">
            <div className="h-0.5 rounded-full bg-white/40" />
            <div className="h-0.5 rounded-full bg-white/25 w-3/4" />
            <div className="h-0.5 rounded-full bg-white/25 w-1/2" />
          </div>
          <div className="absolute bottom-1 right-1 w-4 h-3 rounded-sm"
            style={{ background: `${th.accent}60` }} />
        </div>

        {/* Мета */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate mb-1">{item.topic}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon name="Layers" size={10} />
              {item.outline.slides.length + 3} слайдов
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="HardDrive" size={10} />
              {formatBytes(item.size)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Calendar" size={10} />
              {new Date(item.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </span>
            <span className={`inline-flex items-center gap-1 ${item.uploadedToYadisk ? "text-green-600" : "text-amber-600"}`}>
              <Icon name={item.uploadedToYadisk ? "CloudCheck" : "CloudOff"} size={10} fallback="Cloud" />
              {item.uploadedToYadisk ? "Я.Диск" : "Не загружено"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{item.audience}</p>
        </div>

        {/* Кнопки */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Структура"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={13} />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors"
            title="Удалить из истории"
          >
            <Icon name="Trash2" size={13} />
          </button>
        </div>
      </div>

      {/* Раскрытая структура */}
      {expanded && (
        <div className="mt-3 ml-15 rounded-xl overflow-hidden border border-border"
          style={{ marginLeft: "calc(3rem + 12px)" }}>
          {/* Подзаголовок */}
          {item.outline.subtitle && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border italic"
              style={{ background: `${th.from}08` }}>
              {item.outline.subtitle}
            </div>
          )}
          {/* Слайды */}
          <div className="divide-y divide-border">
            {item.outline.slides.map((s, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2.5">
                <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-5 text-right"
                  style={{ color: th.accent }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{s.title}</p>
                  {s.bullets.slice(0, 2).map((b, j) => (
                    <p key={j} className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                      {b}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Выводы */}
          {item.outline.conclusion?.length > 0 && (
            <div className="px-3 py-2 border-t border-border" style={{ background: `${th.from}06` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: th.accent }}>
                Выводы
              </p>
              {item.outline.conclusion.slice(0, 2).map((c, i) => (
                <p key={i} className="text-[10px] text-muted-foreground leading-relaxed line-clamp-1">{c}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}