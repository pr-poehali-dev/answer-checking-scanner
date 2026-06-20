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

type Phase = "intro" | "choose" | "issuing" | "done";

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

        {/* CHOOSE */}
        {phase === "choose" && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold">Выберите носитель</h1>
              <p className="text-sm text-slate-400 mt-1">Соглашаясь, вы подтверждаете выпуск сертификата</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <Icon name="AlertCircle" size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
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
