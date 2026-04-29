import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type GeneratedTestItem } from "@/store/appStore";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}

function TestRow({ item }: { item: GeneratedTestItem }) {
  const [expanded, setExpanded] = useState(false);

  const onDelete = () => {
    if (confirm(`Удалить работу №${item.workId} из истории генераций? Сама работа в разделе «Работы» останется.`)) {
      appStore.removeGeneratedTest(item.id);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(160 60% 25% / 0.08)" }}>
          <Icon name="FileText" size={16} style={{ color: "hsl(160 60% 25%)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold mono px-2 py-0.5 rounded-sm bg-muted">№{item.workId}</span>
            <p className="text-sm font-semibold truncate">{item.topic}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{item.workType}</span>
            <span>·</span>
            <span>{item.subject}</span>
            <span>·</span>
            <span>{item.classNum} класс</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="ListChecks" size={11} />
              {item.part1Count + item.part2Count} зад. ({item.part1Count}+{item.part2Count})
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="HardDrive" size={11} />
              {formatBytes(item.size)}
            </span>
            {item.uploadedToYadisk ? (
              <span className="inline-flex items-center gap-1 text-green-600">
                <Icon name="CloudCheck" size={11} fallback="Cloud" />
                На Я.Диске
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Icon name="CloudOff" size={11} fallback="Cloud" />
                Не загружено
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Вопросы и ответы"
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
        <div className="mt-3 ml-12 space-y-3 pb-1">
          {item.questions.part1.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5 text-foreground">Часть 1 (с выбором ответа)</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                {item.questions.part1.map((q, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-foreground">{q.question}</span>
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-700 rounded-sm font-semibold">
                      Ответ: {q.answer}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.questions.part2.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5 text-foreground">Часть 2 (развёрнутый ответ)</p>
              <ol start={item.questions.part1.length + 1} className="space-y-1.5 list-decimal list-inside">
                {item.questions.part2.map((q, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-foreground">{q.question}</span>
                    {q.answer && (
                      <p className="ml-5 mt-0.5 text-muted-foreground italic">→ {q.answer}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.yadiskPath && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              <Icon name="Folder" size={11} className="inline -mt-0.5 mr-1" />
              {item.yadiskPath}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TestsHistory() {
  const { generatedTests } = useAppStore();

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
        <p className="text-sm font-semibold">История генераций</p>
        <span className="text-xs text-muted-foreground">{generatedTests.length}</span>
      </div>

      {generatedTests.length === 0 ? (
        <div className="p-8 text-center">
          <Icon name="FileText" size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-xs text-muted-foreground">Здесь появятся созданные работы</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {generatedTests.map(t => (
            <TestRow key={t.id} item={t} />
          ))}
        </div>
      )}
    </div>
  );
}
