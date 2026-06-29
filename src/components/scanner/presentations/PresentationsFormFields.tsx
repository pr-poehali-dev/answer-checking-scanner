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
  customDesign: boolean;
  setCustomDesign: React.Dispatch<React.SetStateAction<boolean>>;
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
  customDesign,
  setCustomDesign,
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
          <p className="text-[10px] text-muted-foreground mt-1.5">
            всего {slidesCount + 3} слайда (+ титул, выводы, финал)
          </p>
        </div>
      </div>

      {/* Индивидуальный дизайн */}
      <button
        type="button"
        onClick={() => setCustomDesign(v => !v)}
        disabled={busy}
        className={`w-full text-left rounded-xl border p-4 transition-all disabled:opacity-50 ${
          customDesign
            ? "border-transparent shadow-md"
            : "border-border hover:border-primary/40 bg-white"
        }`}
        style={customDesign ? {
          background: "linear-gradient(135deg, #6D28D9, #DB2777 55%, #F59E0B)",
        } : undefined}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            customDesign ? "bg-white/20" : "bg-primary/10"
          }`}>
            <Icon name="Sparkles" size={18} className={customDesign ? "text-white" : "text-primary"} fallback="Wand2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${customDesign ? "text-white" : "text-foreground"}`}>
              Индивидуальный дизайн
            </p>
            <p className={`text-[11px] leading-snug ${customDesign ? "text-white/85" : "text-muted-foreground"}`}>
              ИИ создаст уникальное современное оформление под вашу тему — стильные цвета и вёрстку
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {DESIGN_SWATCHES.map((c, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    customDesign ? "ring-1 ring-white/60 scale-100" : "opacity-40 scale-90"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <span className={`text-[10px] ml-1 ${customDesign ? "text-white/70" : "text-muted-foreground"}`}>
                пример палитры
              </span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-all ${
            customDesign ? "bg-white/30" : "bg-muted"
          }`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              customDesign ? "left-[22px]" : "left-0.5"
            }`} />
          </div>
        </div>
      </button>

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
