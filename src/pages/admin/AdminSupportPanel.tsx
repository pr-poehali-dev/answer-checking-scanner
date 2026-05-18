import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, type SupportTicket, type SupportMessage, type PanelOperator } from "@/lib/api";

const PANEL_ROLES = [
  { value: "operator",     label: "Оператор ТП" },
  { value: "advisor",      label: "Советник" },
  { value: "tester_role",  label: "Тестер" },
  { value: "developer",    label: "Разработчик" },
  { value: "deputy",       label: "Зам. Главы Правления" },
];

const STATUS_COLOR: Record<string, string> = {
  open:   "text-yellow-600 bg-yellow-50 border-yellow-200",
  taken:  "text-blue-600 bg-blue-50 border-blue-200",
  closed: "text-gray-500 bg-gray-50 border-gray-200",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Ожидает", taken: "В работе", closed: "Закрыто",
};

const SECTION_LABELS: Record<string, string> = {
  upload: "Загрузка бланков", works: "Работы", results: "Результаты",
  students: "Ученики", tests: "Тесты", synopsis: "Конспекты",
  presentations: "Презентации", exams: "ОГЭ/ЕГЭ", chat: "Чат с ИИ",
  subscription: "Подписка", other: "Другое",
};

interface Props {
  login: string;
  token: string;
  panelRole: string; // роль текущего оператора
}

type SubTab = "tickets" | "operators";

export default function AdminSupportPanel({ login, token, panelRole }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("tickets");
  const [statusFilter, setStatusFilter] = useState("open");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [operators, setOperators] = useState<PanelOperator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Чат с пользователем
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Назначение операторов
  const [assignLogin, setAssignLogin] = useState("");
  const [assignRole, setAssignRole] = useState("operator");
  const [assignBusy, setAssignBusy] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await supportApi.allTickets(login, token, statusFilter);
      setTickets(res.tickets);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const loadOperators = async () => {
    try {
      const res = await supportApi.operators(login, token);
      setOperators(res.operators);
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => { loadTickets(); }, [statusFilter]);
  useEffect(() => { if (subTab === "operators") loadOperators(); }, [subTab]);

  // Поллинг чата
  useEffect(() => {
    if (!activeTicket) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await supportApi.ticketMessages(login, token, activeTicket.id);
        setMessages(res.messages);
        setActiveTicket(res.ticket);
      } catch { /* ignore */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTicket?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const openTicketChat = async (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    try {
      const res = await supportApi.ticketMessages(login, token, ticket.id);
      setMessages(res.messages);
      setActiveTicket(res.ticket);
    } catch (e) { setError((e as Error).message); }
  };

  const takeTicket = async (ticket: SupportTicket) => {
    try {
      await supportApi.takeTicket(login, token, ticket.id);
      await openTicketChat({ ...ticket, status: "taken" });
      loadTickets();
    } catch (e) { setError((e as Error).message); }
  };

  const closeTicket = async () => {
    if (!activeTicket) return;
    if (!confirm("Закрыть обращение?")) return;
    try {
      await supportApi.closeTicket(login, token, activeTicket.id);
      setActiveTicket(null);
      setMessages([]);
      loadTickets();
    } catch (e) { setError((e as Error).message); }
  };

  const sendMsg = async () => {
    if (!msgInput.trim() || !activeTicket) return;
    const text = msgInput.trim();
    setMsgInput("");
    setSending(true);
    try {
      await supportApi.opSendMessage(login, token, activeTicket.id, text);
      const res = await supportApi.ticketMessages(login, token, activeTicket.id);
      setMessages(res.messages);
    } catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };

  const handleAssign = async () => {
    if (!assignLogin.trim()) { setError("Укажите логин"); return; }
    setAssignBusy(true); setError("");
    try {
      await supportApi.assignOperator(login, token, assignLogin.trim(), assignRole);
      setAssignLogin(""); await loadOperators();
    } catch (e) { setError((e as Error).message); }
    finally { setAssignBusy(false); }
  };

  const handleRemove = async (targetLogin: string) => {
    if (!confirm(`Снять роль оператора у ${targetLogin}?`)) return;
    try {
      await supportApi.removeOperator(login, token, targetLogin);
      await loadOperators();
    } catch (e) { setError((e as Error).message); }
  };

  // ── Если чат открыт ──────────────────────────────────────────────────────
  if (activeTicket) {
    const st = STATUS_COLOR[activeTicket.status] ?? STATUS_COLOR.open;
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => { setActiveTicket(null); setMessages([]); if (pollRef.current) clearInterval(pollRef.current); }}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-sm">
            <Icon name="ArrowLeft" size={15} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">#{activeTicket.id} · {activeTicket.subject}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{SECTION_LABELS[activeTicket.section] ?? activeTicket.section}</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] ${st}`}>
                {STATUS_LABEL[activeTicket.status] ?? activeTicket.status}
              </span>
              <span>Пользователь: <strong>{activeTicket.login}</strong></span>
            </div>
          </div>
          {activeTicket.status === "open" && (
            <button onClick={() => takeTicket(activeTicket)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-sm hover:bg-blue-700">
              Взять заявку
            </button>
          )}
          {activeTicket.status === "taken" && activeTicket.operator_login === login && (
            <button onClick={closeTicket}
              className="px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-sm hover:bg-gray-700">
              Закрыть
            </button>
          )}
        </div>

        {/* Сообщения */}
        <div className="flex-1 border border-border rounded-sm bg-white overflow-y-auto p-4 space-y-3">
          {messages.map(m => {
            const isOp = m.sender_role === "operator";
            const isSystem = m.sender_role === "system";
            if (isSystem) return (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">{m.body}</span>
              </div>
            );
            return (
              <div key={m.id} className={`flex ${isOp ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  isOp
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-muted text-foreground border border-border rounded-bl-sm"
                }`}>
                  {!isOp && <p className="text-[10px] font-semibold opacity-60 mb-0.5">{m.sender_login}</p>}
                  {m.body}
                  <p className={`text-[10px] mt-1 ${isOp ? "opacity-60 text-right" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {activeTicket.status !== "closed" ? (
          <div className="flex gap-2 mt-3">
            <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder="Ответ пользователю… (Enter — отправить)"
              rows={2}
              className="flex-1 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            <button onClick={sendMsg} disabled={sending || !msgInput.trim()}
              className="px-4 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50">
              <Icon name={sending ? "Loader2" : "Send"} size={16} className={sending ? "animate-spin" : ""} />
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground border border-border rounded-sm py-2 bg-muted/30">
            Обращение закрыто
          </p>
        )}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Подвкладки */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { id: "tickets", label: "Обращения", icon: "MessageCircle" },
          ...(["head","deputy","developer"].includes(panelRole)
            ? [{ id: "operators", label: "Операторы ПУ", icon: "Users" }]
            : []),
        ] as { id: SubTab; label: string; icon: string }[]).map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              subTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={t.icon} size={13} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* ── Заявки ── */}
      {subTab === "tickets" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1">
              {["open","taken","closed","all"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-sm font-medium border transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}>
                  {s === "open" ? "Ожидают" : s === "taken" ? "В работе" : s === "closed" ? "Закрытые" : "Все"}
                </button>
              ))}
            </div>
            <button onClick={loadTickets} disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-muted/30 disabled:opacity-50">
              <Icon name={loading ? "Loader2" : "RefreshCw"} size={12} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm p-8 text-center">
              <Icon name="Inbox" size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Обращений нет</p>
            </div>
          ) : (
            <div className="border border-border rounded-sm overflow-hidden bg-white divide-y divide-border">
              {tickets.map(t => {
                const sc = STATUS_COLOR[t.status] ?? STATUS_COLOR.open;
                return (
                  <div key={t.id} className="px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => openTicketChat(t)}>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-sm bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Icon name="MessageCircle" size={14} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">#{t.id}</span>
                          <p className="text-sm font-semibold truncate">{t.subject}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sc}`}>
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span>{SECTION_LABELS[t.section] ?? t.section}</span>
                          <span>от <strong>{t.login}</strong></span>
                          {t.operator_number && <span>Оператор №{t.operator_number}</span>}
                          <span>{new Date(t.updated_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                      {t.status === "open" && (
                        <button
                          onClick={e => { e.stopPropagation(); takeTicket(t); }}
                          className="flex-shrink-0 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-sm hover:bg-blue-700 whitespace-nowrap">
                          Взять заявку
                        </button>
                      )}
                      {t.status !== "open" && (
                        <Icon name="ChevronRight" size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Операторы ── */}
      {subTab === "operators" && (
        <div className="space-y-4">
          {/* Форма назначения */}
          <div className="border border-border rounded-sm bg-white p-4 space-y-3">
            <p className="text-sm font-semibold">Назначить роль оператора</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" value={assignLogin} onChange={e => setAssignLogin(e.target.value)}
                placeholder="Логин пользователя"
                className="border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              <select value={assignRole} onChange={e => setAssignRole(e.target.value)}
                className="border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {PANEL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={handleAssign} disabled={assignBusy || !assignLogin.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
                {assignBusy && <Icon name="Loader2" size={13} className="animate-spin" />}
                Назначить
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Вы можете назначать роли только ниже своей. Роль автоматически открывает Панель Управления.
            </p>
          </div>

          {/* Список операторов */}
          <div className="border border-border rounded-sm overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
              <p className="text-sm font-semibold">Операторы ({operators.length})</p>
              <button onClick={loadOperators} className="text-xs text-muted-foreground hover:text-foreground">
                <Icon name="RefreshCw" size={12} />
              </button>
            </div>
            {operators.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">Операторов пока нет</p>
            ) : (
              <div className="divide-y divide-border">
                {operators.map(op => (
                  <div key={op.login} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="User" size={14} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{op.full_name || op.login}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                          {op.panel_role_label}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">№{op.operator_number}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">@{op.login}</p>
                    </div>
                    {op.login !== login && op.panel_role !== "head" && (
                      <button onClick={() => handleRemove(op.login)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Снять роль">
                        <Icon name="X" size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
