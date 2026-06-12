import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

interface Props {
  title: string;
  subtitle?: string;
  onLogout: () => void;
}

export default function CabinetHeader({ title, subtitle, onLogout }: Props) {
  const navigate = useNavigate();
  return (
    <header className="bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/sjou")} className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Icon name="GraduationCap" size={20} className="text-white" />
          </div>
          <div className="leading-tight min-w-0 text-left">
            <div className="font-extrabold text-sm">{title}</div>
            {subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}
          </div>
        </button>
        <button onClick={onLogout} className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5 flex-shrink-0">
          <Icon name="LogOut" size={15} />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </header>
  );
}
