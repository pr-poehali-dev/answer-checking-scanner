import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { subscriptionApi, type SavedCard, type PaymentRow } from "@/lib/api";
import { AutoRenewCard } from "@/components/scanner/AutoRenewCard";
import PersonalAccountCard from "@/components/scanner/billing/PersonalAccountCard";
import SavedCardsCard from "@/components/scanner/billing/SavedCardsCard";
import PaymentHistoryCard from "@/components/scanner/billing/PaymentHistoryCard";
import TestPaymentBanner from "@/components/TestPaymentBanner";
import { usePaymentReturn } from "@/hooks/usePaymentReturn";

/**
 * Раздел настроек «Оплаты, карты, автоплатежи».
 * Здесь пользователь видит свой лицевой счёт, историю пополнений и все привязанные
 * карты — каждую можно отвязать в один клик, без обращения в поддержку
 * (требование ЮMoney к подключению автоплатежей).
 */
export function BillingCard() {
  const { teacher } = useAppStore();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [personalAccount, setPersonalAccount] = useState<string | null>(null);
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");

  const login = teacher?.login;

  const loadCards = useCallback(async () => {
    if (!login) return;
    setLoadingCards(true);
    try {
      const d = await subscriptionApi.cards(login);
      setCards(d.cards || []);
      if (d.personal_account) setPersonalAccount(d.personal_account);
    } catch (e) {
      setError((e as Error).message || "Не удалось загрузить карты");
    } finally {
      setLoadingCards(false);
    }
  }, [login]);

  const loadHistory = useCallback(async () => {
    if (!login) return;
    setLoadingHistory(true);
    try {
      const d = await subscriptionApi.history(login);
      setHistory(d.history || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [login]);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Пользователь вернулся с оплаты (пополнение баланса, привязка карты) —
  // подтверждаем платёж у ЮKassa и обновляем баланс/список карт/историю.
  usePaymentReturn(!!login, {
    onBalanceConfirmed: () => { loadCards(); loadHistory(); },
  });

  if (!teacher) return null;

  const account = personalAccount || teacher.personalAccount || null;

  return (
    <div className="space-y-4">
      {teacher.role === "tester" && <TestPaymentBanner />}

      <PersonalAccountCard
        personalAccount={account}
        balanceKopecks={teacher.aiTokensKopecks ?? 0}
        subscriptionActive={teacher.subscriptionActive}
        subscriptionUntil={teacher.subscriptionUntil}
      />

      <AutoRenewCard login={teacher.login} />

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <Icon name="AlertCircle" size={12} /> {error}
        </p>
      )}

      {loadingCards ? (
        <div className="border border-border rounded-sm bg-white flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Icon name="Loader2" size={14} className="animate-spin" />
          Загрузка карт…
        </div>
      ) : (
        <SavedCardsCard
          login={teacher.login}
          cards={cards}
          onChanged={() => { loadCards(); appStore.refreshSubscription(); }}
        />
      )}

      <PaymentHistoryCard history={history} loading={loadingHistory} />
    </div>
  );
}

export default BillingCard;