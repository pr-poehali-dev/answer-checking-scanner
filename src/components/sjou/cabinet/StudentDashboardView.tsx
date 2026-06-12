import { useState } from "react";
import Icon from "@/components/ui/icon";
import { StudentDashboard } from "./api";

type Tab = "grades" | "schedule" | "homework" | "announce";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "grades", label: "Оценки", icon: "Star" },
  { id: "schedule", label: "Расписание", icon: "CalendarDays" },
  { id: "homework", label: "Домашние задания", icon: "ClipboardList" },
  { id: "announce", label: "Объявления", icon: "Megaphone" },
];

const GRADE_COLORS: Record<number, string> = {
  5: "bg-green-100 text-green-700", 4: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700", 2: "bg-red-100 text-red-700", 1: "bg-red-200 text-red-800",
};

export default function StudentDashboardView({ data }: { data: StudentDashboard }) {
  const [tab, setTab] = useState<Tab>("grades");

  // Группируем оценки по предметам
  const bySubject: Record<string, typeof data.grades> = {};
  data.grades.forEach((g) => {
    (bySubject[g.subject] = bySubject[g.subject] || []).push(g);
  });
  const avg = (arr: { grade_value: number }[]) =>
    arr.length ? (arr.reduce((s, g) => s + g.grade_value, 0) / arr.length).toFixed(2) : "—";

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold">{data.full_name}</h2>
        {data.class_name && <p className="text-slate-500 text-sm">Класс: {data.class_name}</p>}
      </div>

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

      {tab === "grades" && (
        Object.keys(bySubject).length === 0 ? <Empty icon="Star" text="Оценок пока нет" /> : (
          <div className="space-y-3">
            {Object.entries(bySubject).map(([subj, list]) => (
              <div key={subj} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold">{subj}</div>
                  <div className="text-sm text-slate-500">Средний балл: <b className="text-slate-800">{avg(list)}</b></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((g, i) => (
                    <span key={i} title={`${g.grade_date}${g.comment ? ` · ${g.comment}` : ""}`}
                      className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center ${GRADE_COLORS[g.grade_value]}`}>
                      {g.grade_value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "schedule" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.weekdays.map((w, di) => {
            const dl = data.schedule.filter((l) => l.day_of_week === di).sort((a, b) => a.lesson_number - b.lesson_number);
            return (
              <div key={di} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="font-bold text-sm mb-3">{w}</div>
                {dl.length === 0 ? <p className="text-xs text-slate-400">Нет уроков</p> : (
                  <div className="space-y-2">
                    {dl.map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{l.lesson_number}</span>
                        <div>
                          <div className="font-medium">{l.subject}</div>
                          <div className="text-xs text-slate-400">{l.teacher_name || ""}{l.room ? ` · каб. ${l.room}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "homework" && (
        data.homework.length === 0 ? <Empty icon="ClipboardList" text="Заданий пока нет" /> : (
          <div className="space-y-2">
            {data.homework.map((h, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{h.subject}</span>
                  <span className="text-xs text-slate-400">до {h.due_date}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{h.text}</div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "announce" && (
        data.announcements.length === 0 ? <Empty icon="Megaphone" text="Объявлений пока нет" /> : (
          <div className="space-y-2">
            {data.announcements.map((a, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="font-bold mb-0.5">{a.title}</div>
                <div className="text-xs text-slate-400 mb-1">{a.author_name}</div>
                <div className="text-sm whitespace-pre-wrap">{a.body}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="text-center py-12 text-slate-400"><Icon name={icon} size={36} className="mx-auto mb-2" />{text}</div>;
}
