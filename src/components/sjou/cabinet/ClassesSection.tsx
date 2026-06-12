import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { OoSession, ClassItem, cabinetCall } from "./api";

interface Props {
  session: OoSession;
  onChanged: () => void;
}

export default function ClassesSection({ session, onChanged }: Props) {
  const [items, setItems] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [homeroom, setHomeroom] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await cabinetCall(session, "classes_list");
      setItems((d.classes as ClassItem[]) || []);
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
    if (!name.trim()) { setError("Укажите название класса"); return; }
    setAdding(true);
    try {
      await cabinetCall(session, "class_add", { name, grade, homeroom_teacher: homeroom });
      setName(""); setGrade(""); setHomeroom("");
      load(); onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    await cabinetCall(session, "class_delete", { id });
    load(); onChanged();
  };

  const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="text-sm font-semibold mb-3">Добавить класс</div>
        <div className="grid sm:grid-cols-4 gap-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (1А)" />
          <input className={input} type="number" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Параллель (1-11)" />
          <input className={input} value={homeroom} onChange={(e) => setHomeroom(e.target.value)} placeholder="Классный руководитель" />
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
        <div className="text-center py-12 text-slate-400"><Icon name="School" size={36} className="mx-auto mb-2" />Классов пока нет</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between">
              <div>
                <div className="font-bold text-lg">{c.name}</div>
                {c.homeroom_teacher && <div className="text-sm text-slate-500">Кл. рук.: {c.homeroom_teacher}</div>}
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Icon name="Users" size={12} /> {c.students_count} учеников
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Icon name="Trash2" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
