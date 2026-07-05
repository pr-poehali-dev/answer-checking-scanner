import { useState } from "react";
import Icon from "@/components/ui/icon";
import { institutionApi } from "@/lib/api";
import CompanyFooter from "@/components/CompanyFooter";
import { buildConsent } from "@/lib/appVersion";

const REGIONS = [
  // Россия
  "Республика Адыгея", "Республика Алтай", "Республика Башкортостан", "Республика Бурятия",
  "Республика Дагестан", "Республика Ингушетия", "Кабардино-Балкарская Республика",
  "Республика Калмыкия", "Карачаево-Черкесская Республика", "Республика Карелия",
  "Республика Коми", "Республика Крым", "Республика Марий Эл", "Республика Мордовия",
  "Республика Саха (Якутия)", "Республика Северная Осетия — Алания", "Республика Татарстан",
  "Республика Тыва", "Удмуртская Республика", "Республика Хакасия", "Чеченская Республика",
  "Чувашская Республика", "Алтайский край", "Забайкальский край", "Камчатский край",
  "Краснодарский край", "Красноярский край", "Пермский край", "Приморский край",
  "Ставропольский край", "Хабаровский край", "Амурская область", "Архангельская область",
  "Астраханская область", "Белгородская область", "Брянская область", "Владимирская область",
  "Волгоградская область", "Вологодская область", "Воронежская область", "Ивановская область",
  "Иркутская область", "Калининградская область", "Калужская область", "Кемеровская область",
  "Кировская область", "Костромская область", "Курганская область", "Курская область",
  "Ленинградская область", "Липецкая область", "Магаданская область", "Московская область",
  "Мурманская область", "Нижегородская область", "Новгородская область", "Новосибирская область",
  "Омская область", "Оренбургская область", "Орловская область", "Пензенская область",
  "Псковская область", "Ростовская область", "Рязанская область", "Самарская область",
  "Саратовская область", "Сахалинская область", "Свердловская область", "Смоленская область",
  "Тамбовская область", "Тверская область", "Томская область", "Тульская область",
  "Тюменская область", "Ульяновская область", "Челябинская область", "Ярославская область",
  "г. Москва", "г. Санкт-Петербург", "г. Севастополь",
  "Еврейская автономная область", "Ненецкий автономный округ",
  "Ханты-Мансийский автономный округ — Югра", "Чукотский автономный округ",
  "Ямало-Ненецкий автономный округ",
  "Донецкая Народная Республика", "Луганская Народная Республика",
  "Запорожская область", "Херсонская область",
  // Беларусь
  "Брестская область (Беларусь)", "Витебская область (Беларусь)", "Гомельская область (Беларусь)",
  "Гродненская область (Беларусь)", "Минская область (Беларусь)", "Могилёвская область (Беларусь)",
  "г. Минск (Беларусь)",
  // Казахстан
  "Абайская область (Казахстан)", "Акмолинская область (Казахстан)", "Актюбинская область (Казахстан)",
  "Алматинская область (Казахстан)", "Атырауская область (Казахстан)",
  "Восточно-Казахстанская область (Казахстан)", "Жамбылская область (Казахстан)",
  "Жетысуская область (Казахстан)", "Западно-Казахстанская область (Казахстан)",
  "Карагандинская область (Казахстан)", "Костанайская область (Казахстан)",
  "Кызылординская область (Казахстан)", "Мангистауская область (Казахстан)",
  "Павлодарская область (Казахстан)", "Северо-Казахстанская область (Казахстан)",
  "Туркестанская область (Казахстан)", "Ұлытауская область (Казахстан)",
  "Шымкент (Казахстан)", "г. Алматы (Казахстан)", "г. Астана (Казахстан)",
];

interface Props {
  onSuccess: (data: { login: string; password: string; institution_name: string }) => void;
  onBack: () => void;
}

export default function InstitutionRegisterPage({ onSuccess, onBack }: Props) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [inn, setInn] = useState("");
  const [director, setDirector] = useState("");
  const [viceDirector, setViceDirector] = useState("");
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [adminRole, setAdminRole] = useState<"director" | "vice_director">("director");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredRegions = REGIONS.filter(r =>
    r.toLowerCase().includes((regionSearch || region).toLowerCase())
  ).slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !region || !inn || !director || !viceDirector || !adminLogin || !adminPassword || !email) {
      setError("Все поля обязательны для заполнения");
      return;
    }
    if (adminPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (!agreed) {
      setError("Необходимо принять условия Договора-оферты и Политики конфиденциальности");
      return;
    }
    setLoading(true);
    try {
      await institutionApi.register({
        name, region, inn, director_full_name: director,
        vice_director_full_name: viceDirector,
        admin_login: adminLogin, admin_password: adminPassword,
        admin_ou_role: adminRole, email,
        consent: buildConsent("institution_registration"),
      });
      onSuccess({ login: adminLogin, password: adminPassword, institution_name: name });
    } catch (e) {
      setError((e as Error).message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="ArrowLeft" size={13} />
          Назад
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <img
              src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg"
              alt="САОУ"
              className="w-14 h-14 rounded-xl object-contain mx-auto mb-3"
            />
            <h1 className="text-lg font-bold text-foreground">Регистрация Образовательного Учреждения</h1>
            <p className="text-xs text-muted-foreground mt-1">Система Автоматизации Образовательных Учреждений</p>
          </div>

          <div className="border border-border rounded-sm bg-white shadow-sm">
            <div className="px-6 py-3 border-b border-border bg-muted">
              <p className="text-sm font-semibold text-center">Данные учреждения</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Название ОУ */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Название образовательного учреждения <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Icon name="Building2" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="МБОУ «Средняя школа №1»"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Область */}
              <div className="relative">
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Область / регион <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Icon name="MapPin" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={region || regionSearch}
                    onChange={e => {
                      setRegion("");
                      setRegionSearch(e.target.value);
                      setShowRegionDropdown(true);
                    }}
                    onFocus={() => setShowRegionDropdown(true)}
                    placeholder="Начните вводить регион..."
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {showRegionDropdown && filteredRegions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-sm shadow-lg max-h-48 overflow-y-auto">
                    {filteredRegions.map(r => (
                      <button
                        key={r}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          setRegion(r);
                          setRegionSearch(r);
                          setShowRegionDropdown(false);
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ИНН */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  ИНН образовательного учреждения <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Icon name="Hash" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={inn}
                    onChange={e => setInn(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="10 или 12 цифр"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* ФИО директора */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  ФИО директора <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Icon name="UserCheck" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={director}
                    onChange={e => setDirector(e.target.value)}
                    placeholder="Фамилия Имя Отчество"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* ФИО зам. директора */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  ФИО заместителя директора <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Icon name="UserCheck" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={viceDirector}
                    onChange={e => setViceDirector(e.target.value)}
                    placeholder="Фамилия Имя Отчество"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Учётная запись администратора ОУ</p>

                {/* Кем является администратор */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Администратор является <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminRole("director")}
                      className={`py-2 px-3 text-xs font-medium rounded-sm border transition-colors ${
                        adminRole === "director"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      Директор
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminRole("vice_director")}
                      className={`py-2 px-3 text-xs font-medium rounded-sm border transition-colors ${
                        adminRole === "vice_director"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      Зам. директора
                    </button>
                  </div>
                </div>

                {/* Логин */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Логин администратора <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="User" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={adminLogin}
                      onChange={e => setAdminLogin(e.target.value.replace(/\s/g, ""))}
                      placeholder="Только латинские буквы и цифры"
                      autoComplete="username"
                      className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Пароль */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Пароль администратора <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="Lock" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Не менее 6 символов"
                      autoComplete="new-password"
                      className="w-full pl-9 pr-10 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <Icon name={showPass ? "EyeOff" : "Eye"} size={14} />
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Электронная почта ОУ <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="Mail" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="school@edu.ru"
                      className="w-full pl-9 pr-3 py-2.5 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
                  <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-primary cursor-pointer"
                />
                <span className="text-[11px] text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                  Я принимаю условия{" "}
                  <a href="/oferta" target="_blank" className="underline underline-offset-2 hover:text-primary">Договора-оферты</a>
                  {" "}и даю согласие на обработку персональных данных согласно{" "}
                  <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-primary">Политике конфиденциальности</a>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon name="CheckCircle" size={15} />
                )}
                {loading ? "Регистрация..." : "Зарегистрировать учреждение"}
              </button>
            </form>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}