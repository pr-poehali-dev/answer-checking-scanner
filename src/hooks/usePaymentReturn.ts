import { useEffect, useCallback } from "react";
import { subscriptionApi } from "@/lib/api";
import { appStore } from "@/store/appStore";

/**
 * Подстраховка на случай, если ЮKassa НЕ добавила payment_id в return_url
 * (так бывает — платёжная форма не гарантирует передачу параметров обратно)
 * и HTTP-уведомление (webhook) ещё не долетело или не настроено в кабинете
 * ЮKassa. Без этого платёж может уйти на сторону ЮKassa успешно, а в нашей
 * базе остаться "pending" навсегда — баланс/подписка/карта не подтянутся.
 *
 * Работает так: перед переходом на страницу оплаты компонент обязан вызвать
 * rememberPendingPayment(...). После загрузки любой страницы приложения этот
 * хук сам проверяет, есть ли незавершённый платёж, и достаёт его статус —
 * не дожидаясь возврата именно на тот же URL.
 */

const STORAGE_KEY = "saou_pending_payment_v1";

type PendingKind = "subscription" | "balance";

interface PendingPayment {
  paymentId: string;
  kind: PendingKind;
  createdAt: number;
}

/** Вызвать ПЕРЕД редиректом на confirmation_url ЮKassa. */
export function rememberPendingPayment(paymentId: string, kind: PendingKind) {
  try {
    const entry: PendingPayment = { paymentId, kind, createdAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch { /* localStorage недоступен — не критично, есть webhook как основной путь */ }
}

function readPending(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    // Не пытаемся бесконечно — платёж старше 3 суток чистим (протух/отменён)
    if (!parsed.paymentId || Date.now() - parsed.createdAt > 3 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearPending() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Достаёт payment_id либо из URL (?payment_id=...), либо из localStorage. */
function resolvePendingPaymentId(): PendingPayment | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("payment_id");
    if (fromUrl) {
      const stored = readPending();
      return { paymentId: fromUrl, kind: stored?.kind || "balance", createdAt: Date.now() };
    }
  } catch { /* ignore */ }
  return readPending();
}

/** Для страниц со своей логикой возврата (SubscriptionGate уже читает ?payment_id=
 * сама) — достать сохранённый payment_id подписки, если URL его не содержит. */
export function getPendingSubscriptionPaymentId(): string | null {
  const p = readPending();
  return p && p.kind === "subscription" ? p.paymentId : null;
}

export { clearPending as clearPendingPayment };

interface Options {
  /** Вызывается при успешном подтверждении оплаты подписки. */
  onSubscriptionConfirmed?: (giftRub: number) => void;
  /** Вызывается при успешном подтверждении пополнения баланса. */
  onBalanceConfirmed?: (balanceKopecks: number) => void;
}

export function usePaymentReturn(enabled: boolean, options: Options = {}) {
  const { onSubscriptionConfirmed, onBalanceConfirmed } = options;

  const check = useCallback(async () => {
    const pending = resolvePendingPaymentId();
    if (!pending) return;

    try {
      if (pending.kind === "subscription") {
        const res = await subscriptionApi.check(pending.paymentId);
        if (res.subscription_active) {
          clearPending();
          await appStore.refreshSubscription();
          onSubscriptionConfirmed?.(res.ai_gift_rub || 0);
        } else if (res.status !== "pending" && res.status !== "waiting_for_capture") {
          // canceled и т.п. — платёж больше не актуален, не проверяем его вечно
          clearPending();
        }
      } else {
        const res = await subscriptionApi.checkTokens(pending.paymentId);
        if (res.status === "succeeded") {
          clearPending();
          if (res.ai_balance_kopecks !== undefined) {
            appStore.setAiBalance(res.ai_balance_kopecks);
          }
          await appStore.refreshSubscription();
          onBalanceConfirmed?.(res.ai_balance_kopecks ?? 0);
        } else if (res.status !== "pending" && res.status !== "waiting_for_capture") {
          clearPending();
        }
      }
    } catch {
      // Сеть/ЮKassa недоступны — оставляем запись, попробуем ещё раз при
      // следующей загрузке страницы (или её подтвердит webhook сам по себе).
    } finally {
      // Убираем payment_id из адресной строки, чтобы не проверять повторно
      // при обновлении страницы и не мозолить глаза пользователю.
      if (window.location.search.includes("payment_id")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment_id");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [onSubscriptionConfirmed, onBalanceConfirmed]);

  useEffect(() => {
    if (!enabled) return;
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}