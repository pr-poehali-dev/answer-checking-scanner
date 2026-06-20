import { useState } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsCert } from "@/lib/api";
import { cryptoPlugins, ContainerType } from "@/lib/cryptoPlugins";

interface Props {
  login: string;
  token: string;
  cert: UdsCert;
  onDone: () => void;
  onLogout: () => void;
}

type Phase = "intro" | "install" | "choose" | "issuing" | "done";

// Официальные ссылки на загрузки плагинов и драйверов
const DOWNLOADS = {
  rutokenPlugin: "https://www.rutoken.ru/support/download/rutoken-plugin/",
  rutokenDrivers: "https://www.rutoken.ru/support/download/get/rtDrivers-windows.html",
  cryptoProPlugin: "https://www.cryptopro.ru/products/cades/plugin/get_2_0",
  cryptoProCsp: "https://www.cryptopro.ru/products/csp/downloads",
  rutokenExtChrome: "https://chromewebstore.google.com/detail/адаптер-rutoken-plugin/bbmnnnnmcmbcmmkdmdfpljpdghmpljhd",
};

export default function UdsCertIssue({ login, token, cert, onDone, onLogout }: Props) {
  const [phase, setPhase] = useState<Phase>(cert.status === "issuing" ? "choose" : "intro");
  const [container, setContainer] = useState<ContainerType | null>(null);
  const [pin, setPin] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      const { csr, context } = await cryptoPlugins.issue(type, displayName(subjectCN), pin || undefined);

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
                <DlLink href={DOWNLOADS.rutokenDrivers} label="Драйверы Рутокен (Windows)" />
                <DlLink href={DOWNLOADS.rutokenPlugin} label="Rutoken Plugin" />
                <DlLink href={DOWNLOADS.rutokenExtChrome} label="Расширение для Chrome / Яндекс" />
              </div>
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
              <button onClick={() => issue("rutoken")} disabled={busy}
                className="flex flex-col items-center gap-2 py-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                <Icon name="Usb" size={28} className="text-blue-400" fallback="HardDrive" />
                <span className="text-sm font-semibold">На Рутокен</span>
                <span className="text-[10px] text-slate-500">аппаратный носитель</span>
              </button>
              <button onClick={() => issue("cryptopro")} disabled={busy}
                className="flex flex-col items-center gap-2 py-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                <Icon name="Monitor" size={28} className="text-blue-400" fallback="Cpu" />
                <span className="text-sm font-semibold">На ПК (КриптоПро)</span>
                <span className="text-[10px] text-slate-500">контейнер CSP</span>
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

function DlLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors">
      <span className="flex items-center gap-2"><Icon name="Download" size={13} /> {label}</span>
      <Icon name="ExternalLink" size={12} className="opacity-60" />
    </a>
  );
}