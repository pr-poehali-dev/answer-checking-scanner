import Icon from "@/components/ui/icon";
import { ContainerType } from "@/lib/cryptoPlugins";

interface UdsLoginFormProps {
  step: "cert" | "iis" | "creds" | "sms";
  iisCode: string;
  setIisCode: (v: string) => void;
  loginName: string;
  setLoginName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  smsCode: string;
  setSmsCode: (v: string) => void;
  smsHint: string;
  busy: boolean;
  error: string;
  onLogoClick: () => void;
  certLogin: (containerType: ContainerType, pin?: string) => void;
  verifyIis: (e: React.FormEvent) => void;
  doLogin: (e: React.FormEvent) => void;
  doVerifySms: (e: React.FormEvent) => void;
  resendSms: () => void;
  setStep: (s: "cert" | "iis" | "creds" | "sms") => void;
  setError: (v: string) => void;
}

export default function UdsLoginForm({
  step,
  iisCode,
  setIisCode,
  loginName,
  setLoginName,
  password,
  setPassword,
  smsCode,
  setSmsCode,
  smsHint,
  busy,
  error,
  onLogoClick,
  certLogin,
  verifyIis,
  doLogin,
  doVerifySms,
  resendSms,
  setStep,
  setError,
}: UdsLoginFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <button onClick={onLogoClick} title="УДС"
            className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3 active:scale-95 transition-transform">
            <Icon name="ShieldCheck" size={28} className="text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">УДС</h1>
          <p className="text-sm text-slate-400 mt-1">Управление Движения Системы</p>
        </div>

        {step === "cert" ? (
          <div className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <Icon name="BadgeCheck" size={22} className="text-blue-600 mx-auto mb-1" fallback="ShieldCheck" />
              <p className="text-sm font-bold">Вход по сертификату</p>
              <p className="text-[11px] text-gray-400 mt-1">Предъявите сертификат с носителя. Требуется установленный плагин.</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => certLogin("rutoken")} disabled={busy}
                className="flex flex-col items-center gap-1.5 py-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors">
                <Icon name="Usb" size={20} className="text-blue-600" fallback="HardDrive" />
                <span className="text-xs font-semibold">Рутокен</span>
              </button>
              <button onClick={() => certLogin("cryptopro")} disabled={busy}
                className="flex flex-col items-center gap-1.5 py-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors">
                <Icon name="Monitor" size={20} className="text-blue-600" fallback="Cpu" />
                <span className="text-xs font-semibold">КриптоПро</span>
              </button>
            </div>
            {busy && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Icon name="Loader2" size={13} className="animate-spin" /> Проверка сертификата…
              </p>
            )}
            <p className="text-[10px] text-gray-300 text-center">Вход по коду ИИС — невозможен без разрешения Советника</p>
          </div>

        ) : step === "iis" ? (
          <form onSubmit={verifyIis} className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <Icon name="Hash" size={20} className="text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-bold">Код ИИС</p>
              <p className="text-[11px] text-gray-400 mt-1">Введите 5-значный код, выданный при регистрации</p>
            </div>
            <input
              value={iisCode}
              onChange={e => setIisCode(e.target.value.toUpperCase())}
              autoFocus maxLength={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center font-mono tracking-[0.4em] uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="•••••"
            />
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <button type="submit" disabled={busy || iisCode.trim().length < 3}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors">
              {busy ? <><Icon name="Loader2" size={15} className="animate-spin" /> Проверка…</> : <><Icon name="ArrowRight" size={15} /> Далее</>}
            </button>
            <button type="button" onClick={() => { setStep("cert"); setError(""); }}
              className="w-full text-[11px] text-gray-400 hover:text-gray-600 text-center">
              ← Вернуться ко входу по сертификату
            </button>
          </form>

        ) : step === "creds" ? (
          <form onSubmit={doLogin} className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <Icon name="KeyRound" size={20} className="text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-bold">Логин и пароль</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
              <Icon name="CheckCircle2" size={13} /> Код ИИС подтверждён
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Логин сотрудника</label>
              <input value={loginName} onChange={e => setLoginName(e.target.value)} autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Логин" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Пароль" />
            </div>
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <button type="submit" disabled={busy || !loginName.trim() || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors">
              {busy
                ? <><Icon name="Loader2" size={15} className="animate-spin" /> Отправка кода…</>
                : <><Icon name="Send" size={15} /> Получить код входа</>}
            </button>
            <button type="button" onClick={() => { setStep("iis"); setError(""); }}
              className="w-full text-[11px] text-gray-400 hover:text-gray-600 text-center">
              ← Назад к коду ИИС
            </button>
          </form>

        ) : (
          /* step === "sms" */
          <form onSubmit={doVerifySms} className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <Icon name="MessageSquare" size={22} className="text-blue-600" fallback="Mail" />
              </div>
              <p className="text-sm font-bold">Код подтверждения</p>
              {smsHint && (() => {
                const codeMatch = smsHint.match(/код[:\s]+(\d{4})/i);
                if (codeMatch) {
                  return (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <p className="text-[11px] text-amber-700 mb-1">Письмо не доставлено. Ваш код:</p>
                      <p className="text-3xl font-mono font-bold tracking-[0.4em] text-amber-800">{codeMatch[1]}</p>
                    </div>
                  );
                }
                return <p className="text-[11px] text-gray-500 mt-1">{smsHint}</p>;
              })()}
              {!smsHint && <p className="text-[11px] text-gray-400">Введите 4-значный код из письма</p>}
            </div>
            <input
              value={smsCode}
              onChange={e => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoFocus inputMode="numeric" maxLength={4}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-xl text-center font-mono tracking-[0.6em] focus:outline-none focus:border-blue-500"
              placeholder="••••"
            />
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <button type="submit" disabled={busy || smsCode.length < 4}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors">
              {busy ? <><Icon name="Loader2" size={15} className="animate-spin" /> Проверка…</> : <><Icon name="LogIn" size={15} /> Войти</>}
            </button>
            <div className="flex items-center justify-between text-[11px]">
              <button type="button" onClick={() => { setStep("creds"); setError(""); setSmsCode(""); }}
                className="text-gray-400 hover:text-gray-600">
                ← Назад
              </button>
              <button type="button" onClick={resendSms} disabled={busy}
                className="text-blue-500 hover:text-blue-700 disabled:opacity-50">
                Отправить снова
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
