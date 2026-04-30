import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";

function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function formatRub(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SubscriptionGate() {
  const { teacher } = useAppStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [available, setAvailable] = useState<boolean>(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [returnedPaymentId, setReturnedPaymentId] = useState<string | null>(null);
  const [agreedSub, setAgreedSub] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);

  useEffect(() => {
    subscriptionApi.plans()
      .then(d => { setPlans(d.plans); setAvailable(d.available); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingPlans(false));
  }, []);

  // Возврат после оплаты — обрабатываем ?payment_id=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("payment_id");
    if (pid) {
      setReturnedPaymentId(pid);
      handleCheck(pid);
      const url = new URL(window.location.href);
      url.searchParams.delete("payment_id");
      window.history.replaceState({}, "", url.toString());
    }
     
  }, []);

  const handleCheck = async (pid: string) => {
    setBusyPlan("__check__");
    setError(null);
    try {
      const res = await subscriptionApi.check(pid);
      if (res.subscription_active) {
        await appStore.refreshSubscription();
        setInfo("Подписка активирована! Все разделы доступны.");
      } else if (res.status === "canceled") {
        setError("Платёж был отменён. Попробуйте оформить подписку ещё раз.");
      } else {
        setError("Платёж пока не подтверждён банком. Обновите страницу через минуту.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  };

  const handleBuy = async (plan: SubscriptionPlan) => {
    if (!teacher) return;
    setBusyPlan(plan.code);
    setError(null);
    setInfo(null);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const result = await subscriptionApi.create(teacher.login, plan.code, returnUrl);
      if (result.confirmation_url) {
        window.location.href = result.confirmation_url;
      } else {
        setError("Не удалось получить ссылку на оплату");
        setBusyPlan(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusyPlan(null);
    }
  };

  const handleRefresh = async () => {
    setBusyPlan("__refresh__");
    await appStore.refreshSubscription();
    setBusyPlan(null);
  };

  const handleLogout = () => appStore.logout();

  const handleActivateTrial = async () => {
    setActivatingTrial(true);
    setError(null);
    const result = await appStore.activateTrial();
    if (result.ok) {
      await appStore.refreshSubscription();
    } else {
      setError(result.error);
    }
    setActivatingTrial(false);
  };

  const status = teacher?.subscriptionStatus || "none";
  const trialExpired = teacher?.trialExpired ?? false;
  const trialNeverUsed = !teacher?.trialActive && !trialExpired;
  const trialDaysLeft = daysLeft(teacher?.trialUntil);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm flex items-center justify-center"
              style={{ background: "hsl(var(--sidebar-primary))" }}>
              <Icon name="ScanLine" size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">АОУСПТ</p>
              <p className="text-xs text-muted-foreground">{teacher?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Icon name="LogOut" size={13} />
            Выйти
          </button>
        </div>

        {/* Hero */}
        <div className="border border-border rounded-sm overflow-hidden mb-6"
          style={{ background: "linear-gradient(135deg, hsl(var(--sidebar-primary)) 0%, hsl(220 50% 32%) 100%)" }}>
          <div className="p-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Crown" size={16} className="text-yellow-300" fallback="Star" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Подписка АОУСПТ</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {status === "expired" ? "Подписка истекла" : trialExpired ? "Пробный период завершён" : "Активируйте подписку"}
            </h1>
            <p className="text-sm opacity-85 max-w-xl">
              {status === "expired"
                ? `Ваша подписка закончилась ${formatDate(teacher?.subscriptionUntil ?? null)}. Продлите её, чтобы вернуть доступ.`
                : trialExpired
                ? "Ваш пробный период на 5 дней завершён. Оформите подписку, чтобы продолжить работу."
                : "Получите полный доступ ко всем разделам: работы, ученики, сканер ответов, ИИ-генератор тестов и презентаций, синхронизация с Я.Диском."}
            </p>
          </div>
        </div>

        {/* Trial — кнопка активации (если никогда не использовался) */}
        {trialNeverUsed && (
          <div className="border-2 border-green-400 rounded-sm p-5 mb-6 flex flex-col sm:flex-row items-center gap-4"
            style={{ background: "linear-gradient(135deg, hsl(142 70% 97%) 0%, hsl(160 60% 95%) 100%)" }}>
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ background: "hsl(142 70% 40%)", color: "#fff" }}>
                <Icon name="Gift" size={9} />
                Бесплатно
              </div>
              <p className="text-sm font-bold text-foreground">Пробный период — 5 дней</p>
              <p className="text-xs text-muted-foreground mt-0.5">Полный доступ · До 5 ИИ-запросов в день · Карта не нужна</p>
            </div>
            <button
              onClick={handleActivateTrial}
              disabled={activatingTrial}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "hsl(142 70% 40%)" }}
            >
              {activatingTrial ? (
                <><Icon name="Loader2" size={15} className="animate-spin" />Активируем…</>
              ) : (
                <><Icon name="Zap" size={15} />Начать пробный период</>
              )}
            </button>
          </div>
        )}

        {/* Trial — активен, показываем инфо-баннер */}
        {teacher?.trialActive && (
          <div className="border border-blue-300 bg-blue-50 rounded-sm p-4 mb-5 flex items-center gap-3">
            <Icon name="Clock" size={16} className="text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">
                Пробный период активен — ещё {trialDaysLeft} {trialDaysLeft === 1 ? "день" : "дней"}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Использовано ИИ-запросов сегодня: {teacher.trialAiCallsToday} из {teacher.trialAiLimit} · Истекает {formatDate(teacher.trialUntil ?? null)}
              </p>
            </div>
          </div>
        )}

        {/* Возврат после оплаты */}
        {returnedPaymentId && busyPlan === "__check__" && (
          <div className="border border-blue-500/30 bg-blue-500/5 rounded-sm p-4 mb-4 flex items-center gap-3">
            <Icon name="Loader2" size={16} className="text-blue-600 animate-spin" />
            <p className="text-sm text-blue-700">Проверяем оплату…</p>
          </div>
        )}
        {info && (
          <div className="border border-green-500/30 bg-green-500/5 rounded-sm p-4 mb-4 flex items-start gap-3">
            <Icon name="CircleCheck" size={16} className="text-green-600 flex-shrink-0 mt-0.5" fallback="CheckCircle" />
            <div className="flex-1">
              <p className="text-sm text-green-700 font-semibold">{info}</p>
              <button onClick={handleRefresh} className="text-xs text-green-700 underline mt-1">
                Обновить статус
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-sm p-4 mb-4 flex items-start gap-3">
            <Icon name="CircleAlert" size={16} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Согласие с офертой */}
        <label className="flex items-start gap-2.5 mb-5 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreedSub}
            onChange={e => setAgreedSub(e.target.checked)}
            className="mt-0.5 w-4 h-4 flex-shrink-0 accent-primary cursor-pointer"
          />
          <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
            Нажимая «Оформить», я принимаю условия{" "}
            <a href="/oferta" target="_blank" className="underline underline-offset-2 hover:text-primary">Договора-оферты</a>
            {" "}и даю согласие на обработку персональных данных согласно{" "}
            <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-primary">Политике конфиденциальности</a>
          </span>
        </label>

        {/* Тарифы */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {loadingPlans && (
            <div className="md:col-span-3 text-center py-10 text-sm text-muted-foreground">Загружаем тарифы…</div>
          )}
          {!loadingPlans && plans.map(plan => (
            <div
              key={plan.code}
              className={`border rounded-sm bg-white p-5 flex flex-col ${
                plan.popular ? "border-primary shadow-md" : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="inline-flex self-start items-center gap-1 px-2 py-0.5 mb-3 bg-primary text-primary-foreground text-[10px] font-bold rounded-sm uppercase tracking-wider">
                  <Icon name="Sparkles" size={10} />
                  Популярный
                </div>
              )}
              <p className="text-sm font-bold mb-1">{plan.name}</p>
              <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-4">
                <span className="text-3xl font-bold mono">{formatRub(plan.amount)}</span>
                <span className="text-xs text-muted-foreground ml-1">/ {plan.months} мес.</span>
              </div>
              <button
                onClick={() => handleBuy(plan)}
                disabled={busyPlan !== null || !available || !agreedSub}
                className={`mt-auto w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-sm transition-opacity disabled:opacity-50 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-primary text-primary hover:bg-primary/5"
                }`}
              >
                {busyPlan === plan.code ? (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <Icon name="CreditCard" size={14} />
                )}
                Оформить
              </button>
            </div>
          ))}
        </div>

        {/* Что входит */}
        <div className="border border-border rounded-sm bg-white p-5 mb-4">
          <p className="text-sm font-bold mb-3">Что включает подписка</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { icon: "ClipboardList", t: "Безлимит работ и учеников" },
              { icon: "Upload", t: "Распознавание бланков (OCR)" },
              { icon: "Sparkles", t: "ИИ-генератор тестов и контрольных" },
              { icon: "Presentation", t: "ИИ-генератор презентаций" },
              { icon: "Cloud", t: "Хранение на Яндекс.Диске" },
              { icon: "BarChart2", t: "Аналитика и шкалы оценок" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-2">
                <Icon name={f.icon} size={13} className="text-primary" fallback="Check" />
                <span>{f.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Информация о платежной системе */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          {available ? (
            <p>
              Оплата проходит через <span className="font-semibold">ЮKassa</span> · карты Visa, Mastercard, МИР, СБП
            </p>
          ) : (
            <p className="text-amber-600">
              Приём оплаты временно недоступен. Подписку может выдать администратор — обратитесь к нему.
            </p>
          )}
          <p>
            Уже оплатили? <button onClick={handleRefresh} className="underline hover:text-foreground">Обновить статус</button>
          </p>
        </div>
      </div>
      </div>
      <CompanyFooter variant="full" />
    </div>
  );
}