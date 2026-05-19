import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, type SynopsisItem } from "@/store/appStore";
import { downloadDocx, formatWordCount } from "./synopsisUtils";
import { SynopsisTextView } from "./SynopsisTextView";

interface Props {
  item: SynopsisItem;
  onGoPresentation: (item: SynopsisItem) => void;
  onGoTest: (item: SynopsisItem) => void;
}

export function SynopsisRow({ item, onGoPresentation, onGoTest }: Props) {
  const [expanded, setExpanded] = useState(false);

  const onDelete = () => {
    if (confirm(`Удалить конспект «${item.topic}» из истории?`)) {
      appStore.removeSynopsis(item.id);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(25 60% 20% / 0.08)" }}>
          <Icon name="BookOpen" size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.topic}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span>{item.subject}</span>
            <span>{item.classNum} класс</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="AlignLeft" size={11} />
              {formatWordCount(item.wordCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Clock" size={11} />
              {new Date(item.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => downloadDocx(item)}
            className="p-1.5 text-muted-foreground hover:text-green-600 transition-colors"
            title="Скачать конспект (.doc)"
          >
            <Icon name="Download" size={14} />
          </button>
          <button
            onClick={() => onGoTest(item)}
            className="p-1.5 text-muted-foreground hover:text-green-600 transition-colors"
            title="Составить тест по конспекту"
          >
            <Icon name="FileText" size={14} />
          </button>
          <button
            onClick={() => onGoPresentation(item)}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
            title="Создать презентацию по конспекту"
          >
            <Icon name="Presentation" size={14} />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Показать конспект"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="Удалить"
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-12 border border-border rounded-sm overflow-hidden max-h-[500px] overflow-y-auto">
          <SynopsisTextView item={item} />
        </div>
      )}
    </div>
  );
}
