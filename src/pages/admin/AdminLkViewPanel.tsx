import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { NAV_ITEMS, STUDENT_NAV_ITEMS } from "@/components/scanner/types";

type RoleKey = "teacher" | "student";

const ROLE_META: Record<RoleKey, { label: string; icon: string; items: { id: string; label: string; icon: string }[] }> = {
  teacher: { label: "Учитель", icon: "GraduationCap", items: NAV_ITEMS },
  student: { label: "Ученик / студент", icon: "Backpack", items: STUDENT_NAV_ITEMS },
};

export default function AdminLkViewPanel() {
  const { hiddenSections } = useAppStore();
  const [role, setRole] = useState<RoleKey>("teacher");
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    appStore.loadLkVisibility();
  }, []);

  // При смене роли — синхронизируем черновик с сохранённым состоянием
  useEffect(() => {
    setDraft(hiddenSections[role] || []);
    setSaved(false);
  }, [role, hiddenSections]);

  const meta = ROLE_META[role];

  const toggle = (id: string) => {
    setSaved(false);
    setDraft(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const save = async () => {
    setBusy(true); setError(""); setSaved(false);
    const res = await appStore.setLkVisibility(role, draft);
    setBusy(false);
    if (res.ok) setSaved(true);
    else setError(res.error || "Ошибка сохранения");
  };

  const dirty = JSON.stringify([...draft].sort()) !== JSON.stringify([...(hiddenSections[role] || [])].sort());

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold">Вид личного кабинета</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Выберите роль и отметьте разделы, которые будут <strong>скрыты</strong> в личном кабинете всех пользователей этой роли.
        </p>
      </div>

      {/* Переключатель роли */}
      <div className="flex gap-2">
        {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-sm border text-sm font-medium transition-colors ${
              role === r ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Icon name={ROLE_META[r].icon} size={15} className={role === r ? "text-primary" : ""} fallback="User" />
            {ROLE_META[r].label}
          </button>
        ))}
      </div>

      {/* Список разделов */}
      <div className="border border-border rounded-sm bg-white divide-y divide-border">
        {meta.items.map(item => {
          const hidden = draft.includes(item.id);
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <Icon name={item.icon} size={16} className="text-muted-foreground flex-shrink-0" fallback="Circle" />
              <span className="flex-1 text-sm">{item.label}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${hidden ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-600"}`}>
                {hidden ? "Скрыт" : "Виден"}
              </span>
              <button
                onClick={() => toggle(item.id)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${hidden ? "bg-muted" : "bg-primary"}`}
                title={hidden ? "Показать раздел" : "Скрыть раздел"}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hidden ? "" : "translate-x-5"}`} />
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Icon name={busy ? "Loader2" : "Save"} size={14} className={busy ? "animate-spin" : ""} />
          Сохранить
        </button>
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
            <Icon name="CheckCircle2" size={14} /> Сохранено
          </span>
        )}
      </div>
    </div>
  );
}
