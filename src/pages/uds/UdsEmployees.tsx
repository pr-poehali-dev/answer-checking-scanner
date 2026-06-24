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
  assign_cert: "Назначен выпуск сертификата",
  cert_agree: "Согласие на выпуск",
  cert_issued: "Сертификат выпущен",
  revoke_cert: "Сертификат отозван",
  cert_login: "Вход по сертификату",
};

const CERT_STATUS: Record<string, { label: string; color: string }> = {
  assigned: { label: "Назначен выпуск", color: "bg-amber-50 text-amber-600 border-amber-200" },
  issuing: { label: "Выпускается", color: "bg-blue-50 text-blue-600 border-blue-200" },
  active: { label: "Активен", color: "bg-green-50 text-green-600 border-green-200" },
  revoked: { label: "Отозван", color: "bg-red-50 text-red-600 border-red-200" },
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
        <EmployeeDetail data={detail} login={login} token={token} perms={perms} onClose={() => setDetail(null)} />
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
  // Шаг email-верификации
  const [emailStep, setEmailStep] = useState<"form" | "verify">("form");
  const [emailCode, setEmailCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [pendingResult, setPendingResult] = useState<{ login: string; password: string; iis_code: string; operator_number: number } | null>(null);
  const [result, setResult] = useState<{ login: string; password: string; iis_code: string; operator_number: number } | null>(null);

  // Шаг 1: регистрация → если есть email, отправляем код подтверждения
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
      const reg = { login: res.login, password: res.password, iis_code: res.iis_code, operator_number: res.operator_number };
      if (email.trim()) {
        // Отправляем 6-значный код на email нового сотрудника
        const hint = await udsApi.sendEmailCode(email.trim(), res.login);
        setEmailHint(hint.hint || "");
        setPendingResult(reg);
        setEmailCode("");
        setEmailStep("verify");
      } else {
        // email не указан — сразу готово
        setResult(reg);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  // Шаг 2: проверяем 6-значный код
  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingResult) return;
    setBusy(true); setError("");
    try {
      await udsApi.verifyEmailCode(pendingResult.login, emailCode.trim());
      setResult(pendingResult);
      setEmailStep("form");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const resendEmailCode = async () => {
    if (!pendingResult) return;
    setBusy(true); setError("");
    try {
      const hint = await udsApi.sendEmailCode(email.trim(), pendingResult.login);
      setEmailHint(hint.hint || "");
      setEmailCode("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  // Результат
  if (result) {
    return (
      <div className="border border-green-200 rounded-lg bg-green-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="CheckCircle2" size={18} className="text-green-600" />
          <p className="text-sm font-bold text-green-800">Сотрудник зарегистрирован (№{result.operator_number})</p>
        </div>
        {email.trim() && (
          <div className="flex items-center gap-2 text-[11px] text-green-700 bg-green-100 rounded-lg px-2.5 py-1.5">
            <Icon name="MailCheck" size={13} fallback="Check" /> Email подтверждён
          </div>
        )}
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

  // Шаг верификации email
  if (emailStep === "verify" && pendingResult) {
    return (
      <form onSubmit={verifyEmail} className="border border-blue-200 rounded-lg bg-blue-50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="MailCheck" size={18} className="text-blue-600" fallback="Mail" />
          <p className="text-sm font-bold text-blue-800">Подтверждение email</p>
        </div>
        <p className="text-xs text-blue-700">
          Сотруднику <b>{pendingResult.login}</b> отправлен 6-значный код подтверждения.
          {emailHint && <><br /><span className="text-blue-500">{emailHint}</span></>}
        </p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Код из письма (6 цифр)</label>
          <input
            value={emailCode}
            onChange={e => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus inputMode="numeric" maxLength={6}
            className="w-full border-2 border-blue-200 rounded-xl px-3 py-3 text-xl text-center font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500"
            placeholder="••••••"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || emailCode.length < 6}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
            {busy ? <><Icon name="Loader2" size={13} className="animate-spin" /> Проверка…</> : <><Icon name="CheckCircle2" size={13} /> Подтвердить</>}
          </button>
          <button type="button" onClick={resendEmailCode} disabled={busy}
            className="px-3 py-2 border border-blue-300 text-blue-600 text-xs rounded-sm hover:bg-blue-100 disabled:opacity-50">
            Повторить
          </button>
        </div>
        <p className="text-[11px] text-blue-400">
          Если email указан неверно — можно{" "}
          <button type="button" onClick={() => { setEmailStep("form"); setError(""); }}
            className="underline hover:text-blue-600">вернуться назад</button>.
        </p>
      </form>
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
      <p className="text-[11px] text-gray-400">
        Логин, пароль и код ИИС (5 символов) сгенерируются автоматически.
        {email.trim() && " На указанный email придёт 6-значный код подтверждения."}
      </p>
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={13} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <button type="submit" disabled={busy || !firstName.trim() || !lastName.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
        {busy
          ? <><Icon name="Loader2" size={13} className="animate-spin" /> Регистрация…</>
          : <><Icon name="UserPlus" size={13} /> {email.trim() ? "Зарегистрировать и отправить код" : "Зарегистрировать"}</>}
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

function EmployeeDetail({ data, login, token, perms, onClose }: {
  data: { emp: UdsEmployee; logs: UdsAuditEntry[] };
  login: string; token: string; perms: UdsPerms; onClose: () => void;
}) {
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

          {perms.can_cert && emp.login !== "admin" && (
            <CertSection login={login} token={token} targetLogin={emp.login} />
          )}

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

function CertSection({ login, token, targetLogin }: { login: string; token: string; targetLogin: string }) {
  const [cert, setCert] = useState<import("@/lib/api").UdsCert | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [issueCode, setIssueCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await udsApi.certStatus(login, token, targetLogin);
      setCert(res.cert);
    } catch (e) { setError((e as Error).message); }
    finally { setLoaded(true); }
  }, [login, token, targetLogin]);

  useEffect(() => { load(); }, [load]);

  // Автообновление статуса, пока сертификат в процессе
  useEffect(() => {
    if (cert && (cert.status === "assigned" || cert.status === "issuing")) {
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }
  }, [cert?.status, load]);

  const assign = async () => {
    setBusy(true); setError("");
    try {
      await udsApi.assignCert(login, token, targetLogin, issueCode.trim());
      setIssueCode(""); setShowCode(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!confirm("Отозвать сертификат сотрудника? Вход по нему станет невозможен.")) return;
    setBusy(true); setError("");
    try { await udsApi.revokeCert(login, token, targetLogin); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const active = cert && (cert.status === "assigned" || cert.status === "issuing" || cert.status === "active");
  const st = cert ? CERT_STATUS[cert.status] : null;
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString("ru-RU") : "—";

  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon name="BadgeCheck" size={15} className="text-blue-600" fallback="ShieldCheck" />
        <p className="text-xs font-bold">Сертификат входа в УДС</p>
        {st && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loaded && (!cert || cert.status === "revoked") && (
        <>
          {!showCode ? (
            <button onClick={() => setShowCode(true)} disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
              <Icon name="ShieldPlus" size={13} fallback="Shield" /> Выпустить и привязать сертификат
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Введите код ИИС выпуска для подтверждения</p>
              <div className="flex gap-2">
                <input value={issueCode} onChange={e => setIssueCode(e.target.value)} placeholder="Код выпуска" autoFocus
                  className="flex-1 border border-border rounded px-2 py-1.5 text-xs" />
                <button onClick={assign} disabled={busy || !issueCode.trim()}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                  {busy ? "…" : "Подтвердить"}
                </button>
                <button onClick={() => { setShowCode(false); setIssueCode(""); }} className="px-2 py-1.5 border border-border text-xs rounded hover:bg-muted">Отмена</button>
              </div>
            </div>
          )}
        </>
      )}

      {cert && cert.status !== "revoked" && (
        <div className="text-xs space-y-1">
          {cert.status === "assigned" && <p className="text-muted-foreground">Ожидает, пока сотрудник начнёт выпуск в своём ЛК.</p>}
          {cert.status === "issuing" && <p className="text-muted-foreground">Сотрудник выпускает сертификат ({cert.container_type === "rutoken" ? "Рутокен" : "КриптоПро"})…</p>}
          {cert.status === "active" && (
            <div className="grid grid-cols-2 gap-2">
              <Info label="Носитель" value={cert.container_type === "rutoken" ? "Рутокен" : "КриптоПро"} />
              <Info label="Серийный №" value={cert.serial_number || "—"} />
              <Info label="Выдан" value={fmt(cert.issued_at)} />
              <Info label="Действует до" value={fmt(cert.not_after)} />
            </div>
          )}
          {active && (
            <button onClick={revoke} disabled={busy}
              className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 disabled:opacity-50">
              <Icon name="ShieldX" size={13} fallback="X" /> Отозвать сертификат
            </button>
          )}
        </div>
      )}
    </div>
  );
}