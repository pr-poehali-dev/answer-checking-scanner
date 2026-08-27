import Icon from "@/components/ui/icon";
import VkLoginButton from "@/components/login/VkLoginButton";

interface SignupFormPanelProps {
  signupRole: "teacher" | "student";
  setSignupRole: (v: "teacher" | "student") => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  studyGroup: string;
  setStudyGroup: (v: string) => void;
  generatedLogin: string;
  signupPass: string;
  setSignupPass: (v: string) => void;
  showSignupPass: boolean;
  setShowSignupPass: (v: boolean | ((prev: boolean) => boolean)) => void;
  agreedReg: boolean;
  setAgreedReg: (v: boolean) => void;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SignupFormPanel({
  signupRole,
  setSignupRole,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  studyGroup,
  setStudyGroup,
  generatedLogin,
  signupPass,
  setSignupPass,
  showSignupPass,
  setShowSignupPass,
  agreedReg,
  setAgreedReg,
  error,
  loading,
  onSubmit,
}: SignupFormPanelProps) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-3">
      {/* Выбор роли */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Кто вы?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSignupRole("teacher")}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-sm font-medium transition-colors ${
              signupRole === "teacher" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Icon name="GraduationCap" size={16} className={signupRole === "teacher" ? "text-primary" : ""} />
            Учитель
          </button>
          <button
            type="button"
            onClick={() => setSignupRole("student")}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-sm font-medium transition-colors ${
              signupRole === "student" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Icon name="Backpack" size={16} className={signupRole === "student" ? "text-primary" : ""} fallback="User" />
            Ученик / студент
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Имя</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Иван"
            className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Фамилия</label>
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Иванов"
            className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Email</label>
        <div className="relative">
          <Icon name="Mail" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ivanov@school.ru"
            autoComplete="email"
            className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {signupRole === "student" && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Класс / группа <span className="opacity-60">(необязательно)</span></label>
          <div className="relative">
            <Icon name="Users" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={studyGroup}
              onChange={e => setStudyGroup(e.target.value)}
              placeholder="11А или ИС-21"
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Логин (автогенерация) */}
      <div className="p-3 border border-dashed border-border rounded-sm bg-muted/30 flex items-center gap-2">
        <Icon name="UserCheck" size={14} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ваш логин</p>
          <p className="mono text-sm font-semibold truncate">{generatedLogin}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">сгенерирован автоматически</span>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Пароль</label>
        <div className="relative">
          <Icon name="Lock" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showSignupPass ? "text" : "password"}
            value={signupPass}
            onChange={e => setSignupPass(e.target.value)}
            placeholder="Не менее 6 символов"
            autoComplete="new-password"
            className="w-full pl-9 pr-10 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowSignupPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={showSignupPass ? "EyeOff" : "Eye"} size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        После регистрации потребуется оформить подписку <span className="font-semibold">САОУ</span> для доступа к разделам системы.
      </p>

      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={agreedReg}
          onChange={e => setAgreedReg(e.target.checked)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 accent-primary cursor-pointer"
        />
        <span className="text-[11px] text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
          Я принимаю условия{" "}
          <a href="/oferta" target="_blank" className="underline underline-offset-2 hover:text-primary">Договора-оферты</a>,
          {" "}ознакомлен с{" "}
          <a href="/docs" target="_blank" className="underline underline-offset-2 hover:text-primary">Документацией</a>
          {" "}и даю согласие на обработку персональных данных согласно{" "}
          <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-primary">Политике конфиденциальности</a>
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !firstName || !lastName || !email || !signupPass || !agreedReg}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Icon name="UserPlus" size={15} />
        )}
        {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground">или</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <VkLoginButton role={signupRole} label="Зарегистрироваться через ВКонтакте" />
    </form>
  );
}