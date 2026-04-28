import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AnswerKeyPanel } from "./AnswerKeyPanel";
import { ScanUploadZone } from "./ScanUploadZone";
import { RecognitionResults } from "./RecognitionResults";
import { BulkUpload } from "./BulkUpload";
import { FlowStep, RecognitionResult } from "./upload-types";
import { recognizeBlank } from "./ocrEngine";
import { appStore, useAppStore } from "@/store/appStore";

export function UploadSection() {
  const { works, students } = useAppStore();
  const [step, setStep] = useState<FlowStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string>("");
  const [answerKey, setAnswerKey] = useState("");
  const [part1Count, setPart1Count] = useState(20);
  const [part2Count, setPart2Count] = useState(0);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [savedStudent, setSavedStudent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);

  // При выборе работы — автоматически подставляем ключ и параметры
  const handleSelectWork = (workId: string) => {
    setSelectedWorkId(workId);
    const work = works.find(w => w.id === workId);
    if (work) {
      setAnswerKey(work.answerKey);
      setPart1Count(work.part1Count);
      setPart2Count(work.part2Count);
    }
  };

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
    setSavedStudent(null);
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

      // Сохраняем результат в store если выбрана работа
      if (selectedWorkId) {
        const work = works.find(w => w.id === selectedWorkId);
        const student = students.find(s => s.code === data.student_code);

        // Вычисляем оценку по шкале работы
        let grade = "1";
        if (work) {
          const sc = data.analysis.correct;
          const gs = work.gradeScale;
          if (sc >= gs.grade5) grade = "5";
          else if (sc >= gs.grade4) grade = "4";
          else if (sc >= gs.grade3) grade = "3";
          else if (sc >= gs.grade2) grade = "2";
          else grade = "1";
        }

        appStore.addResult({
          workId: selectedWorkId,
          studentCode: data.student_code,
          answers: data.all_answers,
          correctCount: data.analysis.correct,
          totalCount: data.analysis.total,
          score: data.analysis.correct,
          grade,
          scannedAt: new Date().toISOString(),
        });

        setSavedStudent(student?.name ?? `Код: ${data.student_code}`);
      }
    } catch (e: unknown) {
      let msg = "Ошибка распознавания";
      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === "string") {
        msg = e;
      }
      console.error("OCR error:", e);
      setError(msg);
      setStep("error");
    }
  };

  const reset = () => {
    setStep("idle");
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setSavedStudent(null);
  };

  return (
    <div className="animate-slide-up space-y-6">

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Загрузка заполненного бланка</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Выбор работы */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-5 py-3 border-b border-border bg-muted flex items-center gap-2">
          <Icon name="ClipboardList" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Привязать к работе</p>
        </div>
        <div className="p-5">
          {works.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сначала создайте работу в разделе «Работы»</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Выберите работу</label>
                <select value={selectedWorkId} onChange={e => handleSelectWork(e.target.value)}
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">— без привязки —</option>
                  {works.map(w => (
                    <option key={w.id} value={w.id}>
                      №{w.id} · {w.type}: {w.subject} · {w.classNum}{w.classLetter}
                    </option>
                  ))}
                </select>
              </div>
              {selectedWorkId && (
                <div className="flex items-end">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {(() => {
                      const w = works.find(wk => wk.id === selectedWorkId);
                      return w ? (
                        <>
                          <p>Заданий: <span className="font-semibold text-foreground">{w.totalQuestions}</span></p>
                          <p>Ключ: <span className="mono font-semibold text-foreground">{w.answerKey ? `${w.answerKey.slice(0,12)}...` : "не задан"}</span></p>
                          <p className="text-green-600 font-medium">Результат сохранится в работу автоматически</p>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
          {savedStudent && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-sm" style={{ background: "hsl(142 71% 45% / 0.08)", border: "1px solid hsl(142 71% 45% / 0.3)" }}>
              <Icon name="CheckCircle" size={14} style={{ color: "#22c55e" }} />
              <p className="text-xs font-medium" style={{ color: "#16a34a" }}>
                Результат сохранён: {savedStudent}
              </p>
            </div>
          )}
        </div>
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

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Массовая обработка</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <BulkUpload />

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
                <Icon name={s.icon} size={15} className="text-muted-foreground" fallback="Activity" />
              </div>
              <p className="text-2xl font-bold mono">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}