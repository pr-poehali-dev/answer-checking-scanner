import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Section, STUDENT_NAV_ITEMS, SECTION_TITLES } from "@/components/scanner/types";
import { StudentSettingsSection } from "@/components/scanner/StudentSettingsSection";
import { StudentResultsSection } from "@/components/scanner/StudentResultsSection";
import { TestsSection } from "@/components/scanner/TestsSection";
import { SynopsisSection } from "@/components/scanner/SynopsisSection";
import { ExamsSection } from "@/components/scanner/ExamsSection";
import { FipiExamsSection } from "@/components/scanner/FipiExamsSection";
import { ChatSection } from "@/components/scanner/ChatSection";
import { SupportSection } from "@/components/scanner/SupportSection";
import { StudentPresentationsSection } from "@/components/scanner/StudentPresentationsSection";
import { MyMaterialsSection } from "@/components/scanner/MyMaterialsSection";
import { ProjectSection } from "@/components/scanner/ProjectSection";
import TokensModal from "@/components/TokensModal";
import SubscriptionGate from "@/components/SubscriptionGate";
import YadiskRequiredGate from "@/components/YadiskRequiredGate";
import StorageModeGate from "@/components/StorageModeGate";
import CompanyFooter from "@/components/CompanyFooter";
import { useAppStore, appStore } from "@/store/appStore";

const SECTION_COMPONENTS: Partial<Record<Section, React.FC>> = {
  myResults: StudentResultsSection,
  presentations: StudentPresentationsSection,
  tests: TestsSection,
  synopsis: SynopsisSection,
  exams: ExamsSection,
  fipiExams: FipiExamsSection,
  chat: ChatSection,
  project: ProjectSection,
  materials: MyMaterialsSection,
  support: SupportSection,
  settings: StudentSettingsSection,
};

export default function StudentCabinet() {
  const { teacher, yadiskConnected, storageMode, hiddenSections } = useAppStore();
  const [active, setActive] = usePersistedState<Section>("student:active-section", "myResults");
  const [sidebarOpen, setSidebar] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);

  useEffect(() => {
    if (!teacher || teacher.role !== "student") return;
    appStore.refreshSubscription();
    appStore.loadLkVisibility();
    const t = setInterval(() => appStore.refreshSubscription(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [teacher?.login]);

  // Навигация между разделами из дочерних компонентов
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as Section;
      if (section) { setActive(section); setSidebar(false); }
    };
    window.addEventListener("student-navigate", handler);
    return () => window.removeEventListener("student-navigate", handler);
  }, []);

  // Видимые разделы = базовый набор минус скрытые админом
  const navItems = useMemo(() => {
    const hidden = new Set(hiddenSections.student || []);
    return STUDENT_NAV_ITEMS.filter(i => !hidden.has(i.id));
  }, [hiddenSections.student]);

  // Если активный раздел скрыт — переключаемся на первый доступный
  useEffect(() => {
    if (navItems.length && !navItems.some(i => i.id === active)) {
      setActive(navItems[0].id);
    }
  }, [navItems, active]);

  if (!teacher) return null;

  if (!teacher.subscriptionActive) return <SubscriptionGate />;
  if (!storageMode) return <StorageModeGate />;
  if (storageMode === "yadisk" && !yadiskConnected) return <YadiskRequiredGate />;

  const ActiveSection = SECTION_COMPONENTS[active] || ChatSection;
  const navigate = (s: Section) => { setActive(s); setSidebar(false); };
  const initials = teacher.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebar(false)} />
      )}

      {/* Сайдбар */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col flex-shrink-0 transition-transform duration-300
          md:relative md:translate-x-0 md:w-60 md:z-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "hsl(var(--sidebar-background))" }}
      >
        <div className="px-5 py-5 border-b flex items-start justify-between" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5">
            <img src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg" alt="САОУ" className="w-8 h-8 rounded-sm object-contain" />
            <div>
              <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>САОУ</span>
              <p className="text-[10px]" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>Кабинет ученика</p>
            </div>
          </div>
          <button className="md:hidden p-1 mt-0.5 text-muted-foreground" onClick={() => setSidebar(false)}>
            <Icon name="X" size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="section-header px-3 mb-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>Разделы</p>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={16} fallback="Circle" />
              <span className="flex-1">{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Токены ИИ */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setShowTokensModal(true)}
            className="w-full px-3 py-2 rounded-sm border flex items-center gap-2 hover:border-primary/40 transition-colors"
            style={{ borderColor: "hsl(var(--sidebar-border))" }}
          >
            <Icon name="Coins" size={13} style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }} fallback="Circle" />
            <span className="text-xs flex-1 text-left" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.7 }}>
              {teacher.aiTokensKopecks > 0
                ? `${(teacher.aiTokensKopecks / 100).toLocaleString("ru-RU")} ₽ баланс`
                : "Пополнить баланс ИИ"}
            </span>
            <Icon name="Plus" size={11} style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.4 }} />
          </button>
        </div>

        {/* Я.Диск */}
        <div className="px-3 py-2 mx-3 mb-2 rounded-sm border"
          style={{ borderColor: yadiskConnected ? "hsl(142 71% 45% / 0.3)" : "hsl(var(--sidebar-border))", background: yadiskConnected ? "hsl(142 71% 45% / 0.06)" : "transparent" }}>
          <div className="flex items-center gap-2 px-1">
            <Icon name={yadiskConnected ? "CloudCheck" : "CloudOff"} size={13}
              style={{ color: yadiskConnected ? "#22c55e" : "hsl(var(--sidebar-foreground))" }} fallback="Cloud" />
            <span className="text-xs" style={{ color: yadiskConnected ? "#16a34a" : "hsl(var(--sidebar-foreground))", opacity: yadiskConnected ? 1 : 0.5 }}>
              {yadiskConnected ? "Яндекс Диск подключён" : "Яндекс Диск"}
            </span>
          </div>
        </div>

        {/* User */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "hsl(var(--sidebar-primary) / 0.25)", color: "hsl(var(--sidebar-primary))" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>{teacher.name}</p>
              <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>Ученик</p>
            </div>
            <button onClick={() => appStore.logout()}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" title="Выйти">
              <Icon name="LogOut" size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Контент */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-b border-border flex-shrink-0">
          <button className="md:hidden p-1.5 -ml-1 text-muted-foreground" onClick={() => setSidebar(true)}>
            <Icon name="Menu" size={20} />
          </button>
          <div className="flex-1 md:flex-initial mx-3 md:mx-0">
            <h1 className="text-sm md:text-base font-bold leading-none mb-0.5 truncate">{SECTION_TITLES[active]}</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">Личный кабинет ученика</p>
          </div>
          <a
            href="/home"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-semibold rounded-sm hover:bg-muted transition-colors whitespace-nowrap text-muted-foreground"
          >
            <Icon name="Home" size={13} />
            <span className="hidden sm:inline">На главную</span>
          </a>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-3 md:px-6 py-4 md:py-6">
            <ActiveSection key={active} />
          </div>
          <CompanyFooter variant="full" />
        </main>
      </div>

      {/* Нижняя навигация (мобиль) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-stretch">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active === item.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon name={item.icon} size={20} fallback="Circle" />
              <span className="truncate max-w-full px-0.5">{item.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </nav>

      {showTokensModal && <TokensModal onClose={() => setShowTokensModal(false)} />}
    </div>
  );
}