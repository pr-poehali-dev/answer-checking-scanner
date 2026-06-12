import Icon from "@/components/ui/icon";
import { Application, Message, STATUS_META, fmtDate } from "./types";

interface ApplicationDetailProps {
  selected: Application;
  onClose: () => void;
  comment: string;
  setComment: (v: string) => void;
  operatorNumber: string;
  reviewing: boolean;
  review: (decision: "approved" | "rejected") => void;
  messages: Message[];
  msgText: string;
  setMsgText: (v: string) => void;
  sendingMsg: boolean;
  sendMessage: () => void;
}

export default function ApplicationDetail({
  selected,
  onClose,
  comment,
  setComment,
  operatorNumber,
  reviewing,
  review,
  messages,
  msgText,
  setMsgText,
  sendingMsg,
  sendMessage,
}: ApplicationDetailProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            <div className="text-xs text-slate-400">Заявка #{selected.id}</div>
            <h3 className="text-lg font-bold">{selected.oo_full_name}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
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
  );
}
