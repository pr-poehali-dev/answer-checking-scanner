import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms, UdsEmployee, UdsAuditEntry } from "@/lib/api";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "operator", label: "Оператор ТП" },
  { value: "advisor", label: "Советник" },
  { value: "tester_role", label: "Тестер" },
  { value: "developer", label: "Разработчик" },
  { value: "deputy", label: "Зам. Главы Правления" },
  { value: "head", label: "Глава Правления" },
];

const ACTION_LABELS: Record<string, string> = {
  register_employee: "Регистрация сотрудника",
  set_role: "Изменение роли",
  remove_role: "Снятие роли",
  block: "Блокировка",
  unblock: "Разблокировка",
};

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
        <RegisterForm login={login} token={token} assignable={assignable}
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
              <p className="text-sm font-semibold truncate">{emp.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {emp.login} · {emp.panel_role_label}
                {!emp.is_active && <span className="ml-1 text-red-500 font-medium">· заблокирован</span>}
                {!emp.uds_registered && <span className="ml-1 text-orange-500 font-medium">· не через УДС</span>}
              </p>
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
            {perms.can_block && emp.login !== login && emp.login !== "admin" && (
              <button onClick={() => toggleBlock(emp)} title={emp.is_active ? "Заблокировать" : "Разблокировать"}
                className={`p-2 rounded transition-colors ${emp.is_active ? "hover:bg-red-50 text-red-500" : "hover:bg-green-50 text-green-600"}`}>
                <Icon name={emp.is_active ? "Lock" : "LockOpen"} size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {detail && (
        <EmployeeDetail data={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function RegisterForm({ login, token, assignable, onDone }: {
  login: string; token: string; assignable: string[]; onDone: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(assignable[0] || "operator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ login: string; password: string; iis_code: string; operator_number: number } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await udsApi.registerEmployee(login, token, {
        first_name: firstName.trim(), last_name: lastName.trim(),
        middle_name: middleName.trim() || undefined,
        email: email.trim() || undefined, phone: phone.trim() || undefined,
        panel_role: role,
      });
      setResult({ login: res.login, password: res.password, iis_code: res.iis_code, operator_number: res.operator_number });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="border border-green-200 rounded-lg bg-green-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="CheckCircle2" size={18} className="text-green-600" />
          <p className="text-sm font-bold text-green-800">Сотрудник зарегистрирован (№{result.operator_number})</p>
        </div>
        <p className="text-xs text-green-700">Передайте данные сотруднику. После входа он сможет сменить логин и пароль в УДС.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CredBox label="Логин" value={result.login} />
          <CredBox label="Пароль" value={result.password} />
          <CredBox label="Код ИИС" value={result.iis_code} />
        </div>
        <button onClick={onDone} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90">
          Готово
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-lg bg-white p-5 space-y-3">
      <p className="text-sm font-semibold">Регистрация сотрудника</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Фамилия*" value={lastName} onChange={setLastName} />
        <Field label="Имя*" value={firstName} onChange={setFirstName} />
        <Field label="Отчество" value={middleName} onChange={setMiddleName} />
        <Field label="Эл. почта" value={email} onChange={setEmail} type="email" />
        <Field label="Телефон" value={phone} onChange={setPhone} />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Роль*</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ROLE_OPTIONS.filter(r => assignable.includes(r.value)).map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Логин, пароль и код ИИС (5 символов) сгенерируются автоматически.</p>
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={13} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <button type="submit" disabled={busy || !firstName.trim() || !lastName.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
        {busy ? <><Icon name="Loader2" size={13} className="animate-spin" /> Регистрация…</> : <><Icon name="UserPlus" size={13} /> Зарегистрировать</>}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function CredBox({ label, value }: { label: string; value: string }) {
  const copy = () => navigator.clipboard?.writeText(value).catch(() => {});
  return (
    <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold font-mono">{value}</span>
        <button onClick={copy} className="text-gray-400 hover:text-gray-700"><Icon name="Copy" size={13} /></button>
      </div>
    </div>
  );
}

function EmployeeDetail({ data, onClose }: { data: { emp: UdsEmployee; logs: UdsAuditEntry[] }; onClose: () => void }) {
  const { emp, logs } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white">
          <div>
            <p className="text-sm font-bold">{emp.full_name}</p>
            <p className="text-xs text-muted-foreground">{emp.login} · {emp.panel_role_label} · №{emp.operator_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="Эл. почта" value={emp.email || "—"} />
            <Info label="Телефон" value={emp.phone || "—"} />
            <Info label="Код ИИС" value={emp.iis_code || "—"} />
            <Info label="Статус" value={emp.is_active ? "Активен" : "Заблокирован"} />
            <Info label="Через УДС" value={emp.uds_registered ? "Да" : "Нет"} />
            <Info label="Назначил" value={emp.assigned_by || "—"} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">История действий ({logs.length})</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && <p className="text-xs text-muted-foreground">Действий пока нет</p>}
              {logs.map((l, i) => (
                <div key={i} className="text-xs border border-border rounded px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ACTION_LABELS[l.action] || l.action}</span>
                    <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    {l.actor_login} {l.target_login && l.target_login !== l.actor_login ? `→ ${l.target_login}` : ""}
                    {l.details ? ` · ${l.details}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
