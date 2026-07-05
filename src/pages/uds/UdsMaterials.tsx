import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import WatermarkPreview from "@/components/materials/WatermarkPreview";
import { materialsApi, type ModerationItem } from "@/lib/api";
import { toast } from "sonner";

interface UdsMaterialsProps {
  login: string;
  token: string;
}

const ROLE_LABEL: Record<string, string> = { teacher: "Учитель", student: "Ученик" };

export default function UdsMaterials({ login, token }: UdsMaterialsProps) {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialsApi.moderation(login, token);
      setItems(res.items);
    } catch (e) {
      const err = e as { error?: string; message?: string };
      toast.error(err.error || err.message || "Не удалось загрузить очередь");
    } finally {
      setLoading(false);
    }
  }, [login, token]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (item: ModerationItem, approve: boolean) => {
    if (!approve && !reason.trim()) {
      toast.error("Укажите причину отклонения");
      return;
    }
    setBusy(true);
    try {
      const res = await materialsApi.moderate(login, token, item.id, approve, approve ? "" : reason.trim());
      if (res.bonus_granted) {
        toast.success("Одобрено", { description: `Автору начислено ${res.bonus} бонусов` });
      } else {
        toast.success(approve ? "Материал одобрен" : "Материал отклонён");
      }
      setActive(null);
      setReason("");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      const err = e as { error?: string; message?: string };
      toast.error(err.error || err.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icon name="FileCheck" size={18} className="text-primary" />
            Проверка материалов
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Заявки от учителей и учеников. После одобрения материал появится в общей базе, учитель получает 10 бонусов.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <Icon name="RefreshCw" size={14} className="mr-1.5" />
          Обновить
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Icon name="CheckCircle2" size={40} className="mx-auto mb-2 opacity-40" />
          Все заявки проверены. Новых материалов нет.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((m) => (
            <div key={m.id} className="border border-border rounded-lg bg-white overflow-hidden">
              <button onClick={() => { setActive(m); setReason(""); }} className="block w-full text-left">
                <WatermarkPreview previewUrl={m.preview_url} fileExt={m.file_ext} title={m.title} className="h-36 w-full" />
              </button>
              <div className="p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                  {m.subject && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{m.subject}</span>}
                  {m.grade && <span>{m.grade}</span>}
                  {m.file_ext && <span className="uppercase font-mono">{m.file_ext}</span>}
                </div>
                <h3 className="font-semibold text-sm leading-snug">{m.title}</h3>
                {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Icon name="User" size={12} />
                  {m.author_name} · {ROLE_LABEL[m.author_role || ""] || m.author_role}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => moderate(m, true)} disabled={busy}>
                    <Icon name="Check" size={14} className="mr-1" />
                    Одобрить
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setActive(m); setReason(""); }}>
                    <Icon name="X" size={14} className="mr-1" />
                    Отклонить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Панель просмотра/отклонения */}
      {active && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{active.title}</h3>
              <button onClick={() => setActive(null)}><Icon name="X" size={18} /></button>
            </div>
            <WatermarkPreview previewUrl={active.preview_url} fileExt={active.file_ext} title={active.title} className="h-56 w-full rounded-md border border-border mb-3" />
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              {active.subject && <span className="px-2 py-1 rounded bg-primary/10 text-primary">{active.subject}</span>}
              {active.grade && <span className="px-2 py-1 rounded bg-muted">{active.grade}</span>}
              {active.material_type && <span className="px-2 py-1 rounded bg-muted">{active.material_type}</span>}
            </div>
            {active.description && <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{active.description}</p>}
            <a href={active.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 mb-4 hover:underline">
              <Icon name="ExternalLink" size={14} />
              Открыть оригинал файла для проверки
            </a>
            <div className="mb-3">
              <label className="text-sm font-medium">Причина отклонения (если отклоняете)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: низкое качество, нарушение авторских прав" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => moderate(active, true)} disabled={busy}>
                <Icon name="Check" size={15} className="mr-1.5" />
                Одобрить и опубликовать
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => moderate(active, false)} disabled={busy}>
                <Icon name="X" size={15} className="mr-1.5" />
                Отклонить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
