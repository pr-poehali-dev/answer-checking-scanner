import { useState } from "react";
import Icon from "@/components/ui/icon";
import { subscriptionApi, type SavedCard } from "@/lib/api";

interface Props {
  login: string;
  cards: SavedCard[];
  onChanged: () => void;
}

/** Иконка и цвет для платёжной системы карты. */
function cardVisual(type: string): { icon: string; color: string; bg: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("мир") || t.includes("mir")) return { icon: "CreditCard", color: "#0f9d58", bg: "#0f9d5815" };
  if (t.includes("visa")) return { icon: "CreditCard", color: "#1a1f71", bg: "#1a1f7115" };
  if (t.includes("master")) return { icon: "CreditCard", color: "#eb001b", bg: "#eb001b15" };
  if (t.includes("maestro")) return { icon: "CreditCard", color: "#0099df", bg: "#0099df15" };
  if (t.includes("union")) return { icon: "CreditCard", color: "#e21836", bg: "#e2183615" };
  return { icon: "CreditCard", color: "#64748b", bg: "#64748b15" };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export function SavedCardsCard({ login, cards, onChanged }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [error, setError] = useState("");

  const removeOne = async (cardId: number) => {
    setBusyId(cardId); setError("");
    try {
      await subscriptionApi.deleteCard(login, cardId);
      setConfirmId(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message || "Не удалось отвязать карту");
    } finally {
      setBusyId(null);
    }
  };

  const removeAll = async () => {
    setBusyId(-1); setError("");
    try {
      await subscriptionApi.deleteAllCards(login);
      setConfirmAll(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message || "Не удалось отвязать карты");
    } finally {
      setBusyId(null);
    }
  };

  const addCard = async () => {
    setAddingCard(true); setError("");
    try {
      const res = await subscriptionApi.addCard(login, window.location.href);
      if (res.confirmation_url) {
        window.location.href = res.confirmation_url;
      } else {
        setError("Не удалось открыть форму оплаты");
        setAddingCard(false);
      }
    } catch (e) {
      setError((e as Error).message || "Не удалось привязать карту");
      setAddingCard(false);
    }
  };

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon name="CreditCard" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Мои карты</p>
          <span className="text-xs text-muted-foreground">{cards.length}</span>
        </div>
        {cards.length > 0 && (
          !confirmAll ? (
            <button
              onClick={() => { setConfirmAll(true); setConfirmId(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-destructive/40 text-destructive text-xs font-medium rounded-sm hover:bg-destructive/5 transition-colors"
            >
              <Icon name="Trash2" size={12} />
              Отвязать все карты
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={removeAll}
                disabled={busyId === -1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-white text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
              >
                {busyId === -1 ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                Да, отвязать все
              </button>
              <button
                onClick={() => setConfirmAll(false)}
                disabled={busyId === -1}
                className="px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-muted disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          )
        )}
      </div>

      <div className="p-4 space-y-3">
        {confirmAll && (
          <div className="flex items-start gap-2.5 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertTriangle" size={15} className="text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">
              Все карты будут удалены из сервиса навсегда, автоплатёж отключится.
              Чтобы платить снова, карту нужно будет привязать заново.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <Icon name="AlertCircle" size={12} /> {error}
          </p>
        )}

        {cards.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="CreditCard" size={30} className="mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground mb-1">Привязанных карт нет</p>
            <p className="text-xs text-muted-foreground">
              Привяжите карту, чтобы включить автоплатёж и оплачивать в один клик
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map(card => {
              const v = cardVisual(card.card_type);
              const isConfirming = confirmId === card.id;
              return (
                <div key={card.id} className="border border-border rounded-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-11 h-8 rounded-sm flex items-center justify-center flex-shrink-0"
                      style={{ background: v.bg }}
                    >
                      <Icon name={v.icon} size={17} style={{ color: v.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: v.color }}>{card.card_type}</p>
                        <p className="text-sm font-mono tracking-wider">
                          •••• {card.card_last4 || "????"}
                        </p>
                        {card.autorenew_enabled && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">
                            <Icon name="RefreshCw" size={10} />
                            Автоплатёж
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Привязана {formatDate(card.created_at)}
                      </p>
                    </div>

                    {!isConfirming && (
                      <button
                        onClick={() => { setConfirmId(card.id); setConfirmAll(false); }}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:border-destructive/40 hover:text-destructive transition-colors"
                      >
                        <Icon name="Unlink" size={12} fallback="Trash2" />
                        Отвязать
                      </button>
                    )}
                  </div>

                  {isConfirming && (
                    <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground leading-relaxed pt-2.5">
                        Отвязать карту {card.card_type} •••• {card.card_last4}? Автоплатёж по ней
                        отключится навсегда, а карта будет удалена из всех баз данных сервиса.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => removeOne(card.id)}
                          disabled={busyId === card.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-white text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
                        >
                          {busyId === card.id ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                          Да, отвязать
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={busyId === card.id}
                          className="px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-muted disabled:opacity-50"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={addCard}
            disabled={addingCard}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-primary/40 text-primary text-xs font-semibold rounded-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {addingCard ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Plus" size={13} />}
            Привязать карту для автоплатежа
          </button>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Для привязки спишется 10 ₽ — они сразу зачислятся на ваш баланс ИИ.
            Отметьте «Запомнить данные карты» на странице оплаты. Реквизиты карты хранит
            ЮMoney, сервису доступны только тип карты и последние 4 цифры.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SavedCardsCard;