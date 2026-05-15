import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { institutionApi, type InstitutionStaff } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";
import { type OUUser, type OUSection } from "@/components/institution/OUTypes";
import OUSidebar from "@/components/institution/OUSidebar";
import OUProfileSection from "@/components/institution/OUProfileSection";
import OUManagementSection from "@/components/institution/OUManagementSection";
import OUCollectiveSection from "@/components/institution/OUCollectiveSection";

export type { OUUser };

interface Props {
  user: OUUser;
  onLogout: () => void;
}

export default function InstitutionDashboard({ user, onLogout }: Props) {
  const [section, setSection] = useState<OUSection>("profile");
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

  // Edit staff form
  const [editStaff, setEditStaff] = useState<InstitutionStaff | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPosition, setEditPosition] = useState("teacher");
  const [editSubject, setEditSubject] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editShowPass, setEditShowPass] = useState(false);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
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

  const openEdit = (s: InstitutionStaff) => {
    setEditStaff(s);
    setEditFullName(s.full_name);
    setEditPosition(s.position);
    setEditSubject(s.subject || "");
    setEditPassword("");
    setEditError("");
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    setEditError("");
    if (!editFullName || !editPosition) { setEditError("Заполните все обязательные поля"); return; }
    if (editPosition === "teacher" && !editSubject) { setEditError("Укажите предмет для педагога"); return; }
    if (editPassword && editPassword.length < 6) { setEditError("Пароль должен быть не менее 6 символов"); return; }
    setEditLoading(true);
    try {
      await institutionApi.updateStaff(user.login, user.password, editStaff.id, {
        full_name: editFullName,
        position: editPosition,
        subject: editSubject || undefined,
        new_password: editPassword || undefined,
      });
      setEditStaff(null);
      await loadStaff();
    } catch (e) {
      setEditError((e as Error).message || "Ошибка сохранения");
    } finally {
      setEditLoading(false);
    }
  };

  const nav = [
    { id: "profile" as OUSection, label: "Профиль", icon: "User" },
    ...(user.is_manager ? [{ id: "management" as OUSection, label: "Управление", icon: "Settings2" }] : []),
    { id: "collective" as OUSection, label: "Коллектив", icon: "Users" },
  ];

  const initials = user.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebar(false)} />
      )}

      <OUSidebar
        user={user}
        section={section}
        sidebarOpen={sidebarOpen}
        nav={nav}
        initials={initials}
        onSetSection={setSection}
        onCloseSidebar={() => setSidebar(false)}
        onLogout={onLogout}
      />

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
          {section === "profile" && (
            <OUProfileSection user={user} initials={initials} />
          )}

          {section === "management" && user.is_manager && (
            <OUManagementSection
              userLogin={user.login}
              staff={staff}
              staffLoading={staffLoading}
              showCreateForm={showCreateForm}
              newFullName={newFullName}
              newLogin={newLogin}
              newPassword={newPassword}
              newShowPass={newShowPass}
              newPosition={newPosition}
              newSubject={newSubject}
              createError={createError}
              createLoading={createLoading}
              onOpenCreateForm={() => { setShowCreateForm(true); setCreateError(""); }}
              onCloseCreateForm={() => setShowCreateForm(false)}
              onSetNewFullName={setNewFullName}
              onSetNewLogin={setNewLogin}
              onSetNewPassword={setNewPassword}
              onToggleNewShowPass={() => setNewShowPass(v => !v)}
              onSetNewPosition={setNewPosition}
              onSetNewSubject={setNewSubject}
              onCreateStaff={handleCreateStaff}
              editStaff={editStaff}
              editFullName={editFullName}
              editPosition={editPosition}
              editSubject={editSubject}
              editPassword={editPassword}
              editShowPass={editShowPass}
              editError={editError}
              editLoading={editLoading}
              onCloseEdit={() => setEditStaff(null)}
              onSetEditFullName={setEditFullName}
              onSetEditPosition={setEditPosition}
              onSetEditSubject={setEditSubject}
              onSetEditPassword={setEditPassword}
              onToggleEditShowPass={() => setEditShowPass(v => !v)}
              onEditStaff={handleEditStaff}
              onOpenEdit={openEdit}
              onDeleteStaff={handleDeleteStaff}
            />
          )}

          {section === "collective" && (
            <OUCollectiveSection
              institutionName={user.institution_name}
              collective={collective}
            />
          )}
        </main>

        <div className="border-t border-border px-4 py-2 bg-white">
          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}
