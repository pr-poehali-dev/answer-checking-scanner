import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { udsApi } from "@/lib/api";
import { NAV_ITEMS } from "@/components/scanner/types";

export default function UdsMaintenance({ login, token }: { login: string; token: string }) {
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    udsApi.getMaintenance(login, token)
      .then(r => setDraft(r.sections))
      .catch(e => setError((e as Error).message));
  }, [login, token]);

  const toggle = (id: string) => {
    setSaved(false);
    setDraft(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);
  };

  const save = async () => {
    setBusy(true); setError("");
    try { await udsApi.setMaintenance(login, token, draft); setSaved(true); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold">Тех. работы</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Отмеченные разделы закрываются на техработы для всех (кроме тестеров).
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={13} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {NAV_ITEMS.filter(i => i.id !== "support" && i.id !== "settings").map(item => {
          const on = draft.includes(item.id);
          return (
            <button key={item.id} onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
              <Icon name={item.icon} size={16} className="text-muted-foreground" fallback="Circle" />
              <span className="flex-1 text-sm">{item.label}</span>
              {on && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">ТО</span>
              )}
              <Icon name={on ? "Construction" : "Circle"} size={15} className={on ? "text-orange-500" : "text-muted-foreground/30"} fallback="Circle" />
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
