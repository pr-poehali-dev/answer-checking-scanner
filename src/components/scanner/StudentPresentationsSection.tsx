import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAppStore } from "@/store/appStore";
import { type PresentationItem } from "@/store/appStore";
import { yadisk } from "@/lib/yadisk";

const TOPIC_THEMES: Record<string, { from: string; to: string; accent: string }> = {
  биол:     { from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  экол:     { from: "#0F2D1F", to: "#2DC65F", accent: "#D4A017" },
  истор:    { from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  литер:    { from: "#3D0C02", to: "#E89A0C", accent: "#C0392B" },
  физик:    { from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  матем:    { from: "#1A1336", to: "#7C3AFF", accent: "#00E5FF" },
  хими:     { from: "#18222F", to: "#FF5E4B", accent: "#00D4C8" },
  геогр:    { from: "#0A2A4A", to: "#4FC3F7", accent: "#E0F7FA" },
  искусств: { from: "#2C176E", to: "#FF8C42", accent: "#FFD166" },
  default:  { from: "#091E42", to: "#00B4D8", accent: "#48CAE4" },
};

function getTopicTheme(topic: string) {
  const t = topic.toLowerCase();
  for (const [kw, colors] of Object.entries(TOPIC_THEMES)) {
    if (kw !== "default" && t.includes(kw)) return colors;
  }
  return TOPIC_THEMES.default;
}

function StudentPresentationCard({ item }: { item: PresentationItem }) {
  const { teacher } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const th = getTopicTheme(item.topic);

  const handleDownload = async () => {
    if (!item.uploadedToYadisk || !item.yadiskPath || !teacher?.yadiskToken) return;
    setDownloading(true);
    try {
      const result = await yadisk.downloadBinary(teacher.yadiskToken, item.yadiskPath);
      const bin = atob(result.content_b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 relative overflow-hidden shadow-sm"
          style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}
        >
          <div className="absolute top-0 left-0 right-0 h-2" style={{ background: th.accent, opacity: 0.7 }} />
          <div className="absolute inset-x-1.5 top-3 space-y-0.5">
            <div className="h-0.5 rounded-full bg-white/40" />
            <div className="h-0.5 rounded-full bg-white/25 w-3/4" />
            <div className="h-0.5 rounded-full bg-white/25 w-1/2" />
          </div>
          <div className="absolute bottom-1 right-1 w-4 h-3 rounded-sm" style={{ background: `${th.accent}60` }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate mb-1">{item.topic}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon name="Layers" size={10} />
              {item.outline.slides.length + 3} слайдов
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Calendar" size={10} />
              {new Date(item.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </span>
            {item.audience && (
              <span className="inline-flex items-center gap-1">
                <Icon name="Users" size={10} />
                {item.audience}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Структура"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={13} />
          </button>
          {item.uploadedToYadisk && item.yadiskPath && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              title="Скачать с Я.Диска"
            >
              <Icon name={downloading ? "Loader2" : "Download"} size={13} className={downloading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border" style={{ marginLeft: "calc(3rem + 12px)" }}>
          {item.outline.subtitle && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border italic" style={{ background: `${th.from}08` }}>
              {item.outline.subtitle}
            </div>
          )}
          <div className="divide-y divide-border">
            {item.outline.slides.map((s, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2.5">
                <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-5 text-right" style={{ color: th.accent }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{s.title}</p>
                  {s.bullets.slice(0, 2).map((b, j) => (
                    <p key={j} className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">{b}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {item.outline.conclusion?.length > 0 && (
            <div className="px-3 py-2 border-t border-border" style={{ background: `${th.from}06` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: th.accent }}>Выводы</p>
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

export function StudentPresentationsSection() {
  const { presentations } = useAppStore();

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      {/* Шапка */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3" style={{ background: "hsl(var(--muted))" }}>
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Presentation" size={14} className="text-primary" fallback="Monitor" />
          </div>
          <div>
            <p className="text-sm font-bold">Презентации учителя</p>
            <p className="text-[10px] text-muted-foreground">Материалы к урокам, подготовленные преподавателем</p>
          </div>
        </div>

        {presentations.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Icon name="Presentation" size={22} className="text-muted-foreground" fallback="Monitor" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Презентаций пока нет</p>
            <p className="text-xs text-muted-foreground">Когда учитель создаст презентации, они появятся здесь</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {[...presentations].reverse().map(item => (
              <StudentPresentationCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Показаны презентации, сохранённые с Яндекс.Диска учителя
      </p>
    </div>
  );
}