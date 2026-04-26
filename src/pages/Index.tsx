import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Section, NAV_ITEMS, SECTION_TITLES } from "@/components/scanner/types";
import { UploadSection, RecognitionSection, CheckingSection } from "@/components/scanner/SectionsA";
import { ResultsSection, AnalyticsSection, ExportSection, SettingsSection } from "@/components/scanner/SectionsB";

const SECTION_COMPONENTS: Record<Section, React.FC> = {
  upload: UploadSection,
  recognition: RecognitionSection,
  checking: CheckingSection,
  results: ResultsSection,
  analytics: AnalyticsSection,
  export: ExportSection,
  settings: SettingsSection,
};

export default function Index() {
  const [active, setActive] = useState<Section>("upload");
  const ActiveSection = SECTION_COMPONENTS[active];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: "hsl(var(--sidebar-background))" }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
              <Icon name="ScanLine" size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
              ЕГЭ Сканер
            </span>
          </div>
          <p className="text-xs" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>
            Система проверки тестов
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="section-header px-3 mb-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
            Разделы
          </p>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <Icon name={item.icon} size={16} fallback="Circle" />
              <span className="flex-1">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 px-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "hsl(var(--sidebar-primary) / 0.25)", color: "hsl(var(--sidebar-primary))" }}
            >
              АИ
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>Администратор</p>
              <p className="text-[10px]" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>Школа №47</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border flex-shrink-0">
          <div>
            <h1 className="text-base font-bold leading-none mb-0.5">{SECTION_TITLES[active]}</h1>
            <p className="text-xs text-muted-foreground">Апрель 2026 · ЕГЭ Русский язык · 11А класс</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors">
              <Icon name="RefreshCw" size={13} />
              Обновить
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity">
              <Icon name="Plus" size={13} />
              Новая сессия
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <ActiveSection key={active} />
        </main>
      </div>
    </div>
  );
}
