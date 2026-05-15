import Icon from "@/components/ui/icon";
import { UserRow } from "@/lib/api";

interface Props {
  subFor: UserRow;
  subMonths: number;
  subBusy: boolean;
  formatSubUntil: (iso: string | null) => string;
  setSubMonths: (m: number) => void;
  onGrant: (login: string, months: number, revoke?: boolean) => void;
  onClose: () => void;
}

export default function AdminSubscriptionModal({
  subFor,
  subMonths,
  subBusy,
  formatSubUntil,
  setSubMonths,
  onGrant,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !subBusy && onClose()}
    >
      <div className="bg-white rounded-sm border border-border max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Crown" size={16} className="text-primary" fallback="Star" />
          <h3 className="text-sm font-bold">Подписка САОУ</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Пользователь: <span className="font-semibold text-foreground">{subFor.full_name}</span>{" "}
          · <span className="mono">{subFor.login}</span>
        </p>

        <div className="border border-border rounded-sm p-3 mb-4 bg-muted/30 text-xs">
          <p className="text-muted-foreground mb-1">Текущий статус:</p>
          {subFor.subscription_active ? (
            <p className="text-green-600 font-semibold">
              Активна до {formatSubUntil(subFor.subscription_until)}
            </p>
          ) : subFor.subscription_status === "expired" ? (
            <p className="text-amber-600 font-semibold">
              Истекла {formatSubUntil(subFor.subscription_until)}
            </p>
          ) : (
            <p className="text-muted-foreground font-semibold">Нет подписки</p>
          )}
        </div>

        <p className="text-xs font-semibold mb-2">Выдать или продлить подписку</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1, 3, 6, 12].map(m => (
            <button
              key={m}
              onClick={() => setSubMonths(m)}
              disabled={subBusy}
              className={`py-2 text-xs font-semibold rounded-sm border transition-colors disabled:opacity-50 ${
                subMonths === m
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {m} мес.
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground mb-4">
          Подписка добавится к текущей дате окончания (если активна) или начнётся с сегодняшнего дня.
        </p>

        <div className="flex gap-2 justify-between">
          {subFor.subscription_active ? (
            <button
              onClick={() => {
                if (confirm(`Отозвать подписку у ${subFor.full_name}? Доступ к разделам будет закрыт.`)) {
                  onGrant(subFor.login, 0, true);
                }
              }}
              disabled={subBusy}
              className="px-3 py-2 border border-destructive/40 text-destructive text-xs rounded-sm hover:bg-destructive/5 disabled:opacity-50"
            >
              Отозвать
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={subBusy}
              className="px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={() => onGrant(subFor.login, subMonths, false)}
              disabled={subBusy}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {subBusy && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {subFor.subscription_active ? "Продлить" : "Активировать"} на {subMonths} мес.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}