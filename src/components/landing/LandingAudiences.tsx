import Icon from "@/components/ui/icon";

interface LandingAudiencesProps {
  onRegister: () => void;
}

const TEACHER_FEATURES = [
  { icon: "ScanLine", text: "Сканер бланков — проверка класса за 5 минут" },
  { icon: "Sparkles", text: "Генерация тестов и контрольных с ответами" },
  { icon: "Presentation", text: "Презентации .pptx и конспекты по ФГОС" },
  { icon: "Users", text: "Журнал учеников и автоматический подсчёт оценок" },
];

const STUDENT_FEATURES = [
  { icon: "GraduationCap", text: "Подготовка к ОГЭ и ЕГЭ по вариантам ФИПИ" },
  { icon: "FileText", text: "Тренировочные тесты по любым темам" },
  { icon: "MessageSquare", text: "ИИ-помощник: объяснит тему и решит задачу" },
  { icon: "BookOpen", text: "Конспекты и материалы для самостоятельной учёбы" },
];

export default function LandingAudiences({ onRegister }: LandingAudiencesProps) {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Кому подходит САОУ</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Одна платформа — два личных кабинета. Выберите свою роль при регистрации.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Учителям */}
          <div className="rounded-xl border border-border bg-white p-7 md:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5"
              style={{ background: "hsl(160 60% 40% / 0.12)" }}>
              <Icon name="GraduationCap" size={24} style={{ color: "hsl(160 60% 35%)" }} />
            </div>
            <h3 className="text-xl font-bold mb-2">Учителям и преподавателям</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Автоматизируйте рутину: проверку работ, подготовку материалов и ведение журнала.
            </p>
            <ul className="space-y-3 mb-7 flex-1">
              {TEACHER_FEATURES.map(f => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "hsl(160 60% 40% / 0.1)" }}>
                    <Icon name={f.icon} size={14} style={{ color: "hsl(160 60% 35%)" }} fallback="Check" />
                  </div>
                  <span className="text-sm text-foreground/85">{f.text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onRegister}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "hsl(160 60% 35%)" }}
            >
              Зарегистрироваться как учитель
              <Icon name="ArrowRight" size={15} />
            </button>
          </div>

          {/* Ученикам */}
          <div className="rounded-xl border border-border bg-white p-7 md:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5"
              style={{ background: "hsl(210 80% 56% / 0.12)" }}>
              <Icon name="Backpack" size={24} style={{ color: "hsl(210 80% 50%)" }} fallback="User" />
            </div>
            <h3 className="text-xl font-bold mb-2">Ученикам и студентам</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Готовьтесь к экзаменам, тренируйтесь на тестах и учитесь с персональным ИИ-помощником.
            </p>
            <ul className="space-y-3 mb-7 flex-1">
              {STUDENT_FEATURES.map(f => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "hsl(210 80% 56% / 0.1)" }}>
                    <Icon name={f.icon} size={14} style={{ color: "hsl(210 80% 50%)" }} fallback="Check" />
                  </div>
                  <span className="text-sm text-foreground/85">{f.text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onRegister}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "hsl(210 80% 50%)" }}
            >
              Зарегистрироваться как ученик
              <Icon name="ArrowRight" size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
