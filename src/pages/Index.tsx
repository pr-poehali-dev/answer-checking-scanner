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

export default function Index() {
  const [active, setActive] = useState<Section>("works");
  const [authMode, setAuthMode] = useState<"landing" | "login" | "signup">("landing");
  const { teacher, yadiskConnected } = useAppStore();
  const ActiveSection = SECTION_COMPONENTS[active];

  // Периодическая проверка подписки (раз при заходе и каждые 5 мин)
  useEffect(() => {
    if (!teacher || teacher.role !== "teacher") return;
    appStore.refreshSubscription();
    const t = setInterval(() => appStore.refreshSubscription(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [teacher?.login, teacher?.role]);

  // Навигация из других разделов (например, из конспектов в презентации)
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as Section;
      if (section) setActive(section);
    };
    window.addEventListener("navigate-to-section", handler);
    return () => window.removeEventListener("navigate-to-section", handler);
  }, []);

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

  if (teacher.role === "admin") {
    return <AdminPanel />;
  }

  // Гейт подписки — показываем если она не активна
  if (!teacher.subscriptionActive) {
    return <SubscriptionGate />;
  }

  // Обязательная привязка Я.Диска перед началом работы
  if (!yadiskConnected) {
    return <YadiskRequiredGate />;
  }

  const initials = teacher.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: "hsl(var(--sidebar-background))" }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: "hsl(var(--sidebar-primary))" }}>
              <Icon name="ScanLine" size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
              АОУСПТ
            </span>
          </div>
          <p className="text-xs" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>
            Система проверки работ
          </p>
        </div>

        {/* Nav */}
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

        {/* Яндекс Диск статус */}
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
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "hsl(var(--sidebar-primary) / 0.25)", color: "hsl(var(--sidebar-primary))" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>{teacher.name}</p>
              <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>{teacher.school}</p>
            </div>
            <button
              onClick={() => appStore.logout()}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              title="Выйти"
            >
              <Icon name="LogOut" size={13} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border flex-shrink-0">
          <div>
            <h1 className="text-base font-bold leading-none mb-0.5">{SECTION_TITLES[active]}</h1>
            <p className="text-xs text-muted-foreground">АОУСПТ · {new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActive("upload")}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
            >
              <Icon name="Plus" size={13} />
              Новая проверка
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            <ActiveSection key={active} />
          </div>
          <CompanyFooter variant="full" />
        </main>
      </div>
    </div>
  );
}