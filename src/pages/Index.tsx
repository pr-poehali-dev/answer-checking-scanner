import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Section, NAV_ITEMS, SECTION_TITLES } from "@/components/scanner/types";
import { UploadSection } from "@/components/scanner/SectionsA";
import { ResultsSection, SettingsSection } from "@/components/scanner/SectionsB";
import { StudentsSection } from "@/components/scanner/StudentsSection";
import { WorksSection } from "@/components/scanner/WorksSection";
import { PresentationsSection } from "@/components/scanner/PresentationsSection";
import { TestsSection } from "@/components/scanner/TestsSection";
import { SynopsisSection } from "@/components/scanner/SynopsisSection";
import { ExamsSection } from "@/components/scanner/ExamsSection";
import { FipiExamsSection } from "@/components/scanner/FipiExamsSection";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import AdminPanel from "@/pages/AdminPanel";
import SubscriptionGate from "@/components/SubscriptionGate";
import YadiskRequiredGate from "@/components/YadiskRequiredGate";
import CompanyFooter from "@/components/CompanyFooter";
import { useAppStore, appStore } from "@/store/appStore";

const SECTION_COMPONENTS: Record<Section, React.FC> = {
  upload: UploadSection,
  results: ResultsSection,
  students: StudentsSection,
  works: WorksSection,
  presentations: PresentationsSection,
  tests: TestsSection,
  synopsis: SynopsisSection,
  exams: ExamsSection,
  fipiExams: FipiExamsSection,
  settings: SettingsSection,
};

// Разделы для нижней мобильной панели (самые частые)
const MOBILE_NAV: { id: Section; label: string; icon: string }[] = [
  { id: "works",   label: "Работы",    icon: "ClipboardList" },
  { id: "upload",  label: "Проверка",  icon: "ScanLine" },
  { id: "results", label: "Результаты", icon: "BarChart2" },
  { id: "students",label: "Ученики",   icon: "Users" },
  { id: "settings",label: "Ещё",       icon: "Menu" },
];

export default function Index() {
  const [active, setActive]         = useState<Section>("works");
  const [sidebarOpen, setSidebar]   = useState(false);
  const [authMode, setAuthMode]     = useState<"landing" | "login" | "signup">("landing");
  const { teacher, yadiskConnected, maintenanceSections } = useAppStore();
  const ActiveSection = SECTION_COMPONENTS[active];

  useEffect(() => {
    if (!teacher || teacher.role !== "teacher") return;
    appStore.refreshSubscription();
    const t = setInterval(() => appStore.refreshSubscription(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [teacher?.login, teacher?.role]);

  // Загружаем список разделов на ТО при старте
  useEffect(() => {
    appStore.loadMaintenance();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as Section;
      if (section) { setActive(section); setSidebar(false); }
    };
    window.addEventListener("navigate-to-section", handler);
    return () => window.removeEventListener("navigate-to-section", handler);
  }, []);

  // Закрываем сайдбар при смене раздела
  const navigate = (s: Section) => { setActive(s); setSidebar(false); };

  if (!teacher) {
    if (authMode === "landing") {
      return (
        <LandingPage
          onLogin={() => setAuthMode("login")}
          onRegister={() => setAuthMode("signup")}
          onTrial={() => setAuthMode("signup")}
        />
      );
    }
    return (
      <LoginPage
        onLogin={() => { setActive("works"); setAuthMode("landing"); }}
        initialMode={authMode === "signup" ? "signup" : "login"}
        onBack={() => setAuthMode("landing")}
      />
    );
  }

  if (teacher.role === "admin") return <AdminPanel />;

  const isTester = teacher.role === "tester";

  // Тестер — обходит проверки подписки и Я.Диска
  if (!isTester) {
    if (!teacher.subscriptionActive) return <SubscriptionGate />;
    if (!yadiskConnected) return <YadiskRequiredGate />;
  }

  // Раздел на техработах — только тестер проходит, остальные видят заглушку
  const isMaintenance = maintenanceSections.includes(active) && !isTester;

  const initials = teacher.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Оверлей мобильного сайдбара ───────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      {/* ── Сайдбар ───────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col flex-shrink-0 transition-transform duration-300
          md:relative md:translate-x-0 md:w-60 md:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "hsl(var(--sidebar-background))" }}
      >
        {/* Logo + закрыть на мобиле */}
        <div className="px-5 py-5 border-b flex items-start justify-between" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
                <Icon name="ScanLine" size={15} className="text-white" />
              </div>
              <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>АОУСПТ</span>
            </div>
            <p className="text-xs" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>Система проверки работ</p>
          </div>
          <button className="md:hidden p-1 mt-0.5 text-muted-foreground" onClick={() => setSidebar(false)}>
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="section-header px-3 mb-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>Разделы</p>
          {NAV_ITEMS.map((item) => {
            const inMaintenance = maintenanceSections.includes(item.id) && !isTester;
            return (
              <div
                key={item.id}
                className={`nav-item ${active === item.id ? "active" : ""} ${inMaintenance ? "opacity-60" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon name={item.icon} size={16} fallback="Circle" />
                <span className="flex-1">{item.label}</span>
                {inMaintenance && (
                  <Icon name="Construction" size={12} className="text-orange-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Я.Диск */}
        <div className="px-3 py-2 mx-3 mb-2 rounded-sm border"
          style={{ borderColor: yadiskConnected ? "hsl(142 71% 45% / 0.3)" : "hsl(var(--sidebar-border))", background: yadiskConnected ? "hsl(142 71% 45% / 0.06)" : "transparent" }}>
          <div className="flex items-center gap-2 px-1">
            <Icon name={yadiskConnected ? "CloudCheck" : "CloudOff"} size={13}
              style={{ color: yadiskConnected ? "#22c55e" : "hsl(var(--sidebar-foreground))" }}
              fallback="Cloud" />
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
              <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>{teacher.school}</p>
            </div>
            <button onClick={() => appStore.logout()}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" title="Выйти">
              <Icon name="LogOut" size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Основной контент ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Хедер */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-b border-border flex-shrink-0">
          {/* Бургер на мобиле */}
          <button className="md:hidden p-1.5 -ml-1 text-muted-foreground" onClick={() => setSidebar(true)}>
            <Icon name="Menu" size={20} />
          </button>

          <div className="flex-1 md:flex-initial mx-3 md:mx-0">
            <h1 className="text-sm md:text-base font-bold leading-none mb-0.5 truncate">{SECTION_TITLES[active]}</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
              АОУСПТ · {new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </p>
          </div>

          <button
            onClick={() => navigate("upload")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Icon name="Plus" size={13} />
            <span className="hidden sm:inline">Новая проверка</span>
            <span className="sm:hidden">Проверка</span>
          </button>
        </header>

        {/* Контент */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-3 md:px-6 py-4 md:py-6">
            {isMaintenance ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                  <Icon name="Construction" size={28} className="text-orange-500" />
                </div>
                <h2 className="text-lg font-bold mb-2">Технические работы</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Этот раздел временно недоступен. Мы уже работаем над этим — попробуйте зайти позже.
                </p>
              </div>
            ) : (
              <ActiveSection key={active} />
            )}
          </div>
          <CompanyFooter variant="full" />
        </main>
      </div>

      {/* ── Нижняя навигация (только мобиль) ────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-stretch">
          {MOBILE_NAV.map((item) => {
            const isActive = item.id === "settings"
              ? !MOBILE_NAV.slice(0, 4).some(n => n.id === active) && active !== "settings"
                ? false
                : active === item.id || (item.id === "settings" && !MOBILE_NAV.slice(0,4).map(n=>n.id).includes(active))
              : active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => item.id === "settings" ? setSidebar(true) : navigate(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon name={item.icon} size={20} fallback="Circle" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}