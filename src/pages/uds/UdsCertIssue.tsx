import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsCert } from "@/lib/api";
import { cryptoPlugins } from "@/lib/cryptoPlugins";

type PluginState = "checking" | "ok" | "missing";

interface Props {
  login: string;
  token: string;
  cert: UdsCert;
  onDone: () => void;
  onLogout: () => void;
}

type Phase = "intro" | "install" | "choose" | "issuing" | "done";

// Официальные ссылки на загрузки КриптоПро и расширения браузера
const DOWNLOADS = {
  cryptoProCsp: "https://www.cryptopro.ru/products/csp/downloads",
  cryptoProPlugin: "https://www.cryptopro.ru/products/cades/plugin/get_2_0",
  cryptoProExtChrome: "https://chromewebstore.google.com/detail/iifchhfnnmpdbibifmljnfjhpififfog",
  cryptoProExtEdge: "https://microsoftedge.microsoft.com/addons/detail/cryptopro-extension-for/eabkhnjhdmnlbanpgggfbmnfpjnpnicb",
  cryptoProExtFirefox: "https://www.cryptopro.ru/products/cades/plugin/get_2_0",
};

export default function UdsCertIssue({ login, token, cert, onDone, onLogout }: Props) {
  const [phase, setPhase] = useState<Phase>(cert.status === "issuing" ? "choose" : "intro");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cpState, setCpState] = useState<PluginState>("checking");
  const [cpReason, setCpReason] = useState("");

  const checkPlugin = useCallback(async () => {
    setCpState("checking"); setCpReason("");
    const cp = await cryptoPlugins.diagnose().catch((e) => ({ ok: false, reason: (e as Error).message }));
    setCpState(cp.ok ? "ok" : "missing"); setCpReason(cp.reason);
  }, []);

  useEffect(() => {
    if (phase === "choose") checkPlugin();
  }, [phase, checkPlugin]);

  const issue = async () => {
    setError(""); setBusy(true); setPhase("issuing");
    try {
      setStage("Подтверждаем выпуск сертификата…");
      await udsApi.certAgree(login, token, "cryptopro");

      setStage("Шаг 1. Создаём ГОСТ-ключ в контейнере КриптоПро…");
      const subjectCN = cert ? (cert.serial_number || login) : login;
      const { csr, context } = await cryptoPlugins.issue(subjectCN);

      setStage("Шаг 2. Управление УДС «САОУ» выпускает сертификат…");
      const res = await udsApi.signCsr(login, token, csr);

      setStage("Шаг 3. Устанавливаем сертификат в контейнер…");
      await cryptoPlugins.install(context, res.certificate);

      setStage("");
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("choose");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* INTRO */}
        {phase === "intro" && (
          <div className="text-center space-y-5">
            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse">
              <Icon name="ShieldPlus" size={40} className="text-white" fallback="Shield" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Вам назначен выпуск сертификата</h1>
              <p className="text-sm text-slate-400 mt-2">
                Глава/Зам. Главы УДС назначил выпуск и привязку вашего сертификата
                для входа в УДС. Сертификат личный, на 11 месяцев, не копируется.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-left text-xs space-y-1.5 text-slate-300">
              <p>• <b>Кому выдан:</b> вы (ФИО сотрудника)</p>
              <p>• <b>Кем выдан:</b> Управление УДС «САОУ»</p>
              <p>• <b>Срок:</b> строго 11 месяцев</p>
              <p>• <b>Носитель:</b> контейнер КриптоПро (ГОСТ)</p>
              <p className="text-slate-500 pt-1">Только для внутреннего использования в САОУ и УДС.
                Не является официальной ЭЦП РФ / Минцифры.</p>
            </div>
            <button onClick={() => setPhase("install")}
              className="w-full py-2.5 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-center gap-2">
              <Icon name="Download" size={14} /> Как установить КриптоПро и что скачать
            </button>
            <div className="flex gap-2">
              <button onClick={onLogout}
                className="flex-1 py-3 border border-slate-600 rounded-lg text-sm hover:bg-slate-800">
                Позже
              </button>
              <button onClick={() => setPhase("choose")}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                Далее <Icon name="ArrowRight" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* INSTALL — инструкция и ссылки */}
        {phase === "install" && (
          <div className="space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="text-center">
              <Icon name="Download" size={26} className="text-blue-400 mx-auto mb-1" />
              <h1 className="text-xl font-bold">Установка КриптоПро</h1>
              <p className="text-sm text-slate-400 mt-1">
                Для выпуска и входа по сертификату нужен КриптоПро на вашем ПК.
              </p>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Monitor" size={18} className="text-blue-400" fallback="Cpu" />
                <p className="text-sm font-bold">КриптоПро (контейнер ГОСТ на ПК)</p>
              </div>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                <li>Установите <b>КриптоПро CSP</b> (есть бесплатный пробный период).</li>
                <li>Установите <b>КриптоПро ЭЦП Browser plug-in 2.0</b>.</li>
                <li>Добавьте расширение <b>«CryptoPro Extension for CAdES»</b> в браузер.</li>
                <li>Перезапустите браузер.</li>
              </ol>
              <div className="grid grid-cols-1 gap-2">
                <DlLink href={DOWNLOADS.cryptoProCsp} label="КриптоПро CSP" />
                <DlLink href={DOWNLOADS.cryptoProPlugin} label="КриптоПро ЭЦП Browser plug-in" />
                <DlLink href={cryptoProExtLink()} label={`Расширение CryptoPro для ${browserName()}`} />
              </div>
              <p className="text-[10px] text-slate-500">
                Расширения:{" "}
                <a href={DOWNLOADS.cryptoProExtChrome} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Chrome</a>{" · "}
                <a href={DOWNLOADS.cryptoProExtEdge} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Edge</a>{" · "}
                <a href={DOWNLOADS.cryptoProExtFirefox} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firefox</a>
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPhase("intro")}
                className="flex-1 py-3 border border-slate-600 rounded-lg text-sm hover:bg-slate-800">
                Назад
              </button>
              <button onClick={() => setPhase("choose")}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                Я установил — продолжить <Icon name="ArrowRight" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* CHOOSE */}
        {phase === "choose" && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold">Выпуск сертификата</h1>
              <p className="text-sm text-slate-400 mt-1">
                Ключ ГОСТ будет создан в контейнере КриптоПро. Носитель (реестр,
                токен или флеш-носитель) выбирается в диалоге КриптоПро.
              </p>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                <div className="flex items-start gap-2">
                  <Icon name="AlertCircle" size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
                <button onClick={() => setPhase("install")}
                  className="text-[11px] text-blue-300 hover:text-blue-200 flex items-center gap-1">
                  <Icon name="Download" size={12} /> Не установлен КриптоПро? Скачать и установить
                </button>
              </div>
            )}

            <button onClick={issue} disabled={busy || cpState !== "ok"}
              className="relative w-full flex flex-col items-center gap-2 py-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700 disabled:opacity-50 disabled:hover:border-slate-700 transition-colors">
              <PluginBadge state={cpState} />
              <Icon name="Monitor" size={28} className="text-blue-400" fallback="Cpu" />
              <span className="text-sm font-semibold">Выпустить через КриптоПро</span>
              <span className="text-[10px] text-slate-500">ГОСТ-контейнер + сертификат УДС</span>
            </button>

            {cpState === "missing" && cpReason && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                <p className="text-xs text-amber-300 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                  <span><b>КриптоПро:</b> {cpReason}</span>
                </p>
                <button onClick={() => setPhase("install")}
                  className="text-[11px] text-blue-300 hover:text-blue-200 flex items-center gap-1">
                  <Icon name="Download" size={12} /> Скачать и установить КриптоПро
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              <button onClick={checkPlugin}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
                <Icon name="RefreshCw" size={12} /> Проверить КриптоПро снова
              </button>
            </div>

            <button onClick={onLogout} className="w-full text-[11px] text-slate-500 hover:text-slate-300">Выйти</button>
          </div>
        )}

        {/* ISSUING */}
        {phase === "issuing" && (
          <div className="text-center space-y-5">
            <Icon name="Loader2" size={44} className="animate-spin text-blue-400 mx-auto" />
            <div>
              <h1 className="text-lg font-bold">Идёт выпуск…</h1>
              <p className="text-sm text-slate-400 mt-2">{stage}</p>
              <p className="text-[11px] text-slate-500 mt-3">
                Может появиться диалог КриптоПро — выберите носитель и подтвердите.
                Не закрывайте окно.
              </p>
            </div>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="text-center space-y-5">
            <div className="w-20 h-20 rounded-2xl bg-green-600 flex items-center justify-center mx-auto">
              <Icon name="CheckCircle2" size={40} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Сертификат выпущен и привязан</h1>
              <p className="text-sm text-slate-400 mt-2">
                Носитель: контейнер КриптоПро. Теперь вы можете входить в УДС по сертификату.
              </p>
            </div>
            <button onClick={onDone}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold">
              Перейти в УДС
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PluginBadge({ state }: { state: PluginState }) {
  const map = {
    checking: { icon: "Loader2", cls: "bg-slate-600 text-slate-200", spin: true, label: "проверка" },
    ok: { icon: "CheckCircle2", cls: "bg-green-600 text-white", spin: false, label: "найден" },
    missing: { icon: "XCircle", cls: "bg-red-600 text-white", spin: false, label: "не найден" },
  }[state];
  return (
    <span className={`absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${map.cls}`}>
      <Icon name={map.icon} size={10} className={map.spin ? "animate-spin" : ""} fallback="Circle" />
      {map.label}
    </span>
  );
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/YaBrowser/i.test(ua)) return "Яндекс.Браузера";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  return "вашего браузера";
}

function cryptoProExtLink(): string {
  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) return DOWNLOADS.cryptoProExtFirefox;
  if (/Edg\//i.test(ua)) return DOWNLOADS.cryptoProExtEdge;
  return DOWNLOADS.cryptoProExtChrome;
}

function DlLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors">
      <span className="flex items-center gap-2"><Icon name="Download" size={13} /> {label}</span>
      <Icon name="ExternalLink" size={12} className="opacity-60" />
    </a>
  );
}
