import Icon from "@/components/ui/icon";
import { Application, STATUS_META, fmtDate } from "./types";

interface ApplicationsListProps {
  operatorNumber: string;
  setOperatorNumber: (v: string) => void;
  onLogout: () => void;
  filter: string;
  setFilter: (v: string) => void;
  counts: Record<string, number>;
  loading: boolean;
  apps: Application[];
  openApp: (a: Application) => void;
}

export default function ApplicationsList({
  operatorNumber,
  setOperatorNumber,
  onLogout,
  filter,
  setFilter,
  counts,
  loading,
  apps,
  openApp,
}: ApplicationsListProps) {
  return (
    <>
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon name="ShieldCheck" size={22} />
            <div className="font-bold">Панель оператора СЖОУ</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Icon name="BadgeCheck" size={15} className="text-slate-400" />
              <input
                value={operatorNumber}
                onChange={(e) => setOperatorNumber(e.target.value)}
                placeholder="Номер оператора"
                className="bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 w-36 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <button
              onClick={onLogout}
              className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <Icon name="LogOut" size={15} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Фильтры */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { id: "pending", label: "На рассмотрении" },
            { id: "approved", label: "Одобренные" },
            { id: "rejected", label: "Отклонённые" },
            { id: "all", label: "Все" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === t.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {t.id !== "all" && counts[t.id] ? (
                <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Icon name="Inbox" size={40} className="mx-auto mb-3" />
            Заявок нет
          </div>
        ) : (
          <div className="grid gap-3">
            {apps.map((a) => {
              const m = STATUS_META[a.status] || STATUS_META.pending;
              return (
                <button
                  key={a.id}
                  onClick={() => openApp(a)}
                  className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md transition-shadow flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>
                        <Icon name={m.icon} size={12} />
                        {m.label}
                      </span>
                      <span className="text-xs text-slate-400">#{a.id}</span>
                    </div>
                    <div className="font-bold truncate">{a.oo_full_name}</div>
                    <div className="text-sm text-slate-500 truncate">
                      {a.oo_type_label} · {a.region} · ИНН {a.inn}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-slate-400">{fmtDate(a.created_at)}</div>
                    {a.statement_file_url && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <Icon name="Paperclip" size={12} />
                        файл
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
