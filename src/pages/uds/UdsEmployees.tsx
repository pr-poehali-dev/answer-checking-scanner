import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms, UdsEmployee, UdsAuditEntry } from "@/lib/api";
import EmployeeRegisterForm from "./EmployeeRegisterForm";
import EmployeeDetail from "./EmployeeDetail";
import CuratorTransfers from "./CuratorTransfers";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "operator", label: "Оператор ТП" },
  { value: "advisor", label: "Советник" },
  { value: "tester_role", label: "Тестер" },
  { value: "developer", label: "Разработчик" },
  { value: "deputy", label: "Зам. Главы Правления" },
  { value: "head", label: "Глава Правления" },
];

interface Props {
  login: string;
  token: string;
  perms: UdsPerms;
  myRole: string;
}

export default function UdsEmployees({ login, token, perms, myRole }: Props) {
  const [employees, setEmployees] = useState<UdsEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<{ emp: UdsEmployee; logs: UdsAuditEntry[] } | null>(null);

  const assignable = perms.can_assign_roles;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.employees(login, token);
      setEmployees(res.employees);
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

  const changeRole = async (targetLogin: string, role: string) => {
    setError("");
    try { await udsApi.setRole(login, token, targetLogin, role); await load(); }
    catch (e) { setError((e as Error).message); }
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
          <h2 className="text-sm font-bold">Сотрудники УДС ({employees.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Регистрация, роли, блокировка, история действий</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50">
            <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
          {perms.can_register && (
            <button onClick={() => setShowForm(s => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity">
              <Icon name={showForm ? "X" : "UserPlus"} size={13} />
              {showForm ? "Отмена" : "Зарегистрировать"}
            </button>
          )}
        </div>
      </div>

      {showForm && perms.can_register && (
        <EmployeeRegisterForm login={login} token={token} assignable={assignable}
          canAssignSubrole={!!perms.can_assign_subrole}
          onDone={() => { setShowForm(false); load(); }} />
      )}

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {employees.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Сотрудников пока нет</p>
        )}
        {employees.map(emp => (
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
                {!emp.uds_registered && <span className="ml-1 text-orange-500 font-medium">· не через УДС</span>}
              </p>
              {emp.curator_name && (
                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                  <Icon name="UserCheck" size={10} /> Куратор: {emp.curator_name}
                </p>
              )}
            </button>
            {/* Смена роли */}
            {assignable.length > 0 && emp.login !== login && (
              <select
                value={assignable.includes(emp.panel_role) ? emp.panel_role : ""}
                onChange={e => changeRole(emp.login, e.target.value)}
                className="text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— роль —</option>
                {ROLE_OPTIONS.filter(r => assignable.includes(r.value)).map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
                <option value="">Снять роль</option>
              </select>
            )}
            {perms.can_block && emp.can_manage !== false && emp.login !== login && emp.login !== "admin" && (
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