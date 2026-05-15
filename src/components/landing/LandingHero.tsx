import Icon from "@/components/ui/icon";

interface LandingHeroProps {
  onLogin: () => void;
  onRegister: () => void;
  onTrial?: () => void;
}

export default function LandingHero({ onLogin, onRegister, onTrial }: LandingHeroProps) {
  return (
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
            САОУ экономит учителям часы ручной проверки: сканирует бланки ответов, генерирует тесты и презентации, пишет конспекты — строго по программе Минпросвещения РФ.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              onClick={onTrial || onRegister}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-sm transition-opacity hover:opacity-90"
              style={{ background: "hsl(142 70% 40%)", color: "#fff" }}
            >
              <Icon name="Gift" size={16} />
              Попробовать 5 дней бесплатно
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              <Icon name="LogIn" size={16} />
              Войти
            </button>
          </div>
          <p className="text-xs text-white/50 mt-3">
            Пробный период: 5 дней, до 5 ИИ-запросов в день. Карта не нужна.
          </p>

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
  );
}
