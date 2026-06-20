import { useEffect, useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, type SupportTicket, type SupportMessage } from "@/lib/api";

const SECTION_LABEL: Record<string, string> = {
  upload: "Загрузка бланков", works: "Работы", results: "Результаты",
  students: "Ученики", tests: "Тесты", synopsis: "Конспекты",
  presentations: "Презентации", exams: "ОГЭ / ЕГЭ", chat: "Чат с ИИ",
  subscription: "Подписка", other: "Другое",
};

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Ожидает", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  taken: { label: "В работе", color: "text-blue-600 bg-blue-50 border-blue-200" },
  closed: { label: "Закрыто", color: "text-gray-500 bg-gray-50 border-gray-200" },
};

interface Props { login: string; token: string; panelRole: string; }

export default function UdsSupport({ login, token }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await supportApi.allTickets(login, token, filter);
      setTickets(res.tickets);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token, filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Автообновление списка каждые 8 сек
  useEffect(() => {
    const t = setInterval(loadTickets, 8000);
    return () => clearInterval(t);
  }, [loadTickets]);

  const openChat = async (t: SupportTicket) => {
    setActive(t); setError("");
    try {
      const res = await supportApi.ticketMessages(login, token, t.id);
      setMessages(res.messages);
      setActive(res.ticket);
    } catch (e) { setError((e as Error).message); }
  };

  // Поллинг сообщений открытого тикета
  useEffect(() => {
    if (!active) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await supportApi.ticketMessages(login, token, active.id);
        setMessages(res.messages);
        setActive(res.ticket);
      } catch { /* ignore */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active?.id, login, token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const take = async () => {
    if (!active) return;
    setBusy(true);
    try { await supportApi.takeTicket(login, token, active.id); await openChat(active); await loadTickets(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const close = async () => {
    if (!active) return;
    setBusy(true);
    try { await supportApi.closeTicket(login, token, active.id); await openChat(active); await loadTickets(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!msgInput.trim() || !active) return;
    const text = msgInput.trim(); setMsgInput(""); setBusy(true);
    try {
      await supportApi.opSendMessage(login, token, active.id, text);
      const res = await supportApi.ticketMessages(login, token, active.id);
      setMessages(res.messages);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Список тикетов */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Обращения</h2>
            <div className="flex gap-1">
              <button onClick={() => setFilter("open")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${filter === "open" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                Активные
              </button>
              <button onClick={() => setFilter("all")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                Все
              </button>
              <button onClick={loadTickets} className="p-1.5 rounded hover:bg-muted" title="Обновить">
                <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
          <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden max-h-[70vh] overflow-y-auto">
            {tickets.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground p-6 text-center">Обращений нет</p>
            )}
            {tickets.map(t => {
              const st = STATUS[t.status] ?? STATUS.open;
              return (
                <button key={t.id} onClick={() => openChat(t)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/30 ${active?.id === t.id ? "bg-blue-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate flex-1">{t.subject}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.login} · {SECTION_LABEL[t.section] || t.section}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Чат */}
        <div className="border border-border rounded-lg bg-white flex flex-col min-h-[60vh]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <Icon name="MessageSquare" size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                Выберите обращение
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{active.subject}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {active.login} · {SECTION_LABEL[active.section] || active.section}
                    {active.operator_number ? ` · оператор №${active.operator_number}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {active.status === "open" && (
                    <button onClick={take} disabled={busy}
                      className="px-2.5 py-1.5 bg-primary text-primary-foreground text-[11px] font-semibold rounded hover:opacity-90 disabled:opacity-50">
                      Взять
                    </button>
                  )}
                  {active.status !== "closed" && (
                    <button onClick={close} disabled={busy}
                      className="px-2.5 py-1.5 border border-border text-[11px] rounded hover:bg-muted disabled:opacity-50">
                      Закрыть
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[55vh]">
                {messages.map(m => {
                  const isOp = m.sender_role === "operator";
                  const isSys = m.sender_role === "system";
                  if (isSys) return (
                    <div key={m.id} className="text-center">
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded">{m.body}</span>
                    </div>
                  );
                  return (
                    <div key={m.id} className={`flex ${isOp ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${isOp ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${isOp ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {active.status !== "closed" && (
                <div className="border-t border-border p-3 flex gap-2">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ответ пользователю…"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={send} disabled={busy || !msgInput.trim()}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
                    <Icon name="Send" size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
