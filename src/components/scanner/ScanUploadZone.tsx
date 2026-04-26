import { useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { FlowStep, RecognitionResult } from "./upload-types";

interface Props {
  file: File | null;
  previewUrl: string | null;
  step: FlowStep;
  error: string | null;
  result: RecognitionResult | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFile: (f: File) => void;
  onRecognize: () => void;
  onReset: () => void;
  onRetry: () => void;
  ocrStatus?: string;
  ocrProgress?: number;
}

export function ScanUploadZone({ file, previewUrl, step, error, result, dragOver, setDragOver, onFile, onRecognize, onReset, onRetry, ocrStatus, ocrProgress = 0 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile, setDragOver]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
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
                  <button onClick={onReset} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <Icon name="X" size={16} />
                  </button>
                </div>

                {step === "idle" && (
                  <button
                    onClick={onRecognize}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
                  >
                    <Icon name="Cpu" size={16} />
                    Распознать бланк
                  </button>
                )}

                {step === "recognizing" && (
                  <div className="p-3 border border-border rounded-sm space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{ocrStatus || "Распознавание..."}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Это может занять 15–30 секунд</p>
                  </div>
                )}

                {step === "error" && (
                  <div className="p-3 border border-destructive/30 rounded-sm bg-destructive/5">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                    <button onClick={onRetry} className="mt-2 text-xs text-muted-foreground underline">Попробовать снова</button>
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
  );
}