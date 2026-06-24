import Icon from "@/components/ui/icon";
import { UdsPerms, UdsEmployee, UdsAuditEntry } from "@/lib/api";
import EmployeeCertSection from "./EmployeeCertSection";

const ACTION_LABELS: Record<string, string> = {
  register_employee: "Регистрация сотрудника",
  set_role: "Изменение роли",
  remove_role: "Снятие роли",
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
  onClose: () => void;
}

export default function EmployeeDetail({ data, login, token, perms, onClose }: Props) {
  const { emp, logs } = data;
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
            <Info label="Эл. почта" value={emp.email || "—"} />
            <Info label="Телефон" value={emp.phone || "—"} />
            <Info label="Код ИИС" value={emp.iis_code || "—"} />
            <Info label="Статус" value={emp.is_active ? "Активен" : "Заблокирован"} />
            <Info label="Через УДС" value={emp.uds_registered ? "Да" : "Нет"} />
            <Info label="Назначил" value={emp.assigned_by || "—"} />
          </div>

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
