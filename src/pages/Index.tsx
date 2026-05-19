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
import { ChatSection } from "@/components/scanner/ChatSection";
import CollectiveSection from "@/components/scanner/CollectiveSection";
import { SupportSection } from "@/components/scanner/SupportSection";
import TokensModal from "@/components/TokensModal";
import { authApi } from "@/lib/api";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import AdminPanel from "@/pages/AdminPanel";
import InstitutionRegisterPage from "@/pages/InstitutionRegisterPage";
import InstitutionLoginPage from "@/pages/InstitutionLoginPage";
import InstitutionDashboard from "@/pages/InstitutionDashboard";
import SubscriptionGate from "@/components/SubscriptionGate";
import YadiskRequiredGate from "@/components/YadiskRequiredGate";
import CompanyFooter from "@/components/CompanyFooter";
import TesterLogger from "@/components/TesterLogger";
import { useAppStore, appStore } from "@/store/appStore";

const OU_SESSION_KEY = "saou_ou_session_v1";

interface OUUser {
  id: number;
  login: string;
  full_name: string;
  role: string;
  institution_id: number;
  institution_position: string;
  institution_name: string;
  subject?: string;
  token: string;
  is_manager: boolean;
  password: string;
}

function saveOUSession(u: OUUser) {
  try { localStorage.setItem(OU_SESSION_KEY, JSON.stringify(u)); } catch { /* ignore */ }
}
function clearOUSession() {
  try { localStorage.removeItem(OU_SESSION_KEY); } catch { /* ignore */ }
}
function loadOUSession(): OUUser | null {
  try {
    const raw = localStorage.getItem(OU_SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d.login ? d : null;
  } catch { return null; }
}

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
  chat: ChatSection,
  support: SupportSection,
  settings: SettingsSection,
  collective: CollectiveSection,
};

// Разделы для нижней мобильной панели (самые частые)
const MOBILE_NAV: { id: Section; label: string; icon: string }[] = [
  { id: "works",   label: "Работы",    icon: "ClipboardList" },
  { id: "upload",  label: "Проверка",  icon: "ScanLine" },
  { id: "chat",    label: "ИИ Чат",    icon: "MessageSquare" },
  { id: "students",label: "Ученики",   icon: "Users" },
  { id: "settings",label: "Ещё",       icon: "Menu" },
];

export default function Index() {
  const [active, setActive]         = useState<Section>("works");
  const [sidebarOpen, setSidebar]   = useState(false);
  const [authMode, setAuthMode]     = useState<"landing" | "login" | "signup" | "ou-login" | "ou-register">("landing");
  const [ouUser, setOuUser]         = useState<OUUser | null>(() => loadOUSession());
  const [hasInstitution, setHasInstitution] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [showPanel, setShowPanel]   = useState(false);
  const [adminShowLK, setAdminShowLK] = useState(false); // admin нажал "Открыть ЛК"
  const [hasPanelRole, setHasPanelRole] = useState(false);
  const [panelAutoShown, setPanelAutoShown] = useState(false);
  const { teacher, yadiskConnected, maintenanceSections } = useAppStore();
  const ActiveSection = SECTION_COMPONENTS[active];

  useEffect(() => {
    if (!teacher || teacher.role !== "teacher") return;
    appStore.refreshSubscription();
    const t = setInterval(() => appStore.refreshSubscription(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [teacher?.login, teacher?.role]);

  useEffect(() => {
    if (!teacher) { setHasInstitution(false); return; }
    authApi.getCollectiveByToken(teacher.authToken, teacher.login)
      .then(d => setHasInstitution(d.has_institution))
      .catch(() => setHasInstitution(false));
  }, [teacher?.login]);

  // Загружаем список разделов на ТО при старте
  useEffect(() => {
    appStore.loadMaintenance();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as Section;
      if (section) { setActive(section); setSidebar(false); setShowPanel(false); }
    };
    window.addEventListener("navigate-to-section", handler);
    return () => window.removeEventListener("navigate-to-section", handler);
  }, []);

  // Открытие ЛК из ПУ (для admin и операторов)
  useEffect(() => {
    const handler = () => { setShowPanel(false); setAdminShowLK(true); };
    window.addEventListener("open-lk-from-panel", handler);
    return () => window.removeEventListener("open-lk-from-panel", handler);
  }, []);

  // Проверяем панельную роль для не-admin пользователей
  useEffect(() => {
    if (!teacher || teacher.role === "admin") return;
    import("@/lib/api").then(({ supportApi }) => {
      supportApi.operators(teacher.login, teacher.authToken).then(res => {
        const me = res.operators.find((o: { login: string; panel_role: string }) => o.login === teacher.login);
        if (me && me.panel_role && me.panel_role !== "removed") {
          setHasPanelRole(true);
          // Автоматически показываем ПУ при первом входе
          if (!panelAutoShown) {
            setShowPanel(true);
            setPanelAutoShown(true);
          }
        }
      }).catch(() => {});
    });
  }, [teacher?.login]);

  // Закрываем сайдбар при смене раздела
  const navigate = (s: Section) => { setActive(s); setSidebar(false); };

  // ── ОУ маршруты ─────────────────────────────────────────────────────────
  if (ouUser) {
    return (
      <InstitutionDashboard
        user={ouUser}
        onLogout={() => { clearOUSession(); setOuUser(null); setAuthMode("landing"); }}
      />
    );
  }

  if (!teacher) {
    if (authMode === "ou-login") {
      return (
        <InstitutionLoginPage
          onLogin={(u) => { saveOUSession(u); setOuUser(u); }}
          onBack={() => setAuthMode("landing")}
          onRegister={() => setAuthMode("ou-register")}
        />
      );
    }
    if (authMode === "ou-register") {
      return (
        <InstitutionRegisterPage
          onSuccess={({ login, password, institution_name }) => {
            alert(`Учреждение "${institution_name}" успешно зарегистрировано!\nЛогин: ${login}\nВойдите в систему.`);
            setAuthMode("ou-login");
          }}
          onBack={() => setAuthMode("landing")}
        />
      );
    }
    if (authMode === "landing") {
      return (
        <LandingPage
          onLogin={() => setAuthMode("login")}
          onRegister={() => setAuthMode("signup")}
          onTrial={() => setAuthMode("signup")}
          onOuLogin={() => setAuthMode("ou-login")}
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

  // ПУ: admin (если не нажал "Открыть ЛК") или оператор с панельной ролью
  if ((teacher.role === "admin" && !adminShowLK) || showPanel) {
    return (
      <AdminPanel
        onOpenLK={() => { setAdminShowLK(true); setShowPanel(false); }}
      />
    );
  }

  const isTester = teacher.role === "tester";
  const isAdminInLK = teacher.role === "admin" && adminShowLK;
  const canGoToPanel = isAdminInLK || hasPanelRole;

  // Тестер и admin — обходят проверки подписки и Я.Диска
  if (!isTester && !isAdminInLK) {
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
            <div className="flex items-center gap-2.5">
              <img src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg" alt="САОУ" className="w-8 h-8 rounded-sm object-contain" />
              <div>
                <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>САОУ</span>
                <p className="text-[10px]" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>Система Автоматизации<br/>Образовательных Учреждений</p>
              </div>
            </div>
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
          {hasInstitution && (
            <div
              className={`nav-item ${active === "collective" ? "active" : ""}`}
              onClick={() => navigate("collective")}
            >
              <Icon name="Building2" size={16} fallback="Circle" />
              <span className="flex-1">Коллектив</span>
            </div>
          )}
        </nav>

        {/* Токены ИИ */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setShowTokensModal(true)}
            className="w-full px-3 py-2 rounded-sm border flex items-center gap-2 hover:border-primary/40 transition-colors"
            style={{ borderColor: (teacher.aiTokens ?? 0) > 0 ? "hsl(215 60% 22% / 0.3)" : "hsl(var(--sidebar-border))", background: (teacher.aiTokens ?? 0) > 0 ? "hsl(215 60% 22% / 0.06)" : "transparent" }}
          >
            <Icon name="Coins" size={13} style={{ color: (teacher.aiTokens ?? 0) > 0 ? "hsl(215 60% 40%)" : "hsl(var(--sidebar-foreground))", opacity: (teacher.aiTokens ?? 0) > 0 ? 1 : 0.45 }} fallback="Circle" />
            <span className="text-xs flex-1 text-left" style={{ color: "hsl(var(--sidebar-foreground))", opacity: (teacher.aiTokens ?? 0) > 0 ? 0.85 : 0.45 }}>
              {(teacher.aiTokens ?? 0) > 0
                ? `${(teacher.aiTokens).toLocaleString("ru-RU")} токенов`
                : "Купить токены ИИ"}
            </span>
            <Icon name="Plus" size={11} style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.4 }} />
          </button>
        </div>

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

        {/* Кнопка возврата в Панель Управления */}
        {canGoToPanel && (
          <div className="px-3 mb-2">
            <button onClick={() => { setAdminShowLK(false); if (!isAdminInLK) setShowPanel(true); }}
              className="w-full px-3 py-2 rounded-sm border flex items-center gap-2 hover:border-blue-400/40 transition-colors"
              style={{ borderColor: "hsl(215 60% 40% / 0.3)", background: "hsl(215 60% 40% / 0.06)" }}>
              <Icon name="Shield" size={13} style={{ color: "hsl(215 60% 40%)" }} />
              <span className="text-xs flex-1 text-left" style={{ color: "hsl(215 60% 40%)" }}>Панель управления</span>
              <Icon name="ChevronRight" size={11} style={{ color: "hsl(215 60% 40%)", opacity: 0.6 }} />
            </button>
          </div>
        )}

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

          <div className="flex items-center gap-2">
            {isTester && <TesterLogger />}
            <button
              onClick={() => navigate("upload")}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Icon name="Plus" size={13} />
              <span className="hidden sm:inline">Новая проверка</span>
              <span className="sm:hidden">Проверка</span>
            </button>
          </div>
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

      {showTokensModal && <TokensModal onClose={() => setShowTokensModal(false)} />}
    </div>
  );
}