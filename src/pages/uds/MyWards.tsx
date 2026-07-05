import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms, UdsEmployee, UdsAuditEntry } from "@/lib/api";
import EmployeeDetail from "./EmployeeDetail";
import CuratorTransfers from "./CuratorTransfers";

interface Props {
  login: string;
  token: string;
  perms: UdsPerms;
  myRole: string;
}

/** Вкладка «Мои подопечные» — сотрудники, куратором которых является текущий пользователь. */
export default function MyWards({ login, token, perms, myRole }: Props) {
  const [wards, setWards] = useState<UdsEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ emp: UdsEmployee; logs: UdsAuditEntry[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.employees(login, token);
      // Только те, чей куратор — я
      setWards(res.employees.filter(e => e.curator_login === login && e.login !== login));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (targetLogin: string) => {
    try {
      const res = await udsApi.employee(login, token, targetLogin);
      setDetail({ emp: res.employee, logs: res.logs });
    } catch (e) { setError((e as Error).message); }
  };

  const toggleBlock = async (emp: UdsEmployee) => {
    setError("");
    try { await udsApi.block(login, token, emp.login, emp.is_active); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <CuratorTransfers login={login} token={token} onChanged={load} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Мои подопечные ({wards.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Сотрудники, за которых вы отвечаете как куратор</p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50">
          <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {wards.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Icon name="UserCheck" size={28} className="text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">У вас пока нет подопечных</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Они появятся, когда вы зарегистрируете сотрудника или примете передачу</p>
          </div>
        )}
        {wards.map(emp => (
          <div key={emp.login} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">№{emp.operator_number}</span>
            </div>
            <button onClick={() => openDetail(emp.login)} className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold truncate">{emp.full_name}</p>
                {emp.subrole_label && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${emp.subrole === "curator" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                    {emp.subrole_label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {emp.login} · {emp.panel_role_label}
                {!emp.is_active && <span className="ml-1 text-red-500 font-medium">· заблокирован</span>}
              </p>
              {emp.mail_address && (
                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                  <Icon name="Mail" size={10} /> {emp.mail_address}
                </p>
              )}
            </button>
            {perms.can_block && emp.login !== "admin" && (
              <button onClick={() => toggleBlock(emp)} title={emp.is_active ? "Заблокировать" : "Разблокировать"}
                className={`p-2 rounded transition-colors ${emp.is_active ? "hover:bg-red-50 text-red-500" : "hover:bg-green-50 text-green-600"}`}>
                <Icon name={emp.is_active ? "Lock" : "LockOpen"} size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {detail && (
        <EmployeeDetail data={detail} login={login} token={token} perms={perms} myRole={myRole}
          onChanged={() => { openDetail(detail.emp.login); load(); }}
          onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
