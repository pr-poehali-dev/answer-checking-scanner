import Icon from "@/components/ui/icon";

export const THEME_PREVIEWS = [
  { name: "ocean",  label: "Океан",    from: "#091E42", to: "#00B4D8", accent: "#48CAE4" },
  { name: "forest", label: "Лес",      from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  { name: "sunset", label: "Закат",    from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  { name: "slate",  label: "Квант",    from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  { name: "coral",  label: "Лаборат.", from: "#18222F", to: "#FF5E4B", accent: "#00D4C8" },
  { name: "arctic", label: "Арктика",  from: "#0A2A4A", to: "#4FC3F7", accent: "#E0F7FA" },
  { name: "dawn",   label: "Рассвет",  from: "#2C176E", to: "#FF8C42", accent: "#FFD166" },
  { name: "mono",   label: "Моно",     from: "#101010", to: "#E53E3E", accent: "#FFD700" },
];

export function PresentationsHero() {
  return (
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
  );
}
