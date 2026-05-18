import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, type SupportTicket, type SupportMessage } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

const SECTIONS: { value: string; label: string }[] = [
  { value: "upload",        label: "Загрузка бланков" },
  { value: "works",         label: "Работы" },
  { value: "results",       label: "Результаты" },
  { value: "students",      label: "Ученики" },
  { value: "tests",         label: "Тесты" },
  { value: "synopsis",      label: "Конспекты" },
  { value: "presentations", label: "Презентации" },
  { value: "exams",         label: "ОГЭ / ЕГЭ" },
  { value: "chat",          label: "Чат с ИИ" },
  { value: "subscription",  label: "Подписка" },
  { value: "other",         label: "Другое" },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open:   { label: "Ожидает",   color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  taken:  { label: "В работе",  color: "text-blue-600 bg-blue-50 border-blue-200" },
  closed: { label: "Закрыто",   color: "text-gray-500 bg-gray-50 border-gray-200" },
};

export function SupportSection() {
  const { teacher } = useAppStore();
  const login = teacher?.login ?? "";
  const token = teacher?.authToken ?? "";

  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Форма нового обращения
  const [section, setSection] = useState("other");
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");

  // Ввод сообщения в чате
  const [msgInput, setMsgInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTickets = async () => {
    if (!login) return;
    try {
      const res = await supportApi.myTickets(login, token);
      setTickets(res.tickets);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadTickets();
  }, [login]);

  const openChat = async (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    setView("chat");
    setLoading(true);
    try {
      const res = await supportApi.ticketMessages(login, token, ticket.id);
      setMessages(res.messages);
      setActiveTicket(res.ticket);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Поллинг новых сообщений каждые 5 сек
  useEffect(() => {
    if (view !== "chat" || !activeTicket) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await supportApi.ticketMessages(login, token, activeTicket.id);
        setMessages(res.messages);
        setActiveTicket(res.ticket);
      } catch { /* ignore */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, activeTicket?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submitNew = async () => {
    if (!subject.trim() || !firstMsg.trim()) {
      setError("Заполните тему и описание проблемы");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await supportApi.createTicket(login, token, section, subject.trim(), firstMsg.trim());
      await loadTickets();
      const newTicket: SupportTicket = {
        id: res.ticket_id, login, section, subject: subject.trim(),
        status: "open", operator_login: null, operator_number: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setSubject(""); setFirstMsg(""); setSection("other");
      await openChat(newTicket);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const sendMsg = async () => {
    if (!msgInput.trim() || !activeTicket) return;
    const text = msgInput.trim();
    setMsgInput("");
    setSending(true);
    try {
      await supportApi.sendMessage(login, token, activeTicket.id, text);
      const res = await supportApi.ticketMessages(login, token, activeTicket.id);
      setMessages(res.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const sectionLabel = (v: string) => SECTIONS.find(s => s.value === v)?.label ?? v;

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="animate-slide-up space-y-4">
      <div className="border border-border rounded-sm overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(215 60% 18%) 0%, hsl(225 50% 28%) 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Headphones" size={16} className="text-blue-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Служба поддержки</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Техническая поддержка</h2>
          <p className="text-xs opacity-75">Опишите проблему — оператор подключится и поможет в чате</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Мои обращения</p>
        <button
          onClick={() => setView("new")}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <Icon name="Plus" size={13} />
          Новое обращение
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <Icon name="Headphones" size={32} className="mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Обращений пока нет</p>
          <p className="text-xs text-muted-foreground mt-1">Нажмите «Новое обращение» если нужна помощь</p>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden bg-white divide-y divide-border">
          {tickets.map(t => {
            const st = STATUS_LABEL[t.status] ?? STATUS_LABEL.open;
            return (
              <div key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => openChat(t)}>
                <div className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 bg-primary/10">
                  <Icon name="MessageCircle" size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{t.subject}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                    {t.operator_number && (
                      <span className="text-[10px] text-muted-foreground">Оператор №{t.operator_number}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sectionLabel(t.section)} · {new Date(t.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Icon name="ChevronRight" size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── NEW TICKET ────────────────────────────────────────────────────────────
  if (view === "new") return (
    <div className="animate-slide-up space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setView("list"); setError(""); }}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <h2 className="text-sm font-semibold">Новое обращение</h2>
      </div>

      <div className="border border-border rounded-sm bg-white p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Раздел</label>
          <select value={section} onChange={e => setSection(e.target.value)}
            className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Тема обращения <span className="text-destructive">*</span>
          </label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Кратко опишите проблему"
            className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Описание проблемы <span className="text-destructive">*</span>
          </label>
          <textarea value={firstMsg} onChange={e => setFirstMsg(e.target.value)} rows={5}
            placeholder="Подробно опишите что происходит, что ожидали и что получилось…"
            className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <button onClick={() => { setView("list"); setError(""); }}
            className="px-4 py-2 border border-border text-sm rounded-sm hover:bg-muted/30 transition-colors">
            Отмена
          </button>
          <button onClick={submitNew} disabled={sending || !subject.trim() || !firstMsg.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {sending && <Icon name="Loader2" size={14} className="animate-spin" />}
            Отправить обращение
          </button>
        </div>
      </div>
    </div>
  );

  // ── CHAT ─────────────────────────────────────────────────────────────────
  if (view === "chat" && activeTicket) {
    const st = STATUS_LABEL[activeTicket.status] ?? STATUS_LABEL.open;
    return (
      <div className="animate-slide-up flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => { setView("list"); loadTickets(); if (pollRef.current) clearInterval(pollRef.current); }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm">
            <Icon name="ArrowLeft" size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{activeTicket.subject}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{sectionLabel(activeTicket.section)}</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] ${st.color}`}>{st.label}</span>
              {activeTicket.operator_number && (
                <span>Оператор №{activeTicket.operator_number}</span>
              )}
            </div>
          </div>
        </div>

        {/* Сообщения */}
        <div className="flex-1 border border-border rounded-sm bg-white overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}
          {messages.map(m => {
            const isUser = m.sender_role === "user";
            const isSystem = m.sender_role === "system";
            if (isSystem) return (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">{m.body}</span>
              </div>
            );
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground border border-border rounded-bl-sm"
                }`}>
                  {!isUser && (
                    <p className="text-[10px] font-semibold opacity-60 mb-0.5">Оператор</p>
                  )}
                  {m.body}
                  <p className={`text-[10px] mt-1 ${isUser ? "opacity-60 text-right" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Ввод */}
        {activeTicket.status !== "closed" ? (
          <div className="flex gap-2 mt-3">
            <textarea
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder="Напишите сообщение… (Enter — отправить)"
              rows={2}
              className="flex-1 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <button onClick={sendMsg} disabled={sending || !msgInput.trim()}
              className="px-4 bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
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

  return null;
}

export default SupportSection;