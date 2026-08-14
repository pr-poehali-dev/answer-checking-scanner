import Icon from "@/components/ui/icon";
import { SLIDE_OPTIONS, DESIGN_SWATCHES, AUDIENCE_PRESETS } from "./presentationUtils";

interface PresentationsFormFieldsProps {
  topic: string;
  setTopic: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  slidesCount: number;
  setSlidesCount: (v: number) => void;
  busy: boolean;
  generate: () => void;
  teacher: { name?: string; school?: string } | null;
  yadiskConnected: boolean;
}

export function PresentationsFormFields({
  topic,
  setTopic,
  description,
  setDescription,
  audience,
  setAudience,
  slidesCount,
  setSlidesCount,
  busy,
  generate,
  teacher,
  yadiskConnected,
}: PresentationsFormFieldsProps) {
  return (
    <>
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
        </div>
      </div>

      {/* Оформление подбирает ИИ — выбор вариантов будет доступен в редакторе после генерации */}
      <div className="w-full rounded-xl border border-transparent p-4 shadow-sm"
        style={{ background: "linear-gradient(135deg, #6D28D9, #DB2777 55%, #F59E0B)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/20">
            <Icon name="Sparkles" size={18} className="text-white" fallback="Wand2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">
              Оформление подбирает ИИ
            </p>
            <p className="text-[11px] leading-snug text-white/85">
              Цвета, шрифты и композиция каждый раз разные — под настроение темы. Готовые варианты можно сравнить и отредактировать в редакторе перед скачиванием
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {DESIGN_SWATCHES.map((c, i) => (
                <span key={i} className="w-4 h-4 rounded-full ring-1 ring-white/60" style={{ backgroundColor: c }} />
              ))}
              <span className="text-[10px] ml-1 text-white/70">пример палитры</span>
            </div>
          </div>
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
    </>
  );
}