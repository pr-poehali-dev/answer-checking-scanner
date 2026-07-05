import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { udsApi } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  panelRoleLabel: string;
  operatorNumber: number | null;
  subroleLabel?: string | null;
  curatorName?: string | null;
  onUpdated: (login: string, token: string) => void;
}

export default function UdsProfile({ login, token, panelRoleLabel, operatorNumber, subroleLabel, curatorName, onUpdated }: Props) {
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Корпоративная почта
  const [mail, setMail] = useState<{ has_mailbox: boolean; email_address?: string } | null>(null);
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState("");

  useEffect(() => {
    udsApi.mailStatus(login, token)
      .then(m => setMail({ has_mailbox: m.has_mailbox, email_address: m.email_address }))
      .catch(() => {});
  }, [login, token]);

  const createMailbox = async () => {
    setMailBusy(true); setMailMsg("");
    try {
      const r = await udsApi.createMyMailbox(login, token);
      setMail({ has_mailbox: true, email_address: r.email_address });
      setMailMsg(r.status === "active"
        ? "Ящик создан. Задайте пароль почты при следующем входе."
        : "Адрес зарезервирован. Ящик будет создан автоматически.");
    } catch (e) { setMailMsg((e as Error).message); }
    finally { setMailBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setOk(false);
    if (!newLogin.trim() && !newPassword) {
      setError("Укажите новый логин или новый пароль"); return;
    }
    if (newPassword && newPassword !== confirm) {
      setError("Пароли не совпадают"); return;
    }
    if (!currentPassword) {
      setError("Введите текущий пароль для подтверждения"); return;
    }
    setBusy(true);
    try {
      const res = await udsApi.updateProfile(login, token, {
        current_password: currentPassword,
        new_login: newLogin.trim() || undefined,
        new_password: newPassword || undefined,
      });
      onUpdated(res.login, res.token);
      setOk(true);
      setNewLogin(""); setNewPassword(""); setConfirm(""); setCurrentPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h2 className="text-sm font-bold">Мой профиль</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Смена логина и пароля для входа в УДС</p>
      </div>

      <div className="border border-border rounded-lg bg-white p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Icon name="UserCog" size={18} className="text-blue-600" fallback="User" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">{login}</p>
            {subroleLabel && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{subroleLabel}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {panelRoleLabel}{operatorNumber != null ? ` · №${operatorNumber}` : ""}
          </p>
          {curatorName && (
            <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
              <Icon name="UserCheck" size={10} /> Мой куратор: {curatorName}
            </p>
          )}
        </div>
      </div>

      {/* Корпоративная почта */}
      {mail && (
        <div className="border border-border rounded-lg bg-white p-4 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5"><Icon name="Mail" size={13} className="text-blue-600" /> Корпоративная почта</p>
          {mail.has_mailbox ? (
            <p className="text-sm font-mono text-blue-700 break-all">{mail.email_address}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">У вас пока нет корпоративного ящика @ooo29.ru.</p>
              <button onClick={createMailbox} disabled={mailBusy}
                className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
                {mailBusy ? <><Icon name="Loader2" size={13} className="animate-spin" /> Создаём…</> : <><Icon name="MailPlus" size={13} fallback="Plus" /> Создать себе почту</>}
              </button>
            </>
          )}
          {mailMsg && <p className="text-[11px] text-green-600">{mailMsg}</p>}
        </div>
      )}

      <form onSubmit={submit} className="border border-border rounded-lg bg-white p-5 space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Новый логин</label>
          <input value={newLogin} onChange={e => setNewLogin(e.target.value)}
            placeholder="Оставьте пустым, чтобы не менять"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Новый пароль</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="Минимум 6 символов"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {newPassword && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Повторите пароль</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <div className="pt-1 border-t border-border">
          <label className="text-xs text-gray-500 block mb-1 mt-2">Текущий пароль (подтверждение)*</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        {ok && (
          <div className="flex items-center gap-2 p-2.5 rounded-sm bg-green-50 border border-green-200">
            <Icon name="CheckCircle2" size={13} className="text-green-600" />
            <p className="text-xs text-green-700">Данные обновлены</p>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
          {busy ? <><Icon name="Loader2" size={13} className="animate-spin" /> Сохранение…</> : <><Icon name="Save" size={13} /> Сохранить</>}
        </button>
      </form>
    </div>
  );
}