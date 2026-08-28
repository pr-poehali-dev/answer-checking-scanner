import Icon from "@/components/ui/icon";
import type { PaymentRow } from "@/lib/api";

interface Props {
  history: PaymentRow[];
  loading: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  monthly: "Подписка на месяц",
  halfyear: "Подписка на полгода",
  year: "Подписка на год",
  balance: "Пополнение баланса ИИ",
};

const STATUS_VIEW: Record<string, { label: string; color: string; icon: string }> = {
  succeeded: { label: "Оплачено", color: "#16a34a", icon: "CheckCircle2" },
  pending: { label: "Ожидает оплаты", color: "#d97706", icon: "Clock" },
  waiting_for_capture: { label: "Обрабатывается", color: "#d97706", icon: "Clock" },
  canceled: { label: "Отменён", color: "#dc2626", icon: "XCircle" },
};

function planLabel(p: PaymentRow) {
  return PLAN_LABELS[p.plan] || p.plan;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function PaymentHistoryCard({ history, loading }: Props) {
  const succeeded = history.filter(h => h.status === "succeeded");
  const totalPaid = succeeded.reduce((s, h) => s + h.amount, 0);

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Receipt" size={15} className="text-primary" fallback="History" />
          <p className="text-sm font-semibold">История оплат</p>
        </div>
        {succeeded.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Всего оплачено: <span className="font-semibold text-foreground">
              {totalPaid.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Icon name="Loader2" size={14} className="animate-spin" />
          Загрузка…
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 px-4">
          <Icon name="Receipt" size={30} className="mx-auto mb-2 text-muted-foreground opacity-40" fallback="History" />
          <p className="text-xs text-muted-foreground">Оплат пока не было</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {history.map(p => {
            const st = STATUS_VIEW[p.status] || { label: p.status, color: "#64748b", icon: "Circle" };
            const isTopUp = p.plan === "balance";
            return (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div
                  className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
                  style={{ background: isTopUp ? "hsl(215 60% 22% / 0.08)" : "hsl(160 60% 25% / 0.08)" }}
                >
                  <Icon
                    name={isTopUp ? "Wallet" : "BadgeCheck"}
                    size={16}
                    style={{ color: isTopUp ? "hsl(215 60% 40%)" : "hsl(160 60% 30%)" }}
                    fallback="Coins"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{planLabel(p)}</p>
                    {p.source === "autorenew" && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">
                        <Icon name="RefreshCw" size={10} />
                        Автоплатёж
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: st.color }}
                    >
                      <Icon name={st.icon} size={11} fallback="Circle" />
                      {st.label}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(p.paid_at || p.created_at)}
                    </span>
                  </div>
                  {p.subscription_until && p.status === "succeeded" && !isTopUp && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Подписка продлена до {new Date(p.subscription_until).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                  {p.granted_by && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Начислено вручную: {p.granted_by}
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p
                    className="text-sm font-bold"
                    style={{ color: p.status === "succeeded" ? (isTopUp ? "#16a34a" : "hsl(var(--foreground))") : "#94a3b8" }}
                  >
                    {isTopUp && p.status === "succeeded" ? "+" : ""}
                    {p.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                  </p>
                  {p.months > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {p.months} мес.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PaymentHistoryCard;
