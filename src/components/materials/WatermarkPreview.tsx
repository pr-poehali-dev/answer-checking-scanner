import Icon from "@/components/ui/icon";

interface WatermarkPreviewProps {
  previewUrl?: string | null;
  fileExt?: string | null;
  title: string;
  className?: string;
}

const EXT_ICON: Record<string, string> = {
  pdf: "FileText",
  doc: "FileText",
  docx: "FileText",
  ppt: "Presentation",
  pptx: "Presentation",
  xls: "Sheet",
  xlsx: "Sheet",
  zip: "FileArchive",
  txt: "FileText",
  png: "Image",
  jpg: "Image",
  jpeg: "Image",
};

/** Превью материала с водяным знаком САОУ и защитой от копирования. */
export default function WatermarkPreview({ previewUrl, fileExt, title, className }: WatermarkPreviewProps) {
  const ext = (fileExt || "").toLowerCase();
  const isImage = ["png", "jpg", "jpeg"].includes(ext) && !!previewUrl;

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className={`relative overflow-hidden select-none bg-muted ${className || ""}`}
      onContextMenu={block}
      onDragStart={block}
      onCopy={block}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {isImage ? (
        <img
          src={previewUrl!}
          alt={title}
          draggable={false}
          onContextMenu={block}
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Icon name={EXT_ICON[ext] || "File"} size={48} />
          <span className="text-xs uppercase tracking-wide font-mono">{ext || "файл"}</span>
        </div>
      )}

      {/* Прозрачный слой поверх — блокирует выделение/сохранение картинки */}
      <div className="absolute inset-0" onContextMenu={block} />

      {/* Диагональный водяной знак */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div className="flex flex-col gap-6 opacity-[0.14] -rotate-[30deg] scale-150">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex gap-8 whitespace-nowrap">
              {[0, 1, 2, 3].map((col) => (
                <span key={col} className="text-base font-bold text-foreground tracking-widest">
                  САОУ · копирование запрещено
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
