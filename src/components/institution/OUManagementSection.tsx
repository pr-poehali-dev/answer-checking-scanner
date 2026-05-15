import Icon from "@/components/ui/icon";
import { type InstitutionStaff } from "@/lib/api";
import { POSITIONS } from "./OUTypes";

interface OUManagementSectionProps {
  userLogin: string;
  staff: InstitutionStaff[];
  staffLoading: boolean;

  showCreateForm: boolean;
  newFullName: string;
  newLogin: string;
  newPassword: string;
  newShowPass: boolean;
  newPosition: string;
  newSubject: string;
  createError: string;
  createLoading: boolean;
  onOpenCreateForm: () => void;
  onCloseCreateForm: () => void;
  onSetNewFullName: (v: string) => void;
  onSetNewLogin: (v: string) => void;
  onSetNewPassword: (v: string) => void;
  onToggleNewShowPass: () => void;
  onSetNewPosition: (v: string) => void;
  onSetNewSubject: (v: string) => void;
  onCreateStaff: (e: React.FormEvent) => void;

  editStaff: InstitutionStaff | null;
  editFullName: string;
  editPosition: string;
  editSubject: string;
  editPassword: string;
  editShowPass: boolean;
  editError: string;
  editLoading: boolean;
  onCloseEdit: () => void;
  onSetEditFullName: (v: string) => void;
  onSetEditPosition: (v: string) => void;
  onSetEditSubject: (v: string) => void;
  onSetEditPassword: (v: string) => void;
  onToggleEditShowPass: () => void;
  onEditStaff: (e: React.FormEvent) => void;

  onOpenEdit: (s: InstitutionStaff) => void;
  onDeleteStaff: (s: InstitutionStaff) => void;
}

export default function OUManagementSection({
  userLogin,
  staff,
  staffLoading,
  showCreateForm,
  newFullName,
  newLogin,
  newPassword,
  newShowPass,
  newPosition,
  newSubject,
  createError,
  createLoading,
  onOpenCreateForm,
  onCloseCreateForm,
  onSetNewFullName,
  onSetNewLogin,
  onSetNewPassword,
  onToggleNewShowPass,
  onSetNewPosition,
  onSetNewSubject,
  onCreateStaff,
  editStaff,
  editFullName,
  editPosition,
  editSubject,
  editPassword,
  editShowPass,
  editError,
  editLoading,
  onCloseEdit,
  onSetEditFullName,
  onSetEditPosition,
  onSetEditSubject,
  onSetEditPassword,
  onToggleEditShowPass,
  onEditStaff,
  onOpenEdit,
  onDeleteStaff,
}: OUManagementSectionProps) {
  return (
    <div className="max-w-2xl animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Управление сотрудниками</h2>
        <button
          onClick={onOpenCreateForm}
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
            <button onClick={onCloseCreateForm} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={16} />
            </button>
          </div>
          <form onSubmit={onCreateStaff} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">ФИО сотрудника *</label>
              <input
                type="text"
                value={newFullName}
                onChange={e => onSetNewFullName(e.target.value)}
                placeholder="Фамилия Имя Отчество"
                className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Должность *</label>
              <select
                value={newPosition}
                onChange={e => onSetNewPosition(e.target.value)}
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
                  onChange={e => onSetNewSubject(e.target.value)}
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
                  onChange={e => onSetNewLogin(e.target.value.replace(/\s/g, ""))}
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
                    onChange={e => onSetNewPassword(e.target.value)}
                    placeholder="Мин. 6 символов"
                    className="w-full pr-8 px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button type="button" onClick={onToggleNewShowPass}
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
                onClick={onCloseCreateForm}
                className="px-4 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Форма редактирования */}
      {editStaff && (
        <div className="bg-white border border-primary/30 rounded-sm p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Редактировать: {editStaff.full_name}</p>
            <button onClick={onCloseEdit} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={16} />
            </button>
          </div>
          <form onSubmit={onEditStaff} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">ФИО сотрудника *</label>
              <input
                type="text"
                value={editFullName}
                onChange={e => onSetEditFullName(e.target.value)}
                placeholder="Фамилия Имя Отчество"
                className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Должность *</label>
              <select
                value={editPosition}
                onChange={e => onSetEditPosition(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {editPosition === "teacher" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Предмет *</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => onSetEditSubject(e.target.value)}
                  placeholder="Например: Математика, История..."
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Новый пароль <span className="text-muted-foreground/60">(оставьте пустым, чтобы не менять)</span>
              </label>
              <div className="relative">
                <input
                  type={editShowPass ? "text" : "password"}
                  value={editPassword}
                  onChange={e => onSetEditPassword(e.target.value)}
                  placeholder="Мин. 6 символов"
                  className="w-full pr-8 px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button type="button" onClick={onToggleEditShowPass}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Icon name={editShowPass ? "EyeOff" : "Eye"} size={13} />
                </button>
              </div>
            </div>
            {editError && (
              <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
                <Icon name="AlertCircle" size={13} className="text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{editError}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
              >
                {editLoading
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Icon name="Save" size={13} />}
                {editLoading ? "Сохранение..." : "Сохранить изменения"}
              </button>
              <button
                type="button"
                onClick={onCloseEdit}
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
                  {s.is_active && (
                    <button
                      onClick={() => onOpenEdit(s)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Редактировать"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                  )}
                  {s.is_active && s.login !== userLogin && (
                    <button
                      onClick={() => onDeleteStaff(s)}
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
  );
}
