import Icon from "@/components/ui/icon";
import type { PresentationMode } from "@/lib/api";
import { PRESENTATION_MODES } from "./presentationTemplates";

interface ModePickerProps {
  mode: PresentationMode;
  setMode: (v: PresentationMode) => void;
  disabled?: boolean;
}

export function ModePicker({ mode, setMode, disabled }: ModePickerProps) {
  return (
    <div>
      <label className="text-xs font-bold text-foreground block mb-1.5">Тип презентации</label>
      <div className="space-y-2" role="radiogroup">
        {PRESENTATION_MODES.map(m => {
          const active = mode === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={active} disabled={disabled}
              onClick={() => setMode(m.id)}
              className={`w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}>
              <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                active ? "bg-primary border-primary text-primary-foreground" : "border-border"
              }`}>
                {active && <Icon name="Check" size={12} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <Icon name={m.icon} size={13} fallback="FileText" className="text-muted-foreground" />
                  {m.title}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">Можно выбрать только один вариант — ИИ строго следует выбранному типу.</p>
    </div>
  );
}
