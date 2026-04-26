import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { BlankGenerator } from "./BlankGenerator";
import { AnswerKeyPanel } from "./AnswerKeyPanel";
import { ScanUploadZone } from "./ScanUploadZone";
import { RecognitionResults } from "./RecognitionResults";
import { FlowStep, RecognitionResult } from "./upload-types";
import { recognizeBlank } from "./ocrEngine";

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
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setStep("idle");
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }, []);

  const handleRecognize = async () => {
    if (!file) return;
    setStep("recognizing");
    setError(null);
    setOcrProgress(0);
    setOcrStatus("");
    try {
      const data = await recognizeBlank(
        file,
        answerKey,
        part1Count,
        part2Count,
        (status, progress) => {
          setOcrStatus(status);
          setOcrProgress(progress);
        }
      );
      setResult(data);
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

      <BlankGenerator />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Загрузка заполненного бланка</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <AnswerKeyPanel
        answerKey={answerKey}
        setAnswerKey={setAnswerKey}
        part1Count={part1Count}
        setPart1Count={setPart1Count}
        part2Count={part2Count}
        setPart2Count={setPart2Count}
      />

      <ScanUploadZone
        file={file}
        previewUrl={previewUrl}
        step={step}
        error={error}
        result={result}
        dragOver={dragOver}
        setDragOver={setDragOver}
        onFile={handleFile}
        onRecognize={handleRecognize}
        onReset={reset}
        onRetry={() => setStep("idle")}
        ocrStatus={ocrStatus}
        ocrProgress={ocrProgress}
      />

      {step === "done" && result && (
        <RecognitionResults result={result} onReset={reset} />
      )}

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