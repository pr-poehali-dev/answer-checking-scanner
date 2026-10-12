import { useMemo } from "react";
import Icon from "@/components/ui/icon";
import { SlidePreview, TitleSlidePreview } from "./SlidePreview";
import { READY_TEMPLATES, SAMPLE_SLIDE, templateToTheme } from "./presentationTemplates";

interface TemplateGalleryProps {
  topic?: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TemplateGallery({ topic, selectedId, onSelect, onClose }: TemplateGalleryProps) {
  const themes = useMemo(() => READY_TEMPLATES.map(t => ({ t, theme: templateToTheme(t) })), []);
  const title = topic?.trim() || "Тема вашей презентации";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl h-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0"
          style={{ background: "hsl(var(--muted))" }}>
          <div>
            <p className="text-sm font-bold">Готовые шаблоны — 20 вариантов</p>
            <p className="text-[11px] text-muted-foreground">Так будут выглядеть титульный слайд и слайд с текстом. Нажмите на шаблон, чтобы выбрать.</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto styled-scrollbar p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map(({ t, theme }) => {
              const active = selectedId === t.id;
              return (
                <button key={t.id} type="button" onClick={() => { onSelect(t.id); onClose(); }}
                  className={`rounded-xl border-2 p-3 text-left transition-all bg-white ${
                    active ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                  }`}>
                  <div className="grid grid-cols-2 gap-2">
                    <TitleSlidePreview theme={theme} topic={title} subtitle="Подзаголовок презентации" />
                    <SlidePreview theme={theme} slide={SAMPLE_SLIDE} num={2} total={8} />
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <p className="text-xs font-bold">{t.name}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {active && <Icon name="Check" size={11} />}
                      {active ? "Выбран" : "Выбрать"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
