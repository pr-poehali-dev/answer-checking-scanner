import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { OoSession, TeacherItem, cabinetCall } from "./api";

interface Props {
  session: OoSession;
  onChanged: () => void;
}

export default function TeachersSection({ session, onChanged }: Props) {
  const [items, setItems] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await cabinetCall(session, "teachers_list");
      setItems((d.teachers as TeacherItem[]) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Укажите ФИО учителя"); return; }
    setAdding(true);
    try {
      await cabinetCall(session, "teacher_add", { full_name: fullName, subject, email, phone });
      setFullName(""); setSubject(""); setEmail(""); setPhone("");
      load(); onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    await cabinetCall(session, "teacher_delete", { id });
    load(); onChanged();
  };

  const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="text-sm font-semibold mb-3">Добавить учителя</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ФИО" />
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет" />
          <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
        </div>
        <button type="submit" disabled={adding} className="mt-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 py-2.5 px-5">
          {adding ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Plus" size={16} />}
          Добавить
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><Icon name="Loader2" size={28} className="animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Icon name="GraduationCap" size={36} className="mx-auto mb-2" />Учителей пока нет</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between">
              <div className="min-w-0">
                <div className="font-bold">{t.full_name}</div>
                {t.subject && <div className="text-sm text-blue-600">{t.subject}</div>}
                <div className="text-xs text-slate-400 mt-1 space-x-3">
                  {t.email && <span>{t.email}</span>}
                  {t.phone && <span>{t.phone}</span>}
                </div>
                {t.login && (
                  <div className="mt-2 inline-flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-xs">
                    <span className="text-slate-500">Логин: <code className="text-blue-700 font-semibold">{t.login}</code></span>
                    <span className="text-slate-500">Пароль: <code className="text-blue-700 font-semibold">{t.password}</code></span>
                  </div>
                )}
              </div>
              <button onClick={() => remove(t.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                <Icon name="Trash2" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}