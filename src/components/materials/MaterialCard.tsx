import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import WatermarkPreview from "./WatermarkPreview";
import type { MaterialItem } from "@/lib/api";

interface MaterialCardProps {
  item: MaterialItem;
  onOpen: (item: MaterialItem) => void;
}

const ROLE_LABEL: Record<string, string> = { teacher: "Учитель", student: "Ученик" };

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function MaterialCard({ item, onOpen }: MaterialCardProps) {
  return (
    <div className="group border border-border rounded-lg bg-card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <button onClick={() => onOpen(item)} className="block text-left">
        <WatermarkPreview
          previewUrl={item.preview_url}
          fileExt={item.file_ext}
          title={item.title}
          className="h-40 w-full"
        />
      </button>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {item.subject && (
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{item.subject}</span>
          )}
          {item.grade && <span>{item.grade}</span>}
          {item.material_type && <span>· {item.material_type}</span>}
        </div>
        <h3 className="font-semibold leading-snug line-clamp-2">{item.title}</h3>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Icon name="User" size={13} />
            {item.author_name || "Автор"}
            {item.author_role && ROLE_LABEL[item.author_role] && (
              <span className="opacity-70">· {ROLE_LABEL[item.author_role]}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="Download" size={13} />
            {item.downloads_count}
          </span>
        </div>
        <Button size="sm" className="w-full mt-1" onClick={() => onOpen(item)}>
          <Icon name="Eye" size={15} className="mr-1.5" />
          Открыть
        </Button>
        <div className="text-[11px] text-muted-foreground text-center">{formatSize(item.file_size)}</div>
      </div>
    </div>
  );
}
