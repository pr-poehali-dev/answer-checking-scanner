import Icon from "@/components/ui/icon";
import { COMPANY_INFO } from "@/components/CompanyFooter";

interface LandingFooterProps {
  onLogin: () => void;
  onRegister: () => void;
  onScrollTo: (id: string) => void;
}

export default function LandingFooter({ onLogin, onRegister, onScrollTo }: LandingFooterProps) {
  return (
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
              <span className="font-bold text-sm">САОУ</span>
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
                <button key={id} onClick={() => onScrollTo(id)}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </button>
              ))}
              <a href="/knowledge-base" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">База знаний</a>
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
  );
}