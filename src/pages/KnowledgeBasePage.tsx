import { useState } from "react";
import CompanyFooter from "@/components/CompanyFooter";
import Icon from "@/components/ui/icon";

interface TopicItem {
  id: string;
  label: string;
  icon: string;
}

const TOPICS: TopicItem[] = [
  { id: "start", label: "С чего начать", icon: "Rocket" },
  { id: "yadisk", label: "Подключение Яндекс.Диска", icon: "Cloud" },
  { id: "balance", label: "Баланс ИИ-токенов", icon: "Coins" },
  { id: "scan", label: "Проверка работ и сканирование", icon: "ScanLine" },
  { id: "students", label: "Ученики и привязка", icon: "Users" },
  { id: "tests", label: "Тесты и проверочные", icon: "FileText" },
  { id: "worksheets", label: "Рабочие листы", icon: "FileSpreadsheet" },
  { id: "synopsis", label: "Конспекты уроков", icon: "BookOpen" },
  { id: "presentations", label: "Презентации", icon: "Presentation" },
  { id: "exams", label: "ОГЭ / ЕГЭ и ФИПИ", icon: "GraduationCap" },
  { id: "chat", label: "Чат с ИИ", icon: "MessageSquare" },
  { id: "prompts", label: "Как правильно делать запросы", icon: "Sparkles" },
  { id: "tips", label: "Советы по созданию материала", icon: "Lightbulb" },
  { id: "student-cabinet", label: "Кабинет ученика", icon: "Backpack" },
  { id: "faq", label: "Частые вопросы", icon: "CircleHelp" },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-border rounded-lg p-5 ${className}`}>{children}</div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ background: "hsl(var(--sidebar-primary))" }}>
        {n}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold mb-0.5">{title}</p>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-relaxed"
      style={{ background: "hsl(210 80% 56% / 0.08)" }}>
      <Icon name="Lightbulb" size={15} className="flex-shrink-0 mt-0.5 text-accent" fallback="Star" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-relaxed"
      style={{ background: "hsl(38 92% 50% / 0.1)" }}>
      <Icon name="TriangleAlert" size={15} className="flex-shrink-0 mt-0.5 text-warning" fallback="AlertTriangle" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

function Example({ bad, good }: { bad: string; good: string }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-destructive">
          <Icon name="X" size={12} /> Слабый запрос
        </div>
        <p className="text-xs text-foreground/70 leading-relaxed">{bad}</p>
      </div>
      <div className="rounded-md border border-success/30 p-3" style={{ background: "hsl(142 71% 45% / 0.06)" }}>
        <div className="flex items-center gap-1.5 mb-1 text-xs font-bold" style={{ color: "hsl(142 71% 38%)" }}>
          <Icon name="Check" size={12} /> Точный запрос
        </div>
        <p className="text-xs text-foreground/70 leading-relaxed">{good}</p>
      </div>
    </div>
  );
}

function SectionBlock({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "hsl(215 60% 22% / 0.08)" }}>
          <Icon name={icon} size={18} className="text-primary" fallback="Circle" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function KnowledgeBasePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3">
        <a href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="ChevronLeft" size={14} />
          На главную
        </a>
        <span className="text-muted-foreground/40">·</span>
        <div className="flex items-center gap-2">
          <Icon name="BookMarked" size={15} className="text-primary" fallback="BookOpen" />
          <span className="text-xs font-semibold">База знаний САОУ</span>
        </div>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="lg:hidden ml-auto p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Icon name={menuOpen ? "X" : "Menu"} size={18} />
        </button>
      </header>

      {/* Hero */}
      <div className="border-b border-border" style={{ background: "linear-gradient(135deg, hsl(215 60% 22%) 0%, hsl(210 80% 40%) 100%)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">База знаний и инструкции</h1>
          <p className="text-sm opacity-85 max-w-2xl leading-relaxed">
            Всё о работе с платформой САОУ: как проверять работы, создавать тесты, рабочие листы,
            конспекты и презентации с ИИ, и как правильно формулировать запросы, чтобы получить
            качественный учебный материал.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex gap-8">
        {/* Боковая навигация */}
        <aside className={`${menuOpen ? "block" : "hidden"} lg:block fixed lg:sticky inset-0 lg:inset-auto top-0 lg:top-20 z-40 lg:z-auto lg:w-60 lg:flex-shrink-0 lg:self-start bg-white lg:bg-transparent`}>
          {menuOpen && <div className="lg:hidden absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />}
          <nav className="relative lg:max-h-[calc(100vh-6rem)] overflow-y-auto bg-white border border-border rounded-lg p-2 m-4 lg:m-0 max-w-xs lg:max-w-none">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">Содержание</p>
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => scrollTo(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors text-left"
              >
                <Icon name={t.icon} size={14} fallback="Circle" />
                <span className="flex-1">{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Контент */}
        <main className="flex-1 min-w-0 space-y-12">

          <SectionBlock id="start" icon="Rocket" title="С чего начать">
            <p className="text-sm text-muted-foreground leading-relaxed">
              САОУ — это рабочее место учителя: автоматическая проверка работ по фотографии бланка и
              набор ИИ-инструментов для подготовки материалов к урокам. Чтобы начать работать,
              выполните несколько шагов.
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Зарегистрируйтесь и войдите">
                Создайте аккаунт учителя на главной странице. Укажите имя, школу и предмет — эти данные
                подставляются в готовые материалы (тесты, бланки, рабочие листы).
              </Step>
              <Step n={2} title="Подключите Яндекс.Диск">
                Все файлы и данные хранятся в вашем личном Яндекс.Диске. Это безопасно и доступно с
                любого устройства.
              </Step>
              <Step n={3} title="Пополните баланс ИИ-токенов">
                Генерация материалов через ИИ оплачивается из баланса. Пополнить можно в любой момент
                в боковом меню.
              </Step>
              <Step n={4} title="Создайте учеников и работы">
                Добавьте список учеников, создайте работу — и можно проверять бланки или генерировать
                учебные материалы.
              </Step>
            </Card>
          </SectionBlock>

          <SectionBlock id="yadisk" icon="Cloud" title="Подключение Яндекс.Диска">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Яндекс.Диск — это хранилище всех ваших материалов. Один раз подключив его, вы получаете
              доступ к своим данным с любого компьютера или телефона.
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Откройте настройки или баннер подключения">
                После входа система предложит подключить Яндекс.Диск. Нажмите кнопку подключения.
              </Step>
              <Step n={2} title="Разрешите доступ">
                Вы перейдёте на страницу Яндекса — войдите в свой аккаунт и подтвердите доступ.
              </Step>
              <Step n={3} title="Готово — навсегда">
                Подключение сохраняется на уровне аккаунта. При входе с другого устройства Диск
                подключится автоматически, повторно подтверждать не нужно.
              </Step>
            </Card>
            <Tip>В Яндекс.Диске появится папка «АОУСПТ» — там аккуратно разложены ученики, работы,
              тесты, рабочие листы и презентации.</Tip>
          </SectionBlock>

          <SectionBlock id="balance" icon="Coins" title="Баланс ИИ-токенов">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Любая генерация через ИИ (тест, рабочий лист, конспект, презентация, чат) расходует
              средства с баланса. Стоимость зависит от объёма материала.
            </p>
            <Card className="space-y-3">
              <p className="text-sm"><span className="font-semibold">Где пополнить:</span> кнопка с балансом
                в боковом меню → выбрать сумму → оплата через ЮKassa.</p>
              <p className="text-sm"><span className="font-semibold">Списание:</span> после каждой удачной
                генерации видно, сколько списано и сколько осталось.</p>
            </Card>
            <Tip>Чем подробнее и объёмнее запрос (больше слайдов, заданий, вопросов) — тем больше
              расход. Начинайте с небольшого объёма, а затем дополняйте.</Tip>
          </SectionBlock>

          <SectionBlock id="scan" icon="ScanLine" title="Проверка работ и сканирование">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Главная функция платформы — автоматическая проверка работ учеников по фотографии бланка.
              Не нужно проверять вручную: система распознаёт ответы и выставляет оценку.
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Создайте работу">
                В разделе «Работы» укажите предмет, класс, количество заданий и ключ правильных ответов.
                Система рассчитает шкалу оценок.
              </Step>
              <Step n={2} title="Распечатайте бланки">
                Сгенерируйте бланки для учеников. На каждом есть поля для ответов и код работы.
              </Step>
              <Step n={3} title="Загрузите фото заполненных бланков">
                В разделе «Загрузка бланков» сфотографируйте или загрузите снимки. ИИ распознает ответы.
              </Step>
              <Step n={4} title="Получите результаты">
                В разделе «Результаты» — оценки по каждому ученику, статистика и проблемные задания.
              </Step>
            </Card>
            <Tip>Фотографируйте бланк ровно, при хорошем освещении, без бликов и теней — так
              распознавание будет точнее.</Tip>
          </SectionBlock>

          <SectionBlock id="students" icon="Users" title="Ученики и привязка">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Список учеников нужен для проверки работ и чтобы ученики видели свои результаты в личном
              кабинете.
            </p>
            <Card className="space-y-3">
              <p className="text-sm"><span className="font-semibold">Добавление:</span> в разделе «Ученики»
                введите ФИО и класс. Каждому присваивается код для бланков и код привязки.</p>
              <p className="text-sm"><span className="font-semibold">Привязка ученика:</span> ученик
                регистрируется сам и вводит выданный код привязки — после этого он видит свои оценки.</p>
            </Card>
          </SectionBlock>

          <SectionBlock id="tests" icon="FileText" title="Тесты и проверочные работы">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ИИ создаёт тесты, проверочные и контрольные работы по теме за минуту: формулирует вопросы,
              рассчитывает шкалу оценок и сразу добавляет работу в раздел «Работы» с готовым ключом
              ответов для сканера. Файл сохраняется в Word (.docx).
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Выберите тип работы">
                Тест, проверочная или контрольная — от короткой проверки до итогового контроля.
              </Step>
              <Step n={2} title="Заполните параметры">
                Предмет, класс, тему и описание. Укажите число тестовых вопросов (с вариантами) и
                открытых заданий.
              </Step>
              <Step n={3} title="Получите готовую работу">
                Файл скачается и сохранится на Я.Диск, а работа автоматически появится в «Работах» —
                можно сразу печатать бланки и проверять.
              </Step>
            </Card>
            <Tip>Содержание формируется по программе и материалам, утверждённым Минпросвещения РФ.</Tip>
          </SectionBlock>

          <SectionBlock id="worksheets" icon="FileSpreadsheet" title="Рабочие листы">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Рабочий лист — это раздаточный материал для урока с заданиями. ИИ подбирает материал по
              теме, при необходимости добавляет фотографии и карты, и оформляет всё в фирменный бланк
              САОУ с полями для ФИО и класса ученика.
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Укажите предмет, класс и тему">
                Добавьте описание — на чём сделать акцент и какие подтемы охватить.
              </Step>
              <Step n={2} title="Выберите число заданий">
                От 1 до 20. Включите опцию иллюстраций, если нужны фото, схемы или карты.
              </Step>
              <Step n={3} title="Скачайте готовый бланк">
                Красиво оформленный документ с окантовкой, шапкой САОУ и местом для подписи ученика.
              </Step>
            </Card>
            <Tip>Рабочий лист можно создать прямо из готового конспекта — в разделе «Конспекты» нажмите
              кнопку «Создать рабочий лист по конспекту», и поля заполнятся автоматически.</Tip>
          </SectionBlock>

          <SectionBlock id="synopsis" icon="BookOpen" title="Конспекты уроков">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ИИ готовит развёрнутый конспект урока по теме: структуру, ключевые понятия и объяснения.
              Готовый конспект можно скачать в Word, а также одним нажатием превратить в тест, рабочий
              лист или презентацию.
            </p>
            <Card className="space-y-3">
              <p className="text-sm"><span className="font-semibold">Что указать:</span> предмет, класс,
                тему и пожелания к содержанию.</p>
              <p className="text-sm"><span className="font-semibold">Что дальше:</span> из карточки
                конспекта доступны быстрые кнопки — тест, рабочий лист и презентация по той же теме.</p>
            </Card>
          </SectionBlock>

          <SectionBlock id="presentations" icon="Presentation" title="Презентации">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ИИ создаёт презентацию (PowerPoint) по теме урока: структуру слайдов, текст и
              иллюстрации. Оформление каждый раз индивидуальное и современное — единого шаблона нет,
              даже для одной темы дизайн будет разным.
            </p>
            <Card className="space-y-4">
              <Step n={1} title="Опишите тему и аудиторию">
                Укажите тему, для какого класса презентация и сколько примерно слайдов.
              </Step>
              <Step n={2} title="Дождитесь сборки">
                ИИ подберёт фотографии и соберёт файл. Обычно занимает около минуты.
              </Step>
              <Step n={3} title="Скачайте или обновите дизайн">
                Если оформление не понравилось — нажмите «Сгенерировать заново дизайн»: тот же
                материал получит новый вид без повторной оплаты.
              </Step>
            </Card>
          </SectionBlock>

          <SectionBlock id="exams" icon="GraduationCap" title="ОГЭ / ЕГЭ и варианты ФИПИ">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Раздел для подготовки к экзаменам. ИИ собирает тренировочные варианты по структуре ФИПИ,
              а также доступны готовые варианты без участия ИИ.
            </p>
            <Card className="space-y-3">
              <p className="text-sm"><span className="font-semibold">ОГЭ / ЕГЭ:</span> ИИ генерирует
                варианты по выбранному предмету и теме по образцу ФИПИ.</p>
              <p className="text-sm"><span className="font-semibold">Экзамены ФИПИ:</span> готовые
                варианты без расхода токенов — можно сразу использовать.</p>
            </Card>
          </SectionBlock>

          <SectionBlock id="chat" icon="MessageSquare" title="Чат с ИИ">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Чат — это помощник-ассистент для учителя и ученика. Спросите объяснение темы, попросите
              идеи для урока, помощь с формулировками или разбор задачи.
            </p>
            <Tip>Чат отвечает на вопросы и помогает в обсуждении. Для готовых файлов (тестов, листов,
              презентаций) используйте профильные разделы — там результат оформляется в документ.</Tip>
          </SectionBlock>

          <SectionBlock id="prompts" icon="Sparkles" title="Как правильно делать запросы к ИИ">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Качество материала напрямую зависит от того, насколько точно вы описали задачу. Чем
              конкретнее запрос — тем лучше результат. Используйте простое правило: <span className="font-semibold text-foreground">тема + класс + что именно нужно + акценты</span>.
            </p>

            <Card className="space-y-4">
              <p className="text-sm font-semibold">Из чего складывается хороший запрос:</p>
              <div className="space-y-2.5">
                {[
                  ["Конкретная тема", "Не «дроби», а «Сложение и вычитание обыкновенных дробей с разными знаменателями»."],
                  ["Класс / уровень", "Укажите класс — материал подстроится под возраст и сложность."],
                  ["Что именно нужно", "Сколько заданий или слайдов, какого типа (тест, задачи, заполнить пропуски)."],
                  ["Акценты в описании", "На что сделать упор, какие подтемы охватить, какой уровень сложности."],
                ].map(([t, d]) => (
                  <div key={t} className="flex items-start gap-2.5">
                    <Icon name="Check" size={15} className="flex-shrink-0 mt-0.5" style={{ color: "hsl(142 71% 45%)" }} />
                    <p className="text-sm"><span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span></p>
                  </div>
                ))}
              </div>
            </Card>

            <p className="text-sm font-semibold mt-4 mb-1">Примеры: было → стало</p>
            <Example
              bad="Тест по биологии"
              good="Тест по биологии, 7 класс, тема «Строение растительной клетки». 10 вопросов с вариантами и 2 открытых, упор на функции органоидов."
            />
            <Example
              bad="Презентация про войну"
              good="Презентация по истории, 9 класс, «Основные сражения Великой Отечественной войны 1941–1945». 10–12 слайдов, с картами и датами."
            />
            <Example
              bad="Рабочий лист математика"
              good="Рабочий лист по математике, 5 класс, «Десятичные дроби». 6 заданий: задачи на сравнение, округление и действия, с иллюстрациями."
            />

            <Warn>Не пишите слишком общо («сделай что-нибудь по теме»). ИИ заполнит пробелы на своё
              усмотрение, и материал может оказаться не таким, как вы ожидали.</Warn>
          </SectionBlock>

          <SectionBlock id="tips" icon="Lightbulb" title="Советы по созданию материала">
            <Card className="space-y-3">
              {[
                ["Начинайте с конспекта", "Сначала сделайте конспект по теме, а из него — тест, рабочий лист и презентацию. Так материалы будут согласованы между собой."],
                ["Дробите большие темы", "Большую тему лучше разбить на несколько материалов поменьше — результат получается точнее и полезнее."],
                ["Проверяйте перед уроком", "ИИ готовит материал по программе РФ, но всегда просматривайте результат: при необходимости поправьте формулировки под свой класс."],
                ["Указывайте предмет и класс везде", "Эти данные сильно влияют на сложность и подачу — не пропускайте их."],
                ["Используйте описание", "Поле «Описание/акцент» — самое мощное: именно здесь вы направляете ИИ на нужные подтемы и уровень."],
                ["Повторяйте генерацию", "Если результат не идеален — измените формулировку и сгенерируйте снова. Часто одна уточняющая фраза решает всё."],
              ].map(([t, d]) => (
                <div key={t} className="flex items-start gap-2.5">
                  <Icon name="Sparkles" size={15} className="flex-shrink-0 mt-0.5 text-accent" fallback="Star" />
                  <p className="text-sm"><span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span></p>
                </div>
              ))}
            </Card>
          </SectionBlock>

          <SectionBlock id="student-cabinet" icon="Backpack" title="Кабинет ученика">
            <p className="text-sm text-muted-foreground leading-relaxed">
              У ученика свой личный кабинет. После привязки к учителю он видит свои результаты и
              получает доступ к учебным материалам.
            </p>
            <Card className="space-y-3">
              <p className="text-sm"><span className="font-semibold">Мои результаты:</span> оценки по
                проверенным работам с разбором.</p>
              <p className="text-sm"><span className="font-semibold">Презентации учителя:</span>
                материалы к урокам, подготовленные преподавателем.</p>
              <p className="text-sm"><span className="font-semibold">Тренировочные тесты, конспекты,
                ОГЭ/ЕГЭ:</span> инструменты для самостоятельной подготовки.</p>
              <p className="text-sm"><span className="font-semibold">Чат с ИИ:</span> помощь в учёбе и
                объяснение тем.</p>
            </Card>
          </SectionBlock>

          <SectionBlock id="faq" icon="CircleHelp" title="Частые вопросы">
            <Card className="space-y-4">
              {[
                ["Где хранятся мои файлы?", "В вашем личном Яндекс.Диске, в папке «АОУСПТ». Платформа не хранит их у себя."],
                ["Почему генерация платная?", "ИИ-генерация расходует вычислительные ресурсы. Оплата идёт из баланса токенов, который вы пополняете."],
                ["Можно ли работать с телефона?", "Да. Платформа адаптирована под мобильные устройства, а Яндекс.Диск подключается на любом устройстве автоматически."],
                ["Материал получился не идеальным — что делать?", "Уточните запрос (тема, класс, акценты в описании) и сгенерируйте заново. Перед уроком всегда просматривайте результат."],
                ["По какой программе создаётся материал?", "По действующей программе и материалам, утверждённым Министерством просвещения РФ (ФГОС)."],
              ].map(([q, a]) => (
                <div key={q}>
                  <p className="text-sm font-semibold mb-0.5">{q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </Card>
            <div className="rounded-lg border border-border bg-white p-5 text-center">
              <Icon name="Headphones" size={22} className="mx-auto mb-2 text-primary" />
              <p className="text-sm font-semibold mb-1">Не нашли ответ?</p>
              <p className="text-sm text-muted-foreground mb-3">
                Напишите в техническую поддержку прямо из личного кабинета — раздел «Тех. поддержка».
              </p>
              <a href="/" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "hsl(var(--sidebar-primary))" }}>
                <Icon name="LogIn" size={14} />
                Войти в кабинет
              </a>
            </div>
          </SectionBlock>

        </main>
      </div>

      <CompanyFooter variant="full" />
    </div>
  );
}
