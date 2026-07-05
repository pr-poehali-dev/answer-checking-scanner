import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsConsent } from "@/lib/api";

const CONTEXT_LABELS: Record<string, string> = {
  registration: "Регистрация (учитель/ученик)",
  institution_registration: "Регистрация учреждения",
  sjou_application: "Заявка ОО в СЖОУ",
  subscription: "Оформление подписки",
};

const CONTEXT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все формы" },
  { value: "registration", label: "Регистрация" },
  { value: "institution_registration", label: "Учреждение" },
  { value: "sjou_application", label: "Заявка СЖОУ" },
];

export default function UdsConsents({ login, token }: { login: string; token: string }) {
  const [consents, setConsents] = useState<UdsConsent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.consents(login, token, q.trim() || undefined, ctx || undefined);
      setConsents(res.consents);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token, q, ctx]);

  useEffect(() => { load(); }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold">Журнал согласий ({consents.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Доказательная база: кто, когда, с какого IP и с какой редакцией документов согласился.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors disabled:opacity-50">
          <Icon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            placeholder="ФИО, логин, email или телефон"
            className="w-full pl-9 pr-3 py-2 border border-border rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={ctx}
          onChange={e => setCtx(e.target.value)}
          className="px-3 py-2 border border-border rounded-sm text-xs bg-white focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CONTEXT_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs rounded-sm hover:opacity-90">
          <Icon name="Search" size={13} /> Найти
        </button>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {consents.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Записей о согласиях пока нет</p>
        )}
        {consents.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <button
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              className="w-full flex items-start gap-3 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="ShieldCheck" size={14} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {c.full_name || c.login || c.email || "—"}
                  </p>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {c.created_at ? new Date(c.created_at).toLocaleString("ru-RU") : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {CONTEXT_LABELS[c.context] || c.context}
                  {c.login ? ` · ${c.login}` : ""}
                  {c.ip_address ? ` · IP ${c.ip_address}` : ""}
                </p>
              </div>
              <Icon name={expanded === c.id ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
            </button>

            {expanded === c.id && (
              <div className="mt-3 ml-11 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Field label="Пользователь (ID)" value={c.user_id != null ? String(c.user_id) : "—"} />
                <Field label="Логин" value={c.login || "—"} />
                <Field label="ФИО" value={c.full_name || "—"} />
                <Field label="Email" value={c.email || "—"} />
                <Field label="Телефон" value={c.phone || "—"} />
                <Field label="Контекст (форма)" value={CONTEXT_LABELS[c.context] || c.context} />
                <Field label="Дата и время" value={c.created_at ? new Date(c.created_at).toLocaleString("ru-RU") : "—"} />
                <Field label="IP-адрес" value={c.ip_address || "—"} mono />
                <Field label="Документы" value={c.documents || "—"} />
                <Field label="Версия сайта" value={c.app_version || "—"} mono />
                <Field label="Ред. Политики" value={c.privacy_revision || "—"} />
                <Field label="Ред. Оферты" value={c.oferta_revision || "—"} />
                {c.institution_id != null && <Field label="ID учреждения" value={String(c.institution_id)} />}
                {c.user_agent && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Устройство (User-Agent)</p>
                    <p className="text-[11px] text-foreground break-all">{c.user_agent}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-[12px] text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
