import Icon from "@/components/ui/icon";

interface Props {
  resetFor: string;
  resetPass: string;
  setResetPass: (v: string) => void;
  onReset: (login: string) => void;
  onClose: () => void;
  onGeneratePassword: () => string;
}

export default function AdminResetPasswordModal({
  resetFor,
  resetPass,
  setResetPass,
  onReset,
  onClose,
  onGeneratePassword,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-sm border border-border max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-1">Сброс пароля</h3>
        <p className="text-xs text-muted-foreground mb-4">для <span className="mono font-bold">{resetFor}</span></p>
        <div className="flex gap-1 mb-4">
          <input
            autoFocus
            value={resetPass}
            onChange={e => setResetPass(e.target.value)}
            placeholder="Новый пароль (мин. 6 символов)"
            className="flex-1 px-3 py-2 border border-border rounded-sm text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setResetPass(onGeneratePassword())}
            className="px-2 border border-border rounded-sm text-xs hover:bg-muted"
          ><Icon name="Wand2" size={13} /></button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted"
          >Отмена</button>
          <button
            onClick={() => onReset(resetFor)}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90"
          >Сохранить</button>
        </div>
      </div>
    </div>
  );
}
