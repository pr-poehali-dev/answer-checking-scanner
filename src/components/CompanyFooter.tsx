import Icon from "@/components/ui/icon";

interface CompanyFooterProps {
  variant?: "full" | "compact";
  className?: string;
}

export const COMPANY_INFO = {
  fullName: "ООО «РАССВЕТ»",
  legalName: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РАССВЕТ"',
  inn: "2907011706",
  kpp: "290701001",
  ogrn: "1062907013707",
  phone: "+7 (995) 222-81-29",
  phoneLink: "+79952228129",
  email: "ooorassvet29@yandex.ru",
};

export default function CompanyFooter({
  variant = "full",
  className = "",
}: CompanyFooterProps) {
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer
        className={`border-t border-border bg-muted/30 px-6 py-3 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span>
            © {year} {COMPANY_INFO.fullName} · ИНН{" "}
            <span className="mono">{COMPANY_INFO.inn}</span> · КПП{" "}
            <span className="mono">{COMPANY_INFO.kpp}</span> · ОГРН{" "}
            <span className="mono">{COMPANY_INFO.ogrn}</span>
          </span>
          <span className="inline-flex items-center gap-3">
            <a
              href={`tel:${COMPANY_INFO.phoneLink}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Icon name="Phone" size={10} />
              {COMPANY_INFO.phone}
            </a>
            <a
              href={`mailto:${COMPANY_INFO.email}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Icon name="Mail" size={10} />
              {COMPANY_INFO.email}
            </a>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`border-t border-border bg-white ${className}`}>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid md:grid-cols-3 gap-6 mb-5">
          {/* Юр. лицо + регистрация */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center"
                style={{ background: "hsl(var(--sidebar-primary))" }}
              >
                <Icon name="ScanLine" size={13} className="text-white" />
              </div>
              <p className="text-xs font-bold">{COMPANY_INFO.fullName}</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mb-3">
              {COMPANY_INFO.legalName}
            </p>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  ИНН
                </p>
                <p className="mono font-semibold">{COMPANY_INFO.inn}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  КПП
                </p>
                <p className="mono font-semibold">{COMPANY_INFO.kpp}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  ОГРН
                </p>
                <p className="mono font-semibold">{COMPANY_INFO.ogrn}</p>
              </div>
            </div>
          </div>

          {/* Контакты */}
          <div>
            <p className="text-xs font-bold mb-2">Контакты</p>
            <div className="space-y-1.5 text-[11px]">
              <a
                href={`tel:${COMPANY_INFO.phoneLink}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="Phone" size={12} />
                <span className="mono">{COMPANY_INFO.phone}</span>
              </a>
              <br />
              <a
                href={`mailto:${COMPANY_INFO.email}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="Mail" size={12} />
                {COMPANY_INFO.email}
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <p>
            © {year} {COMPANY_INFO.fullName}. Все права защищены.
          </p>
          <p>
            АОУСПТ — Автоматизированная Обучающая Универсальная Система Проверки
            Тестов
          </p>
        </div>
      </div>
    </footer>
  );
}
