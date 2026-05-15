import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { institutionApi, type InstitutionStaff } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";

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

interface Props {
  user: OUUser;
  onLogout: () => void;
}

type Section = "profile" | "management" | "collective";

const POSITION_LABELS: Record<string, string> = {
  director: "Директор",
  vice_director: "Зам. директора",
  counselor: "Советник",
  teacher: "Педагог",
};

const POSITIONS = [
  { value: "director", label: "Директор" },
  { value: "vice_director", label: "Зам. директора" },
  { value: "counselor", label: "Советник" },
  { value: "teacher", label: "Педагог" },
];

function getPositionLabel(position: string, subject?: string | null): string {
  if (position === "teacher" && subject) return `Педагог (${subject})`;
  return POSITION_LABELS[position] || position;
}

export default function InstitutionDashboard({ user, onLogout }: Props) {
  const [section, setSection] = useState<Section>("profile");
  const [sidebarOpen, setSidebar] = useState(false);
  const [staff, setStaff] = useState<InstitutionStaff[]>([]);
  const [collective, setCollective] = useState<{ full_name: string; position: string; position_label: string; subject: string | null }[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Create staff form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newShowPass, setNewShowPass] = useState(false);
  const [newPosition, setNewPosition] = useState("teacher");
  const [newSubject, setNewSubject] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await institutionApi.getStaff(user.login, user.password);
      setStaff(res.staff);
    } catch { /* ignore */ } finally {
      setStaffLoading(false);
    }
  }, [user.login, user.password]);

  const loadCollective = useCallback(async () => {
    try {
      const res = await institutionApi.getCollective(user.login, user.password);
      setCollective(res.members);
    } catch { /* ignore */ }
  }, [user.login, user.password]);

  useEffect(() => {
    if (section === "management") loadStaff();
    if (section === "collective") loadCollective();
  }, [section, loadStaff, loadCollective]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newFullName || !newLogin || !newPassword || !newPosition) {
      setCreateError("Заполните все обязательные поля");
      return;
    }
    if (newPosition === "teacher" && !newSubject) {
      setCreateError("Укажите предмет для педагога");
      return;
    }
    setCreateLoading(true);
    try {
      await institutionApi.createStaff(user.login, user.password, {
        full_name: newFullName,
        login: newLogin,
        password: newPassword,
        position: newPosition,
        subject: newSubject || undefined,
      });
      setShowCreateForm(false);
      setNewFullName(""); setNewLogin(""); setNewPassword(""); setNewPosition("teacher"); setNewSubject("");
      await loadStaff();
    } catch (e) {
      setCreateError((e as Error).message || "Ошибка создания");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteStaff = async (s: InstitutionStaff) => {
    if (!confirm(`Деактивировать сотрудника ${s.full_name}?`)) return;
    try {
      await institutionApi.deleteStaff(user.login, user.password, s.id);
      await loadStaff();
    } catch { /* ignore */ }
  };

  const nav = [
    { id: "profile" as Section, label: "Профиль", icon: "User" },
    ...(user.is_manager ? [{ id: "management" as Section, label: "Управление", icon: "Settings2" }] : []),
    { id: "collective" as Section, label: "Коллектив", icon: "Users" },
  ];

  const initials = user.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebar(false)} />
      )}

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
          <button className="md:hidden p-1 mt-0.5 text-muted-foreground" onClick={() => setSidebar(false)}>
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
              onClick={() => { setSection(item.id); setSidebar(false); }}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
          <button onClick={() => setSidebar(true)} className="p-1.5 -ml-1.5">
            <Icon name="Menu" size={20} className="text-foreground" />
          </button>
          <span className="font-semibold text-sm text-foreground flex-1">
            {nav.find(n => n.id === section)?.label}
          </span>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">{initials}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* PROFILE */}
          {section === "profile" && (
            <div className="max-w-lg animate-slide-up space-y-4">
              <h2 className="text-base font-bold text-foreground">Профиль</h2>
              <div className="bg-white border border-border rounded-sm p-5 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-primary-foreground">{initials}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{getPositionLabel(user.institution_position, user.subject)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{user.institution_name}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon name="User" size={13} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Логин:</span>
                    <span className="text-xs font-mono font-medium text-foreground">{user.login}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="Building2" size={13} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Учреждение:</span>
                    <span className="text-xs text-foreground">{user.institution_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="Briefcase" size={13} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Должность:</span>
                    <span className="text-xs text-foreground">{getPositionLabel(user.institution_position, user.subject)}</span>
                  </div>
                </div>
              </div>

              {user.is_manager && (
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 flex items-start gap-3">
                  <Icon name="ShieldCheck" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Доступ к управлению</p>
                    <p className="text-xs text-blue-600 mt-0.5">Как {getPositionLabel(user.institution_position)}, вы можете создавать профили сотрудников в разделе «Управление».</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANAGEMENT */}
          {section === "management" && user.is_manager && (
            <div className="max-w-2xl animate-slide-up space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Управление сотрудниками</h2>
                <button
                  onClick={() => { setShowCreateForm(true); setCreateError(""); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
                >
                  <Icon name="Plus" size={13} />
                  Добавить сотрудника
                </button>
              </div>

              {/* Форма создания */}
              {showCreateForm && (
                <div className="bg-white border border-border rounded-sm p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">Новый сотрудник</p>
                    <button onClick={() => setShowCreateForm(false)} className="text-muted-foreground hover:text-foreground">
                      <Icon name="X" size={16} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateStaff} className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">ФИО сотрудника *</label>
                      <input
                        type="text"
                        value={newFullName}
                        onChange={e => setNewFullName(e.target.value)}
                        placeholder="Фамилия Имя Отчество"
                        className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Должность *</label>
                      <select
                        value={newPosition}
                        onChange={e => setNewPosition(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {POSITIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    {newPosition === "teacher" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Предмет *</label>
                        <input
                          type="text"
                          value={newSubject}
                          onChange={e => setNewSubject(e.target.value)}
                          placeholder="Например: Математика, История..."
                          className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Логин *</label>
                        <input
                          type="text"
                          value={newLogin}
                          onChange={e => setNewLogin(e.target.value.replace(/\s/g, ""))}
                          placeholder="Логин для входа"
                          className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Пароль *</label>
                        <div className="relative">
                          <input
                            type={newShowPass ? "text" : "password"}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Мин. 6 символов"
                            className="w-full pr-8 px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button type="button" onClick={() => setNewShowPass(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <Icon name={newShowPass ? "EyeOff" : "Eye"} size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {createError && (
                      <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
                        <Icon name="AlertCircle" size={13} className="text-destructive flex-shrink-0" />
                        <p className="text-xs text-destructive">{createError}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={createLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {createLoading
                          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Icon name="UserPlus" size={13} />}
                        {createLoading ? "Создание..." : "Создать профиль"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Список сотрудников */}
              <div className="bg-white border border-border rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted">
                  <p className="text-xs font-semibold text-muted-foreground">Сотрудники учреждения</p>
                </div>
                {staffLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  </div>
                ) : staff.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Icon name="Users" size={28} className="text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Сотрудников пока нет</p>
                    <p className="text-xs text-muted-foreground mt-1">Добавьте первого сотрудника выше</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {s.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">{s.position_label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                          }`}>
                            {s.is_active ? "Активен" : "Деактивирован"}
                          </span>
                          {s.is_active && s.login !== user.login && (
                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                              title="Деактивировать"
                            >
                              <Icon name="UserMinus" size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COLLECTIVE */}
          {section === "collective" && (
            <div className="max-w-lg animate-slide-up space-y-4">
              <h2 className="text-base font-bold text-foreground">Коллектив</h2>
              <div className="bg-white border border-border rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted">
                  <p className="text-xs font-semibold text-muted-foreground">{user.institution_name}</p>
                </div>
                {collective.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Icon name="Users" size={28} className="text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">В коллективе пока нет участников</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {collective.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {m.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground">{m.position_label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <div className="border-t border-border px-4 py-2 bg-white">
          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}
