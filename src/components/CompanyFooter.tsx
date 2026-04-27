import Icon from "@/components/ui/icon";

interface CompanyFooterProps {
  variant?: "full" | "compact";
  className?: string;
}

export const COMPANY_INFO = {
  fullName: "ООО «РАССВЕТ»",
  shortName: "АОУСПТ",
  inn: "0000000000",
  kpp: "000000000",
  ogrn: "0000000000000",
  address: "г. Москва, ул. Примерная, д. 1, офис 1",
  phone: "+7 (000) 000-00-00",
  email: "info@aousp.ru",
  site: "aousp.ru",
  bankName: "—",
  bankAccount: "—",
  bankBik: "—",
  bankCorrAccount: "—",
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
            © {year} {COMPANY_INFO.fullName} · ИНН {COMPANY_INFO.inn} · ОГРН{" "}
            {COMPANY_INFO.ogrn}
          </span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Icon name="Phone" size={10} />
              {COMPANY_INFO.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Mail" size={10} />
              {COMPANY_INFO.email}
            </span>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`border-t border-border bg-white ${className}`}>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid md:grid-cols-3 gap-6 mb-5">
          {/* Реквизиты */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center"
                style={{ background: "hsl(var(--sidebar-primary))" }}
              >
                <Icon name="ScanLine" size={13} className="text-white" />
              </div>
              <p className="text-xs font-bold">{COMPANY_INFO.fullName}</p>
            </div>
            <div className="space-y-0.5 text-[11px] text-muted-foreground leading-relaxed">
              <p>
                ИНН:{" "}
                <span className="mono text-foreground">{COMPANY_INFO.inn}</span>
              </p>
              <p>
                КПП:{" "}
                <span className="mono text-foreground">{COMPANY_INFO.kpp}</span>
              </p>
              <p>
                ОГРН:{" "}
                <span className="mono text-foreground">
                  {COMPANY_INFO.ogrn}
                </span>
              </p>
              <p className="pt-1 flex items-start gap-1">
                <Icon
                  name="MapPin"
                  size={11}
                  className="mt-0.5 flex-shrink-0"
                />
                <span>{COMPANY_INFO.address}</span>
              </p>
            </div>
          </div>

          {/* Контакты */}
          <div>
            <p className="text-xs font-bold mb-2">Контакты</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p className="inline-flex items-center gap-1.5">
                <Icon name="Phone" size={11} />
                <a
                  href={`tel:${COMPANY_INFO.phone.replace(/\s/g, "")}`}
                  className="hover:text-foreground"
                >
                  {COMPANY_INFO.phone}
                </a>
              </p>
              <p className="inline-flex items-center gap-1.5">
                <Icon name="Mail" size={11} />
                <a
                  href={`mailto:${COMPANY_INFO.email}`}
                  className="hover:text-foreground"
                >
                  {COMPANY_INFO.email}
                </a>
              </p>
              <p className="inline-flex items-center gap-1.5">
                <Icon name="Globe" size={11} />
                <a
                  href={`https://${COMPANY_INFO.site}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  {COMPANY_INFO.site}
                </a>
              </p>
            </div>
          </div>

          {/* Банковские реквизиты */}
          <div>
            <p className="text-xs font-bold mb-2">Банковские реквизиты</p>
            <div className="space-y-0.5 text-[11px] text-muted-foreground leading-relaxed">
              <p>
                Банк:{" "}
                <span className="text-foreground">{COMPANY_INFO.bankName}</span>
              </p>
              <p>
                Р/с:{" "}
                <span className="mono text-foreground">
                  {COMPANY_INFO.bankAccount}
                </span>
              </p>
              <p>
                К/с:{" "}
                <span className="mono text-foreground">
                  {COMPANY_INFO.bankCorrAccount}
                </span>
              </p>
              <p>
                БИК:{" "}
                <span className="mono text-foreground">
                  {COMPANY_INFO.bankBik}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <p>
            © {year} {COMPANY_INFO.fullName}. Все права защищены.
          </p>
          <p className="inline-flex items-center gap-3">
            <span>Платежи через ЮKassa</span>
            <span>·</span>
            <a href="#" className="hover:text-foreground">
              Договор-оферта
            </a>
            <span>·</span>
            <a href="#" className="hover:text-foreground">
              Политика конфиденциальности
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
