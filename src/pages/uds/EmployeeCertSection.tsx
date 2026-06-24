import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsCert } from "@/lib/api";

const CERT_STATUS: Record<string, { label: string; color: string }> = {
  assigned: { label: "Назначен выпуск", color: "bg-amber-50 text-amber-600 border-amber-200" },
  issuing: { label: "Выпускается", color: "bg-blue-50 text-blue-600 border-blue-200" },
  active: { label: "Активен", color: "bg-green-50 text-green-600 border-green-200" },
  revoked: { label: "Отозван", color: "bg-red-50 text-red-600 border-red-200" },
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default function EmployeeCertSection({ login, token, targetLogin }: {
  login: string; token: string; targetLogin: string;
}) {
  const [cert, setCert] = useState<UdsCert | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [issueCode, setIssueCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await udsApi.certStatus(login, token, targetLogin);
      setCert(res.cert);
    } catch (e) { setError((e as Error).message); }
    finally { setLoaded(true); }
  }, [login, token, targetLogin]);

  useEffect(() => { load(); }, [load]);

  // Автообновление статуса, пока сертификат в процессе
  useEffect(() => {
    if (cert && (cert.status === "assigned" || cert.status === "issuing")) {
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }
  }, [cert?.status, load]);

  const assign = async () => {
    setBusy(true); setError("");
    try {
      await udsApi.assignCert(login, token, targetLogin, issueCode.trim());
      setIssueCode(""); setShowCode(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!confirm("Отозвать сертификат сотрудника? Вход по нему станет невозможен.")) return;
    setBusy(true); setError("");
    try { await udsApi.revokeCert(login, token, targetLogin); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const active = cert && (cert.status === "assigned" || cert.status === "issuing" || cert.status === "active");
  const st = cert ? CERT_STATUS[cert.status] : null;
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString("ru-RU") : "—";

  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon name="BadgeCheck" size={15} className="text-blue-600" fallback="ShieldCheck" />
        <p className="text-xs font-bold">Сертификат входа в УДС</p>
        {st && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loaded && (!cert || cert.status === "revoked") && (
        <>
          {!showCode ? (
            <button onClick={() => setShowCode(true)} disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50">
              <Icon name="ShieldPlus" size={13} fallback="Shield" /> Выпустить и привязать сертификат
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Введите код ИИС выпуска для подтверждения</p>
              <div className="flex gap-2">
                <input value={issueCode} onChange={e => setIssueCode(e.target.value)} placeholder="Код выпуска" autoFocus
                  className="flex-1 border border-border rounded px-2 py-1.5 text-xs" />
                <button onClick={assign} disabled={busy || !issueCode.trim()}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                  {busy ? "…" : "Подтвердить"}
                </button>
                <button onClick={() => { setShowCode(false); setIssueCode(""); }} className="px-2 py-1.5 border border-border text-xs rounded hover:bg-muted">Отмена</button>
              </div>
            </div>
          )}
        </>
      )}

      {cert && cert.status !== "revoked" && (
        <div className="text-xs space-y-1">
          {cert.status === "assigned" && <p className="text-muted-foreground">Ожидает, пока сотрудник начнёт выпуск в своём ЛК.</p>}
          {cert.status === "issuing" && <p className="text-muted-foreground">Сотрудник выпускает сертификат ({cert.container_type === "rutoken" ? "Рутокен" : "КриптоПро"})…</p>}
          {cert.status === "active" && (
            <div className="grid grid-cols-2 gap-2">
              <Info label="Носитель" value={cert.container_type === "rutoken" ? "Рутокен" : "КриптоПро"} />
              <Info label="Серийный №" value={cert.serial_number || "—"} />
              <Info label="Выдан" value={fmt(cert.issued_at)} />
              <Info label="Действует до" value={fmt(cert.not_after)} />
            </div>
          )}
          {active && (
            <button onClick={revoke} disabled={busy}
              className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 disabled:opacity-50">
              <Icon name="ShieldX" size={13} fallback="X" /> Отозвать сертификат
            </button>
          )}
        </div>
      )}
    </div>
  );
}
