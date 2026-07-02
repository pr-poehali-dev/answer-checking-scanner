import CompanyFooter from "@/components/CompanyFooter";
import Icon from "@/components/ui/icon";

export default function OfertaPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-white px-6 py-4 flex items-center gap-3">
        <a href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="ChevronLeft" size={14} />
          На главную
        </a>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-xs font-semibold">Оферта</span>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold mb-1">Оферта о предоставлении услуг</h1>
          <p className="text-xs text-muted-foreground mb-8">
            ООО «Компания «Немзор» · ИНН 2907019688 · КПП 290701001 · ОГРН 1262900002947
          </p>

          <Section title="1. Общие положения">
            <p>1.1. Настоящая оферта является публичным предложением (офертой) ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «КОМПАНИЯ «НЕМЗОР», далее — «Исполнитель», заключить договор оказания услуг с любым физическим или юридическим лицом, далее — «Заказчик», принявшим условия данной оферты.</p>
            <p>1.2. Оферта действует бессрочно и может быть отозвана Исполнителем в любой момент.</p>
          </Section>

          <Section title="2. Предмет договора">
            <p>2.1. Исполнитель обязуется предоставить Заказчику доступ к следующим услугам:</p>
            <ul>
              <li>САОУ пакет — доступ ко всем функциям раздела сайта (Искл. Административные панели)
Даёт доступ к функциям ИИ, только после пополнения баланса для ИИ-токенов. </li>
            </ul>
          </Section>

          <Section title="3. Порядок акцепта оферты">
            <p>3.1. Акцептом оферты является:</p>
            <ul>
              <li>Регистрация на сайте</li>
              <li>Выбор тарифного плана</li>
              <li>Оплата услуг</li>
            </ul>
          </Section>

          <Section title="4. Стоимость и порядок оплаты">
            <p>4.1. Стоимость услуг определяется в соответствии с выбранным тарифным планом. И доплачивается любая сумма для работы с ИИ функционалом.</p>
            <p>4.2. Оплата производится:</p>
            <ul>
              <li>Банковской картой</li>
              <li>Электронными деньгами</li>
              <li>Через платёжные системы</li>
            </ul>
            <p>4.3. Оплата производится ежемесячно / ежеквартально / ежегодно (в зависимости от выбранного тарифа).

  </p>
          </Section>

          <Section title="5. Права и обязанности сторон">
            <p>5.1. Исполнитель обязуется:</p>
            <ul>
              <li>Обеспечить доступ к услугам</li>
              <li>Поддерживать работоспособность сервиса</li>
              <li>Обновлять функционал</li>
            </ul>
            <p>5.2. Заказчик обязуется:</p>
            <ul>
              <li>Предоставить достоверную информацию</li>
              <li>Своевременно оплачивать услуги</li>
              <li>Соблюдать правила использования сервиса</li>
            </ul>
          </Section>

          <Section title="6. Срок действия и расторжение">
            <p>6.1. Договор вступает в силу с момента оплаты и действует до момента прекращения подписки.</p>
            <p>6.2. Заказчик вправе расторгнуть договор в любой момент.</p>
          </Section>

          <Section title="7. Ответственность сторон">
            <p>7.1. Исполнитель не несёт ответственности за:</p>
            <ul>
              <li>Технические сбои</li>
              <li>Действия третьих лиц</li>
              <li>Непреодолимую силу</li>
            </ul>
          </Section>

          <Section title="8. Заключительные положения">
            <p>8.1. Все споры разрешаются в соответствии с действующим законодательством.</p>
            <p>8.2. Изменения в оферту вносятся Исполнителем в одностороннем порядке.</p>
          </Section>
        </div>
      </main>

      <CompanyFooter variant="full" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold mb-3 pb-2 border-b border-border">{title}</h2>
      <div className="space-y-2 text-sm text-foreground leading-relaxed [&_ul]:mt-1 [&_ul]:ml-4 [&_ul]:space-y-1 [&_ul]:list-disc [&_ul]:text-muted-foreground">
        {children}
      </div>
    </section>
  );
}