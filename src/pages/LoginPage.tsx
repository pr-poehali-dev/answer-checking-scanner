import { useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore } from "@/store/appStore";
import CompanyFooter from "@/components/CompanyFooter";
import { buildConsent } from "@/lib/appVersion";
import LoginFormPanel from "@/components/login/LoginFormPanel";
import SignupFormPanel from "@/components/login/SignupFormPanel";
import ConfirmEmailPanel from "@/components/login/ConfirmEmailPanel";
import ForgotResetPanel from "@/components/login/ForgotResetPanel";

interface LoginPageProps {
  onLogin: (role: "admin" | "teacher" | "tester" | "student") => void;
  initialMode?: "login" | "signup";
  onBack?: () => void;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? (/[a-z0-9]/.test(c) ? c : ""))
    .join("");
}

function previewLogin(firstName: string, lastName: string): string {
  const f = translit(lastName.trim());
  const i = translit(firstName.trim());
  const base = (f + (i ? i[0] : "")).slice(0, 32);
  return base || "—";
}

type Mode = "login" | "signup" | "confirm" | "forgot" | "reset";

export default function LoginPage({ onLogin, initialMode = "login", onBack }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);

  // login
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // signup
  const [signupRole, setSignupRole] = useState<"teacher" | "student">("teacher");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [studyGroup, setStudyGroup] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [showSignupPass, setShowSignupPass] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedReg, setAgreedReg] = useState(false);

  // confirm-email
  const [confirmLogin, setConfirmLogin] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [confirmHint, setConfirmHint] = useState("");
  const [resending, setResending] = useState(false);

  // forgot / reset password
  const [forgotLogin, setForgotLogin] = useState("");
  const [forgotHint, setForgotHint] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const generatedLogin = useMemo(
    () => previewLogin(firstName, lastName),
    [firstName, lastName],
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await appStore.login(login.trim(), password);
    setLoading(false);
    if (res.ok) { onLogin(res.role); return; }
    if (res.needConfirmation && res.login) {
      setConfirmLogin(res.login);
      setConfirmHint("Введите код, отправленный вам на почту при регистрации.");
      setMode("confirm");
      return;
    }
    setError(res.error || "Неверный логин или пароль");
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (signupPass.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    setLoading(true);
    const res = await appStore.signup({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password: signupPass,
      role: signupRole,
      study_group: signupRole === "student" ? studyGroup.trim() : undefined,
      consent: buildConsent("registration"),
    });
    setLoading(false);
    if (res.ok) {
      setConfirmLogin(res.login);
      setConfirmHint(`Мы отправили письмо на ${res.email} — введите код из письма или перейдите по ссылке в нём`);
      setMode("confirm");
    } else {
      setError(res.error || "Ошибка регистрации");
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (confirmCode.trim().length < 6) {
      setError("Введите 6-значный код из письма");
      return;
    }
    setLoading(true);
    const res = await appStore.confirmEmail(confirmLogin, confirmCode.trim());
    setLoading(false);
    if (res.ok) onLogin(res.role);
    else setError(res.error || "Неверный код");
  };

  const handleResendCode = async () => {
    setResending(true);
    setError("");
    const res = await appStore.resendEmailCode(confirmLogin);
    setResending(false);
    if (res.ok) setConfirmHint(res.hint);
    else setError(res.error);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await appStore.forgotPassword(forgotLogin.trim());
    setLoading(false);
    if (res.ok) {
      setConfirmLogin(res.login || forgotLogin.trim());
      setForgotHint(res.hint);
      setResetCode("");
      setResetNewPass("");
      setMode("reset");
    } else {
      setError(res.error || "Не удалось отправить код");
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (resetCode.trim().length < 6) {
      setError("Введите 6-значный код из письма");
      return;
    }
    if (resetNewPass.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }
    setLoading(true);
    const res = await appStore.resetPasswordConfirm(confirmLogin, resetCode.trim(), resetNewPass);
    setLoading(false);
    if (res.ok) {
      setResetSuccess(true);
    } else {
      setError(res.error || "Не удалось сменить пароль");
    }
  };

  const handleResendResetCode = async () => {
    setResending(true);
    setError("");
    const res = await appStore.forgotPassword(confirmLogin);
    setResending(false);
    if (res.ok) setForgotHint(res.hint);
    else setError(res.error);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {onBack && (
        <div className="px-4 pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeft" size={13} />
            На главную
          </button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg" alt="САОУ" className="w-16 h-16 rounded-xl object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">САОУ</h1>
          <p className="text-sm text-muted-foreground mt-1">Система Автоматизации Образовательных Учреждений</p>
        </div>

        {/* Tabs */}
        {(mode === "login" || mode === "signup") && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-sm mb-3">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`py-2 text-xs font-semibold rounded-sm transition-colors ${
                mode === "login" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`py-2 text-xs font-semibold rounded-sm transition-colors ${
                mode === "signup" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Регистрация
            </button>
          </div>
        )}

        {/* Form */}
        <div className="border border-border rounded-sm bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted flex items-center gap-2">
            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={15} />
              </button>
            )}
            <p className="text-sm font-semibold text-center flex-1">
              {mode === "login" ? "Вход в систему САОУ"
                : mode === "signup" ? "Регистрация в системе САОУ"
                : mode === "confirm" ? "Подтверждение email"
                : mode === "forgot" ? "Восстановление пароля"
                : "Новый пароль"}
            </p>
          </div>

          {mode === "confirm" ? (
            <ConfirmEmailPanel
              confirmCode={confirmCode}
              setConfirmCode={setConfirmCode}
              confirmHint={confirmHint}
              error={error}
              loading={loading}
              resending={resending}
              onSubmit={handleConfirmSubmit}
              onResendCode={handleResendCode}
            />
          ) : mode === "forgot" || mode === "reset" ? (
            <ForgotResetPanel
              mode={mode}
              forgotLogin={forgotLogin}
              setForgotLogin={setForgotLogin}
              forgotHint={forgotHint}
              resetCode={resetCode}
              setResetCode={setResetCode}
              resetNewPass={resetNewPass}
              setResetNewPass={setResetNewPass}
              showResetPass={showResetPass}
              setShowResetPass={setShowResetPass}
              resetSuccess={resetSuccess}
              error={error}
              loading={loading}
              resending={resending}
              onForgotSubmit={handleForgotSubmit}
              onResetSubmit={handleResetSubmit}
              onResendResetCode={handleResendResetCode}
              onGoToLoginAfterReset={() => { setResetSuccess(false); setLogin(confirmLogin); switchMode("login"); }}
            />
          ) : mode === "login" ? (
            <LoginFormPanel
              login={login}
              setLogin={setLogin}
              password={password}
              setPassword={setPassword}
              showPass={showPass}
              setShowPass={setShowPass}
              error={error}
              loading={loading}
              onSubmit={handleLoginSubmit}
              onForgotPassword={() => { setForgotLogin(login); switchMode("forgot"); }}
            />
          ) : (
            <SignupFormPanel
              signupRole={signupRole}
              setSignupRole={setSignupRole}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              studyGroup={studyGroup}
              setStudyGroup={setStudyGroup}
              generatedLogin={generatedLogin}
              signupPass={signupPass}
              setSignupPass={setSignupPass}
              showSignupPass={showSignupPass}
              setShowSignupPass={setShowSignupPass}
              agreedReg={agreedReg}
              setAgreedReg={setAgreedReg}
              error={error}
              loading={loading}
              onSubmit={handleSignupSubmit}
            />
          )}
        </div>


      </div>
      </div>
      <CompanyFooter variant="full" />
    </div>
  );
}
