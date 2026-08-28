import Icon from "@/components/ui/icon";
import type { MailContact, MailThread } from "@/lib/api";

export type Peer = { address: string; name: string; roleLabel?: string; login?: string | null };

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
  tab: "chats" | "contacts";
  setTab: (t: "chats" | "contacts") => void;
  threads: MailThread[];
  loadingList: boolean;
  contacts: MailContact[];
  search: string;
  setSearch: (s: string) => void;
  peer: Peer | null;
  onOpenPeer: (p: Peer) => void;
  canMailing?: boolean;
  onOpenCompose: () => void;
  onOpenMailing: () => void;
}

export default function UdsMailSidebar({
  tab, setTab, threads, loadingList, contacts, search, setSearch,
  peer, onOpenPeer, canMailing, onOpenCompose, onOpenMailing,
}: Props) {
  return (
    <div className={`w-full sm:w-72 md:w-80 border-r border-border flex flex-col ${peer ? "hidden sm:flex" : "flex"}`}>
      <div className="flex border-b border-border">
        <button onClick={() => setTab("chats")}
          className={`flex-1 py-2.5 text-xs font-semibold ${tab === "chats" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <Icon name="MessageSquare" size={13} className="inline mr-1" /> Диалоги
        </button>
        <button onClick={() => setTab("contacts")}
          className={`flex-1 py-2.5 text-xs font-semibold ${tab === "contacts" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <Icon name="Users" size={13} className="inline mr-1" /> Контакты
        </button>
      </div>

      <div className="p-2 border-b border-border space-y-1.5">
        <button onClick={onOpenCompose}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90">
          <Icon name="PenSquare" size={13} fallback="Plus" /> Написать
        </button>
        {canMailing && (
          <button onClick={onOpenMailing}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold rounded-sm hover:bg-amber-100">
            <Icon name="Megaphone" size={13} fallback="Radio" /> Рассылка
          </button>
        )}
      </div>

      {tab === "contacts" && (
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ФИО…"
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto styled-scrollbar">
        {tab === "chats" ? (
          loadingList ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Icon name="Loader2" size={14} className="animate-spin" /> Загрузка…
            </div>
          ) : threads.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8 px-4">
              Диалогов пока нет. Откройте «Контакты» и напишите коллеге.
            </p>
          ) : (
            threads.map(t => (
              <button key={t.thread_key}
                onClick={() => onOpenPeer({ address: t.peer_address, name: t.peer_name, login: t.peer_login })}
                className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted/50 flex items-center gap-2.5 ${peer?.address === t.peer_address ? "bg-blue-50" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {initials(t.peer_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{t.peer_name}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtTime(t.last_at)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{t.last_body}</p>
                </div>
                {t.unread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
              </button>
            ))
          )
        ) : (
          contacts.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8 px-4">Никого не найдено</p>
          ) : (
            contacts.map(c => (
              <button key={c.login + c.address}
                onClick={() => onOpenPeer({ address: c.address, name: c.full_name, roleLabel: c.role_label, login: c.login })}
                className="w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted/50 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {initials(c.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{c.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.role_label} · {c.address}</p>
                </div>
              </button>
            ))
          )
        )}
      </div>
    </div>
  );
}
