import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { udsApi } from "@/lib/api";
import { NAV_ITEMS, STUDENT_NAV_ITEMS } from "@/components/scanner/types";

type RoleKey = "teacher" | "student";

const ROLE_META: Record<RoleKey, { label: string; icon: string; items: { id: string; label: string; icon: string }[] }> = {
  teacher: { label: "Учитель", icon: "GraduationCap", items: NAV_ITEMS },
  student: { label: "Ученик / студент", icon: "Backpack", items: STUDENT_NAV_ITEMS },
};

export default function UdsLkView({ login, token }: { login: string; token: string }) {
  const [role, setRole] = useState<RoleKey>("teacher");
  const [hiddenAll, setHiddenAll] = useState<{ teacher: string[]; student: string[] }>({ teacher: [], student: [] });
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    udsApi.getLkVisibility(login, token)
      .then(r => setHiddenAll(r.hidden))
      .catch(e => setError((e as Error).message));
  }, [login, token]);

  useEffect(() => { setDraft(hiddenAll[role] || []); setSaved(false); }, [role, hiddenAll]);

  const toggle = (id: string) => {
    setSaved(false);
    setDraft(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      await udsApi.setLkVisibility(login, token, role, draft);
      setHiddenAll(h => ({ ...h, [role]: draft }));
      setSaved(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const items = ROLE_META[role].items;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold">Вид ЛК</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Скрывайте разделы личного кабинета по ролям. Отмеченные — скрыты.</p>
      </div>

      <div className="flex gap-2">
        {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
          <button key={r} onClick={() => setRole(r)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${role === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
            <Icon name={ROLE_META[r].icon} size={14} fallback="User" />
            {ROLE_META[r].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={13} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {items.map(item => {
          const hidden = draft.includes(item.id);
          return (
            <button key={item.id} onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
              <Icon name={item.icon} size={16} className="text-muted-foreground" fallback="Circle" />
              <span className="flex-1 text-sm">{item.label}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${hidden ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                {hidden ? "Скрыт" : "Виден"}
              </span>
              <Icon name={hidden ? "EyeOff" : "Eye"} size={15} className={hidden ? "text-red-500" : "text-green-500"} />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
          {busy ? <><Icon name="Loader2" size={13} className="animate-spin" /> Сохранение…</> : <><Icon name="Save" size={13} /> Сохранить</>}
        </button>
        {saved && <span className="text-xs text-green-600 flex items-center gap-1"><Icon name="CheckCircle2" size={13} /> Сохранено</span>}
      </div>
    </div>
  );
}
