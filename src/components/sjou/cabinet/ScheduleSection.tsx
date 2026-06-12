import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { OoSession, ClassItem, TeacherItem, LessonItem, WEEKDAYS, cabinetCall } from "./api";

interface Props {
  session: OoSession;
}

export default function ScheduleSection({ session }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [classId, setClassId] = useState("");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("0");
  const [num, setNum] = useState("1");
  const [room, setRoom] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [c, t] = await Promise.all([
          cabinetCall(session, "classes_list"),
          cabinetCall(session, "teachers_list"),
        ]);
        const cl = (c.classes as ClassItem[]) || [];
        setClasses(cl);
        setTeachers((t.teachers as TeacherItem[]) || []);
        if (cl.length && !classId) setClassId(String(cl[0].id));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const loadLessons = useCallback(async () => {
    if (!classId) { setLessons([]); return; }
    setLoading(true);
    try {
      const d = await cabinetCall(session, "lessons_list", { class_id: classId });
      setLessons((d.lessons as LessonItem[]) || []);
    } catch {
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [session, classId]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!classId) { setError("Сначала создайте класс"); return; }
    if (!subject.trim()) { setError("Укажите предмет"); return; }
    setAdding(true);
    try {
      await cabinetCall(session, "lesson_add", {
        class_id: classId, subject, teacher_id: teacherId,
        day_of_week: day, lesson_number: num, room,
      });
      setSubject(""); setRoom("");
      loadLessons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    await cabinetCall(session, "lesson_delete", { id });
    loadLessons();
  };

  const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (classes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Icon name="CalendarDays" size={36} className="mx-auto mb-2" />
        Сначала добавьте классы во вкладке «Классы»
      </div>
    );
  }

  const byDay = (d: number) =>
    lessons.filter((l) => l.day_of_week === d).sort((a, b) => a.lesson_number - b.lesson_number);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <label className="text-sm font-medium text-slate-700">Класс:</label>
        <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="text-sm font-semibold mb-3">Добавить урок в расписание</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет" />
          <select className={input} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Учитель</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select className={input} value={day} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
          <select className={input} value={num} onChange={(e) => setNum(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}-й урок</option>)}
          </select>
          <input className={input} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Кабинет" />
        </div>
        <button type="submit" disabled={adding} className="mt-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 py-2.5 px-5">
          {adding ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Plus" size={16} />}
          Добавить
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><Icon name="Loader2" size={28} className="animate-spin mx-auto" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKDAYS.map((w, di) => {
            const dl = byDay(di);
            return (
              <div key={di} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="font-bold text-sm mb-3">{w}</div>
                {dl.length === 0 ? (
                  <p className="text-xs text-slate-400">Нет уроков</p>
                ) : (
                  <div className="space-y-2">
                    {dl.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 text-sm group">
                        <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{l.lesson_number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{l.subject}</div>
                          <div className="text-xs text-slate-400">
                            {l.teacher_name || "—"}{l.room ? ` · каб. ${l.room}` : ""}
                          </div>
                        </div>
                        <button onClick={() => remove(l.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
