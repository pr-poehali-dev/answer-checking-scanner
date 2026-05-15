import Icon from "@/components/ui/icon";
import { type SubscriptionPlan } from "@/lib/api";

const FEATURES = [
  {
    icon: "ScanLine",
    title: "Сканер бланков ответов",
    desc: "Загружайте фотографии бланков — ИИ мгновенно распознаёт ответы, сравнивает с ключом и выставляет оценки. Экономия часов ручной проверки.",
    color: "hsl(215 60% 22%)",
  },
  {
    icon: "Sparkles",
    title: "ИИ-генератор тестов",
    desc: "Укажите тему и класс — система составит тест, проверочную или контрольную работу с ответами, шкалой оценок и готовым файлом .docx.",
    color: "hsl(160 60% 25%)",
  },
  {
    icon: "Presentation",
    title: "Презентации за минуты",
    desc: "ИИ создаёт полноценные .pptx-презентации по теме урока строго по программе Минпросвещения РФ и ФГОС, с фотографиями и структурой.",
    color: "hsl(215 50% 35%)",
  },
  {
    icon: "BookOpen",
    title: "Конспекты уроков",
    desc: "Развёрнутые конспекты от 2 до 4 страниц по официальной учебной программе. Укажите предмет, класс и тему — ИИ напишет за 5–7 минут.",
    color: "hsl(25 60% 30%)",
  },
  {
    icon: "Users",
    title: "Журнал учеников",
    desc: "Ведите список класса с кодами учеников. Все результаты привязываются к конкретным ученикам автоматически при сканировании.",
    color: "hsl(270 50% 35%)",
  },
  {
    icon: "Cloud",
    title: "Синхронизация с Я.Диском",
    desc: "Все данные — ученики, работы, результаты, презентации — автоматически сохраняются на ваш личный Яндекс.Диск. Данные только у вас.",
    color: "hsl(197 71% 35%)",
  },
];

const HOW_TO = [
  { step: "01", title: "Создайте работу", desc: "Добавьте работу вручную или сгенерируйте тест через ИИ — с ответами и шкалой оценок." },
  { step: "02", title: "Раздайте бланки ученикам", desc: "Распечатайте бланки ответов прямо из системы. Каждый бланк содержит код ученика." },
  { step: "03", title: "Сфотографируйте бланки", desc: "После проверки просто сфотографируйте заполненные бланки — качество обычной камеры телефона." },
  { step: "04", title: "Загрузите и получите результаты", desc: "Загрузите фото в систему. ИИ распознает ответы, сопоставит с ключом и покажет итоги по каждому ученику." },
];

function formatRub(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

interface LandingContentProps {
  onLogin: () => void;
  onRegister: () => void;
  onTrial?: () => void;
  plans: SubscriptionPlan[];
  loadingPlans: boolean;
  onScrollTo: (id: string) => void;
}

export default function LandingContent({
  onLogin,
  onRegister,
  onTrial,
  plans,
  loadingPlans,
  onScrollTo,
}: LandingContentProps) {
  return (
    <>
      {/* ── ВОЗМОЖНОСТИ ───────────────────────────────────────────────────── */}
      <section id="features" className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(215 60% 22%)" }}>Возможности системы</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Всё что нужно учителю — в одном месте</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              От проверки бланков до генерации контента — АОУСПТ автоматизирует рутину, оставляя время на живое общение с учениками.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title}
                className="group border border-border rounded-sm p-6 hover:shadow-md transition-shadow bg-white">
                <div className="w-11 h-11 rounded-sm flex items-center justify-center mb-4 flex-shrink-0"
                  style={{ background: f.color + "15" }}>
                  <Icon name={f.icon} size={20} style={{ color: f.color }} fallback="Star" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── КАК ЭТО РАБОТАЕТ ──────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 md:py-20"
        style={{ background: "hsl(210 20% 97%)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(215 60% 22%)" }}>Простой процесс</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как работает проверка бланков</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Весь цикл — от создания работы до итогов — занимает минуты, а не часы.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_TO.map((h, i) => (
              <div key={h.step} className="relative">
                {i < HOW_TO.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-border -translate-y-0.5 z-0" style={{ width: "calc(100% - 2.5rem)", left: "calc(100% - 1.25rem)" }} />
                )}
                <div className="relative bg-white border border-border rounded-sm p-5 z-10">
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center mb-4 font-bold text-sm"
                    style={{ background: "hsl(215 60% 22%)", color: "#fff" }}>
                    {h.step}
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">{h.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ИИ-инструменты */}
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { icon: "Sparkles", title: "Генератор тестов", desc: "Тесты, проверочные и контрольные с вопросами, ответами и шкалой оценок. Файл .docx готов к печати." },
              { icon: "Presentation", title: "Генератор презентаций", desc: "Красивые .pptx по теме урока с фотографиями, структурой и содержанием по ФГОС." },
              { icon: "BookOpen", title: "Генератор конспектов", desc: "Полные конспекты 2–4 страницы по программе Минпросвещения РФ. Кнопкой «Создать презентацию» — сразу в .pptx." },
            ].map(t => (
              <div key={t.title} className="border border-border rounded-sm p-5 bg-white">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{ background: "hsl(215 60% 22%)", color: "#fff" }}>
                    <Icon name={t.icon} size={15} className="text-white" fallback="Star" />
                  </div>
                  <p className="text-sm font-bold">{t.title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ТАРИФЫ ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(215 60% 22%)" }}>Тарифы</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Выберите подходящий план</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Все функции доступны на любом тарифе. Разница — только в длительности подписки.
            </p>
          </div>

          {/* Trial-карточка */}
          <div className="max-w-4xl mx-auto mb-6">
            <div className="border-2 border-green-400 rounded-sm p-6 flex flex-col sm:flex-row items-center gap-5"
              style={{ background: "linear-gradient(135deg, hsl(142 70% 96%) 0%, hsl(160 60% 94%) 100%)" }}>
              <div className="w-14 h-14 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(142 70% 40%)" }}>
                <Icon name="Gift" size={26} className="text-white" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ background: "hsl(142 70% 40%)", color: "#fff" }}>
                  <Icon name="Clock" size={9} />
                  Бесплатно
                </div>
                <p className="text-base font-bold text-foreground">Пробный период — 5 дней</p>
                <p className="text-xs text-muted-foreground mt-0.5">Полный доступ ко всем разделам · До 5 ИИ-запросов в день · Карта не нужна · Без обязательств</p>
              </div>
              <button
                onClick={onTrial || onRegister}
                className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "hsl(142 70% 40%)" }}
              >
                <Icon name="Zap" size={15} />
                Начать пробный период
              </button>
            </div>
          </div>

          {loadingPlans ? (
            <div className="text-center py-12">
              <Icon name="Loader2" size={24} className="mx-auto animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Загружаем тарифы…</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Тарифы временно недоступны</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {plans.map(plan => (
                <div key={plan.code}
                  className={`relative border rounded-sm bg-white p-6 flex flex-col ${plan.popular ? "border-primary shadow-lg" : "border-border"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-[11px] font-bold rounded-full uppercase tracking-wider">
                      <Icon name="Sparkles" size={10} />
                      Популярный
                    </div>
                  )}
                  <p className="text-base font-bold text-foreground mb-1">{plan.name}</p>
                  <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-foreground">{formatRub(plan.amount)}</span>
                    <span className="text-xs text-muted-foreground ml-1">/ {plan.months === 1 ? "месяц" : `${plan.months} мес.`}</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {["Сканер бланков ответов", "ИИ-генератор тестов", "ИИ-презентации и конспекты", "Синхронизация с Я.Диском", "Журнал учеников и результатов"].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                        <Icon name="Check" size={13} className="text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onRegister}
                    className={`w-full py-2.5 text-sm font-bold rounded-sm transition-opacity hover:opacity-90 ${
                      plan.popular
                        ? "text-white"
                        : "border border-primary text-primary hover:bg-primary hover:text-white"
                    }`}
                    style={plan.popular ? { background: "hsl(var(--sidebar-primary))" } : {}}
                  >
                    Оформить подписку
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            Оплата через ЮKassa. После регистрации вы попадёте на страницу оформления подписки.
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20"
        style={{ background: "linear-gradient(135deg, hsl(215 60% 16%) 0%, hsl(220 55% 26%) 100%)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Icon name="ScanLine" size={36} className="mx-auto mb-4 text-white/60" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Начните экономить время уже сегодня
          </h2>
          <p className="text-white/70 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Зарегистрируйтесь за минуту и получите доступ ко всем инструментам для учителей.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-sm hover:opacity-90 transition-opacity"
              style={{ background: "hsl(210 80% 56%)", color: "#fff" }}
            >
              <Icon name="UserPlus" size={16} />
              Зарегистрироваться
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              <Icon name="LogIn" size={16} />
              Уже есть аккаунт
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
