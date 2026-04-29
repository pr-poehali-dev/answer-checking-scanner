import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { COMPANY_INFO } from "@/components/CompanyFooter";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/api";

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

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

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    subscriptionApi.plans()
      .then(d => setPlans(d.plans))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── НАВИГАЦИЯ ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Логотип */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-sm flex items-center justify-center"
              style={{ background: "hsl(var(--sidebar-primary))" }}>
              <Icon name="ScanLine" size={16} className="text-white" />
            </div>
            <span className="font-bold text-sm text-foreground">АОУСПТ</span>
          </div>

          {/* Навигация десктоп */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button onClick={() => scrollTo("features")} className="text-muted-foreground hover:text-foreground transition-colors">Возможности</button>
            <button onClick={() => scrollTo("how-it-works")} className="text-muted-foreground hover:text-foreground transition-colors">Как работает</button>
            <button onClick={() => scrollTo("pricing")} className="text-muted-foreground hover:text-foreground transition-colors">Тарифы</button>
            <button onClick={() => scrollTo("contacts")} className="text-muted-foreground hover:text-foreground transition-colors">Контакты</button>
          </nav>

          {/* Кнопки */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-semibold rounded-sm hover:bg-muted transition-colors"
            >
              <Icon name="LogIn" size={14} />
              Войти
            </button>
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "hsl(var(--sidebar-primary))" }}
            >
              <Icon name="UserPlus" size={14} />
              <span className="hidden sm:inline">Регистрация</span>
              <span className="sm:hidden">Войти</span>
            </button>
            {/* Мобильное меню */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            >
              <Icon name={menuOpen ? "X" : "Menu"} size={18} />
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-2">
            {[["features","Возможности"],["how-it-works","Как работает"],["pricing","Тарифы"],["contacts","Контакты"]].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="block w-full text-left text-sm py-2 text-muted-foreground hover:text-foreground border-b border-border last:border-0">
                {label}
              </button>
            ))}
            <button onClick={onLogin} className="block w-full text-left text-sm py-2 font-semibold text-primary">
              Войти в систему
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(215 60% 16%) 0%, hsl(220 55% 26%) 50%, hsl(215 45% 20%) 100%)" }}>
        {/* Декоративные элементы */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: "hsl(210 80% 56%)" }} />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10"
            style={{ background: "hsl(160 60% 40%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
            style={{ background: "hsl(210 80% 56%)" }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border border-white/20 bg-white/10 backdrop-blur-sm">
              <Icon name="Sparkles" size={13} className="text-yellow-300" />
              <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">ИИ-система для учителей</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              Автоматизируйте проверку работ и создание материалов
            </h1>
            <p className="text-base sm:text-lg text-white/75 mb-8 leading-relaxed max-w-2xl">
              АОУСПТ экономит учителям часы ручной проверки: сканирует бланки ответов, генерирует тесты и презентации, пишет конспекты — строго по программе Минпросвещения РФ.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onRegister}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-sm transition-opacity hover:opacity-90"
                style={{ background: "hsl(210 80% 56%)", color: "#fff" }}
              >
                <Icon name="Zap" size={16} />
                Начать бесплатно
              </button>
              <button
                onClick={() => scrollTo("how-it-works")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                <Icon name="PlayCircle" size={16} />
                Как это работает
              </button>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-white/15">
              {[
                { value: "100+", label: "учителей используют" },
                { value: "5 мин", label: "проверка целого класса" },
                { value: "ФГОС", label: "строгое соответствие" },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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

      {/* ── ФУТЕР ─────────────────────────────────────────────────────────── */}
      <footer id="contacts" className="bg-white border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Бренд */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-sm flex items-center justify-center"
                  style={{ background: "hsl(var(--sidebar-primary))" }}>
                  <Icon name="ScanLine" size={14} className="text-white" />
                </div>
                <span className="font-bold text-sm">АОУСПТ</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Система автоматической проверки работ и генерации учебных материалов для учителей.
              </p>
            </div>

            {/* Навигация */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3">Система</p>
              <div className="space-y-2">
                {[["features","Возможности"],["how-it-works","Как работает"],["pricing","Тарифы"]].map(([id, label]) => (
                  <button key={id} onClick={() => scrollTo(id)}
                    className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Аккаунт */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3">Аккаунт</p>
              <div className="space-y-2">
                <button onClick={onLogin} className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Войти</button>
                <button onClick={onRegister} className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Регистрация</button>
                <a href="/oferta" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Договор-оферта</a>
                <a href="/privacy" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Конфиденциальность</a>
              </div>
            </div>

            {/* Контакты */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3">Контакты</p>
              <div className="space-y-2">
                <a href={`tel:${COMPANY_INFO.phoneLink}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="Phone" size={11} />
                  {COMPANY_INFO.phone}
                </a>
                <a href={`mailto:${COMPANY_INFO.email}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="Mail" size={11} />
                  {COMPANY_INFO.email}
                </a>
              </div>
            </div>
          </div>

          {/* Юридическая информация */}
          <div className="border-t border-border pt-6">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground mb-2">
              <span className="font-semibold">{COMPANY_INFO.fullName}</span>
              <span>ИНН: <span className="mono">{COMPANY_INFO.inn}</span></span>
              <span>КПП: <span className="mono">{COMPANY_INFO.kpp}</span></span>
              <span>ОГРН: <span className="mono">{COMPANY_INFO.ogrn}</span></span>
            </div>
            <p className="text-[11px] text-muted-foreground">{COMPANY_INFO.legalName}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              © {new Date().getFullYear()} {COMPANY_INFO.fullName}. Все права защищены. Платежи через ЮKassa.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
