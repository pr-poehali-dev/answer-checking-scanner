import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { OoSession, StudentItem, ClassItem, cabinetCall } from "./api";

interface Props {
  session: OoSession;
  onChanged: () => void;
}

export default function StudentsSection({ session, onChanged }: Props) {
  const [items, setItems] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classId, setClassId] = useState("");
  const [birth, setBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        cabinetCall(session, "students_list"),
        cabinetCall(session, "classes_list"),
      ]);
      setItems((s.students as StudentItem[]) || []);
      setClasses((c.classes as ClassItem[]) || []);
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
    if (!fullName.trim()) { setError("Укажите ФИО ученика"); return; }
    setAdding(true);
    try {
      await cabinetCall(session, "student_add", {
        full_name: fullName, class_id: classId, birth_date: birth,
        parent_name: parentName, parent_phone: parentPhone,
      });
      setFullName(""); setBirth(""); setParentName(""); setParentPhone("");
      load(); onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    await cabinetCall(session, "student_delete", { id });
    load(); onChanged();
  };

  const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="text-sm font-semibold mb-3">Добавить ученика</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ФИО ученика" />
          <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Без класса</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className={input} value={birth} onChange={(e) => setBirth(e.target.value)} placeholder="Дата рождения" />
          <input className={input} value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="ФИО родителя" />
          <input className={input} value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Телефон родителя" />
          <button type="submit" disabled={adding} className="rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 py-2.5">
            {adding ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Plus" size={16} />}
            Добавить
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><Icon name="Loader2" size={28} className="animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Icon name="Users" size={36} className="mx-auto mb-2" />Учеников пока нет</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">ФИО</th>
                <th className="text-left px-4 py-2.5 font-medium">Класс</th>
                <th className="text-left px-4 py-2.5 font-medium">Доступы</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2.5 font-medium">{s.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.class_name || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {s.login && (
                      <div className="mb-1">
                        <span className="text-slate-400">Ученик: </span>
                        <code className="text-blue-700 font-semibold">{s.login}</code>
                        <span className="text-slate-400"> / </span>
                        <code className="text-blue-700 font-semibold">{s.password}</code>
                      </div>
                    )}
                    {s.parent_login && (
                      <div>
                        <span className="text-slate-400">Родитель: </span>
                        <code className="text-purple-700 font-semibold">{s.parent_login}</code>
                        <span className="text-slate-400"> / </span>
                        <code className="text-purple-700 font-semibold">{s.parent_password}</code>
                      </div>
                    )}
                    {!s.login && <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Icon name="Trash2" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}