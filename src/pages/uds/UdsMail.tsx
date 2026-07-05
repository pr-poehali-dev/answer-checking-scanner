import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, type MailContact, type MailThread, type MailMessage } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  myAddress?: string | null;
}

type Peer = { address: string; name: string; roleLabel?: string; login?: string | null };

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

export default function UdsMail({ login, token, myAddress }: Props) {
  const [tab, setTab] = useState<"chats" | "contacts">("chats");
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [contacts, setContacts] = useState<MailContact[]>([]);
  const [search, setSearch] = useState("");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ispCheck, setIspCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const [ispBusy, setIspBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const testIsp = async () => {
    setIspBusy(true); setIspCheck(null);
    try {
      const r = await udsApi.mailTestIsp(login, token);
      setIspCheck({ ok: r.ok, text: r.ok ? (r.message || "Связь с ISPmanager есть") : (r.reason || "Ошибка") });
    } catch (e) {
      setIspCheck({ ok: false, text: (e as Error).message });
    } finally {
      setIspBusy(false);
    }
  };

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    try {
      const d = await udsApi.mailThreads(login, token);
      setThreads(d.threads);
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingList(false); }
  }, [login, token]);

  const loadContacts = useCallback(async (q: string) => {
    try {
      const d = await udsApi.mailContacts(login, token, q);
      setContacts(d.contacts);
    } catch (e) { setError((e as Error).message); }
  }, [login, token]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (tab === "contacts") {
      const t = setTimeout(() => loadContacts(search), 300);
      return () => clearTimeout(t);
    }
  }, [tab, search, loadContacts]);

  const openPeer = useCallback(async (p: Peer) => {
    setPeer(p); setError(""); setMessages([]); setLoadingThread(true);
    try {
      const d = await udsApi.mailThread(login, token, p.address);
      setMessages(d.messages);
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingThread(false); }
  }, [login, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!peer || !draft.trim()) return;
    setSending(true); setError("");
    try {
      const res = await udsApi.mailSend(login, token, peer.address, subject.trim(), draft.trim());
      setDraft(""); setSubject("");
      const d = await udsApi.mailThread(login, token, peer.address);
      setMessages(d.messages);
      loadThreads();
      // Сообщение сохранено, но не ушло на внешний адрес — предупреждаем
      if (res.warning) setError(res.warning);
    } catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };

  const isExternal = peer && !peer.address.toLowerCase().endsWith("@ooo29.ru");

  return (
    <div className="border border-border rounded-sm bg-white overflow-hidden flex h-[calc(100vh-220px)] min-h-[420px]">
      {/* Левая колонка: чаты / контакты */}
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

        {tab === "contacts" && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ФИО…"
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
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
                  onClick={() => openPeer({ address: t.peer_address, name: t.peer_name, login: t.peer_login })}
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
                  onClick={() => openPeer({ address: c.address, name: c.full_name, roleLabel: c.role_label, login: c.login })}
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

      {/* Правая колонка: переписка */}
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
              <button onClick={() => setPeer(null)} className="sm:hidden text-muted-foreground">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
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
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  className="flex-1 px-3 py-2 text-xs border border-border rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary max-h-32" />
                <button onClick={send} disabled={sending || !draft.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-sm bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-50">
                  {sending ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}