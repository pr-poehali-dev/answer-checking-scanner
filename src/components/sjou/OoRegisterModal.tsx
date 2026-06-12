import { useState } from "react";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/2188b28c-bef1-4cf5-9016-f25d4b79fa8a";

const OO_TYPES = [
  { value: "school", label: "Общеобразовательная школа" },
  { value: "gymnasium", label: "Гимназия" },
  { value: "lyceum", label: "Лицей" },
  { value: "kindergarten", label: "Детский сад" },
  { value: "college", label: "Колледж / СПО" },
  { value: "supplementary", label: "Учреждение доп. образования" },
  { value: "other", label: "Другое" },
];

interface Props {
  onClose: () => void;
}

export default function OoRegisterModal({ onClose }: Props) {
  const [form, setForm] = useState({
    oo_full_name: "",
    oo_short_name: "",
    oo_type: "school",
    inn: "",
    ogrn: "",
    legal_address: "",
    actual_address: "",
    region: "",
    director_name: "",
    contact_name: "",
    contact_position: "",
    contact_phone: "",
    contact_email: "",
    students_count: "",
  });
  const [fileName, setFileName] = useState("");
  const [fileB64, setFileB64] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Файл больше 10 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileB64(String(reader.result));
      setFileName(f.name);
      setError("");
    };
    reader.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const required = [
      ["oo_full_name", "Полное наименование ОО"],
      ["inn", "ИНН"],
      ["legal_address", "Юридический адрес"],
      ["region", "Регион"],
      ["director_name", "ФИО руководителя"],
      ["contact_name", "Контактное лицо"],
      ["contact_phone", "Телефон"],
      ["contact_email", "Email"],
    ];
    for (const [k, label] of required) {
      if (!form[k as keyof typeof form].trim()) {
        setError(`Заполните: ${label}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...form,
          statement_file_b64: fileB64 || undefined,
          statement_file_name: fileName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  const input =
    "w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-6 text-white relative rounded-t-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <Icon name="X" size={20} />
          </button>
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <Icon name="Building2" size={22} />
          </div>
          <h3 className="text-xl font-bold">Регистрация образовательной организации</h3>
          <p className="text-sm text-blue-100">
            Заявка рассматривается оператором СЖОУ. Все данные хранятся на серверах в России.
          </p>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle2" size={36} className="text-green-600" />
            </div>
            <h4 className="text-lg font-bold mb-2">Заявка отправлена!</h4>
            <p className="text-sm text-slate-600 mb-6">
              Оператор СЖОУ рассмотрит вашу заявку и свяжется с вами по указанным контактам.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Сведения об организации
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Полное наименование ОО *</label>
                  <input className={input} value={form.oo_full_name} onChange={(e) => set("oo_full_name", e.target.value)} placeholder="МБОУ «Средняя школа №1»" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Краткое наименование</label>
                    <input className={input} value={form.oo_short_name} onChange={(e) => set("oo_short_name", e.target.value)} placeholder="Школа №1" />
                  </div>
                  <div>
                    <label className={labelCls}>Тип организации *</label>
                    <select className={input} value={form.oo_type} onChange={(e) => set("oo_type", e.target.value)}>
                      {OO_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ИНN *</label>
                    <input className={input} value={form.inn} onChange={(e) => set("inn", e.target.value)} placeholder="7700000000" />
                  </div>
                  <div>
                    <label className={labelCls}>ОГРН</label>
                    <input className={input} value={form.ogrn} onChange={(e) => set("ogrn", e.target.value)} placeholder="1037700000000" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Регион *</label>
                  <input className={input} value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Московская область" />
                </div>
                <div>
                  <label className={labelCls}>Юридический адрес *</label>
                  <input className={input} value={form.legal_address} onChange={(e) => set("legal_address", e.target.value)} placeholder="г. Москва, ул. ..." />
                </div>
                <div>
                  <label className={labelCls}>Фактический адрес</label>
                  <input className={input} value={form.actual_address} onChange={(e) => set("actual_address", e.target.value)} placeholder="если отличается от юридического" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ФИО руководителя *</label>
                    <input className={input} value={form.director_name} onChange={(e) => set("director_name", e.target.value)} placeholder="Иванов Иван Иванович" />
                  </div>
                  <div>
                    <label className={labelCls}>Кол-во учащихся</label>
                    <input className={input} type="number" value={form.students_count} onChange={(e) => set("students_count", e.target.value)} placeholder="500" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Контактное лицо
              </div>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ФИО *</label>
                    <input className={input} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="Петрова Анна" />
                  </div>
                  <div>
                    <label className={labelCls}>Должность</label>
                    <input className={input} value={form.contact_position} onChange={(e) => set("contact_position", e.target.value)} placeholder="Зам. директора" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Телефон *</label>
                    <input className={input} value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+7 (___) ___-__-__" />
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input className={input} type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="school@example.ru" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Заявление от ОО
              </div>
              <label className="flex items-center gap-3 px-4 py-3.5 rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                <Icon name="Upload" size={20} className="text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {fileName || "Загрузить файл заявления"}
                  </div>
                  <div className="text-xs text-slate-400">PDF, DOC, DOCX, JPG, PNG — до 10 МБ</div>
                </div>
                {fileName && <Icon name="CheckCircle2" size={18} className="text-green-600" />}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={onFile} />
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm">
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Icon name="Send" size={18} />
                  Отправить заявку
                </>
              )}
            </button>
            <p className="text-xs text-center text-slate-500">
              Отправляя заявку, вы соглашаетесь на обработку персональных данных в соответствии с 152-ФЗ.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
