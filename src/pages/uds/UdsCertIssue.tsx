import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsCert } from "@/lib/api";
import { cryptoPlugins, ContainerType, RutokenDevice } from "@/lib/cryptoPlugins";

type PluginState = "checking" | "ok" | "missing";

interface Props {
  login: string;
  token: string;
  cert: UdsCert;
  onDone: () => void;
  onLogout: () => void;
}

type Phase = "intro" | "install" | "choose" | "issuing" | "done";

// Официальные ссылки на загрузки плагинов, драйверов и расширений
const DOWNLOADS = {
  // Рутокен
  rutokenPlugin: "https://www.rutoken.ru/support/download/rutoken-plugin/",
  rutokenDrivers: "https://www.rutoken.ru/support/download/drivers-for-windows/",
  rutokenExtChrome: "https://chromewebstore.google.com/detail/ohedcglhbbfdgaogjhcclacoccbagkjg",
  rutokenExtEdge: "https://microsoftedge.microsoft.com/addons/search/%D0%90%D0%B4%D0%B0%D0%BF%D1%82%D0%B5%D1%80%20%D0%A0%D1%83%D1%82%D0%BE%D0%BA%D0%B5%D0%BD",
  rutokenExtFirefox: "https://addons.mozilla.org/ru/firefox/addon/rutoken-plugin-adapter/",
  // КриптоПро
  cryptoProPlugin: "https://www.cryptopro.ru/products/cades/plugin/get_2_0",
  cryptoProCsp: "https://www.cryptopro.ru/products/csp/downloads",
  cryptoProExtChrome: "https://chromewebstore.google.com/detail/iifchhfnnmpdbibifmljnfjhpififfog",
};

export default function UdsCertIssue({ login, token, cert, onDone, onLogout }: Props) {
  const [phase, setPhase] = useState<Phase>(cert.status === "issuing" ? "choose" : "intro");
  const [container, setContainer] = useState<ContainerType | null>(null);
  const [pin, setPin] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rtState, setRtState] = useState<PluginState>("checking");
  const [cpState, setCpState] = useState<PluginState>("checking");
  const [rtReason, setRtReason] = useState("");
  const [cpReason, setCpReason] = useState("");
  const [rtDevices, setRtDevices] = useState<RutokenDevice[]>([]);
  const [rtDeviceId, setRtDeviceId] = useState<number | null>(null);

  const checkPlugins = useCallback(async () => {
    setRtState("checking"); setCpState("checking"); setRtReason(""); setCpReason("");
    const rt = await cryptoPlugins.diagnose("rutoken").catch((e) => ({ ok: false, reason: (e as Error).message }));
    setRtState(rt.ok ? "ok" : "missing"); setRtReason(rt.reason);
    // Если Рутокен доступен — подгружаем список подключённых носителей для выбора
    if (rt.ok) {
      const devices = await cryptoPlugins.listRutokenDevices();
      setRtDevices(devices);
      // Автовыбор: первый носитель с поддержкой ГОСТ, иначе просто первый
      const preferred = devices.find(d => d.supportsGost) ?? devices[0];
      setRtDeviceId(preferred ? preferred.id : null);
    } else {
      setRtDevices([]); setRtDeviceId(null);
    }
    const cp = await cryptoPlugins.diagnose("cryptopro").catch((e) => ({ ok: false, reason: (e as Error).message }));
    setCpState(cp.ok ? "ok" : "missing"); setCpReason(cp.reason);
  }, []);

  // Проверяем плагины при входе на экран выбора носителя
  useEffect(() => {
    if (phase === "choose") checkPlugins();
  }, [phase, checkPlugins]);

  const issue = async (type: ContainerType) => {
    setContainer(type);
    setError(""); setBusy(true); setPhase("issuing");
    try {
      setStage("Подтверждаем выбор носителя…");
      await udsApi.certAgree(login, token, type);

      setStage(type === "rutoken"
        ? "Генерируем ключевую пару на Рутокене…"
        : "Генерируем ключевую пару в КриптоПро…");
      const subjectCN = cert ? (cert.serial_number || login) : login;
      const { csr, context } = await cryptoPlugins.issue(
        type, displayName(subjectCN), pin || undefined,
        type === "rutoken" ? (rtDeviceId ?? undefined) : undefined,
      );

      setStage("Управление УДС «САОУ» выпускает сертификат…");
      const res = await udsApi.signCsr(login, token, csr);

      setStage("Устанавливаем сертификат на носитель…");
      await cryptoPlugins.install(type, context, res.certificate);

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
              <p>• <b>Назначение:</b> цифровая подпись для входа в УДС</p>
              <p className="text-slate-500 pt-1">Только для внутреннего использования в САОУ и УДС.
                Не является официальной ЭЦП РФ / Минцифры.</p>
            </div>
            <button onClick={() => setPhase("install")}
              className="w-full py-2.5 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-center gap-2">
              <Icon name="Download" size={14} /> Как установить плагин и что скачать
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
              <h1 className="text-xl font-bold">Установка и скачивание</h1>
              <p className="text-sm text-slate-400 mt-1">
                Для выпуска и входа по сертификату нужен плагин на вашем ПК.
                Выберите носитель, который будете использовать.
              </p>
            </div>

            {/* РУТОКЕН */}
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Usb" size={18} className="text-blue-400" fallback="HardDrive" />
                <p className="text-sm font-bold">Рутокен (аппаратный токен)</p>
              </div>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                <li>Установите <b>Драйверы Рутокен</b> для Windows.</li>
                <li>Установите <b>Rutoken Plugin</b>.</li>
                <li>Добавьте расширение <b>«Адаптер Rutoken Plugin»</b> в браузер.</li>
                <li>Подключите токен Рутокен 2.0 / 3.0 в USB и перезапустите браузер.</li>
              </ol>
              <div className="grid grid-cols-1 gap-2">
                <DlLink href={DOWNLOADS.rutokenPlugin} label="Rutoken Plugin (драйверы внутри)" />
                <DlLink href={rutokenExtLink()} label={`Расширение «Адаптер Рутокен» для ${browserName()}`} />
              </div>
              <p className="text-[10px] text-slate-500">
                Расширения для других браузеров:{" "}
                <a href={DOWNLOADS.rutokenExtChrome} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Chrome</a>{" · "}
                <a href={DOWNLOADS.rutokenExtEdge} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Edge</a>{" · "}
                <a href={DOWNLOADS.rutokenExtFirefox} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firefox</a>
              </p>
            </div>

            {/* КРИПТОПРО */}
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Monitor" size={18} className="text-blue-400" fallback="Cpu" />
                <p className="text-sm font-bold">КриптоПро (контейнер на ПК)</p>
              </div>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                <li>Установите <b>КриптоПро CSP</b> (есть бесплатный пробный период).</li>
                <li>Установите <b>КриптоПро ЭЦП Browser plug-in 2.0</b>.</li>
                <li>Перезапустите браузер.</li>
              </ol>
              <div className="grid grid-cols-1 gap-2">
                <DlLink href={DOWNLOADS.cryptoProCsp} label="КриптоПро CSP" />
                <DlLink href={DOWNLOADS.cryptoProPlugin} label="КриптоПро ЭЦП Browser plug-in" />
                <DlLink href={DOWNLOADS.cryptoProExtChrome} label="Расширение КриптоПро для Chrome / Edge" />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              После установки вернитесь и нажмите «Я установил — продолжить».
              Может потребоваться перезапуск браузера.
            </p>

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
              <h1 className="text-xl font-bold">Выберите носитель</h1>
              <p className="text-sm text-slate-400 mt-1">Соглашаясь, вы подтверждаете выпуск сертификата</p>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                <div className="flex items-start gap-2">
                  <Icon name="AlertCircle" size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
                <button onClick={() => setPhase("install")}
                  className="text-[11px] text-blue-300 hover:text-blue-200 flex items-center gap-1">
                  <Icon name="Download" size={12} /> Не установлен плагин? Скачать и установить
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => issue("rutoken")} disabled={busy || rtState !== "ok"}
                className="relative flex flex-col items-center gap-2 py-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700 disabled:opacity-50 disabled:hover:border-slate-700 transition-colors">
                <PluginBadge state={rtState} />
                <Icon name="Usb" size={28} className="text-blue-400" fallback="HardDrive" />
                <span className="text-sm font-semibold">На Рутокен</span>
                <span className="text-[10px] text-slate-500">аппаратный носитель</span>
              </button>
              <button onClick={() => issue("cryptopro")} disabled={busy || cpState !== "ok"}
                className="relative flex flex-col items-center gap-2 py-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700 disabled:opacity-50 disabled:hover:border-slate-700 transition-colors">
                <PluginBadge state={cpState} />
                <Icon name="Monitor" size={28} className="text-blue-400" fallback="Cpu" />
                <span className="text-sm font-semibold">На ПК (КриптоПро)</span>
                <span className="text-[10px] text-slate-500">контейнер CSP</span>
              </button>
            </div>

            {/* Точная диагностика по каждому плагину */}
            {(rtState === "missing" || cpState === "missing") && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                {rtState === "missing" && rtReason && (
                  <p className="text-xs text-amber-300 flex items-start gap-2">
                    <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                    <span><b>Рутокен:</b> {rtReason}</span>
                  </p>
                )}
                {cpState === "missing" && cpReason && (
                  <p className="text-xs text-amber-300 flex items-start gap-2">
                    <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                    <span><b>КриптоПро:</b> {cpReason}</span>
                  </p>
                )}
                <button onClick={() => setPhase("install")}
                  className="text-[11px] text-blue-300 hover:text-blue-200 flex items-center gap-1">
                  <Icon name="Download" size={12} /> Скачать и установить плагин
                </button>
              </div>
            )}

            {/* ВЫБОР КОНКРЕТНОГО НОСИТЕЛЯ РУТОКЕН */}
            {rtState === "ok" && rtDevices.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 space-y-2">
                <label className="text-xs text-slate-300 flex items-center gap-1.5">
                  <Icon name="Usb" size={13} className="text-blue-400" fallback="HardDrive" />
                  {rtDevices.length > 1 ? "Выберите носитель Рутокен" : "Подключённый носитель"}
                </label>
                <select
                  value={rtDeviceId ?? ""}
                  onChange={(e) => setRtDeviceId(Number(e.target.value))}
                  disabled={busy || rtDevices.length === 1}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                >
                  {rtDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}{d.model ? ` — ${d.model}` : ""}{d.supportsGost ? "" : " (без ГОСТ)"}
                    </option>
                  ))}
                </select>
                {rtDeviceId != null && rtDevices.find(d => d.id === rtDeviceId && !d.supportsGost) && (
                  <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
                    <Icon name="AlertTriangle" size={12} className="flex-shrink-0 mt-0.5" />
                    Этот носитель может не поддерживать ГОСТ. Если выпуск не удастся —
                    выберите Рутокен ЭЦП 2.0/3.0 или используйте КриптоПро.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              <button onClick={checkPlugins}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
                <Icon name="RefreshCw" size={12} /> Проверить плагин и носители снова
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">PIN-код Рутокена (если требуется)</label>
              <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Только для Рутокена" />
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
                Не отключайте носитель и не закрывайте окно.
                Может появиться запрос плагина — подтвердите его.
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
                Носитель: {container === "rutoken" ? "Рутокен" : "КриптоПро"}.
                Теперь вы можете входить в УДС по сертификату.
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

function displayName(v: string): string {
  // Тема сертификата формируется на бэкенде из ФИО; здесь только CN-заглушка.
  return v;
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

function rutokenExtLink(): string {
  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) return DOWNLOADS.rutokenExtFirefox;
  if (/Edg\//i.test(ua)) return DOWNLOADS.rutokenExtEdge;
  return DOWNLOADS.rutokenExtChrome; // Chrome, Яндекс, Opera — из Chrome Web Store
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