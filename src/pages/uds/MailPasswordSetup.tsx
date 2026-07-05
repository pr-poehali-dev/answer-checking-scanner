import { useState } from "react";
import Icon from "@/components/ui/icon";
import { udsApi } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  emailAddress: string;
  mailStatus?: string;
  onDone: () => void;
  onLogout: () => void;
}

/**
 * Обязательная установка пароля корпоративной почты при первом входе.
 * Показывается на весь экран. Продолжить в панель без пароля НЕЛЬЗЯ —
 * доступна только установка пароля или выход из аккаунта.
 */
export default function MailPasswordSetup({ login, token, emailAddress, mailStatus, onDone, onLogout }: Props) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (pass.length < 8) { setError("Пароль — минимум 8 символов"); return; }
    if (pass !== pass2) { setError("Пароли не совпадают"); return; }
    setBusy(true);
    try {
      await udsApi.setMailPassword(login, token, pass);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/95 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <Icon name="Mail" size={26} className="text-white" />
          </div>
          <h1 className="text-lg font-bold">Настройте корпоративную почту</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Вам выдан адрес:
          </p>
          <p className="text-sm font-mono font-semibold text-blue-700 mt-0.5 break-all">{emailAddress}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Придумайте пароль для почты — он понадобится для отправки писем и входа в веб-почту хостинга.
          </p>
          <p className="text-[11px] font-semibold text-blue-700 mt-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
            Это обязательный шаг. Продолжить работу в УДС можно только после установки пароля почты.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Новый пароль почты"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <Icon name={show ? "EyeOff" : "Eye"} size={16} />
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            value={pass2}
            onChange={e => setPass2(e.target.value)}
            placeholder="Повторите пароль"
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={submit}
          disabled={busy || !pass || !pass2}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
        >
          {busy ? <><Icon name="Loader2" size={15} className="animate-spin" /> Сохраняем…</> : <><Icon name="Check" size={15} /> Сохранить и продолжить</>}
        </button>
        <p className="text-[10px] text-gray-400 text-center">
          Пароль хранится в защищённом виде. Его можно сменить позже в разделе «Почта».
        </p>
        <div className="pt-1 border-t border-gray-100 text-center">
          <button
            onClick={onLogout}
            disabled={busy}
            className="text-[11px] text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Icon name="LogOut" size={11} /> Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}