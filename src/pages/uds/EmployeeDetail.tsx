import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsPerms, UdsEmployee, UdsAuditEntry, UdsCurator } from "@/lib/api";
import EmployeeCertSection from "./EmployeeCertSection";

const ACTION_LABELS: Record<string, string> = {
  register_employee: "Регистрация сотрудника",
  set_role: "Изменение роли",
  remove_role: "Снятие роли",
  set_subrole: "Изменение подроли",
  set_curator: "Смена куратора",
  transfer_request: "Запрос на передачу",
  transfer_accepted: "Передача принята",
  transfer_declined: "Передача отклонена",
  transfer_direct: "Передан куратору",
  reset_user_password: "Смена пароля",
  block: "Блокировка",
  unblock: "Разблокировка",
  assign_cert: "Назначен выпуск сертификата",
  cert_agree: "Согласие на выпуск",
  cert_issued: "Сертификат выпущен",
  revoke_cert: "Сертификат отозван",
  cert_login: "Вход по сертификату",
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

interface Props {
  data: { emp: UdsEmployee; logs: UdsAuditEntry[] };
  login: string;
  token: string;
  perms: UdsPerms;
  myRole: string;
  onChanged?: () => void;
  onClose: () => void;
}

export default function EmployeeDetail({ data, login, token, perms, myRole, onChanged, onClose }: Props) {
  const { emp, logs } = data;
  const isHeadOrDeputy = myRole === "head" || myRole === "deputy";
  const [curators, setCurators] = useState<UdsCurator[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // Смена пароля
  const [showPass, setShowPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  // Передача подопечного
  const [transferTo, setTransferTo] = useState("");

  useEffect(() => {
    if (isHeadOrDeputy || perms.is_curator) {
      udsApi.curators(login, token).then(r => setCurators(r.curators)).catch(() => {});
    }
  }, [login, token, isHeadOrDeputy, perms.is_curator]);

  const setSubrole = async (subrole: string) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await udsApi.setSubrole(login, token, emp.login, subrole);
      setMsg("Подроль обновлена"); onChanged?.();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const setCurator = async (curatorLogin: string) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await udsApi.setCurator(login, token, emp.login, curatorLogin);
      setMsg("Куратор назначен"); onChanged?.();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const doResetPassword = async () => {
    if (newPass.length < 6) { setErr("Пароль не менее 6 символов"); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      await udsApi.resetUserPassword(login, token, emp.login, newPass);
      setMsg("Пароль сотрудника изменён"); setShowPass(false); setNewPass("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const doTransfer = async () => {
    if (!transferTo) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await udsApi.transferRequest(login, token, emp.login, transferTo);
      setMsg(r.direct ? "Сотрудник передан" : "Запрос на передачу отправлен — ждёт принятия");
      setTransferTo(""); onChanged?.();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  // Кто может передавать: Глава/Зам (любого) или куратор своего подопечного
  const canTransfer = isHeadOrDeputy || (perms.is_curator && emp.curator_login === login);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white">
          <div>
            <p className="text-sm font-bold">{emp.full_name}</p>
            <p className="text-xs text-muted-foreground">{emp.login} · {emp.panel_role_label} · №{emp.operator_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="Эл. почта" value={emp.mail_address || emp.email || "—"} />
            <Info label="Телефон" value={emp.phone || "—"} />
            <Info label="Код ИИС" value={emp.iis_code || "—"} />
            <Info label="Статус" value={emp.is_active ? "Активен" : "Заблокирован"} />
            <Info label="Подроль" value={emp.subrole_label || "—"} />
            <Info label="Куратор" value={emp.curator_name || "—"} />
          </div>

          {(msg || err) && (
            <p className={`text-xs ${err ? "text-destructive" : "text-green-600"}`}>{err || msg}</p>
          )}

          {/* Куратор — назначение (Глава/Зам) */}
          {isHeadOrDeputy && emp.login !== "admin" && emp.login !== login && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Icon name="UserCheck" size={13} /> Куратор сотрудника</p>
              <select value={emp.curator_login || ""} onChange={e => setCurator(e.target.value)} disabled={busy}
                className="w-full text-xs border border-border rounded px-2 py-1.5">
                <option value="">— без куратора —</option>
                {curators.map(c => <option key={c.login} value={c.login}>{c.full_name} ({c.panel_role_label})</option>)}
              </select>
            </div>
          )}

          {/* Подроль — назначение (Глава/Зам) */}
          {perms.can_assign_subrole && emp.login !== "admin" && emp.login !== login && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Icon name="BadgeCheck" size={13} /> Подроль</p>
              <select value={emp.subrole || ""} onChange={e => setSubrole(e.target.value)} disabled={busy}
                className="w-full text-xs border border-border rounded px-2 py-1.5">
                <option value="">Без подроли</option>
                <option value="curator">Куратор</option>
                <option value="manager">Менеджер</option>
              </select>
            </div>
          )}

          {/* Передача подопечного другому куратору */}
          {canTransfer && emp.login !== "admin" && emp.login !== login && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Icon name="ArrowLeftRight" size={13} /> Передать другому куратору</p>
              <div className="flex gap-2">
                <select value={transferTo} onChange={e => setTransferTo(e.target.value)} disabled={busy}
                  className="flex-1 text-xs border border-border rounded px-2 py-1.5">
                  <option value="">— выберите куратора —</option>
                  {curators.filter(c => c.login !== emp.curator_login).map(c => (
                    <option key={c.login} value={c.login}>{c.full_name} ({c.panel_role_label})</option>
                  ))}
                </select>
                <button onClick={doTransfer} disabled={busy || !transferTo}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                  Передать
                </button>
              </div>
              {!isHeadOrDeputy && <p className="text-[10px] text-muted-foreground">Передача произойдёт после принятия вторым куратором.</p>}
            </div>
          )}

          {/* Смена пароля сотрудника (куратор / Глава / Зам) */}
          {emp.can_manage !== false && emp.login !== "admin" && emp.login !== login && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Icon name="KeyRound" size={13} /> Пароль сотрудника</p>
              {!showPass ? (
                <button onClick={() => setShowPass(true)}
                  className="text-xs px-3 py-1.5 border border-border rounded hover:bg-muted">Сменить пароль</button>
              ) : (
                <div className="flex gap-2">
                  <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Новый пароль" autoFocus
                    className="flex-1 text-xs border border-border rounded px-2 py-1.5" />
                  <button onClick={doResetPassword} disabled={busy || newPass.length < 6}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">ОК</button>
                  <button onClick={() => { setShowPass(false); setNewPass(""); }}
                    className="px-2 py-1.5 border border-border text-xs rounded hover:bg-muted">Отмена</button>
                </div>
              )}
            </div>
          )}

          {perms.can_cert && emp.login !== "admin" && (
            <EmployeeCertSection login={login} token={token} targetLogin={emp.login} />
          )}

          <div>
            <p className="text-xs font-semibold mb-2">История действий ({logs.length})</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && <p className="text-xs text-muted-foreground">Действий пока нет</p>}
              {logs.map((l, i) => (
                <div key={i} className="text-xs border border-border rounded px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ACTION_LABELS[l.action] || l.action}</span>
                    <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    {l.actor_login} {l.target_login && l.target_login !== l.actor_login ? `→ ${l.target_login}` : ""}
                    {l.details ? ` · ${l.details}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}