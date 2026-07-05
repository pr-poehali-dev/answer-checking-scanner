import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import WatermarkPreview from "./WatermarkPreview";
import { materialsApi, type MaterialItem } from "@/lib/api";
import { toast } from "sonner";
import type { MaterialsSession } from "@/lib/materialsSession";

interface MaterialViewDialogProps {
  item: MaterialItem | null;
  onClose: () => void;
  session: MaterialsSession | null;
  onLimitReached: () => void;
}

const ROLE_LABEL: Record<string, string> = { teacher: "Учитель", student: "Ученик" };

export default function MaterialViewDialog({ item, onClose, session, onLimitReached }: MaterialViewDialogProps) {
  const [downloading, setDownloading] = useState(false);
  if (!item) return null;

  const download = async () => {
    setDownloading(true);
    try {
      const res = await materialsApi.download(item.id, session?.login, session?.token);
      // Скачивание оригинала без водяных знаков
      const a = document.createElement("a");
      a.href = res.file_url;
      a.download = res.file_name || item.title;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Файл скачивается", { description: "Оригинал без водяных знаков" });
    } catch (e) {
      const err = e as { status?: number; error?: string; message?: string };
      if (err.status === 402) {
        onClose();
        onLimitReached();
        return;
      }
      toast.error("Не удалось скачать", { description: err.message || err.error || "Ошибка" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <WatermarkPreview
            previewUrl={item.preview_url}
            fileExt={item.file_ext}
            title={item.title}
            className="h-72 w-full rounded-lg border border-border"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            {item.subject && <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">{item.subject}</span>}
            {item.grade && <span className="px-2 py-1 rounded bg-muted">{item.grade}</span>}
            {item.material_type && <span className="px-2 py-1 rounded bg-muted">{item.material_type}</span>}
            {item.file_ext && <span className="px-2 py-1 rounded bg-muted uppercase font-mono">{item.file_ext}</span>}
          </div>

          {item.description && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Описание</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
            <span className="flex items-center gap-1.5">
              <Icon name="User" size={15} />
              {item.author_name}
              {item.author_role && ROLE_LABEL[item.author_role] && (
                <span className="opacity-70">· {ROLE_LABEL[item.author_role]}</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="Download" size={15} />
              {item.downloads_count} скачиваний
            </span>
          </div>

          <div className="rounded-md bg-warning/10 text-xs p-2.5 flex gap-2">
            <Icon name="ShieldAlert" size={15} className="shrink-0 mt-0.5 text-warning" />
            <span>Превью защищено водяным знаком САОУ. Копирование запрещено. Скачанный файл — оригинал без водяных знаков.</span>
          </div>

          <Button className="w-full" size="lg" onClick={download} disabled={downloading}>
            <Icon name="Download" size={18} className="mr-2" />
            {downloading ? "Подготовка..." : "Скачать материал"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}