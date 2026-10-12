import { useState } from "react";
import Icon from "@/components/ui/icon";
import { SlidePreview } from "./SlidePreview";
import { TemplateGallery } from "./TemplateGallery";
import { READY_TEMPLATES, SAMPLE_SLIDE, templateToTheme, type DesignMode } from "./presentationTemplates";

interface TemplatePickerProps {
  designMode: DesignMode;
  setDesignMode: (v: DesignMode) => void;
  templateId: string;
  setTemplateId: (v: string) => void;
  topic?: string;
  disabled?: boolean;
}

export function TemplatePicker({ designMode, setDesignMode, templateId, setTemplateId, topic, disabled }: TemplatePickerProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
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
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-muted-foreground">Выбран: <b className="text-foreground">{READY_TEMPLATES.find(t => t.id === templateId)?.name}</b></p>
            <button type="button" onClick={() => setGalleryOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <Icon name="Maximize2" size={13} fallback="Eye" />
              Посмотреть все крупно
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {READY_TEMPLATES.map(t => (
              <button key={t.id} type="button" disabled={disabled} onClick={() => setTemplateId(t.id)}
                className={`relative rounded-lg overflow-hidden border-2 text-left transition-all disabled:opacity-50 ${
                  templateId === t.id ? "border-primary shadow-md" : "border-transparent hover:border-primary/30"
                }`}>
                <SlidePreview theme={templateToTheme(t)} slide={SAMPLE_SLIDE} num={2} total={8} className="!rounded-none !shadow-none !border-0" />
                {templateId === t.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                    <Icon name="Check" size={11} className="text-primary" />
                  </div>
                )}
                <div className="px-2 py-1 bg-white">
                  <p className="text-[10px] font-semibold truncate">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {galleryOpen && (
        <TemplateGallery topic={topic} selectedId={templateId} onSelect={setTemplateId} onClose={() => setGalleryOpen(false)} />
      )}
    </div>
  );
}
