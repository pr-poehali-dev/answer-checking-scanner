import Icon from "@/components/ui/icon";
import { READY_TEMPLATES, type DesignMode } from "./presentationTemplates";

interface TemplatePickerProps {
  designMode: DesignMode;
  setDesignMode: (v: DesignMode) => void;
  templateId: string;
  setTemplateId: (v: string) => void;
  disabled?: boolean;
}

export function TemplatePicker({ designMode, setDesignMode, templateId, setTemplateId, disabled }: TemplatePickerProps) {
  return (
    <div>
      <label className="text-xs font-bold text-foreground block mb-1.5">Оформление</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {([
          { id: "template" as const, title: "Готовый шаблон", desc: "20 проверенных дизайнов — выберите любой", icon: "LayoutTemplate" },
          { id: "custom" as const, title: "Индивидуальный дизайн", desc: "ИИ создаст уникальное оформление под тему", icon: "Sparkles" },
        ]).map(o => (
          <button key={o.id} type="button" disabled={disabled} onClick={() => setDesignMode(o.id)}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
              designMode === o.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              designMode === o.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <Icon name={o.icon} size={15} fallback="Image" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold">{o.title}</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{o.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {designMode === "template" && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {READY_TEMPLATES.map(t => (
            <button key={t.id} type="button" disabled={disabled} onClick={() => setTemplateId(t.id)}
              className={`rounded-lg overflow-hidden border-2 text-left transition-all disabled:opacity-50 ${
                templateId === t.id ? "border-primary shadow-md" : "border-transparent hover:border-primary/30"
              }`}>
              <div className="h-14 relative" style={{ background: t.bg }}>
                <div className="absolute inset-x-0 top-0 h-6" style={{ background: t.dark }} />
                <div className="absolute left-2 top-2 h-1.5 w-1/2 rounded-full" style={{ background: "rgba(255,255,255,.75)" }} />
                <div className="absolute left-2 bottom-2 h-1 w-3/4 rounded-full" style={{ background: t.dark, opacity: 0.35 }} />
                <div className="absolute left-2 bottom-4 h-1 w-1/2 rounded-full" style={{ background: t.dark, opacity: 0.35 }} />
                <div className="absolute right-2 bottom-2 w-4 h-4 rounded-full" style={{ background: t.accent }} />
                <div className="absolute right-5 bottom-3 w-3 h-3 rounded-full" style={{ background: t.accent2 }} />
                {templateId === t.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                    <Icon name="Check" size={11} className="text-primary" />
                  </div>
                )}
              </div>
              <div className="px-2 py-1 bg-white">
                <p className="text-[10px] font-semibold truncate">{t.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
