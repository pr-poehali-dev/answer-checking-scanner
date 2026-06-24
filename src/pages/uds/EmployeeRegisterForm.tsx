import { useState } from "react";
import Icon from "@/components/ui/icon";
import { udsApi } from "@/lib/api";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "operator", label: "Оператор ТП" },
  { value: "advisor", label: "Советник" },
  { value: "tester_role", label: "Тестер" },
  { value: "developer", label: "Разработчик" },
  { value: "deputy", label: "Зам. Главы Правления" },
  { value: "head", label: "Глава Правления" },
];

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
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

interface Props {
  login: string;
  token: string;
  assignable: string[];
  onDone: () => void;
}

export default function EmployeeRegisterForm({ login, token, assignable, onDone }: Props) {
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
