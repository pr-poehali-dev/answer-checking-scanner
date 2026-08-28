import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, SupportStaff } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  ticketId: number;
  onClose: () => void;
  onTransferred: () => void;
}

/** Передача обращения другому сотруднику УДС. */
export default function TransferDialog({ login, token, ticketId, onClose, onTransferred }: Props) {
  const [staff, setStaff] = useState<SupportStaff[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await supportApi.staff(login, token);
      setStaff(res.staff);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  const transfer = async (toLogin: string) => {
    setBusy(true); setError("");
    try {
      await supportApi.transferTicket(login, token, ticketId, toLogin);
      onTransferred();
      onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? staff.filter(s =>
        (s.full_name || "").toLowerCase().includes(term) ||
        s.login.toLowerCase().includes(term) ||
        s.panel_role_label.toLowerCase().includes(term))
    : staff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Передать обращение</p>
            <p className="text-xs text-muted-foreground">Выберите сотрудника</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Поиск сотрудника…"
              className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto styled-scrollbar p-5 pt-3">
          {loading ? (
            <div className="py-8 text-center">
              <Icon name="Loader2" size={18} className="animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Сотрудники не найдены</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {filtered.map(s => (
                <button key={s.login} disabled={busy} onClick={() => transfer(s.login)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 text-left disabled:opacity-50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon name="User" size={14} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{s.full_name || s.login}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.panel_role_label}
                      {s.operator_number != null ? ` · №${s.operator_number}` : ""}
                    </p>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
