import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import CabinetHeader from "@/components/sjou/cabinet/CabinetHeader";
import StudentDashboardView from "@/components/sjou/cabinet/StudentDashboardView";
import { OoSession, loadSession, clearSession, authCall, StudentDashboard } from "@/components/sjou/cabinet/api";

interface Child {
  id: number;
  full_name: string;
  class_name?: string;
}

export default function SjouParentPage() {
  const navigate = useNavigate();
  const [session] = useState<OoSession | null>(() => loadSession());
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChild, setLoadingChild] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "parent") { navigate("/sjou"); return; }
    authCall(session, "p_children")
      .then((d) => {
        const list = (d.children as Child[]) || [];
        setChildren(list);
        if (list.length) setActiveId(list[0].id);
      })
      .catch(() => { clearSession(); navigate("/sjou"); })
      .finally(() => setLoading(false));
  }, [session, navigate]);

  useEffect(() => {
    if (!session || activeId === null) return;
    setLoadingChild(true);
    authCall(session, "p_child_dashboard", { student_id: activeId })
      .then((d) => setData(d as unknown as StudentDashboard))
      .catch(() => setData(null))
      .finally(() => setLoadingChild(false));
  }, [session, activeId]);

  if (!session) return null;
  const logout = () => { clearSession(); navigate("/sjou"); };

  return (
    <div className="min-h-screen bg-slate-50">
      <CabinetHeader title="Кабинет родителя · СЖОУ" subtitle={session.oo_full_name} onLogout={logout} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-slate-400"><Icon name="Loader2" size={32} className="animate-spin mx-auto" /></div>
        ) : children.length === 0 ? (
          <div className="text-center py-20 text-slate-400"><Icon name="Users" size={36} className="mx-auto mb-2" />Нет привязанных детей</div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="flex gap-2 mb-6 flex-wrap">
                {children.map((c) => (
                  <button key={c.id} onClick={() => setActiveId(c.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeId === c.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                    {c.full_name}{c.class_name ? ` · ${c.class_name}` : ""}
                  </button>
                ))}
              </div>
            )}
            {loadingChild ? (
              <div className="text-center py-20 text-slate-400"><Icon name="Loader2" size={32} className="animate-spin mx-auto" /></div>
            ) : data ? (
              <StudentDashboardView data={data} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
