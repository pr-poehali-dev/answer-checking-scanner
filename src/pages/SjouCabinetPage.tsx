import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { OoSession, loadSession, clearSession, cabinetCall } from "@/components/sjou/cabinet/api";
import ClassesSection from "@/components/sjou/cabinet/ClassesSection";
import TeachersSection from "@/components/sjou/cabinet/TeachersSection";
import StudentsSection from "@/components/sjou/cabinet/StudentsSection";
import ScheduleSection from "@/components/sjou/cabinet/ScheduleSection";
import JournalSection from "@/components/sjou/cabinet/JournalSection";

type Tab = "overview" | "classes" | "teachers" | "students" | "schedule" | "journal";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Обзор", icon: "LayoutDashboard" },
  { id: "classes", label: "Классы", icon: "School" },
  { id: "teachers", label: "Учителя", icon: "GraduationCap" },
  { id: "students", label: "Ученики", icon: "Users" },
  { id: "schedule", label: "Расписание", icon: "CalendarDays" },
  { id: "journal", label: "Журнал оценок", icon: "BookOpenCheck" },
];

interface Overview {
  oo_full_name: string;
  classes: number;
  teachers: number;
  students: number;
}

export default function SjouCabinetPage() {
  const navigate = useNavigate();
  const [session] = useState<OoSession | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);

  const loadOverview = useCallback(async () => {
    if (!session) return;
    try {
      const d = await cabinetCall(session, "overview");
      setOverview(d as unknown as Overview);
    } catch {
      // если сессия невалидна — на выход
      clearSession();
      navigate("/sjou");
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session) { navigate("/sjou"); return; }
    loadOverview();
  }, [session, navigate, loadOverview]);

  if (!session) return null;

  const logout = () => { clearSession(); navigate("/sjou"); };

  const stats = [
    { id: "classes" as Tab, label: "Классы", value: overview?.classes ?? 0, icon: "School", color: "#2563eb" },
    { id: "teachers" as Tab, label: "Учителя", value: overview?.teachers ?? 0, icon: "GraduationCap", color: "#16a34a" },
    { id: "students" as Tab, label: "Ученики", value: overview?.students ?? 0, icon: "Users", color: "#9333ea" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Icon name="GraduationCap" size={20} className="text-white" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-sm">Кабинет ОО · СЖОУ</div>
              <div className="text-xs text-slate-400 truncate">{overview?.oo_full_name || session.oo_full_name}</div>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5 flex-shrink-0">
            <Icon name="LogOut" size={15} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Навигация */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === n.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon name={n.icon} size={15} />
              {n.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div>
            <h2 className="text-2xl font-extrabold mb-1">Добро пожаловать!</h2>
            <p className="text-slate-500 mb-6">{overview?.oo_full_name || session.oo_full_name}</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {stats.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTab(s.id)}
                  className="bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-md transition-shadow"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}15` }}>
                    <Icon name={s.icon} size={22} style={{ color: s.color }} />
                  </div>
                  <div className="text-3xl font-extrabold">{s.value}</div>
                  <div className="text-sm text-slate-500">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "classes" && <ClassesSection session={session} onChanged={loadOverview} />}
        {tab === "teachers" && <TeachersSection session={session} onChanged={loadOverview} />}
        {tab === "students" && <StudentsSection session={session} onChanged={loadOverview} />}
        {tab === "schedule" && <ScheduleSection session={session} />}
        {tab === "journal" && <JournalSection session={session} />}
      </div>
    </div>
  );
}