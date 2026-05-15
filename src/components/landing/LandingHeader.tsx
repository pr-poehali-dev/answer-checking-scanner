import Icon from "@/components/ui/icon";

interface LandingHeaderProps {
  onLogin: () => void;
  onRegister: () => void;
  onOuLogin?: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onScrollTo: (id: string) => void;
}

export default function LandingHeader({
  onLogin,
  onRegister,
  onOuLogin,
  menuOpen,
  onMenuToggle,
  onScrollTo,
}: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Логотип */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <img src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg" alt="САОУ" className="w-8 h-8 rounded-sm object-contain" />
          <span className="font-bold text-sm text-foreground">САОУ</span>
        </div>

        {/* Навигация десктоп */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <button onClick={() => onScrollTo("features")} className="text-muted-foreground hover:text-foreground transition-colors">Возможности</button>
          <button onClick={() => onScrollTo("how-it-works")} className="text-muted-foreground hover:text-foreground transition-colors">Как работает</button>
          <button onClick={() => onScrollTo("pricing")} className="text-muted-foreground hover:text-foreground transition-colors">Тарифы</button>
          <button onClick={() => onScrollTo("contacts")} className="text-muted-foreground hover:text-foreground transition-colors">Контакты</button>
        </nav>

        {/* Кнопки */}
        <div className="flex items-center gap-2">
          {onOuLogin && (
            <button
              onClick={onOuLogin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-semibold rounded-sm hover:bg-muted transition-colors text-muted-foreground"
            >
              <Icon name="Building2" size={13} />
              Для ОУ
            </button>
          )}
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
            onClick={onMenuToggle}
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
            <button key={id} onClick={() => onScrollTo(id)}
              className="block w-full text-left text-sm py-2 text-muted-foreground hover:text-foreground border-b border-border last:border-0">
              {label}
            </button>
          ))}
          <button onClick={onLogin} className="block w-full text-left text-sm py-2 font-semibold text-primary">
            Войти в систему
          </button>
          {onOuLogin && (
            <button onClick={onOuLogin} className="block w-full text-left text-sm py-2 font-semibold text-muted-foreground">
              Вход для образовательного учреждения
            </button>
          )}
        </div>
      )}
    </header>
  );
}
