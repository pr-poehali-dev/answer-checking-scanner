import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { BlankGenerator } from "./BlankGenerator";

const RECOGNIZE_URL = "https://functions.poehali.dev/de6ae337-82d7-4cc2-ae90-3cf97475be59";

interface AnalysisDetail {
  question: number;
  student: string;
  key: string;
  correct: boolean;
  part: number;
}

interface RecognitionResult {
  student_code: string;
  answers_part1: string[];
  answers_part2: string[];
  all_answers: string[];
  analysis: {
    total: number;
    correct: number;
    wrong: number;
    score_raw: number;
    score_scaled: number;
    percent: number;
    details: AnalysisDetail[];
  };
  image_size_kb: number;
}

type FlowStep = "idle" | "uploading" | "recognizing" | "done" | "error";

export function UploadSection() {
  const [step, setStep] = useState<FlowStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState("ВАБГД12345АВВБГД678ГДААБ910111213");
  const [part1Count, setPart1Count] = useState(26);
  const [part2Count, setPart2Count] = useState(7);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setStep("idle");
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleRecognize = async () => {
    if (!file) return;
    setStep("recognizing");
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);

      const resp = await fetch(RECOGNIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: b64,
          answer_key: answerKey,
          part1_count: part1Count,
          part2_count: part2Count,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Ошибка сервера");
      setResult(typeof data === "string" ? JSON.parse(data) : data);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("idle");
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="animate-slide-up space-y-6">

      {/* PDF Blank Generator */}
      <BlankGenerator />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Загрузка заполненного бланка</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Answer key + settings */}
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

      {/* Upload zone */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-5 py-3 border-b border-border bg-muted flex items-center gap-2">
          <Icon name="ScanLine" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Загрузка отсканированного бланка</p>
        </div>
        <div className="p-5">
          {!file ? (
            <div
              className={`upload-zone ${dragOver ? "border-primary bg-primary/5" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="Upload" size={36} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground mb-1">
                {dragOver ? "Отпустите файл" : "Перетащите сюда или нажмите для выбора"}
              </p>
              <p className="text-sm text-muted-foreground">JPG, PNG, PDF — отсканированный бланк ответов</p>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleInputChange} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File + preview */}
              <div className="flex gap-5">
                {previewUrl && (
                  <div className="w-32 h-44 border border-border rounded-sm overflow-hidden flex-shrink-0 bg-muted">
                    <img src={previewUrl} alt="Бланк" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 p-3 border border-border rounded-sm bg-muted/30">
                    <Icon name="FileImage" size={18} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} КБ</p>
                    </div>
                    <button onClick={reset} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                      <Icon name="X" size={16} />
                    </button>
                  </div>

                  {step === "idle" && (
                    <button
                      onClick={handleRecognize}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
                    >
                      <Icon name="Cpu" size={16} />
                      Распознать бланк
                    </button>
                  )}

                  {step === "recognizing" && (
                    <div className="flex items-center gap-3 p-3 border border-border rounded-sm">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Распознавание... пожалуйста подождите</span>
                    </div>
                  )}

                  {step === "error" && (
                    <div className="p-3 border border-destructive/30 rounded-sm bg-destructive/5">
                      <p className="text-sm text-destructive font-medium">{error}</p>
                      <button onClick={() => setStep("idle")} className="mt-2 text-xs text-muted-foreground underline">Попробовать снова</button>
                    </div>
                  )}

                  {step === "done" && result && (
                    <div className="p-3 border border-border rounded-sm" style={{ background: "hsl(142 71% 45% / 0.06)", borderColor: "hsl(142 71% 45% / 0.3)" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="CheckCircle" size={15} style={{ color: "#22c55e" }} />
                        <span className="text-sm font-semibold" style={{ color: "#16a34a" }}>Распознавание завершено</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Код ученика: <span className="mono font-bold text-foreground">{result.student_code}</span> · Обработано: {result.image_size_kb} КБ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {step === "done" && result && (
        <div className="animate-fade-in space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Код ученика", value: result.student_code, icon: "Hash" },
              { label: "Верных ответов", value: `${result.analysis.correct}/${result.analysis.total}`, icon: "CheckSquare" },
              { label: "Первичный балл", value: result.analysis.score_raw, icon: "Award" },
              { label: "Тестовый балл ЕГЭ", value: result.analysis.score_scaled, icon: "TrendingUp" },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <Icon name={s.icon} size={15} className="text-muted-foreground" fallback="Info" />
                </div>
                <p className="text-2xl font-bold mono"
                  style={s.label === "Тестовый балл ЕГЭ" ? {
                    color: result.analysis.score_scaled >= 80 ? "#22c55e"
                      : result.analysis.score_scaled >= 52 ? "#3b82f6"
                      : result.analysis.score_scaled >= 36 ? "#f59e0b" : "#ef4444"
                  } : {}}
                >{s.value}</p>
              </div>
            ))}
          </div>

          {/* Answers grid part 1 */}
          <div className="border border-border rounded-sm bg-white">
            <div className="px-5 py-3 border-b border-border bg-muted flex items-center justify-between">
              <p className="text-sm font-semibold">Часть 1 — распознанные ответы ({result.answers_part1.length} заданий)</p>
              <span className="text-xs text-muted-foreground mono">
                {result.analysis.details.filter(d => d.part === 1 && d.correct).length}/{result.answers_part1.length} верных
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-13 gap-1" style={{ gridTemplateColumns: `repeat(13, minmax(0, 1fr))` }}>
                {result.analysis.details.filter(d => d.part === 1).map((d) => (
                  <div
                    key={d.question}
                    title={`№${d.question}: ответ — «${d.student}», ключ — «${d.key}»`}
                    className="rounded-sm border flex flex-col items-center justify-center py-1 cursor-default"
                    style={{
                      background: d.correct ? "hsl(142 71% 45% / 0.1)" : "hsl(0 72% 51% / 0.1)",
                      borderColor: d.correct ? "hsl(142 71% 45% / 0.35)" : "hsl(0 72% 51% / 0.35)",
                    }}
                  >
                    <span className="text-[9px] text-muted-foreground">{d.question}</span>
                    <span className="mono font-bold text-xs leading-tight" style={{ color: d.correct ? "hsl(142 71% 35%)" : "hsl(0 72% 45%)" }}>
                      {d.student || "·"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Answers part 2 */}
          {result.answers_part2.length > 0 && (
            <div className="border border-border rounded-sm bg-white">
              <div className="px-5 py-3 border-b border-border bg-muted">
                <p className="text-sm font-semibold">Часть 2 — распознанные ответы ({result.answers_part2.length} заданий)</p>
              </div>
              <div className="divide-y divide-border">
                {result.analysis.details.filter(d => d.part === 2).map((d) => (
                  <div key={d.question} className="flex items-center gap-4 px-5 py-3 table-row-hover">
                    <div
                      className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: "hsl(215 60% 22% / 0.1)", color: "hsl(215 60% 22%)" }}
                    >
                      {d.question}
                    </div>
                    <span className="flex-1 text-sm mono">{d.student || "—"}</span>
                    {d.key && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Ключ: <span className="mono">{d.key}</span></span>
                        <span className={d.correct ? "badge-success" : "badge-danger"}>
                          {d.correct ? "Верно" : "Неверно"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="border border-border rounded-sm bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Результат</span>
              <span className="mono text-sm font-bold" style={{
                color: result.analysis.score_scaled >= 80 ? "#22c55e"
                  : result.analysis.score_scaled >= 52 ? "#3b82f6"
                  : result.analysis.score_scaled >= 36 ? "#f59e0b" : "#ef4444"
              }}>
                {result.analysis.score_scaled} баллов ЕГЭ
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${result.analysis.score_scaled}%`,
                  background: result.analysis.score_scaled >= 80 ? "#22c55e"
                    : result.analysis.score_scaled >= 52 ? "#3b82f6"
                    : result.analysis.score_scaled >= 36 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="text-destructive">Порог: 36</span>
              <span>100</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors">
              <Icon name="RotateCcw" size={14} />
              Загрузить другой бланк
            </button>
          </div>
        </div>
      )}

      {/* Stats footer */}
      {step !== "done" && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Обработано сегодня", value: "247", icon: "FileCheck" },
            { label: "Среднее время бланка", value: "1.3 сек", icon: "Timer" },
            { label: "Точность распознавания", value: "98.7%", icon: "Target" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <Icon name={s.icon} size={16} className="text-muted-foreground" fallback="Info" />
              </div>
              <p className="text-2xl font-bold text-foreground mono">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecognitionSection() {
  const steps = [
    { name: "Выравнивание изображения", status: "done", time: "0.12 с" },
    { name: "Обнаружение ячеек бланка", status: "done", time: "0.31 с" },
    { name: "Распознавание цифр (часть 1)", status: "done", time: "0.45 с" },
    { name: "Распознавание букв (часть 2)", status: "active", time: "..." },
    { name: "Проверка контрольных сумм", status: "pending", time: "—" },
    { name: "Сохранение результатов", status: "pending", time: "—" },
  ];

  return (
    <div className="animate-slide-up space-y-6">
      <p className="section-header">Статус распознавания</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="bg-muted px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium">Бланк_Васильева.jpg</span>
            <span className="badge-success">Часть 1/2</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-8 gap-1.5 mb-4">
              {Array.from({ length: 32 }, (_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-sm flex items-center justify-center text-xs font-mono font-semibold border"
                  style={{
                    background: i < 20 ? "hsl(142 71% 45% / 0.12)" : i < 28 ? "hsl(210 80% 56% / 0.08)" : "hsl(210 20% 94%)",
                    borderColor: i < 20 ? "hsl(142 71% 45% / 0.3)" : i < 28 ? "hsl(210 80% 56% / 0.3)" : "hsl(214 20% 88%)",
                    color: i < 20 ? "hsl(142 71% 35%)" : i < 28 ? "hsl(210 80% 40%)" : "hsl(215 16% 47%)",
                  }}
                >
                  {i < 20 ? String.fromCharCode(1040 + (i % 5)) : i < 28 ? (i % 5 + 1) : "·"}
                </div>
              ))}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(142 71% 45% / 0.3)" }} /> Буква</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(210 80% 56% / 0.3)" }} /> Цифра</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(210 20% 94%)" }} /> Ожидание</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-border bg-white">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: s.status === "done" ? "hsl(142 71% 45%)" : s.status === "active" ? "hsl(210 80% 56%)" : "hsl(210 20% 88%)",
                }}
              >
                {s.status === "done" && <Icon name="Check" size={11} className="text-white" />}
                {s.status === "active" && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>
              <span className="flex-1 text-sm" style={{ color: s.status === "pending" ? "hsl(215 16% 47%)" : "inherit" }}>
                {s.name}
              </span>
              <span className="mono text-xs text-muted-foreground">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CheckingSection() {
  const [key] = useState("ВАБГД12345АВВБГД678ГДААБ910111213");
  const answers = "ВАБГД12345АВВБГД678ГДААБ910111214";

  return (
    <div className="animate-slide-up space-y-6">
      <p className="section-header">Эталон и ответы ученика</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Ключ ответов</p>
          </div>
          <div className="p-4">
            <textarea
              className="w-full text-sm mono border border-border rounded-sm p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={5}
              defaultValue={key}
            />
            <p className="text-xs text-muted-foreground mt-2">Введите ответы в виде строки или загрузите из файла</p>
            <div className="mt-3 flex gap-2">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:opacity-90 transition-opacity">
                <Icon name="Save" size={13} />
                Сохранить ключ
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors">
                <Icon name="FolderOpen" size={13} />
                Загрузить
              </button>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
            <p className="text-sm font-semibold">Ответы: Васильева О.П.</p>
            <span className="badge-success">31/32 верных</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: 32 }, (_, i) => {
                const correct = key[i] === answers[i];
                return (
                  <div
                    key={i}
                    className="h-9 rounded-sm flex flex-col items-center justify-center border cursor-default"
                    style={{
                      background: correct ? "hsl(142 71% 45% / 0.1)" : "hsl(0 72% 51% / 0.1)",
                      borderColor: correct ? "hsl(142 71% 45% / 0.35)" : "hsl(0 72% 51% / 0.35)",
                    }}
                  >
                    <span className="mono font-semibold text-xs" style={{ color: correct ? "hsl(142 71% 35%)" : "hsl(0 72% 45%)" }}>
                      {answers[i] || "·"}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Настройки шкалирования ЕГЭ/ОГЭ</p>
        </div>
        <div className="p-4 grid grid-cols-4 gap-4">
          {[
            { label: "Тип экзамена", value: "ЕГЭ" },
            { label: "Предмет", value: "Русский язык" },
            { label: "Год", value: "2026" },
            { label: "Порог (мин. баллов)", value: "36" },
          ].map((f, i) => (
            <div key={i}>
              <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
              <div className="border border-border rounded-sm px-3 py-2 text-sm font-medium bg-white">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
