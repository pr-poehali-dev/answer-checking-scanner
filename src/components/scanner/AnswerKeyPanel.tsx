import Icon from "@/components/ui/icon";

interface Props {
  answerKey: string;
  setAnswerKey: (v: string) => void;
  part1Count: number;
  setPart1Count: (v: number) => void;
  part2Count: number;
  setPart2Count: (v: number) => void;
}

export function AnswerKeyPanel({ answerKey, setAnswerKey, part1Count, setPart1Count, part2Count, setPart2Count }: Props) {
  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-3 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="Key" size={15} className="text-primary" />
        <p className="text-sm font-semibold">Ключ правильных ответов</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Строка ответов (последовательно, без пробелов)</label>
          <textarea
            className="w-full text-sm mono border border-border rounded-sm p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={3}
            value={answerKey}
            onChange={e => setAnswerKey(e.target.value)}
            placeholder="Пример: ВАБГД12345АВВБГД..."
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 1</label>
            <input
              type="number" min={1} max={60} value={part1Count}
              onChange={e => setPart1Count(parseInt(e.target.value) || 1)}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 2</label>
            <input
              type="number" min={0} max={30} value={part2Count}
              onChange={e => setPart2Count(parseInt(e.target.value) || 0)}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Итого заданий</label>
            <div className="w-full border border-border rounded-sm px-3 py-2 text-sm mono font-bold bg-muted text-muted-foreground">
              {part1Count + part2Count}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
