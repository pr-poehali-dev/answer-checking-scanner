import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type PresentationItem } from "@/store/appStore";
import { presentationApi } from "@/lib/api";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";

const PRESENTATIONS_FOLDER = `${ROOT_FOLDER}/Презентации`;

const SLIDE_OPTIONS = [5, 7, 8, 10, 12, 14];
const AUDIENCE_PRESETS = [
  "Ученики 5–6 классов",
  "Ученики 7–8 классов",
  "Ученики 9 класса",
  "Ученики 10–11 классов",
  "Подготовка к ОГЭ",
  "Подготовка к ЕГЭ",
];

function downloadBase64(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}

export function PresentationsSection() {
  const { teacher, presentations, yadiskConnected } = useAppStore();

  // Предзаполнение из конспекта (если пришли из раздела «Конспекты»)
  const synopsisTopic = sessionStorage.getItem("synopsis_topic") || "";
  const synopsisDesc = sessionStorage.getItem("synopsis_description") || "";
  if (synopsisTopic) { sessionStorage.removeItem("synopsis_topic"); sessionStorage.removeItem("synopsis_description"); }

  const [topic, setTopic] = useState(synopsisTopic);
  const [description, setDescription] = useState(synopsisDesc);
  const [audience, setAudience] = useState(AUDIENCE_PRESETS[3]);
  const [slidesCount, setSlidesCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      setError("Укажите тему урока");
      return;
    }
    if (!teacher) return;
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      setStage("ИИ готовит структуру презентации…");
      const result = await presentationApi.generate(
        {
          topic: topic.trim(),
          description: description.trim(),
          audience,
          slidesCount,
          teacherName: teacher.name,
          teacherSchool: teacher.school,
        },
        (attempt) => setStage(`Повторная попытка ${attempt} из 3 — ИИ-сервис занят, ждём…`),
      );

      let yadiskPath: string | null = null;
      let uploadedToYadisk = false;

      if (yadiskConnected && teacher.yadiskToken) {
        try {
          setStage("Загружаем на Яндекс.Диск…");
          await yadisk.ensureFolder(teacher.yadiskToken, PRESENTATIONS_FOLDER);
          const date = new Date().toISOString().slice(0, 10);
          yadiskPath = `${PRESENTATIONS_FOLDER}/${date} ${result.filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, result.pptx_b64, true);
          uploadedToYadisk = true;
        } catch (e) {
          console.error("Yadisk upload failed", e);
          setError(`Презентация создана, но не загружена на Я.Диск: ${(e as Error).message}`);
        }
      }

      const item: PresentationItem = {
        id: String(Date.now()),
        topic: topic.trim(),
        description: description.trim(),
        audience,
        slidesCount,
        filename: result.filename,
        size: result.size,
        yadiskPath,
        uploadedToYadisk,
        createdAt: new Date().toISOString(),
        outline: result.outline,
      };
      appStore.addPresentation(item);

      // Скачиваем локально тоже
      downloadBase64(result.pptx_b64, result.filename);

      setSuccess(
        uploadedToYadisk
          ? `Готово! Презентация сохранена на Я.Диск и скачана.`
          : yadiskConnected
          ? `Презентация скачана. Проверьте подключение Я.Диска для автозагрузки.`
          : `Презентация скачана. Подключите Я.Диск в «Настройках» для автоматической загрузки.`
      );
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать презентацию");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="animate-slide-up space-y-5">
      {/* Hero */}
      <div className="border border-border rounded-sm overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(215 60% 22%) 0%, hsl(215 50% 30%) 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Sparkles" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Создавайте презентации к урокам за минуту</h2>
          <p className="text-xs opacity-80">
            Опишите тему — ИИ соберёт структуру, подберёт тезисы и создаст красивый файл .pptx.
            Презентация автоматически отправляется на ваш Яндекс.Диск.
          </p>
        </div>
      </div>

      {/* Форма генерации */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры урока</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Тема урока <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Например: Закон Ома и его применение"
              disabled={busy}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Описание / контекст урока
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="На что сделать акцент, какие подтемы раскрыть, какие примеры использовать. Чем подробнее — тем точнее результат."
              disabled={busy}
              rows={4}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Аудитория</label>
              <select
                value={audience}
                onChange={e => setAudience(e.target.value)}
                disabled={busy}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {AUDIENCE_PRESETS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Слайдов с содержанием</label>
              <div className="flex gap-1.5 flex-wrap">
                {SLIDE_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSlidesCount(n)}
                    disabled={busy}
                    className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${
                      slidesCount === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                + титульный, выводы и финальный слайд (всего {slidesCount + 3})
              </p>
            </div>
          </div>

          {/* Подпись учителя — превью того, что попадёт на слайды */}
          <div className="border border-dashed border-border rounded-sm px-3 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <Icon name="Signature" size={13} className="text-muted-foreground" fallback="PenTool" />
              <span className="text-xs text-muted-foreground">Подпись на слайдах:</span>
              <span className="text-xs font-semibold text-foreground">
                {teacher?.name || "—"}
                {teacher?.school ? ` · ${teacher.school}` : ""}
              </span>
            </div>
          </div>

          {/* Я.Диск статус */}
          <div className={`border rounded-sm px-3 py-2.5 flex items-center gap-2 ${
            yadiskConnected ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"
          }`}>
            <Icon
              name={yadiskConnected ? "CloudCheck" : "CloudOff"}
              size={14}
              className={yadiskConnected ? "text-green-600" : "text-amber-600"}
              fallback="Cloud"
            />
            <span className="text-xs">
              {yadiskConnected
                ? <>Я.Диск подключён — файл попадёт в папку <span className="mono font-semibold">{PRESENTATIONS_FOLDER}</span></>
                : "Я.Диск не подключён — презентация только скачается. Подключите в «Настройках» для автозагрузки."}
            </span>
          </div>

          {error && (
            <div className="border border-destructive/40 bg-destructive/5 rounded-sm px-3 py-2.5 flex items-start gap-2">
              <Icon name="CircleAlert" size={14} className="text-destructive flex-shrink-0 mt-0.5" fallback="AlertCircle" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="border border-green-500/40 bg-green-500/5 rounded-sm px-3 py-2.5 flex items-start gap-2">
              <Icon name="CircleCheck" size={14} className="text-green-600 flex-shrink-0 mt-0.5" fallback="CheckCircle" />
              <p className="text-xs text-green-700">{success}</p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={busy || !topic.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Icon name={busy ? "Loader2" : "Sparkles"} size={15} className={busy ? "animate-spin" : ""} />
            {busy ? (stage || "Генерация…") : "Создать презентацию"}
          </button>
        </div>
      </div>

      {/* История */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">История презентаций</p>
          <span className="text-xs text-muted-foreground">{presentations.length}</span>
        </div>

        {presentations.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="Presentation" size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">Здесь появятся созданные презентации</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {presentations.map(p => (
              <PresentationRow key={p.id} item={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PresentationRow({ item }: { item: PresentationItem }) {
  const [expanded, setExpanded] = useState(false);

  const onDelete = () => {
    if (confirm(`Удалить «${item.topic}» из истории? Файл на Я.Диске останется.`)) {
      appStore.removePresentation(item.id);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(215 60% 22% / 0.08)" }}>
          <Icon name="Presentation" size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.topic}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Icon name="Layers" size={11} />
              {item.outline.slides.length + 3} слайдов
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="HardDrive" size={11} />
              {formatBytes(item.size)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Clock" size={11} />
              {new Date(item.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
            title="Структура"
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="Удалить из истории"
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-12 space-y-2 pb-1">
          {item.outline.subtitle && (
            <p className="text-xs text-muted-foreground italic">{item.outline.subtitle}</p>
          )}
          <ol className="space-y-1.5 list-decimal list-inside">
            {item.outline.slides.map((s, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold text-foreground">{s.title}</span>
                {s.bullets.length > 0 && (
                  <span className="text-muted-foreground"> — {s.bullets.join("; ")}</span>
                )}
              </li>
            ))}
          </ol>
          {item.outline.conclusion.length > 0 && (
            <div className="text-xs">
              <span className="font-semibold text-foreground">Итоги: </span>
              <span className="text-muted-foreground">{item.outline.conclusion.join("; ")}</span>
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

export default PresentationsSection;