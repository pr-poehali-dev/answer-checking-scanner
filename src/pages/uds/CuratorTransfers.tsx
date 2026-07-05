import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, type UdsTransfer } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  onChanged?: () => void;
}

/** Блок запросов на передачу подопечных между кураторами (запрос → принятие). */
export default function CuratorTransfers({ login, token, onChanged }: Props) {
  const [transfers, setTransfers] = useState<UdsTransfer[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await udsApi.transfers(login, token);
      setTransfers(r.transfers);
    } catch { /* нет прав — просто не показываем */ }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: number, accept: boolean) => {
    setBusy(true);
    try {
      await udsApi.transferRespond(login, token, id, accept);
      await load();
      onChanged?.();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  if (transfers.length === 0) return null;

  const incoming = transfers.filter(t => t.incoming);
  const outgoing = transfers.filter(t => !t.incoming);

  return (
    <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-2">
      <p className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
        <Icon name="ArrowLeftRight" size={13} /> Передача подопечных
      </p>

      {incoming.map(t => (
        <div key={t.id} className="bg-white rounded-lg border border-border p-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{t.employee_name}</p>
            <p className="text-[11px] text-muted-foreground">От: {t.from_name}{t.note ? ` · ${t.note}` : ""}</p>
          </div>
          <button onClick={() => respond(t.id, true)} disabled={busy}
            className="px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
            Принять
          </button>
          <button onClick={() => respond(t.id, false)} disabled={busy}
            className="px-2.5 py-1 border border-border text-xs rounded hover:bg-muted disabled:opacity-50">
            Отклонить
          </button>
        </div>
      ))}

      {outgoing.map(t => (
        <div key={t.id} className="bg-white/60 rounded-lg border border-border p-2.5 flex items-center gap-2">
          <Icon name="Clock" size={13} className="text-amber-500 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">
            <span className="font-medium text-foreground">{t.employee_name}</span> → {t.to_name} · ждёт принятия
          </p>
        </div>
      ))}
    </div>
  );
}
