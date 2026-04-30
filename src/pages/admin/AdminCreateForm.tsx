import Icon from "@/components/ui/icon";

interface Props {
  busy: boolean;
  newLogin: string;
  newPassword: string;
  newName: string;
  newSchool: string;
  setNewLogin: (v: string) => void;
  setNewPassword: (v: string) => void;
  setNewName: (v: string) => void;
  setNewSchool: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onGeneratePassword: () => string;
}

export default function AdminCreateForm({
  busy,
  newLogin,
  newPassword,
  newName,
  newSchool,
  setNewLogin,
  setNewPassword,
  setNewName,
  setNewSchool,
  onSubmit,
  onCancel,
  onGeneratePassword,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="border border-border rounded-sm bg-white p-5 space-y-3">
      <h3 className="text-sm font-bold">Новый учитель</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">ФИО</label>
          <input
            required
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Иванова Наталья Петровна"
            className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Школа</label>
          <input
            value={newSchool}
            onChange={e => setNewSchool(e.target.value)}
            placeholder="АОУСПТ"
            className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Логин</label>
          <input
            required
            value={newLogin}
            onChange={e => setNewLogin(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="ivanova"
            className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring mono"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Пароль (мин. 6 символов)</label>
          <div className="flex gap-1">
            <input
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••"
              className="flex-1 px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring mono"
            />
            <button
              type="button"
              onClick={() => setNewPassword(onGeneratePassword())}
              title="Сгенерировать"
              className="px-2 border border-border rounded-sm text-xs hover:bg-muted"
            >
              <Icon name="Wand2" size={13} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted"
        >Отмена</button>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Создаём..." : "Создать"}
        </button>
      </div>
    </form>
  );
}
