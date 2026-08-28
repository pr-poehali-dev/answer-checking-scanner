import Icon from "@/components/ui/icon";

/**
 * Баннер тестового режима оплаты. Показывается ТОЛЬКО пользователям с ролью
 * "tester" — backend для таких аккаунтов автоматически проводит все платежи
 * через отдельный тестовый магазин ЮKassa (закрыт от обычных пользователей,
 * реальные деньги не списываются). Обычные пользователи этот баннер не видят
 * и не могут включить тестовый режим сами.
 */
export function TestPaymentBanner() {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-sm border border-amber-300 bg-amber-50 mb-4">
      <Icon name="FlaskConical" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" fallback="AlertTriangle" />
      <p className="text-xs text-amber-800 leading-relaxed">
        <span className="font-semibold">Тестовый режим оплаты.</span> Ваш аккаунт — роль «тестер»,
        поэтому все платежи (подписка, баланс, привязка карты) проходят через закрытый
        тестовый магазин ЮKassa. Реальные деньги не списываются.
      </p>
    </div>
  );
}

export default TestPaymentBanner;
