import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import UploadMaterialDialog from "@/components/materials/UploadMaterialDialog";
import { materialsApi, type MyMaterialItem } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

const STATUS_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending: { label: "На проверке", icon: "Clock", color: "text-amber-600", bg: "bg-amber-50" },
  approved: { label: "Одобрено", icon: "CheckCircle2", color: "text-green-600", bg: "bg-green-50" },
  rejected: { label: "Отклонено", icon: "XCircle", color: "text-red-600", bg: "bg-red-50" },
};

// Обрезаем длинные названия: больше 25 символов — ставим троеточие.
const truncateName = (name: string, max = 25) =>
  name.length > max ? name.slice(0, max).trimEnd() + "…" : name;

export function MyMaterialsSection() {
  const { teacher } = useAppStore();
  const [items, setItems] = useState<MyMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    if (!teacher) return;
    setLoading(true);
    try {
      const res = await materialsApi.my(teacher.login, teacher.authToken);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  useEffect(() => { load(); }, [load]);

  if (!teacher) return null;

  const approvedCount = items.filter(i => i.status === "approved").length;
  const bonusEarned = items.filter(i => i.bonus_granted).length * 10;

  return (
    <div className="animate-slide-up space-y-6">
      {/* Hero */}
      <div className="border border-border rounded-sm bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-sm flex items-center justify-center bg-primary/10 flex-shrink-0">
              <Icon name="FolderOpen" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Мои материалы</h2>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                Загружайте материалы в общедоступную базу. После проверки сотрудниками УДС они появятся на странице «Материалы».
                {teacher.role === "teacher" && " За каждый одобренный материал вы получаете 10 бонусов."}
              </p>
            </div>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Icon name="Upload" size={16} className="mr-1.5" />
            Загрузить материал
          </Button>
        </div>

        {teacher.role === "teacher" && items.length > 0 && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Icon name="CheckCircle2" size={16} className="text-green-600" />
              <span className="text-sm"><b>{approvedCount}</b> одобрено</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Coins" size={16} className="text-primary" />
              <span className="text-sm"><b>{bonusEarned}</b> бонусов заработано</span>
            </div>
          </div>
        )}
      </div>

      {/* Список моих материалов */}
      <div className="bg-white border border-border rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted">
          <div className="flex items-center gap-2.5">
            <Icon name="ListChecks" size={15} className="text-muted-foreground" />
            <p className="text-sm font-bold">Мои загрузки</p>
          </div>
          {items.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{items.length}</span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="FolderOpen" size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground mb-1">Вы ещё не загружали материалы</p>
            <p className="text-xs text-muted-foreground">Поделитесь своей разработкой с другими учителями и учениками</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((m) => {
              const meta = STATUS_META[m.status] || STATUS_META.pending;
              return (
                <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={m.title}>{truncateName(m.title)}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {m.subject && <span>{m.subject}</span>}
                      <span>{new Date(m.created_at).toLocaleDateString("ru-RU")}</span>
                      {m.status === "approved" && (
                        <span className="flex items-center gap-1">
                          <Icon name="Download" size={12} />
                          {m.downloads_count}
                        </span>
                      )}
                      {m.bonus_granted && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Icon name="Coins" size={12} />
                          +10 бонусов
                        </span>
                      )}
                    </div>
                    {m.status === "rejected" && m.reject_reason && (
                      <p className="text-xs text-red-500 mt-1">Причина: {m.reject_reason}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${meta.bg} ${meta.color}`}>
                    <Icon name={meta.icon} size={13} />
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UploadMaterialDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        session={{ login: teacher.login, token: teacher.authToken, role: teacher.role, name: teacher.name, subscriptionActive: teacher.subscriptionActive }}
        onUploaded={load}
      />
    </div>
  );
}