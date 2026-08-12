import Icon from "@/components/ui/icon";
import type { PresentationThemePayload } from "@/lib/api";

function hex(c?: string) {
  if (!c) return "#000000";
  return c.startsWith("#") ? c : `#${c}`;
}

const MOOD_LABELS: Record<string, string> = {
  strict: "Строгий", bright: "Яркий", minimal: "Минимализм",
  playful: "Игривый", elegant: "Элегантный",
};

const LAYOUT_LABELS: Record<string, string> = {
  left_header: "Блок слева", split_diagonal: "Диагональ", top_banner: "Баннер сверху",
  sidebar_dark: "Тёмный сайдбар", center_frame: "Рамка по центру", corner_tag: "Бейдж в углу",
  ribbon: "Лента", stacked_bar: "Слоистые полосы",
};

interface ThemePickerProps {
  options: PresentationThemePayload[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** Мини-превью палитры варианта дизайна — карточка с градиентом и подписью. */
export function ThemePicker({ options, selectedIndex, onSelect }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {options.map((t, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
            selectedIndex === i ? "border-primary shadow-md scale-[1.02]" : "border-transparent hover:border-primary/30"
          }`}
        >
          <div className="h-14 relative" style={{ background: `linear-gradient(135deg, ${hex(t.title_bg)}, ${hex(t.accent2)})` }}>
            <div className="absolute top-1.5 left-1.5 right-1.5 space-y-1">
              <div className="h-1 rounded-full bg-white/50 w-3/4" />
              <div className="h-1 rounded-full bg-white/30 w-1/2" />
            </div>
            {selectedIndex === i && (
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <Icon name="Check" size={11} className="text-primary" />
              </div>
            )}
          </div>
          <div className="px-2 py-1.5 bg-white">
            <p className="text-[10px] font-semibold truncate">{LAYOUT_LABELS[t.layout] || t.layout}</p>
            <p className="text-[9px] text-muted-foreground truncate">{MOOD_LABELS[t.mood || ""] || "Индивидуальный"}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
