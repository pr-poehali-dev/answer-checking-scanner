import Icon from "@/components/ui/icon";
import { type OUUser, type OUSection, getPositionLabel } from "./OUTypes";

interface OUSidebarProps {
  user: OUUser;
  section: OUSection;
  sidebarOpen: boolean;
  nav: { id: OUSection; label: string; icon: string }[];
  initials: string;
  onSetSection: (s: OUSection) => void;
  onCloseSidebar: () => void;
  onLogout: () => void;
}

export default function OUSidebar({
  user,
  section,
  sidebarOpen,
  nav,
  initials,
  onSetSection,
  onCloseSidebar,
  onLogout,
}: OUSidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col flex-shrink-0 transition-transform duration-300
        md:relative md:translate-x-0 md:w-60 md:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "hsl(var(--sidebar-background))" }}
    >
      <div className="px-5 py-5 border-b flex items-start justify-between" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg"
              alt="САОУ"
              className="w-8 h-8 rounded-sm object-contain"
            />
            <div>
              <span className="font-bold text-sm" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>САОУ</span>
              <p className="text-[10px] leading-tight" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>
                Система Автоматизации<br />Образовательных Учреждений
              </p>
            </div>
          </div>
        </div>
        <button className="md:hidden p-1 mt-0.5 text-muted-foreground" onClick={onCloseSidebar}>
          <Icon name="X" size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-header px-3 mb-3 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
          Разделы
        </p>
        {nav.map(item => (
          <div
            key={item.id}
            className={`nav-item ${section === item.id ? "active" : ""}`}
            onClick={() => { onSetSection(item.id); onCloseSidebar(); }}
          >
            <Icon name={item.icon} size={16} fallback="Circle" />
            <span className="flex-1">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="px-3 py-3 rounded-sm border" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-foreground">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
                {user.full_name}
              </p>
              <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.55 }}>
                {getPositionLabel(user.institution_position, user.subject)}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-2.5 w-full text-xs flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }}
          >
            <Icon name="LogOut" size={12} />
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
