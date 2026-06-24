import { useEffect, useState, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms, UdsCert } from "@/lib/api";
import { cryptoPlugins, ContainerType } from "@/lib/cryptoPlugins";
import UdsEmployees from "@/pages/uds/UdsEmployees";
import UdsUsers from "@/pages/uds/UdsUsers";
import UdsAuditLog from "@/pages/uds/UdsAuditLog";
import UdsProfile from "@/pages/uds/UdsProfile";
import UdsSupport from "@/pages/uds/UdsSupport";
import UdsLkView from "@/pages/uds/UdsLkView";
import UdsMaintenance from "@/pages/uds/UdsMaintenance";
import UdsCertIssue from "@/pages/uds/UdsCertIssue";

const PANEL_ROLE_LABELS: Record<string, string> = {
  head: "Глава Правления",
  deputy: "Зам. Главы Правления",
  developer: "Разработчик",
  tester_role: "Тестер",
  advisor: "Советник",
  operator: "Оператор ТП",
};

interface Session {
  login: string;
  token: string;
  panel_role: string;
  panel_role_label: string;
  operator_number: number;
  perms: UdsPerms;
}

const LS_KEY = "uds_session_v3";
const COOKIE_KEY = "uds_session_v3";
const COOKIE_DAYS = 30;

function setCookie(value: string) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(): string | null {
  const match = document.cookie.split("; ").find(r => r.startsWith(COOKIE_KEY + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function removeCookie() {
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// Таймаут сессии — 5 минут простоя
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

type Tab = "employees" | "users" | "audit" | "support" | "profile" | "lkview" | "maintenance";

export default function UdsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [myCert, setMyCert] = useState<UdsCert | null>(null);
  // Шаги входа: cert → iis → creds → sms
  const [step, setStep] = useState<"cert" | "iis" | "creds" | "sms">("cert");
  const [iisCode, setIisCode] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsHint, setSmsHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("employees");
  const [logoClicks, setLogoClicks] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Таймаут сессии: сброс при активности ─────────────────────────────────
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const doLogout = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    removeCookie();
    setSession(null); setMyCert(null);
    setStep("cert"); setIisCode("");
    setLoginName(""); setPassword(""); setSmsCode(""); setSmsHint("");
  }, []);

  // Проверяем таймаут каждые 30 секунд
  useEffect(() => {
    if (!session) return;
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    const check = () => {
      if (Date.now() - lastActivityRef.current >= SESSION_TIMEOUT_MS) {
        doLogout();
      }
    };
    timeoutRef.current = setInterval(check, 30_000);
    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity));
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [session, resetActivity, doLogout]);

  const refreshMe = useCallback((s: Session) => {
    udsApi.me(s.login, s.token).then(me => {
      if (me.uds_access && me.perms) {
        setSession(prev => prev ? { ...prev, panel_role: me.panel_role || prev.panel_role, perms: me.perms! } : prev);
        setMyCert(me.my_cert);
      } else {
        localStorage.removeItem(LS_KEY); removeCookie(); setSession(null);
      }
    }).catch(() => { localStorage.removeItem(LS_KEY); removeCookie(); setSession(null); });
  }, []);

  const applyAuth = useCallback((res: { login: string; token: string; panel_role: string; panel_role_label: string; operator_number: number; perms: UdsPerms }) => {
    const s: Session = {
      login: res.login, token: res.token,
      panel_role: res.panel_role, panel_role_label: res.panel_role_label,
      operator_number: res.operator_number, perms: res.perms,
    };
    setSession(s);
    lastActivityRef.current = Date.now();
    const raw = JSON.stringify(s);
    localStorage.setItem(LS_KEY, raw);
    setCookie(raw);
    refreshMe(s);
  }, [refreshMe]);

  // Восстановление сессии — сначала куки, потом localStorage
  useEffect(() => {
    try {
      const raw = getCookie() || localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        setSession(s);
        setCookie(raw);
        refreshMe(s);
      }
    } catch { /* ignore */ }
  }, [refreshMe]);

  // Вход по сертификату
  const certLogin = async (containerType: ContainerType, pin?: string) => {
    setBusy(true); setError("");
    try {
      const { nonce } = await udsApi.certChallenge();
      const { signature, fingerprint } = await cryptoPlugins.sign(containerType, nonce, pin);
      const res = await udsApi.certLogin(fingerprint, nonce, signature);
      applyAuth(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 5 кликов по логотипу → вход по коду ИИС
  const onLogoClick = () => {
    const n = logoClicks + 1;
    setLogoClicks(n);
    if (n >= 5) { setStep("iis"); setLogoClicks(0); setError(""); }
  };

  const verifyIis = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await udsApi.verifyIis(iisCode.trim());
      setStep("creds");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Шаг 2: логин+пароль → отправляем SMS-код
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await udsApi.sendSmsCode(loginName.trim(), password, iisCode.trim());
      setSmsHint(res.hint || "");
      setSmsCode("");
      setStep("sms");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Шаг 3: вводим 4-значный код → получаем токен
  const doVerifySms = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await udsApi.verifySmsCode(loginName.trim(), password, iisCode.trim(), smsCode.trim());
      applyAuth(res);
      setPassword(""); setSmsCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Повторная отправка кода
  const resendSms = async () => {
    setBusy(true); setError("");
    try {
      const res = await udsApi.sendSmsCode(loginName.trim(), password, iisCode.trim());
      setSmsHint(res.hint || "");
      setSmsCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = doLogout;

  // ── Форма входа ──────────────────────────────────────────────────────────
  if (!session) {
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

  // ── Полноэкранный выпуск сертификата (назначен Главой/Замом) ──────────────
  if (myCert && (myCert.status === "assigned" || myCert.status === "issuing")) {
    return (
      <UdsCertIssue
        login={session.login}
        token={session.token}
        cert={myCert}
        onDone={() => refreshMe(session)}
        onLogout={logout}
      />
    );
  }

  const { perms } = session;
  const TABS: { id: Tab; label: string; icon: string; show: boolean }[] = [
    { id: "employees", label: "Сотрудники", icon: "Users", show: true },
    { id: "users", label: "Пользователи", icon: "UserSearch", show: true },
    { id: "support", label: "Тех. поддержка", icon: "Headphones", show: perms.can_support },
    { id: "lkview", label: "Вид ЛК", icon: "LayoutDashboard", show: perms.can_lkview },
    { id: "maintenance", label: "Тех. работы", icon: "Construction", show: perms.can_maintenance },
    { id: "audit", label: "Логи действий", icon: "ScrollText", show: true },
    { id: "profile", label: "Мой профиль", icon: "UserCog", show: session.login !== "admin" },
  ].filter(t => t.show);

  const onProfileUpdated = (newLogin: string, newToken: string) => {
    const updated = { ...session, login: newLogin, token: newToken };
    setSession(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center bg-blue-600">
            <Icon name="ShieldCheck" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Управление Движения Системы</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{session.login}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                {session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
              </span>
              {session.operator_number != null && (
                <span className="text-[10px] text-muted-foreground font-mono">№{session.operator_number}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
        >
          <Icon name="LogOut" size={13} />
          Выйти
        </button>
      </header>

      <div className="bg-white border-b border-border px-4 md:px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={13} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {tab === "employees" && (
          <UdsEmployees login={session.login} token={session.token} perms={perms} myRole={session.panel_role} />
        )}
        {tab === "users" && (
          <UdsUsers login={session.login} token={session.token} perms={perms} />
        )}
        {tab === "audit" && (
          <UdsAuditLog login={session.login} token={session.token} />
        )}
        {tab === "support" && (
          <UdsSupport login={session.login} token={session.token} panelRole={session.panel_role} />
        )}
        {tab === "lkview" && (
          <UdsLkView login={session.login} token={session.token} />
        )}
        {tab === "maintenance" && (
          <UdsMaintenance login={session.login} token={session.token} />
        )}
        {tab === "profile" && (
          <UdsProfile
            login={session.login}
            token={session.token}
            panelRoleLabel={session.panel_role_label || PANEL_ROLE_LABELS[session.panel_role]}
            operatorNumber={session.operator_number}
            onUpdated={onProfileUpdated}
          />
        )}
      </main>
    </div>
  );
}