import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import CabinetHeader from "@/components/sjou/cabinet/CabinetHeader";
import StudentDashboardView from "@/components/sjou/cabinet/StudentDashboardView";
import { OoSession, loadSession, clearSession, authCall, StudentDashboard } from "@/components/sjou/cabinet/api";
import { SJOU_STUDENT_TAB_TO_PATH, PATH_TO_SJOU_STUDENT_TAB } from "@/lib/routes";

export default function SjouStudentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session] = useState<OoSession | null>(() => loadSession());
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const tab = PATH_TO_SJOU_STUDENT_TAB[location.pathname] || "grades";

  useEffect(() => {
    if (!session || session.role !== "student") { navigate("/sjou"); return; }
    authCall(session, "s_dashboard")
      .then((d) => setData(d as unknown as StudentDashboard))
      .catch(() => { clearSession(); navigate("/sjou"); })
      .finally(() => setLoading(false));
  }, [session, navigate]);

  if (!session) return null;
  const logout = () => { clearSession(); navigate("/sjou"); };

  return (
    <div className="min-h-screen bg-slate-50">
      <CabinetHeader title="Дневник ученика · СЖОУ" subtitle={session.oo_full_name} onLogout={logout} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-slate-400"><Icon name="Loader2" size={32} className="animate-spin mx-auto" /></div>
        ) : data ? (
          <StudentDashboardView data={data} tab={tab} onTabChange={(t) => navigate(SJOU_STUDENT_TAB_TO_PATH[t])} />
        ) : null}
      </div>
    </div>
  );
}