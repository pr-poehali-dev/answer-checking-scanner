import { useState } from "react";
import Icon from "@/components/ui/icon";
import { subscriptionApi } from "@/lib/api";
import { useAppStore, appStore } from "@/store/appStore";

interface TokensModalProps {
  onClose: () => void;
}

const PRESETS = [
  { tokens: 3000, label: "3 000", note: "≈ 1 подписка" },
  { tokens: 10000, label: "10 000", note: "Популярный" },
  { tokens: 30000, label: "30 000", note: "Много" },
  { tokens: 100000, label: "100 000", note: "Надолго" },
];

function calcRub(tokens: number) {
  return Math.round(tokens / 1000 * 30);
}

export default function TokensModal({ onClose }: TokensModalProps) {
  const { teacher } = useAppStore();
  const [selected, setSelected] = useState(10000);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const tokenCount = useCustom
    ? Math.max(1000, Math.round(parseInt(custom.replace(/\D/g, "") || "0") / 1000) * 1000)
    : selected;
  const rubAmount = calcRub(tokenCount);

  const handleBuy = async () => {
    if (!teacher) return;
    setError("");
    setLoading(true);
    try {
      const result = await subscriptionApi.buyTokens(
        teacher.login,
        tokenCount,
        window.location.href,
      );
      if (result.confirmation_url) {
        setCheckingId(result.payment_id);
        window.open(result.confirmation_url, "_blank");
      }
    } catch (e) {
      setError((e as Error).message || "Ошибка создания платежа");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!checkingId || !teacher) return;
    setLoading(true);
    setError("");
    try {
      const result = await subscriptionApi.checkTokens(checkingId);
      if (result.status === "succeeded") {
        if (result.ai_tokens_balance !== undefined) {
          appStore.setAiTokens(result.ai_tokens_balance);
        }
        setSuccess(true);
      } else if (result.status === "canceled") {
        setError("Платёж отменён");
        setCheckingId("");
      } else {
        setError("Платёж ещё не завершён. Проверьте страницу оплаты и попробуйте снова.");
      }
    } catch (e) {
      setError((e as Error).message || "Ошибка проверки платежа");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-sm w-full max-w-sm p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Icon name="CheckCircle" size={32} className="text-green-600" />
          </div>
          <p className="text-lg font-bold text-foreground">Токены зачислены!</p>
          <p className="text-sm text-muted-foreground">
            Баланс обновлён. Теперь вы можете использовать ИИ-генерации.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="Coins" size={18} className="text-primary" />
            <p className="font-bold text-sm text-foreground">Купить токены ИИ</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Баланс */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-sm">
            <Icon name="Wallet" size={16} className="text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Текущий баланс</p>
              <p className="text-sm font-bold text-foreground">
                {(teacher?.aiTokens ?? 0).toLocaleString("ru-RU")} токенов
              </p>
            </div>
          </div>

          {/* Пресеты */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Выберите количество</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.tokens}
                  onClick={() => { setSelected(p.tokens); setUseCustom(false); }}
                  className={`border rounded-sm p-3 text-left transition-colors ${
                    !useCustom && selected === p.tokens
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-bold text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.note}</p>
                  <p className="text-xs font-semibold text-primary mt-1">{calcRub(p.tokens)} ₽</p>
                </button>
              ))}
            </div>
          </div>

          {/* Своё количество */}
          <div>
            <button
              onClick={() => setUseCustom(v => !v)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Icon name={useCustom ? "ChevronDown" : "ChevronRight"} size={12} />
              Своё количество
            </button>
            {useCustom && (
              <div className="mt-2">
                <input
                  type="text"
                  value={custom}
                  onChange={e => setCustom(e.target.value.replace(/\D/g, ""))}
                  placeholder="Например: 50000"
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">Минимум 1 000 токенов. Шаг — 1 000.</p>
              </div>
            )}
          </div>

          {/* Итог */}
          <div className="border border-border rounded-sm p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Итого</p>
              <p className="text-sm font-bold">{tokenCount.toLocaleString("ru-RU")} токенов</p>
            </div>
            <p className="text-xl font-bold text-foreground">{rubAmount} ₽</p>
          </div>

          <p className="text-xs text-muted-foreground">
            1 000 токенов = 30 ₽ · Токены не сгорают · Оплата через ЮKassa
          </p>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
              <Icon name="AlertCircle" size={13} className="text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Кнопки */}
          {!checkingId ? (
            <button
              onClick={handleBuy}
              disabled={loading || tokenCount < 1000}
              className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="CreditCard" size={15} />}
              {loading ? "Создаём платёж…" : `Оплатить ${rubAmount} ₽`}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm flex items-start gap-2">
                <Icon name="Info" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Оплатите в открытой вкладке, затем нажмите «Я оплатил» для проверки.
                </p>
              </div>
              <button
                onClick={handleCheckPayment}
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Icon name="CheckCircle" size={15} />}
                {loading ? "Проверяем…" : "Я оплатил — проверить"}
              </button>
              <button
                onClick={() => setCheckingId("")}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Отменить и выбрать другое количество
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
