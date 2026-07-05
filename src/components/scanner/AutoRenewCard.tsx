import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { subscriptionApi, type AutorenewStatus } from "@/lib/api";

interface Props {
  login: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Блок управления автопродлением подписки.
 * Показывается только если автопродление включено. Позволяет отключить его в один клик
 * (54-ФЗ: пользователь может отказаться от рекуррентных списаний в любой момент).
 */
export function AutoRenewCard({ login }: Props) {
  const [status, setStatus] = useState<AutorenewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await subscriptionApi.autorenewStatus(login);
      setStatus(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [login]);

  useEffect(() => { load(); }, [load]);

  const disable = async () => {
    setBusy(true); setError("");
    try {
      await subscriptionApi.cancelAutorenew(login);
      await load();
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Пока грузим — ничего не показываем (чтобы не мигал блок)
  if (loading) return null;
  // Если автопродление не подключено — блок не нужен
  if (!status || !status.autorenew_enabled) return null;

  return (
    <div className="rounded-sm border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon name="RefreshCw" size={16} className="text-primary" />
        <p className="text-sm font-semibold">Автопродление включено</p>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Подписка продлевается автоматически. Следующее списание —{" "}
          <span className="font-semibold text-foreground">{formatDate(status.subscription_until)}</span>.
        </p>
        {status.payment_method_title && (
          <p>Способ оплаты: <span className="font-medium text-foreground">{status.payment_method_title}</span></p>
        )}
        {status.last_error && (
          <p className="text-amber-600">Последняя попытка списания не удалась. Проверьте карту.</p>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <Icon name="AlertCircle" size={12} /> {error}
        </p>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors"
        >
          <Icon name="XCircle" size={13} />
          Отключить автопродление
        </button>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Отключить автопродление? Списания прекратятся, сохранённая карта будет удалена.
            Текущая подписка продолжит действовать до {formatDate(status.subscription_until)}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={disable}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-white text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
              Да, отключить
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-muted disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoRenewCard;
