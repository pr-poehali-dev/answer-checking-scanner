import { useState } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  personalAccount: string | null;
  balanceKopecks: number;
  subscriptionActive: boolean;
  subscriptionUntil: string | null;
}

/** Разбивает номер счёта на группы для читаемости: 123 456 789 */
function formatAccount(acc: string | null) {
  if (!acc) return "—";
  return acc.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

export function PersonalAccountCard({
  personalAccount, balanceKopecks, subscriptionActive, subscriptionUntil,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!personalAccount) return;
    try {
      await navigator.clipboard.writeText(personalAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* буфер обмена недоступен — не критично */ }
  };

  return (
    <div
      className="rounded-sm overflow-hidden border border-border"
      style={{ background: "linear-gradient(135deg, hsl(215 60% 22%) 0%, hsl(215 55% 30%) 100%)" }}
    >
      <div className="px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="Landmark" size={13} className="opacity-70" fallback="Wallet" />
              <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">
                Лицевой счёт
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold font-mono tracking-wider">
                {formatAccount(personalAccount)}
              </p>
              {personalAccount && (
                <button
                  onClick={copy}
                  title="Скопировать номер"
                  className="p-1.5 rounded-sm hover:bg-white/15 transition-colors flex-shrink-0"
                >
                  <Icon name={copied ? "Check" : "Copy"} size={14} className="opacity-80" />
                </button>
              )}
            </div>
            <p className="text-xs opacity-60 mt-1">
              Указывайте этот номер при обращении в поддержку
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1.5 mb-1 justify-end">
              <Icon name="Coins" size={13} className="opacity-70" />
              <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">
                Баланс ИИ
              </span>
            </div>
            <p className="text-2xl font-bold">
              {(balanceKopecks / 100).toLocaleString("ru-RU", {
                minimumFractionDigits: 2, maximumFractionDigits: 2,
              })} ₽
            </p>
            <p className="text-xs opacity-60 mt-1">
              {subscriptionActive
                ? subscriptionUntil
                  ? `Подписка до ${new Date(subscriptionUntil).toLocaleDateString("ru-RU")}`
                  : "Подписка активна"
                : "Подписка не активна"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonalAccountCard;