import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsAuditEntry } from "@/lib/api";

const ACTION_LABELS: Record<string, string> = {
  register_employee: "Регистрация сотрудника",
  set_role: "Изменение роли",
  remove_role: "Снятие роли",
  block: "Блокировка",
  unblock: "Разблокировка",
};

const ACTION_ICON: Record<string, string> = {
  register_employee: "UserPlus",
  set_role: "Shield",
  remove_role: "ShieldOff",
  block: "Lock",
  unblock: "LockOpen",
};

export default function UdsAuditLog({ login, token }: { login: string; token: string }) {
  const [logs, setLogs] = useState<UdsAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.auditLog(login, token);
      setLogs(res.logs);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Логи действий ({logs.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Хранятся, пока есть место. Последние 300 записей.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50">
          <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {logs.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Записей пока нет</p>
        )}
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name={ACTION_ICON[l.action] || "Activity"} size={14} className="text-blue-500" fallback="Activity" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{ACTION_LABELS[l.action] || l.action}</p>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("ru-RU")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {l.actor_login}{l.actor_role ? ` (${l.actor_role})` : ""}
                {l.target_login && l.target_login !== l.actor_login ? ` → ${l.target_login}` : ""}
                {l.details ? ` · ${l.details}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
