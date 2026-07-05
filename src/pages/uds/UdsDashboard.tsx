import Icon from "@/components/ui/icon";
import UdsEmployees from "@/pages/uds/UdsEmployees";
import UdsUsers from "@/pages/uds/UdsUsers";
import UdsAuditLog from "@/pages/uds/UdsAuditLog";
import UdsConsents from "@/pages/uds/UdsConsents";
import UdsProfile from "@/pages/uds/UdsProfile";
import UdsSupport from "@/pages/uds/UdsSupport";
import UdsLkView from "@/pages/uds/UdsLkView";
import UdsMaintenance from "@/pages/uds/UdsMaintenance";
import UdsMail from "@/pages/uds/UdsMail";
import UdsMaterials from "@/pages/uds/UdsMaterials";
import MyWards from "@/pages/uds/MyWards";
import { PANEL_ROLE_LABELS, Session, Tab } from "@/pages/uds/udsSession";

interface UdsDashboardProps {
  session: Session;
  tab: Tab;
  setTab: (t: Tab) => void;
  logout: () => void;
  onProfileUpdated: (newLogin: string, newToken: string) => void;
  myMailAddress?: string | null;
}

export default function UdsDashboard({ session, tab, setTab, logout, onProfileUpdated, myMailAddress }: UdsDashboardProps) {
  const { perms } = session;
  const canModerate = ["advisor", "deputy", "head"].includes(session.panel_role) || session.login === "admin";
  const canConsents = ["deputy", "head"].includes(session.panel_role) || session.login === "admin";
  const TABS: { id: Tab; label: string; icon: string; show: boolean; badge?: number }[] = [
    { id: "employees", label: "Сотрудники", icon: "Users", show: true },
    { id: "wards", label: "Мои подопечные", icon: "UserCheck", show: !!perms.is_curator, badge: session.pending_transfers },
    { id: "materials", label: "Материалы", icon: "FileCheck", show: canModerate },
    { id: "users", label: "Пользователи", icon: "UserSearch", show: true },
    { id: "mail", label: "Почта", icon: "Mail", show: !!myMailAddress },
    { id: "support", label: "Тех. поддержка", icon: "Headphones", show: perms.can_support },
    { id: "lkview", label: "Вид ЛК", icon: "LayoutDashboard", show: perms.can_lkview },
    { id: "maintenance", label: "Тех. работы", icon: "Construction", show: perms.can_maintenance },
    { id: "audit", label: "Логи действий", icon: "ScrollText", show: true },
    { id: "consents", label: "Согласия", icon: "ShieldCheck", show: canConsents },
    { id: "profile", label: "Мой профиль", icon: "UserCog", show: session.login !== "admin" },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center bg-blue-600">
            <Icon name="ShieldCheck" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Управление Движения Системы</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{session.login}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                {session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
              </span>
              {session.operator_number != null && (
                <span className="text-[10px] text-muted-foreground font-mono">№{session.operator_number}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
        >
          <Icon name="LogOut" size={13} />
          Выйти
        </button>
      </header>

      <div className="bg-white border-b border-border px-4 md:px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={13} fallback="Circle" />
              {t.label}
              {!!t.badge && t.badge > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {tab === "employees" && (
          <UdsEmployees login={session.login} token={session.token} perms={perms} myRole={session.panel_role} />
        )}
        {tab === "wards" && (
          <MyWards login={session.login} token={session.token} perms={perms} myRole={session.panel_role} />
        )}
        {tab === "users" && (
          <UdsUsers login={session.login} token={session.token} perms={perms} />
        )}
        {tab === "mail" && (
          <UdsMail login={session.login} token={session.token} myAddress={myMailAddress} />
        )}
        {tab === "materials" && (
          <UdsMaterials login={session.login} token={session.token} />
        )}
        {tab === "audit" && (
          <UdsAuditLog login={session.login} token={session.token} />
        )}
        {tab === "consents" && (
          <UdsConsents login={session.login} token={session.token} />
        )}
        {tab === "support" && (
          <UdsSupport login={session.login} token={session.token} panelRole={session.panel_role} />
        )}
        {tab === "lkview" && (
          <UdsLkView login={session.login} token={session.token} />
        )}
        {tab === "maintenance" && (
          <UdsMaintenance login={session.login} token={session.token} />
        )}
        {tab === "profile" && (
          <UdsProfile
            login={session.login}
            token={session.token}
            panelRoleLabel={session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
            operatorNumber={session.operator_number}
            subroleLabel={session.subrole_label}
            curatorName={session.curator_name}
            onUpdated={onProfileUpdated}
          />
        )}
      </main>
    </div>
  );
}