import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/2188b28c-bef1-4cf5-9016-f25d4b79fa8a";
const PWD_KEY = "sjou_operator_pwd_v1";

interface Application {
  id: number;
  oo_full_name: string;
  oo_short_name?: string;
  oo_type: string;
  oo_type_label: string;
  inn: string;
  ogrn?: string;
  legal_address: string;
  actual_address?: string;
  region: string;
  director_name: string;
  contact_name: string;
  contact_position?: string;
  contact_phone: string;
  contact_email: string;
  students_count?: number;
  statement_file_url?: string;
  statement_file_name?: string;
  status: string;
  operator_comment?: string;
  reviewed_at?: string;
  created_at: string;
  oo_admin_login?: string;
  oo_admin_password?: string;
  operator_number?: string;
}

interface Message {
  id: number;
  direction: string;
  subject?: string;
  body: string;
  operator_number?: string;
  to_email?: string;
  email_sent?: boolean;
  created_at: string;
}

const OP_NUM_KEY = "sjou_operator_number_v1";

const STATUS_META: Record<string, { label: string; cls: string; icon: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-amber-100 text-amber-700", icon: "Clock" },
  approved: { label: "Одобрена", cls: "bg-green-100 text-green-700", icon: "CheckCircle2" },
  rejected: { label: "Отклонена", cls: "bg-red-100 text-red-700", icon: "XCircle" },
};

export default function SjouOperatorPage() {
  const [pwd, setPwd] = useState(() => localStorage.getItem(PWD_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [operatorNumber, setOperatorNumber] = useState(() => localStorage.getItem(OP_NUM_KEY) || "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    localStorage.setItem(OP_NUM_KEY, operatorNumber);
  }, [operatorNumber]);

  const load = useCallback(
    async (password: string, status: string) => {
      setLoading(true);
      setAuthError("");
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", status, operator_password: password }),
        });
        if (res.status === 401) {
          setAuthed(false);
          setAuthError("Неверный пароль оператора");
          localStorage.removeItem(PWD_KEY);
          return;
        }
        const data = await res.json();
        setApps(data.applications || []);
        setCounts(data.counts || {});
        setAuthed(true);
        localStorage.setItem(PWD_KEY, password);
      } catch {
        setAuthError("Ошибка соединения");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (pwd) load(pwd, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed) load(pwd, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    load(pwd, filter);
  };

  const loadMessages = useCallback(
    async (appId: number) => {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "messages", id: appId, operator_password: pwd }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch {
        setMessages([]);
      }
    },
    [pwd],
  );

  const openApp = (a: Application) => {
    setSelected(a);
    setComment(a.operator_comment || "");
    setMsgText("");
    setMessages([]);
    loadMessages(a.id);
  };

  const review = async (decision: "approved" | "rejected") => {
    if (!selected) return;
    setReviewing(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          id: selected.id,
          decision,
          comment,
          inn: selected.inn,
          operator_number: operatorNumber,
          operator_password: pwd,
        }),
      });
      if (!res.ok) throw new Error();
      setSelected(null);
      setComment("");
      load(pwd, filter);
    } catch {
      setAuthError("Ошибка при сохранении решения");
    } finally {
      setReviewing(false);
    }
  };

  const sendMessage = async () => {
    if (!selected || !msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          id: selected.id,
          message: msgText.trim(),
          operator_number: operatorNumber,
          operator_password: pwd,
        }),
      });
      if (!res.ok) throw new Error();
      setMsgText("");
      loadMessages(selected.id);
    } catch {
      setAuthError("Ошибка при отправке сообщения");
    } finally {
      setSendingMsg(false);
    }
  };

  const fmtDate = (s?: string) =>
    s ? new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  // ---- Экран входа ----
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <form onSubmit={doLogin} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-7">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
            <Icon name="ShieldCheck" size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold mb-1">Панель оператора СЖОУ</h1>
          <p className="text-sm text-slate-500 mb-5">Рассмотрение заявок образовательных организаций</p>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Пароль оператора</label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Введите пароль"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 mb-4"
          />
          {authError && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <Icon name="AlertCircle" size={16} />
              {authError}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="LogIn" size={18} />}
            Войти
          </button>
        </form>
      </div>
    );
  }

  // ---- Панель ----
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon name="ShieldCheck" size={22} />
            <div className="font-bold">Панель оператора СЖОУ</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Icon name="BadgeCheck" size={15} className="text-slate-400" />
              <input
                value={operatorNumber}
                onChange={(e) => setOperatorNumber(e.target.value)}
                placeholder="Номер оператора"
                className="bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 w-36 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <button
              onClick={() => { localStorage.removeItem(PWD_KEY); setAuthed(false); setPwd(""); }}
              className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <Icon name="LogOut" size={15} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Фильтры */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { id: "pending", label: "На рассмотрении" },
            { id: "approved", label: "Одобренные" },
            { id: "rejected", label: "Отклонённые" },
            { id: "all", label: "Все" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === t.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {t.id !== "all" && counts[t.id] ? (
                <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Icon name="Inbox" size={40} className="mx-auto mb-3" />
            Заявок нет
          </div>
        ) : (
          <div className="grid gap-3">
            {apps.map((a) => {
              const m = STATUS_META[a.status] || STATUS_META.pending;
              return (
                <button
                  key={a.id}
                  onClick={() => openApp(a)}
                  className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md transition-shadow flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>
                        <Icon name={m.icon} size={12} />
                        {m.label}
                      </span>
                      <span className="text-xs text-slate-400">#{a.id}</span>
                    </div>
                    <div className="font-bold truncate">{a.oo_full_name}</div>
                    <div className="text-sm text-slate-500 truncate">
                      {a.oo_type_label} · {a.region} · ИНН {a.inn}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-slate-400">{fmtDate(a.created_at)}</div>
                    {a.statement_file_url && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <Icon name="Paperclip" size={12} />
                        файл
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Детальная карточка заявки */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <div className="text-xs text-slate-400">Заявка #{selected.id}</div>
                <h3 className="text-lg font-bold">{selected.oo_full_name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                <Icon name="X" size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Тип организации", selected.oo_type_label],
                  ["Краткое наименование", selected.oo_short_name],
                  ["ИНН", selected.inn],
                  ["ОГРН", selected.ogrn],
                  ["Регион", selected.region],
                  ["Кол-во учащихся", selected.students_count?.toString()],
                  ["Юридический адрес", selected.legal_address],
                  ["Фактический адрес", selected.actual_address],
                  ["Руководитель", selected.director_name],
                  ["Контактное лицо", `${selected.contact_name}${selected.contact_position ? ` (${selected.contact_position})` : ""}`],
                  ["Телефон", selected.contact_phone],
                  ["Email", selected.contact_email],
                ].map(([k, v]) =>
                  v ? (
                    <div key={k}>
                      <div className="text-xs text-slate-400">{k}</div>
                      <div className="text-slate-800 font-medium">{v}</div>
                    </div>
                  ) : null,
                )}
              </div>

              {selected.statement_file_url && (
                <a
                  href={selected.statement_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                >
                  <Icon name="FileText" size={20} className="text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{selected.statement_file_name || "Заявление от ОО"}</div>
                    <div className="text-xs text-slate-400">Открыть файл заявления</div>
                  </div>
                  <Icon name="ExternalLink" size={16} className="text-slate-400" />
                </a>
              )}

              {selected.status !== "pending" && selected.operator_comment && (
                <div className="px-4 py-3 rounded-lg bg-slate-50 text-sm">
                  <div className="text-xs text-slate-400 mb-1">Комментарий оператора</div>
                  {selected.operator_comment}
                </div>
              )}

              {selected.status === "approved" && selected.oo_admin_login && (
                <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                  <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                    <Icon name="KeyRound" size={14} />
                    Данные доступа администратора ОО
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-slate-400">Логин</div>
                      <code className="text-slate-800 font-medium">{selected.oo_admin_login}</code>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Пароль</div>
                      <code className="text-slate-800 font-medium">{selected.oo_admin_password}</code>
                    </div>
                  </div>
                </div>
              )}

              {selected.status === "pending" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Сообщение организации (необязательно)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Сообщение, которое получит организация в письме..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    {!operatorNumber && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <Icon name="AlertTriangle" size={12} />
                        Укажите номер оператора в шапке — он будет в подписи письма.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => review("approved")}
                      disabled={reviewing}
                      className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Icon name="Check" size={18} />
                      Одобрить
                    </button>
                    <button
                      onClick={() => review("rejected")}
                      disabled={reviewing}
                      className="flex-1 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Icon name="X" size={18} />
                      Отклонить
                    </button>
                  </div>
                </>
              ) : (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium ${STATUS_META[selected.status].cls}`}>
                  Заявка {STATUS_META[selected.status].label.toLowerCase()} · {fmtDate(selected.reviewed_at)}
                </div>
              )}

              {/* Переписка по почте */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Icon name="Mail" size={15} />
                  Переписка по почте
                </div>

                {messages.length === 0 ? (
                  <p className="text-sm text-slate-400 mb-3">Писем пока нет.</p>
                ) : (
                  <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                    {messages.map((m) => (
                      <div key={m.id} className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600">
                            {m.subject || "Письмо"}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            {m.email_sent ? (
                              <Icon name="CheckCheck" size={12} className="text-green-600" />
                            ) : (
                              <Icon name="AlertCircle" size={12} className="text-amber-500" />
                            )}
                            {fmtDate(m.created_at)}
                          </span>
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</div>
                        {m.operator_number && (
                          <div className="text-xs text-slate-400 mt-1">Оператор №{m.operator_number}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    rows={2}
                    placeholder="Написать письмо организации..."
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sendingMsg || !msgText.trim()}
                    className="px-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {sendingMsg ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="Send" size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}