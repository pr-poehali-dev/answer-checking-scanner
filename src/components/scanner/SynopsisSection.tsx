import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type SynopsisItem } from "@/store/appStore";
import { synopsisApi } from "@/lib/api";
import { SUBJECTS } from "./types";

function cyrToRtf(s: string): string {
  return Array.from(s).map(ch => {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      if (ch === "\\") return "\\\\";
      if (ch === "{") return "\\{";
      if (ch === "}") return "\\}";
      return ch;
    }
    return `\\u${code}?`;
  }).join("");
}

function mdLineToRtf(line: string): string {
  return line.replace(/\*\*([^*]+)\*\*/g, (_, t) => `{\\b ${cyrToRtf(t)}}`);
}

function downloadDocx(item: SynopsisItem) {
  const lines = item.text.split("\n");

  const rtfParts: string[] = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0\\froman Times New Roman;}}",
    "{\\colortbl;\\red0\\green0\\blue0;\\red40\\green70\\blue140;}",
    "\\widowctrl\\hyphauto",
    "\\margl1800\\margr1800\\margt1400\\margb1400",
  ];

  for (const line of lines) {
    if (line.trim() === "" || line === "---") {
      rtfParts.push("\\pard\\sb60\\par");
    } else if (line.startsWith("# ")) {
      rtfParts.push(`\\pard\\keepn\\sb300\\sa100\\f0\\fs34\\cf2\\b ${cyrToRtf(line.slice(2))}\\b0\\par`);
    } else if (line.startsWith("## ")) {
      rtfParts.push(`\\pard\\keepn\\sb240\\sa80\\f0\\fs28\\cf2\\b ${cyrToRtf(line.slice(3))}\\b0\\par`);
    } else if (line.startsWith("### ")) {
      rtfParts.push(`\\pard\\keepn\\sb200\\sa60\\f0\\fs26\\b ${cyrToRtf(line.slice(4))}\\b0\\par`);
    } else if (line.startsWith("#### ")) {
      rtfParts.push(`\\pard\\keepn\\sb160\\sa40\\f0\\fs24\\b ${cyrToRtf(line.slice(5))}\\b0\\par`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      rtfParts.push(`\\pard\\li360\\fi-200\\sb40\\f0\\fs22 \\bullet  ${mdLineToRtf(line.slice(2))}\\par`);
    } else if (/^\d+[.)]\s/.test(line)) {
      const m = line.match(/^(\d+[.)]\s?)(.*)$/);
      if (m) rtfParts.push(`\\pard\\li400\\fi-280\\sb40\\f0\\fs22 ${cyrToRtf(m[1])} ${mdLineToRtf(m[2])}\\par`);
    } else {
      rtfParts.push(`\\pard\\sb60\\sa60\\f0\\fs22 ${mdLineToRtf(line)}\\par`);
    }
  }

  rtfParts.push("}");
  const rtf = rtfParts.join("\n");

  const blob = new Blob([rtf], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeTopic = item.topic.replace(/[^a-zA-Z0-9\u0400-\u04FF ]/g, "").trim().slice(0, 40) || "конспект";
  a.href = url;
  a.download = `Конспект_${safeTopic}_${item.classNum}кл.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CLASS_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 1);

const STAGE_MESSAGES = [
  "ИИ изучает программу Минпросвещения РФ по теме…",
  "Составляю цели и задачи урока…",
  "Пишу теоретический материал — это займёт несколько минут…",
  "Подбираю примеры и вопросы для учеников…",
  "Финальная проверка и оформление конспекта…",
];

function formatWordCount(n: number) {
  if (n % 100 >= 11 && n % 100 <= 19) return `${n} слов`;
  const r = n % 10;
  if (r === 1) return `${n} слово`;
  if (r >= 2 && r <= 4) return `${n} слова`;
  return `${n} слов`;
}

export function SynopsisSection() {
  const { teacher, synopses } = useAppStore();

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [classNum, setClassNum] = useState(9);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<SynopsisItem | null>(null);

  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStageRotation = () => {
    setStageIdx(0);
    setStage(STAGE_MESSAGES[0]);
    let idx = 0;
    stageTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, STAGE_MESSAGES.length - 1);
      setStageIdx(idx);
      setStage(STAGE_MESSAGES[idx]);
    }, 70_000);
  };

  const stopStageRotation = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = null;
  };

  const generate = async () => {
    if (!topic.trim()) { setError("Укажите тему урока"); return; }
    if (!teacher) return;

    setError(null);
    setCreated(null);
    setBusy(true);
    startStageRotation();

    try {
      const result = await synopsisApi.generate(
        {
          subject,
          class_num: classNum,
          topic: topic.trim(),
          description: description.trim(),
          teacher_name: teacher.name,
          teacher_school: teacher.school,
          login: teacher.login,
        },
        (attempt) => setStage(`Повторная попытка ${attempt} из 3 — сервис занят, ждём…`),
      );

      const item: SynopsisItem = {
        id: String(Date.now()),
        subject,
        classNum,
        topic: topic.trim(),
        description: description.trim(),
        text: result.text,
        wordCount: result.word_count,
        createdAt: new Date().toISOString(),
      };

      appStore.addSynopsis(item);
      setCreated(item);
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать конспект");
    } finally {
      stopStageRotation();
      setBusy(false);
      setStage("");
    }
  };

  const goToPresentation = (item: SynopsisItem) => {
    sessionStorage.setItem("synopsis_topic", item.topic);
    sessionStorage.setItem("synopsis_description", item.text);
    window.dispatchEvent(new CustomEvent("navigate-to-section", { detail: "presentations" }));
  };

  const goToTest = (item: SynopsisItem) => {
    sessionStorage.setItem("synopsis_test_topic", item.topic);
    sessionStorage.setItem("synopsis_test_subject", item.subject);
    sessionStorage.setItem("synopsis_test_class", String(item.classNum));
    sessionStorage.setItem("synopsis_test_description", item.text);
    window.dispatchEvent(new CustomEvent("navigate-to-section", { detail: "tests" }));
  };

  return (
    <div className="animate-slide-up space-y-5">
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
                onChange={e => setSubject(e.target.value)}
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
                onChange={e => setClassNum(Number(e.target.value))}
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
              onChange={e => setTopic(e.target.value)}
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
              onChange={e => setDescription(e.target.value)}
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
                {teacher?.name || "—"}{teacher?.school ? ` · ${teacher.school}` : ""}
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
            onClick={generate}
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
                Скачать .doc
              </button>
              <button
                onClick={() => goToTest(created)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors"
                style={{ background: "hsl(142 71% 30%)", color: "#fff" }}
              >
                <Icon name="FileText" size={12} />
                Составить тест
              </button>
              <button
                onClick={() => goToPresentation(created)}
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

      {/* История конспектов */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">История конспектов</p>
          <span className="text-xs text-muted-foreground">{synopses.length}</span>
        </div>
        {synopses.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="BookOpen" size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">Здесь появятся созданные конспекты</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {synopses.map(s => (
              <SynopsisRow key={s.id} item={s} onGoPresentation={goToPresentation} onGoTest={goToTest} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SynopsisTextView({ item }: { item: SynopsisItem }) {
  const lines = item.text.split("\n");

  return (
    <div className="p-5 max-h-[600px] overflow-y-auto">
      <div className="prose prose-sm max-w-none space-y-2">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) {
            return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-foreground">{line.slice(3)}</h2>;
          }
          if (line.startsWith("### ")) {
            return <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>;
          }
          if (line.startsWith("#### ")) {
            return <h4 key={i} className="text-sm font-semibold mt-2 mb-0.5 text-foreground">{line.slice(5)}</h4>;
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={i} className="flex gap-2 text-sm text-foreground/90">
                <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                <span>{renderInline(line.slice(2))}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s(.*)$/);
            if (match) {
              return (
                <div key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-primary font-semibold flex-shrink-0 w-5 text-right">{match[1]}.</span>
                  <span>{renderInline(match[2])}</span>
                </div>
              );
            }
          }
          if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
            return <p key={i} className="text-sm font-semibold text-foreground">{line.slice(2, -2)}</p>;
          }
          if (line.trim() === "" || line === "---") {
            return <div key={i} className="h-2" />;
          }
          return <p key={i} className="text-sm text-foreground/90 leading-relaxed">{renderInline(line)}</p>;
        })}
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}

function SynopsisRow({ item, onGoPresentation, onGoTest }: {
  item: SynopsisItem;
  onGoPresentation: (item: SynopsisItem) => void;
  onGoTest: (item: SynopsisItem) => void;
}) {
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

export default SynopsisSection;