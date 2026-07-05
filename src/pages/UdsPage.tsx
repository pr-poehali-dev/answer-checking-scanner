import { useEffect, useState, useCallback, useRef } from "react";
import { udsApi, UdsPerms, UdsCert } from "@/lib/api";
import { cryptoPlugins, CryptoProMedia } from "@/lib/cryptoPlugins";
import UdsCertIssue from "@/pages/uds/UdsCertIssue";
import UdsLoginForm from "@/pages/uds/UdsLoginForm";
import UdsDashboard from "@/pages/uds/UdsDashboard";
import MailPasswordSetup from "@/pages/uds/MailPasswordSetup";
import {
  Session,
  Tab,
  LS_KEY,
  SESSION_TIMEOUT_MS,
  setCookie,
  getCookie,
  removeCookie,
} from "@/pages/uds/udsSession";

export default function UdsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [myCert, setMyCert] = useState<UdsCert | null>(null);
  const [myMail, setMyMail] = useState<{ email_address: string; status: string; password_set: boolean } | null>(null);
  // Шаги входа: cert → iis → creds → sms
  const [step, setStep] = useState<"cert" | "iis" | "creds" | "sms">("cert");
  const [iisCode, setIisCode] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsHint, setSmsHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [certList, setCertList] = useState<CryptoProMedia[] | null>(null);
  const [certLoading, setCertLoading] = useState(false);
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
    setSession(null); setMyCert(null); setMyMail(null);
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
        setMyMail(me.my_mail);
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

  // Загрузка списка сертификатов КриптоПро для выбора носителя
  const loadCertificates = useCallback(async () => {
    setCertLoading(true); setError("");
    try {
      const diag = await cryptoPlugins.diagnose();
      if (!diag.ok) { setError(diag.reason); setCertList([]); return; }
      const list = await cryptoPlugins.listCertificates();
      setCertList(list);
      if (list.length === 0) {
        setError("В хранилище КриптоПро нет сертификатов. Сначала выпустите сертификат УДС.");
      }
    } catch (e) {
      setError((e as Error).message);
      setCertList([]);
    } finally {
      setCertLoading(false);
    }
  }, []);

  // Вход по выбранному сертификату (носителю) КриптоПро
  const certLogin = async (thumbprint?: string) => {
    setBusy(true); setError("");
    try {
      const { nonce } = await udsApi.certChallenge();
      const { signature, fingerprint } = await cryptoPlugins.sign(nonce, thumbprint);
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
      <UdsLoginForm
        step={step}
        iisCode={iisCode}
        setIisCode={setIisCode}
        loginName={loginName}
        setLoginName={setLoginName}
        password={password}
        setPassword={setPassword}
        smsCode={smsCode}
        setSmsCode={setSmsCode}
        smsHint={smsHint}
        busy={busy}
        error={error}
        onLogoClick={onLogoClick}
        certLogin={certLogin}
        certList={certList}
        certLoading={certLoading}
        loadCertificates={loadCertificates}
        verifyIis={verifyIis}
        doLogin={doLogin}
        doVerifySms={doVerifySms}
        resendSms={resendSms}
        setStep={setStep}
        setError={setError}
      />
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

  // ── Обязательная установка пароля почты при первом входе ──────────────────
  // Без права отказа: пока пароль не установлен — доступ в панель закрыт.
  if (myMail && !myMail.password_set) {
    return (
      <MailPasswordSetup
        login={session.login}
        token={session.token}
        emailAddress={myMail.email_address}
        mailStatus={myMail.status}
        onDone={() => refreshMe(session)}
        onLogout={logout}
      />
    );
  }

  const onProfileUpdated = (newLogin: string, newToken: string) => {
    const updated = { ...session, login: newLogin, token: newToken };
    setSession(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  return (
    <UdsDashboard
      session={session}
      tab={tab}
      setTab={setTab}
      logout={logout}
      onProfileUpdated={onProfileUpdated}
      myMailAddress={myMail?.email_address ?? null}
    />
  );
}