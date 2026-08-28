import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, SupportTicketLog } from "@/lib/api";

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  take:      { label: "Взял обращение",     icon: "HandMetal",  color: "text-blue-600 bg-blue-50" },
  transfer:  { label: "Передал обращение",  icon: "ArrowRightLeft", color: "text-purple-600 bg-purple-50" },
  close:     { label: "Закрыл обращение",   icon: "CheckCircle2", color: "text-green-600 bg-green-50" },
  message:   { label: "Ответ клиенту",      icon: "MessageSquare", color: "text-gray-600 bg-gray-50" },
  "view-user": { label: "Смотрел данные",   icon: "Eye",        color: "text-orange-600 bg-orange-50" },
};

interface Props {
  login: string;
  token: string;
  ticketId: number;
  onClose: () => void;
}

/**
 * Журнал действий по обращению — что делал сотрудник и что выдавал клиенту.
 * Доступен Советнику, Зам. Главы и Главе (проверка на сервере).
 */
export default function TicketLogsPanel({ login, token, ticketId, onClose }: Props) {
  const [logs, setLogs] = useState<SupportTicketLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await supportApi.ticketLogs(login, token, ticketId);
      setLogs(res.logs);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token, ticketId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Журнал действий</p>
            <p className="text-xs text-muted-foreground">Обращение №{ticketId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <Icon name="X" size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto styled-scrollbar p-5">
          {loading ? (
            <div className="py-10 text-center">
              <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              По этому обращению действий пока не было
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map(l => {
                const meta = ACTION_LABELS[l.action] ?? {
                  label: l.action, icon: "Circle", color: "text-gray-600 bg-gray-50",
                };
                return (
                  <div key={l.id} className="flex gap-2.5 p-3 border border-border rounded-lg">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon name={meta.icon} size={13} fallback="Circle" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-xs font-semibold">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {l.created_at ? new Date(l.created_at).toLocaleString("ru-RU") : "—"}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {l.actor_name || l.actor_login}
                        {l.actor_role_label ? ` · ${l.actor_role_label}` : ""}
                      </p>
                      {l.details && (
                        <p className="text-xs mt-1 break-words">{l.details}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
