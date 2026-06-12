import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import CabinetHeader from "@/components/sjou/cabinet/CabinetHeader";
import {
  OoSession, loadSession, clearSession, authCall,
  ClassItem, HomeworkItem, AnnounceItem, ScheduleRow,
} from "@/components/sjou/cabinet/api";

type Tab = "journal" | "homework" | "schedule" | "announce";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "journal", label: "Журнал", icon: "BookOpenCheck" },
  { id: "homework", label: "Домашние задания", icon: "ClipboardList" },
  { id: "schedule", label: "Расписание", icon: "CalendarDays" },
  { id: "announce", label: "Объявления", icon: "Megaphone" },
];

const GRADE_COLORS: Record<number, string> = {
  5: "bg-green-100 text-green-700", 4: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700", 2: "bg-red-100 text-red-700", 1: "bg-red-200 text-red-800",
};
const today = () => new Date().toISOString().slice(0, 10);
const input = "px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function SjouTeacherPage() {
  const navigate = useNavigate();
  const [session] = useState<OoSession | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>("journal");
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (!session || session.role !== "teacher") { navigate("/sjou"); return; }
    authCall(session, "t_classes")
      .then((d) => setClasses((d.classes as ClassItem[]) || []))
      .catch(() => { clearSession(); navigate("/sjou"); });
  }, [session, navigate]);

  if (!session) return null;
  const logout = () => { clearSession(); navigate("/sjou"); };

  return (
    <div className="min-h-screen bg-slate-50">
      <CabinetHeader title="Кабинет учителя · СЖОУ" subtitle={session.full_name} onLogout={logout} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === n.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
              <Icon name={n.icon} size={15} />
              {n.label}
            </button>
          ))}
        </div>

        {tab === "journal" && <JournalTab session={session} classes={classes} />}
        {tab === "homework" && <HomeworkTab session={session} classes={classes} />}
        {tab === "schedule" && <ScheduleTab session={session} />}
        {tab === "announce" && <AnnounceTab session={session} classes={classes} />}
      </div>
    </div>
  );
}

// ── Журнал ──
function JournalTab({ session, classes }: { session: OoSession; classes: ClassItem[] }) {
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<{ id: number; full_name: string }[]>([]);
  const [grades, setGrades] = useState<{ id: number; student_id: number; grade_value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (classes.length && !classId) setClassId(String(classes[0].id)); }, [classes, classId]);

  const load = useCallback(async () => {
    if (!classId || !subject.trim()) { setStudents([]); setGrades([]); return; }
    setLoading(true);
    try {
      const d = await authCall(session, "t_journal", { class_id: classId, subject, grade_date: date });
      setStudents((d.students as typeof students) || []);
      setGrades((d.grades as typeof grades) || []);
    } finally { setLoading(false); }
  }, [session, classId, subject, date]);
  useEffect(() => { load(); }, [load]);

  const setGrade = async (sid: number, v: number) => {
    await authCall(session, "t_grade_set", { class_id: classId, student_id: sid, subject, grade_date: date, grade_value: v });
    load();
  };
  const del = async (id: number) => { await authCall(session, "t_grade_delete", { id }); load(); };

  if (!classes.length) return <Empty icon="School" text="В вашей школе пока нет классов" />;

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 grid sm:grid-cols-3 gap-3">
        <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет" />
        <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {!subject.trim() ? <Empty icon="BookOpenCheck" text="Введите предмет, чтобы открыть журнал" />
        : loading ? <Loader />
        : students.length === 0 ? <Empty icon="Users" text="В классе нет учеников" />
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {students.map((s) => {
                  const g = grades.find((x) => x.student_id === s.id);
                  return (
                    <tr key={s.id} className="border-t border-slate-100 first:border-0">
                      <td className="px-4 py-2.5 font-medium">{s.full_name}</td>
                      <td className="px-4 py-2.5 text-center w-16">
                        {g ? <button onClick={() => del(g.id)} className={`w-8 h-8 rounded-lg font-bold ${GRADE_COLORS[g.grade_value]}`}>{g.grade_value}</button>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-center gap-1">
                          {[2, 3, 4, 5].map((v) => (
                            <button key={v} onClick={() => setGrade(s.id, v)}
                              className="w-7 h-7 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-blue-600 hover:text-white transition-colors">{v}</button>
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

// ── Домашние задания ──
function HomeworkTab({ session, classes }: { session: OoSession; classes: ClassItem[] }) {
  const [classId, setClassId] = useState("");
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [subject, setSubject] = useState("");
  const [due, setDue] = useState(today());
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (classes.length && !classId) setClassId(String(classes[0].id)); }, [classes, classId]);
  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const d = await authCall(session, "t_homework_list", { class_id: classId });
      setItems((d.homework as HomeworkItem[]) || []);
    } finally { setLoading(false); }
  }, [session, classId]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !text.trim()) return;
    await authCall(session, "t_homework_add", { class_id: classId, subject, due_date: due, text });
    setText(""); load();
  };
  const del = async (id: number) => { await authCall(session, "t_homework_delete", { id }); load(); };

  if (!classes.length) return <Empty icon="School" text="Нет классов" />;
  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет" />
          <input className={input} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <textarea className={`${input} w-full`} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст задания" />
        <button className="mt-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 py-2.5 px-5 flex items-center gap-2">
          <Icon name="Plus" size={16} /> Задать ДЗ
        </button>
      </form>
      {loading ? <Loader /> : items.length === 0 ? <Empty icon="ClipboardList" text="Заданий пока нет" /> : (
        <div className="space-y-2">
          {items.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{h.subject}</span>
                  <span className="text-xs text-slate-400">до {h.due_date}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{h.text}</div>
              </div>
              <button onClick={() => del(h.id)} className="text-slate-300 hover:text-red-500"><Icon name="Trash2" size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Расписание ──
function ScheduleTab({ session }: { session: OoSession }) {
  const [lessons, setLessons] = useState<(ScheduleRow & { id: number; class_name: string })[]>([]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authCall(session, "t_schedule").then((d) => {
      setLessons((d.lessons as typeof lessons) || []);
      setWeekdays((d.weekdays as string[]) || []);
    }).finally(() => setLoading(false));
  }, [session]);
  if (loading) return <Loader />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {weekdays.map((w, di) => {
        const dl = lessons.filter((l) => l.day_of_week === di).sort((a, b) => a.lesson_number - b.lesson_number);
        return (
          <div key={di} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-bold text-sm mb-3">{w}</div>
            {dl.length === 0 ? <p className="text-xs text-slate-400">Нет уроков</p> : (
              <div className="space-y-2">
                {dl.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 text-sm">
                    <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{l.lesson_number}</span>
                    <div>
                      <div className="font-medium">{l.subject}</div>
                      <div className="text-xs text-slate-400">{l.class_name}{l.room ? ` · каб. ${l.room}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Объявления ──
function AnnounceTab({ session, classes }: { session: OoSession; classes: ClassItem[] }) {
  const [items, setItems] = useState<AnnounceItem[]>([]);
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await authCall(session, "t_announce_list");
      setItems((d.announcements as AnnounceItem[]) || []);
    } finally { setLoading(false); }
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bodyText.trim()) return;
    await authCall(session, "t_announce_add", { title, body: bodyText, class_id: classId });
    setTitle(""); setBodyText(""); load();
  };
  const del = async (id: number) => { await authCall(session, "t_announce_delete", { id }); load(); };

  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
          <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Всей школе</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <textarea className={`${input} w-full`} rows={2} value={bodyText} onChange={(e) => setBodyText(e.target.value)} placeholder="Текст объявления" />
        <button className="mt-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 py-2.5 px-5 flex items-center gap-2">
          <Icon name="Send" size={16} /> Опубликовать
        </button>
      </form>
      {loading ? <Loader /> : items.length === 0 ? <Empty icon="Megaphone" text="Объявлений пока нет" /> : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold mb-0.5">{a.title}</div>
                <div className="text-xs text-slate-400 mb-1">{a.class_name ? a.class_name : "Вся школа"} · {a.author_name}</div>
                <div className="text-sm whitespace-pre-wrap">{a.body}</div>
              </div>
              <button onClick={() => del(a.id)} className="text-slate-300 hover:text-red-500"><Icon name="Trash2" size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loader() {
  return <div className="text-center py-12 text-slate-400"><Icon name="Loader2" size={28} className="animate-spin mx-auto" /></div>;
}
function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="text-center py-12 text-slate-400"><Icon name={icon} size={36} className="mx-auto mb-2" />{text}</div>;
}
