import Icon from "@/components/ui/icon";

interface Props {
  composeTo: string;
  setComposeTo: (v: string) => void;
  composeSubject: string;
  setComposeSubject: (v: string) => void;
  composeBody: string;
  setComposeBody: (v: string) => void;
  composeError: string;
  composeSending: boolean;
  onClose: () => void;
  onSend: () => void;
}

export default function UdsMailComposeModal({
  composeTo, setComposeTo, composeSubject, setComposeSubject,
  composeBody, setComposeBody, composeError, composeSending, onClose, onSend,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => !composeSending && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icon name="PenSquare" size={15} fallback="Plus" /> Новое письмо
          </h3>
          <button onClick={onClose} disabled={composeSending}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Адрес получателя</label>
          <input value={composeTo} onChange={e => setComposeTo(e.target.value)}
            placeholder="example@mail.ru" type="email"
            className="w-full px-3 py-2 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Тема</label>
          <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
            placeholder="Тема письма"
            className="w-full px-3 py-2 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Сообщение</label>
          <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={5}
            placeholder="Текст сообщения…"
            className="w-full px-3 py-2 text-xs border border-border rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {composeError && <p className="text-xs text-destructive">{composeError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={composeSending}
            className="px-3 py-2 text-xs border border-border rounded-sm hover:bg-muted disabled:opacity-50">
            Отмена
          </button>
          <button onClick={onSend} disabled={composeSending}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
            {composeSending ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Send" size={13} />}
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
