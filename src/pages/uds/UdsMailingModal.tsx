import Icon from "@/components/ui/icon";
import { type MailingAudience, type MailingStatus } from "@/lib/api";
import { PANEL_ROLE_LABELS } from "@/pages/uds/udsSession";

const MAILING_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "operator", label: PANEL_ROLE_LABELS.operator },
  { value: "advisor", label: PANEL_ROLE_LABELS.advisor },
  { value: "tester_role", label: PANEL_ROLE_LABELS.tester_role },
  { value: "developer", label: PANEL_ROLE_LABELS.developer },
  { value: "deputy", label: PANEL_ROLE_LABELS.deputy },
  { value: "head", label: PANEL_ROLE_LABELS.head },
];

const MAILING_STATUS_OPTIONS: { value: MailingStatus; label: string; sender: string; color: string }[] = [
  { value: "planned", label: "Плановая", sender: "info@saou.ru", color: "text-blue-600 border-blue-200 bg-blue-50" },
  { value: "important", label: "Важно", sender: "uprav@saou.ru", color: "text-amber-600 border-amber-200 bg-amber-50" },
  { value: "danger", label: "Опасность", sender: "mvm@saou.ru", color: "text-red-600 border-red-200 bg-red-50" },
];

interface Props {
  mailingAudience: MailingAudience;
  setMailingAudience: (v: MailingAudience) => void;
  mailingRoles: string[];
  toggleMailingRole: (role: string) => void;
  mailingStatus: MailingStatus;
  setMailingStatus: (v: MailingStatus) => void;
  mailingSubject: string;
  setMailingSubject: (v: string) => void;
  mailingBody: string;
  setMailingBody: (v: string) => void;
  mailingError: string;
  mailingSending: boolean;
  mailingResult: { sent: number; total: number; sender: string } | null;
  onClose: () => void;
  onSend: () => void;
}

export default function UdsMailingModal({
  mailingAudience, setMailingAudience, mailingRoles, toggleMailingRole,
  mailingStatus, setMailingStatus, mailingSubject, setMailingSubject,
  mailingBody, setMailingBody, mailingError, mailingSending, mailingResult,
  onClose, onSend,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => !mailingSending && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto styled-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icon name="Megaphone" size={15} fallback="Radio" /> Рассылка
          </h3>
          <button onClick={onClose} disabled={mailingSending}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Icon name="X" size={16} />
          </button>
        </div>

        {mailingResult ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-sm bg-green-50 border border-green-200">
              <Icon name="CheckCircle2" size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-800 leading-relaxed">
                Отправлено {mailingResult.sent} из {mailingResult.total} писем с адреса <span className="font-mono">{mailingResult.sender}</span>.
              </p>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose}
                className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded-sm hover:opacity-90">
                Готово
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Кому</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: "all" as MailingAudience, label: "Все пользователи" },
                  { value: "staff" as MailingAudience, label: "Сотрудники" },
                  { value: "roles" as MailingAudience, label: "Список ролей" },
                ]).map(o => (
                  <button key={o.value} type="button" onClick={() => setMailingAudience(o.value)}
                    className={`px-2 py-2 text-[11px] font-medium rounded-sm border transition-colors ${
                      mailingAudience === o.value ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {mailingAudience === "roles" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Роли</label>
                <div className="flex flex-wrap gap-1.5">
                  {MAILING_ROLE_OPTIONS.map(r => (
                    <button key={r.value} type="button" onClick={() => toggleMailingRole(r.value)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium rounded-sm border transition-colors ${
                        mailingRoles.includes(r.value) ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Статус рассылки</label>
              <div className="grid grid-cols-3 gap-1.5">
                {MAILING_STATUS_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setMailingStatus(o.value)}
                    className={`px-2 py-2 text-[11px] font-semibold rounded-sm border transition-colors ${
                      mailingStatus === o.value ? o.color : "border-border text-muted-foreground hover:border-primary/40"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Отправитель: <span className="font-mono">{MAILING_STATUS_OPTIONS.find(o => o.value === mailingStatus)?.sender}</span>
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Тема</label>
              <input value={mailingSubject} onChange={e => setMailingSubject(e.target.value)}
                placeholder="Тема письма"
                className="w-full px-3 py-2 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <p className="text-[10px] text-muted-foreground mt-1">
                В письме тема автоматически будет дополнена вашим ФИО: «Иванов Иван: {mailingSubject || "тема"}»
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Сообщение</label>
              <textarea value={mailingBody} onChange={e => setMailingBody(e.target.value)} rows={6}
                placeholder="Текст рассылки…"
                className="w-full px-3 py-2 text-xs border border-border rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {mailingError && <p className="text-xs text-destructive">{mailingError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} disabled={mailingSending}
                className="px-3 py-2 text-xs border border-border rounded-sm hover:bg-muted disabled:opacity-50">
                Отмена
              </button>
              <button onClick={onSend} disabled={mailingSending}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
                {mailingSending ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Send" size={13} />}
                {mailingSending ? "Отправляем…" : "Рассылка"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
