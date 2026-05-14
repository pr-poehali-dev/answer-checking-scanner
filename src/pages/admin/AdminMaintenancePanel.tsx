import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { NAV_ITEMS } from "@/components/scanner/types";
import { authApi } from "@/lib/api";

interface Props {
  token: string;
}

export default function AdminMaintenancePanel({ token }: Props) {
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    authApi.getMaintenance()
      .then(r => setSections(r.sections || []))
      .catch(() => setError("Не удалось загрузить статус разделов"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await authApi.setMaintenance(token, sections);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold">Технические работы</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Закрытые разделы показывают заглушку для обычных пользователей. Тестеры видят всё.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Icon name="Loader2" size={16} className="animate-spin" />
          Загрузка...
        </div>
      ) : (
        <div className="border border-border rounded-sm bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Раздел</th>
                <th className="px-4 py-2 text-center font-semibold w-32">Статус</th>
                <th className="px-4 py-2 text-center font-semibold w-32">Техработы</th>
              </tr>
            </thead>
            <tbody>
              {NAV_ITEMS.map(item => {
                const isClosed = sections.includes(item.id);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon name={item.icon} size={14} fallback="Circle" className="text-muted-foreground" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 text-orange-600">
                          <Icon name="Construction" size={12} />
                          Закрыт
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Icon name="CircleCheck" size={12} fallback="Check" />
                          Доступен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggle(item.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          isClosed ? "bg-orange-400" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow ${
                          isClosed ? "translate-x-4" : "translate-x-0.5"
                        }`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving
            ? <><Icon name="Loader2" size={13} className="animate-spin" />Сохранение...</>
            : <><Icon name="Save" size={13} />Сохранить изменения</>
          }
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
            <Icon name="CheckCircle2" size={13} />
            Сохранено
          </span>
        )}
        {sections.length > 0 && (
          <span className="text-xs text-orange-600">
            {sections.length} {sections.length === 1 ? "раздел закрыт" : sections.length < 5 ? "раздела закрыто" : "разделов закрыто"}
          </span>
        )}
      </div>
    </div>
  );
}
