import Icon from "@/components/ui/icon";
import type { MailMessage } from "@/lib/api";
import type { Peer } from "@/pages/uds/UdsMailSidebar";

function initials(name: string) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "@";
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

interface Props {
  peer: Peer | null;
  myAddress?: string | null;
  testIsp: () => void;
  ispBusy: boolean;
  ispCheck: { ok: boolean; text: string } | null;
  onBack: () => void;
  loadingThread: boolean;
  messages: MailMessage[];
  bottomRef: React.RefObject<HTMLDivElement>;
  isExternal: boolean | null;
  subject: string;
  setSubject: (s: string) => void;
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string;
}

export default function UdsMailConversation({
  peer, myAddress, testIsp, ispBusy, ispCheck, onBack,
  loadingThread, messages, bottomRef, isExternal,
  subject, setSubject, draft, setDraft, onSend, sending, error,
}: Props) {
  return (
    <div className={`flex-1 flex flex-col ${peer ? "flex" : "hidden sm:flex"}`}>
      {!peer ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 px-6 text-center">
          <Icon name="Mail" size={40} className="opacity-30" />
          <p className="text-sm">Выберите диалог или контакт слева</p>
          {myAddress && <p className="text-xs">Ваш адрес: <span className="font-mono">{myAddress}</span></p>}
          <div className="mt-4 flex flex-col items-center gap-2">
            <button onClick={testIsp} disabled={ispBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-muted disabled:opacity-50">
              {ispBusy ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Server" size={12} />}
              Проверить связь с почтовым хостингом
            </button>
            {ispCheck && (
              <p className={`text-xs max-w-xs ${ispCheck.ok ? "text-green-600" : "text-destructive"}`}>
                <Icon name={ispCheck.ok ? "CheckCircle2" : "AlertCircle"} size={12} className="inline mr-1" />
                {ispCheck.text}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Шапка собеседника */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-muted/30">
            <button onClick={onBack} className="sm:hidden text-muted-foreground">
              <Icon name="ArrowLeft" size={18} />
            </button>
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {initials(peer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{peer.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {peer.roleLabel ? `${peer.roleLabel} · ` : ""}{peer.address}
                {isExternal && <span className="ml-1.5 text-amber-600 font-medium">внешний адрес</span>}
              </p>
            </div>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto styled-scrollbar p-4 space-y-2 bg-slate-50">
            {loadingThread ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                <Icon name="Loader2" size={14} className="animate-spin" /> Загрузка…
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Сообщений пока нет. Напишите первым.</p>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.mine ? "bg-primary text-primary-foreground" : "bg-white border border-border"}`}>
                    {m.subject && <p className={`text-[11px] font-bold mb-0.5 ${m.mine ? "text-white/90" : "text-foreground"}`}>{m.subject}</p>}
                    <p className="text-xs whitespace-pre-wrap break-words">{m.body}</p>
                    <div className={`flex items-center gap-1 justify-end mt-1 ${m.mine ? "text-white/70" : "text-muted-foreground"}`}>
                      <span className="text-[9px]">{fmtTime(m.created_at)}</span>
                      {m.mine && m.external_sent && <Icon name="Send" size={9} />}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Ввод */}
          <div className="border-t border-border p-3 space-y-2">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {isExternal && (
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Тема письма (для внешнего адреса)"
                className="w-full px-3 py-1.5 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            )}
            <div className="flex items-end gap-2">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={1} placeholder="Сообщение…"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                className="flex-1 px-3 py-2 text-xs border border-border rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary max-h-32" />
              <button onClick={onSend} disabled={sending || !draft.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-sm bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-50">
                {sending ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
