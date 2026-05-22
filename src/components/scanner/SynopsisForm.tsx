import Icon from "@/components/ui/icon";
import { type SynopsisItem } from "@/store/appStore";
import { downloadDocx, formatWordCount } from "./synopsisUtils";
import { SynopsisTextView } from "./SynopsisTextView";
import { SUBJECTS } from "./types";

const CLASS_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 1);

interface Props {
  subject: string;
  classNum: number;
  topic: string;
  description: string;
  busy: boolean;
  stageIdx: number;
  stage: string;
  error: string | null;
  created: SynopsisItem | null;
  teacherName: string;
  teacherSchool: string;
  onSubjectChange: (v: string) => void;
  onClassNumChange: (v: number) => void;
  onTopicChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onGenerate: () => void;
  onGoTest: (item: SynopsisItem) => void;
  onGoPresentation: (item: SynopsisItem) => void;
}

export function SynopsisForm({
  subject,
  classNum,
  topic,
  description,
  busy,
  stageIdx,
  stage,
  error,
  created,
  teacherName,
  teacherSchool,
  onSubjectChange,
  onClassNumChange,
  onTopicChange,
  onDescriptionChange,
  onGenerate,
  onGoTest,
  onGoPresentation,
}: Props) {
  return (
    <>
      {/* Hero */}
      <div className="border border-border rounded-sm overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(25 60% 20%) 0%, hsl(35 55% 30%) 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="BookOpen" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Конспект урока по программе Минпросвещения РФ</h2>
          <p className="text-xs opacity-80">
            Укажите предмет, класс и тему — ИИ напишет развёрнутый конспект от 2 до 4 страниц
            строго по официальной учебной программе. Среднее время генерации: 5–7 минут.
          </p>
        </div>
      </div>

      {/* Форма */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры конспекта</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Предмет и класс */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Предмет <span className="text-destructive">*</span>
              </label>
              <select
                value={subject}
                onChange={e => onSubjectChange(e.target.value)}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Класс <span className="text-destructive">*</span>
              </label>
              <select
                value={classNum}
                onChange={e => onClassNumChange(Number(e.target.value))}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {CLASS_OPTIONS.map(n => <option key={n} value={n}>{n} класс</option>)}
              </select>
            </div>
          </div>

          {/* Тема */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Тема урока <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => onTopicChange(e.target.value)}
              placeholder="Например: Закон Ома для участка цепи"
              disabled={busy}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Дополнительные акценты и пожелания
            </label>
            <textarea
              value={description}
              onChange={e => onDescriptionChange(e.target.value)}
              placeholder="Что особенно важно раскрыть, какие примеры привести, на что сделать упор. Чем подробнее — тем точнее конспект."
              disabled={busy}
              rows={3}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
            />
          </div>

          {/* Инфо-плашка */}
          <div className="border border-border rounded-sm px-3 py-2.5 bg-muted/30 flex items-start gap-2">
            <Icon name="Info" size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              ИИ пишет конспект медленно и обстоятельно — не торопит себя.
              Среднее время: <strong>5–7 минут</strong>. Не закрывайте страницу во время генерации.
            </p>
          </div>

          {/* Подпись */}
          <div className="border border-dashed border-border rounded-sm px-3 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <Icon name="Signature" size={13} className="text-muted-foreground" fallback="PenTool" />
              <span className="text-xs text-muted-foreground">Учитель:</span>
              <span className="text-xs font-semibold text-foreground">
                {teacherName || "—"}{teacherSchool ? ` · ${teacherSchool}` : ""}
              </span>
            </div>
          </div>

          {error && (
            <div className="border border-destructive/40 bg-destructive/5 rounded-sm px-3 py-2.5 flex items-start gap-2">
              <Icon name="CircleAlert" size={14} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Прогресс */}
          {busy && (
            <div className="border border-primary/20 bg-primary/5 rounded-sm px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="Loader2" size={14} className="text-primary animate-spin flex-shrink-0" />
                <p className="text-xs font-semibold text-primary">{stage || "ИИ пишет конспект…"}</p>
              </div>
              <div className="w-full bg-primary/10 rounded-full h-1">
                <div
                  className="bg-primary h-1 rounded-full transition-all duration-[10000ms] ease-linear"
                  style={{ width: `${Math.min((stageIdx + 1) * 20, 90)}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={onGenerate}
            disabled={busy || !topic.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Icon name={busy ? "Loader2" : "BookOpen"} size={15} className={busy ? "animate-spin" : ""} />
            {busy ? "ИИ пишет конспект…" : "Создать конспект"}
          </button>
        </div>
      </div>

      {/* Только что созданный конспект */}
      {created && (
        <div className="border border-green-500/40 rounded-sm bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-green-500/20 bg-green-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="CircleCheck" size={15} className="text-green-600" fallback="CheckCircle" />
              <p className="text-sm font-semibold text-green-700">Конспект готов!</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{formatWordCount(created.wordCount)}</span>
              <button
                onClick={() => downloadDocx(created)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors border border-green-600 text-green-700 hover:bg-green-50"
              >
                <Icon name="Download" size={12} />
                Скачать .docx
              </button>
              <button
                onClick={() => onGoTest(created)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors"
                style={{ background: "hsl(142 71% 30%)", color: "#fff" }}
              >
                <Icon name="FileText" size={12} />
                Составить тест
              </button>
              <button
                onClick={() => onGoPresentation(created)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors"
                style={{ background: "hsl(215 60% 22%)", color: "#fff" }}
              >
                <Icon name="Presentation" size={12} />
                Создать презентацию
              </button>
            </div>
          </div>
          <SynopsisTextView item={created} />
        </div>
      )}
    </>
  );
}