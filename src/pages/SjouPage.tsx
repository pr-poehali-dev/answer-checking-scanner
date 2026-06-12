import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import OoRegisterModal from "@/components/sjou/OoRegisterModal";

type Role = "teacher" | "student" | "parent" | "admin";

const ROLES: {
  id: Role;
  title: string;
  icon: string;
  color: string;
  desc: string;
  features: string[];
}[] = [
  {
    id: "teacher",
    title: "Учитель",
    icon: "GraduationCap",
    color: "#2563eb",
    desc: "Электронный журнал, выставление оценок и домашних заданий за минуты.",
    features: [
      "Журнал успеваемости и посещаемости",
      "Выставление оценок в один клик",
      "Домашние задания с прикреплением файлов",
      "Автоматический расчёт средних баллов",
    ],
  },
  {
    id: "student",
    title: "Ученик",
    icon: "BookOpen",
    color: "#16a34a",
    desc: "Личный дневник с расписанием, оценками и домашкой всегда под рукой.",
    features: [
      "Электронный дневник с оценками",
      "Расписание уроков и звонков",
      "Домашние задания на каждый день",
      "Уведомления о новых оценках",
    ],
  },
  {
    id: "parent",
    title: "Родитель",
    icon: "Users",
    color: "#9333ea",
    desc: "Контроль успеваемости ребёнка и связь с учителями в реальном времени.",
    features: [
      "Оценки и пропуски ребёнка онлайн",
      "Уведомления об успеваемости",
      "Сообщения от классного руководителя",
      "Объявления школы",
    ],
  },
  {
    id: "admin",
    title: "Администратор ОО",
    icon: "Building2",
    color: "#dc2626",
    desc: "Управление школой, классами, учителями и отчётностью из единого кабинета.",
    features: [
      "Управление классами и учителями",
      "Учебные планы и расписание",
      "Отчёты по успеваемости и ФГОС",
      "Контроль ведения журналов",
    ],
  },
];

const COMPLIANCE: { icon: string; title: string; text: string }[] = [
  {
    icon: "ShieldCheck",
    title: "152-ФЗ о персональных данных",
    text: "Все данные хранятся на серверах СЖОУ в России. Полное соответствие закону о защите персональных данных.",
  },
  {
    icon: "ScrollText",
    title: "Требования Минпросвещения РФ",
    text: "Электронный журнал и дневник соответствуют требованиям Министерства просвещения и Минобрнауки России.",
  },
  {
    icon: "Server",
    title: "Свои серверы",
    text: "Никаких сторонних облаков. Данные учеников и учителей полностью под нашим контролем и защитой.",
  },
  {
    icon: "Lock",
    title: "Шифрование и резервные копии",
    text: "Защищённое соединение, регулярные бэкапы и круглосуточный мониторинг стабильной работы системы.",
  },
];

export default function SjouPage() {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [ooRegOpen, setOoRegOpen] = useState(false);
  const [role, setRole] = useState<Role>("teacher");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggedUser, setLoggedUser] = useState<{ oo_full_name: string; contact_name: string } | null>(null);

  const openLogin = (r?: Role) => {
    if (r) setRole(r);
    setLoginError("");
    setLoggedUser(null);
    setLoginOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!login.trim() || !password.trim()) {
      setLoginError("Введите логин и пароль");
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch("https://functions.poehali.dev/2188b28c-bef1-4cf5-9016-f25d4b79fa8a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "oo_login", login: login.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Ошибка входа");
        return;
      }
      setLoggedUser({ oo_full_name: data.oo_full_name, contact_name: data.contact_name });
    } catch {
      setLoginError("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Icon name="GraduationCap" size={20} className="text-white" />
            </div>
            <div className="leading-tight text-left">
              <div className="font-extrabold text-base tracking-tight">СЖОУ</div>
              <div className="text-[10px] text-slate-500 hidden sm:block">Электронный журнал и дневник</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#roles" className="hover:text-slate-900 transition-colors">Возможности</a>
            <a href="#compliance" className="hover:text-slate-900 transition-colors">Безопасность</a>
            <a href="#how" className="hover:text-slate-900 transition-colors">Как начать</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Icon name="ArrowLeft" size={14} />
              На главную
            </button>
            <button
              onClick={() => setOoRegOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <Icon name="Building2" size={15} />
              Регистрация ОО
            </button>
            <button
              onClick={() => openLogin()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Icon name="LogIn" size={15} />
              Войти
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium mb-6">
            <Icon name="ShieldCheck" size={14} />
            Соответствует требованиям Минпросвещения РФ
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
            СЖОУ — электронный<br className="hidden sm:block" /> журнал и дневник
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-xl text-blue-100 mb-9">
            Современная система автоматизации для учителей, учеников, родителей
            и администраций образовательных организаций. Все данные — на серверах СЖОУ в России.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => openLogin()}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors shadow-lg"
            >
              <Icon name="LogIn" size={18} />
              Войти в систему
            </button>
            <button
              onClick={() => setOoRegOpen(true)}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors border border-white/30"
            >
              <Icon name="Building2" size={18} />
              Регистрация ОО
            </button>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Одна система для всех</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            СЖОУ объединяет учителей, учеников, родителей и администрацию в едином цифровом пространстве школы.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map((r) => (
            <div
              key={r.id}
              className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${r.color}15` }}
              >
                <Icon name={r.icon} size={24} style={{ color: r.color }} />
              </div>
              <h3 className="font-bold text-lg mb-1.5">{r.title}</h3>
              <p className="text-sm text-slate-600 mb-4">{r.desc}</p>
              <ul className="space-y-2 mb-5">
                {r.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Icon name="Check" size={15} className="mt-0.5 flex-shrink-0" style={{ color: r.color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => openLogin(r.id)}
                className="text-sm font-semibold inline-flex items-center gap-1 transition-colors"
                style={{ color: r.color }}
              >
                Войти как {r.title.toLowerCase()}
                <Icon name="ArrowRight" size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4">
              <Icon name="ShieldCheck" size={14} />
              Безопасность и соответствие закону
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Данные под защитой</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              СЖОУ полностью соответствует требованиям Минпросвещения и Минобрнауки РФ
              к электронным журналам и дневникам.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {COMPLIANCE.map((c) => (
              <div key={c.title} className="flex gap-4 p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Icon name={c.icon} size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{c.title}</h3>
                  <p className="text-sm text-slate-600">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to start */}
      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Как начать работу</h2>
          <p className="text-slate-600">Три шага до полностью цифровой школы</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { n: "1", icon: "Building2", title: "Регистрация школы", text: "Администрация регистрирует образовательную организацию в СЖОУ." },
            { n: "2", icon: "Users", title: "Добавление участников", text: "Загружаются классы, учителя, ученики и родители." },
            { n: "3", icon: "Rocket", title: "Работа в системе", text: "Учителя ведут журнал, ученики и родители видят оценки онлайн." },
          ].map((s) => (
            <div key={s.n} className="relative bg-white rounded-2xl border border-slate-200 p-7 text-center">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                {s.n}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 mt-3">
                <Icon name={s.icon} size={26} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <button
            onClick={() => setOoRegOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Icon name="Building2" size={18} />
            Зарегистрировать организацию
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Icon name="GraduationCap" size={20} className="text-white" />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-white">СЖОУ</div>
                <div className="text-xs">Электронный журнал и дневник</div>
              </div>
            </div>
            <p className="text-xs text-center sm:text-right">
              © {new Date().getFullYear()} СЖОУ. Данные хранятся на серверах в России.<br />
              Соответствует требованиям Минпросвещения и Минобрнауки РФ.
            </p>
          </div>
        </div>
      </footer>

      {/* Login modal */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setLoginOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-6 text-white relative">
              <button
                onClick={() => setLoginOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                <Icon name="X" size={20} />
              </button>
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
                <Icon name="LogIn" size={22} />
              </div>
              <h3 className="text-xl font-bold">Вход в СЖОУ</h3>
              <p className="text-sm text-blue-100">Выберите роль и войдите в систему</p>
            </div>

            {loggedUser ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle2" size={36} className="text-green-600" />
                </div>
                <h4 className="text-lg font-bold mb-1">Вы вошли в систему</h4>
                <p className="text-sm text-slate-600 mb-1">{loggedUser.oo_full_name}</p>
                <p className="text-sm text-slate-400 mb-6">{loggedUser.contact_name}</p>
                <button
                  onClick={() => setLoginOpen(false)}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                >
                  Продолжить
                </button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Я вхожу как</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        role === r.id
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Icon name={r.icon} size={16} />
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Логин</label>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  type="text"
                  placeholder="Введите логин"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Пароль</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Введите пароль"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {loginError && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm">
                  <Icon name="AlertCircle" size={16} />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loggingIn && <Icon name="Loader2" size={18} className="animate-spin" />}
                <span>Войти</span>
              </button>

              {role !== "admin" && (
                <p className="text-xs text-center text-amber-600">
                  Сейчас доступен вход администратора ОО. Доступ для учителей, учеников и родителей появится позже.
                </p>
              )}

              <p className="text-xs text-center text-slate-500">
                Защищённое соединение. Данные хранятся на серверах СЖОУ в России.
              </p>
            </form>
            )}
          </div>
        </div>
      )}

      {ooRegOpen && <OoRegisterModal onClose={() => setOoRegOpen(false)} />}
    </div>
  );
}