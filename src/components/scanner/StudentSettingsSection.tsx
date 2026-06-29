import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { ProfileCard } from "./ProfileCard";
import { YadiskCard } from "./YadiskCard";
import { StorageModeCard } from "./StorageModeCard";
import { useAppStore } from "@/store/appStore";
import { studentLinkApi } from "@/lib/api";

function StudentBindCard() {
  const { teacher } = useAppStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState<{ full_name?: string; class_label?: string | null; bind_code?: string } | null>(null);

  const reload = () => {
    if (!teacher) return;
    setLoading(true);
    studentLinkApi.myBinding(teacher.login)
      .then(d => setBinding(d.bound ? { full_name: d.full_name, class_label: d.class_label, bind_code: d.bind_code } : null))
      .catch(() => setBinding(null))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [teacher?.login]);

  const submit = async () => {
    if (!teacher || code.trim().length < 4) return;
    setBusy(true); setError("");
    try {
      const res = await studentLinkApi.bind(teacher.login, code.trim().toUpperCase());
      setBinding({ full_name: res.full_name, class_label: res.class_label, bind_code: code.trim().toUpperCase() });
      setCode("");
    } catch (e) {
      setError((e as Error).message || "Не удалось привязать код");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <Icon name="Link" size={16} className="text-primary" />
        <div>
          <p className="text-sm font-semibold">Привязка к учителю</p>
          <p className="text-xs text-muted-foreground">Введите код привязки, чтобы видеть свои результаты</p>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Loader2" size={15} className="animate-spin" /> Проверяем привязку…
          </div>
        ) : binding ? (
          <div className="flex items-center gap-3 p-3 rounded-sm bg-green-50 border border-green-100">
            <Icon name="CheckCircle2" size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 truncate">{binding.full_name}</p>
              <p className="text-xs text-green-700">
                {binding.class_label ? `Класс ${binding.class_label} · ` : ""}код {binding.bind_code}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Код привязки (8 символов)</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                placeholder="A7K2M9QX"
                className="w-full px-3 py-2.5 border border-border rounded-sm text-base font-bold mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
                <Icon name="AlertCircle" size={14} className="text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            <button
              onClick={submit}
              disabled={busy || code.length < 4}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Icon name={busy ? "Loader2" : "Link"} size={14} className={busy ? "animate-spin" : ""} />
              Привязать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentSettingsSection() {
  const { storageMode } = useAppStore();
  return (
    <div className="animate-slide-up space-y-6">
      <StudentBindCard />
      <ProfileCard />
      <StorageModeCard />
      {storageMode === "yadisk" && <YadiskCard />}
    </div>
  );
}

export default StudentSettingsSection;