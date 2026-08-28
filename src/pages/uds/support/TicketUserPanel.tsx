import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { supportApi, UdsUserDetail, UdsPayment, UdsCharge } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Учитель", student: "Ученик", tester: "Тестер", admin: "Админ",
};

interface Props {
  login: string;
  token: string;
  ticketId: number;
  onClose: () => void;
}

/**
 * Карточка «Все данные» внутри обращения техподдержки.
 * Оператор ТП не имеет доступа к разделу «Пользователи», но по взятому
 * обращению видит здесь всё, что нужно для помощи клиенту.
 */
export default function TicketUserPanel({ login, token, ticketId, onClose }: Props) {
  const [user, setUser] = useState<UdsUserDetail | null>(null);
  const [payments, setPayments] = useState<UdsPayment[]>([]);
  const [charges, setCharges] = useState<UdsCharge[]>([]);
  const [tab, setTab] = useState<"info" | "payments" | "actions">("info");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await supportApi.ticketUser(login, token, ticketId);
      setUser(res.user); setPayments(res.payments); setCharges(res.charges);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token, ticketId]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("ru-RU") : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[88vh] overflow-y-auto styled-scrollbar"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{user?.full_name || user?.login || "Клиент"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.login}{user ? ` · ${ROLE_LABELS[user.role] || user.role}` : ""}
              {user && !user.is_active && <span className="text-red-500"> · заблокирован</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted flex-shrink-0">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex border-b border-border px-5 sticky top-[57px] bg-white z-10">
          {([["info", "Информация"], ["payments", "Платежи и списания"], ["actions", "Действия"]] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {lbl}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center">
            <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : !user ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Данные недоступны</p>
        ) : tab === "info" ? (
          <div className="p-5 grid grid-cols-2 gap-3 text-xs">
            <Info label="Лицевой счёт" value={user.personal_account || "—"} mono />
            <Info label="Эл. почта" value={user.email || "—"} />
            <Info label="Телефон" value={user.phone || "—"} />
            <Info label="Школа" value={user.school || "—"} />
            <Info label="Класс/группа" value={user.study_group || "—"} />
            <Info label="Предмет" value={user.subject || "—"} />
            <Info label="Подписка" value={user.subscription_status} />
            <Info label="Подписка до" value={fmt(user.subscription_until)} />
            <Info label="Баланс ИИ" value={`${user.ai_balance_rub.toFixed(2)} ₽`} />
            <Info label="Триал до" value={fmt(user.trial_until)} />
            <Info label="Регистрация" value={fmt(user.created_at)} />
            <Info label="Был в сети" value={fmt(user.last_seen_at)} />
          </div>
        ) : tab === "payments" ? (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold mb-2">Платежи</p>
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Платежей нет</p>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border">
                  {payments.map((p, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.plan || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(p.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold">{p.amount_rub.toFixed(2)} ₽</p>
                        <p className="text-[10px] text-muted-foreground">{p.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold mb-2">Списания ИИ</p>
              {charges.length === 0 ? (
                <p className="text-xs text-muted-foreground">Списаний нет</p>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto styled-scrollbar">
                  {charges.map((c, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs truncate">{c.action}</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(c.created_at)}</p>
                      </div>
                      <p className="text-xs font-semibold flex-shrink-0">−{c.amount_rub.toFixed(2)} ₽</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Icon name="Info" size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">
                Начисление средств, продление подписки и смена пароля выполняются
                в разделе «Пользователи» — он доступен Советнику и выше.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-medium break-words ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
