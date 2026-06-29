import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type WorksheetItem } from "@/store/appStore";
import { yadisk } from "@/lib/yadisk";

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}

export function WorksheetCard({ item }: { item: WorksheetItem }) {
  const { teacher } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const onDelete = () => {
    if (confirm(`Удалить «${item.title}» из истории? Файл на Я.Диске останется.`)) {
      appStore.removeWorksheet(item.id);
    }
  };

  const handleDownload = async () => {
    if (!item.uploadedToYadisk || !item.yadiskPath || !teacher?.yadiskToken) return;
    setDownloading(true);
    try {
      const result = await yadisk.downloadBinary(teacher.yadiskToken, item.yadiskPath);
      const bin = atob(result.content_b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        {/* Миниатюра бланка */}
        <div className="w-12 h-14 rounded-lg flex-shrink-0 relative overflow-hidden shadow-sm border"
          style={{ background: "#fff", borderColor: "#1B4F9C" }}>
          <div className="absolute top-0 left-0 right-0 h-3" style={{ background: "#0D1B3E" }} />
          <div className="absolute inset-x-1 top-4 space-y-0.5">
            <div className="h-0.5 rounded-full" style={{ background: "#1B4F9C", opacity: 0.5 }} />
            <div className="h-0.5 rounded-full bg-gray-300 w-3/4" />
            <div className="h-0.5 rounded-full bg-gray-300" />
            <div className="h-0.5 rounded-full bg-gray-300 w-1/2" />
          </div>
        </div>

        {/* Мета */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate mb-1">{item.title}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon name="BookText" size={10} fallback="Book" />
              {item.subject} · {item.classNum} кл.
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="ListChecks" size={10} />
              {item.tasksCount} заданий
            </span>
            {item.imagesAdded > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="Image" size={10} fallback="ImagePlus" />
                {item.imagesAdded} илл.
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="HardDrive" size={10} />
              {formatBytes(item.size)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Calendar" size={10} />
              {new Date(item.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </span>
            <span className={`inline-flex items-center gap-1 ${item.uploadedToYadisk ? "text-green-600" : "text-amber-600"}`}>
              <Icon name={item.uploadedToYadisk ? "CloudCheck" : "CloudOff"} size={10} fallback="Cloud" />
              {item.uploadedToYadisk ? "Я.Диск" : "Не загружено"}
            </span>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Задания"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={13} />
          </button>
          {item.uploadedToYadisk && item.yadiskPath && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              title="Скачать с Я.Диска"
            >
              <Icon name={downloading ? "Loader2" : "Download"} size={13} className={downloading ? "animate-spin" : ""} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors"
            title="Удалить из истории"
          >
            <Icon name="Trash2" size={13} />
          </button>
        </div>
      </div>

      {/* Раскрытые задания */}
      {expanded && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border" style={{ marginLeft: "calc(3rem + 12px)" }}>
          {item.intro && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border italic" style={{ background: "#0D1B3E08" }}>
              {item.intro}
            </div>
          )}
          <div className="divide-y divide-border">
            {item.tasks.map((t) => (
              <div key={t.number} className="px-3 py-2 flex items-start gap-2.5">
                <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-5 text-right" style={{ color: "#1B4F9C" }}>
                  {t.number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{t.instruction}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {t.type && <span className="text-[10px] text-muted-foreground">{t.type}</span>}
                    {t.table && t.table.headers?.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Icon name="Table2" size={9} fallback="Grid" /> Таблица
                      </span>
                    )}
                    {t.content && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Icon name="FileText" size={9} /> Данные
                      </span>
                    )}
                    {t.image_query && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Icon name="Image" size={9} fallback="ImagePlus" /> Иллюстрация
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {item.conclusion && (
            <div className="px-3 py-2 border-t border-border" style={{ background: "#1B4F9C08" }}>
              <p className="text-[10px] font-bold mb-0.5" style={{ color: "#1B4F9C" }}>Вывод</p>
              <p className="text-xs text-muted-foreground italic">{item.conclusion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}