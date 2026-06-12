import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { OoSession, ClassItem, JournalStudent, JournalGrade, cabinetCall } from "./api";

interface Props {
  session: OoSession;
}

const today = () => new Date().toISOString().slice(0, 10);

const GRADE_COLORS: Record<number, string> = {
  5: "bg-green-100 text-green-700",
  4: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700",
  2: "bg-red-100 text-red-700",
  1: "bg-red-200 text-red-800",
};

export default function JournalSection({ session }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(today());

  const [students, setStudents] = useState<JournalStudent[]>([]);
  const [grades, setGrades] = useState<JournalGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await cabinetCall(session, "classes_list");
        const cl = (c.classes as ClassItem[]) || [];
        setClasses(cl);
        if (cl.length && !classId) setClassId(String(cl[0].id));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const loadJournal = useCallback(async () => {
    if (!classId || !subject.trim()) { setStudents([]); setGrades([]); return; }
    setLoading(true);
    setError("");
    try {
      const d = await cabinetCall(session, "journal", {
        class_id: classId, subject, grade_date: date,
      });
      setStudents((d.students as JournalStudent[]) || []);
      setGrades((d.grades as JournalGrade[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [session, classId, subject, date]);

  useEffect(() => { loadJournal(); }, [loadJournal]);

  const studentGrade = (studentId: number) =>
    grades.find((g) => g.student_id === studentId);

  const setGrade = async (studentId: number, value: number) => {
    try {
      await cabinetCall(session, "grade_set", {
        class_id: classId, student_id: studentId, subject,
        grade_date: date, grade_value: value,
      });
      loadJournal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const removeGrade = async (id: number) => {
    await cabinetCall(session, "grade_delete", { id });
    loadJournal();
  };

  const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (classes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Icon name="BookOpenCheck" size={36} className="mx-auto mb-2" />
        Сначала добавьте классы и учеников
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Класс</label>
            <select className={`${input} w-full`} value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Предмет</label>
            <input className={`${input} w-full`} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Например, Алгебра" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Дата</label>
            <input className={`${input} w-full`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!subject.trim() ? (
        <div className="text-center py-12 text-slate-400">
          <Icon name="BookOpenCheck" size={36} className="mx-auto mb-2" />
          Введите предмет, чтобы открыть журнал
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400"><Icon name="Loader2" size={28} className="animate-spin mx-auto" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Icon name="Users" size={36} className="mx-auto mb-2" />
          В этом классе нет учеников
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ученик</th>
                <th className="text-center px-4 py-2.5 font-medium">Оценка за {date}</th>
                <th className="text-center px-4 py-2.5 font-medium">Поставить</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const g = studentGrade(s.id);
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium">{s.full_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      {g ? (
                        <button
                          onClick={() => removeGrade(g.id)}
                          title="Удалить оценку"
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${GRADE_COLORS[g.grade_value] || "bg-slate-100"}`}
                        >
                          {g.grade_value}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {[2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            onClick={() => setGrade(s.id, v)}
                            className="w-7 h-7 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
