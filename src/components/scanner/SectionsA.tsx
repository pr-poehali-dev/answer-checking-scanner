import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ScanUploadZone } from "./ScanUploadZone";
import { RecognitionResults } from "./RecognitionResults";
import { BulkUpload } from "./BulkUpload";
import { FlowStep, RecognitionResult } from "./upload-types";
import { recognizeBlank } from "./ocrEngine";
import { appStore, useAppStore } from "@/store/appStore";

const OPT_LABELS = ["\u0410", "\u0411", "\u0412", "\u0413", "\u0414", "\u0415"];

export function UploadSection() {
  const { works, students } = useAppStore();
  const [step, setStep] = useState<FlowStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string>("");
  const [answerKey, setAnswerKey] = useState("");
  const [questionsCount, setQuestionsCount] = useState(20);
  const [optionsCount, setOptionsCount] = useState(4);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [savedStudent, setSavedStudent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);

  const normAnswerKey = (raw: string) => {
    const LAT: Record<string,string> = {
      "A":"\u0410","B":"\u0411","C":"\u0412","D":"\u0413","E":"\u0414","F":"\u0415",
      "a":"\u0410","b":"\u0411","c":"\u0412","d":"\u0413","e":"\u0414","f":"\u0415",
    };
    return raw.split("").map(ch => LAT[ch] ?? ch.toUpperCase()).join("");
  };

  const handleSelectWork = (workId: string) => {
    setSelectedWorkId(workId);
    const work = works.find(w => w.id === workId);
    if (work) {
      setAnswerKey(normAnswerKey(work.answerKey));
      setQuestionsCount(work.totalQuestions);
    }
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setStep("idle");
    setPreviewUrl(URL.createObjectURL(f));
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
        questionsCount,
        0,
        (status, progress) => { setOcrStatus(status); setOcrProgress(progress); }
      );
      setResult(data);
      setStep("done");

      if (selectedWorkId) {
        const work = works.find(w => w.id === selectedWorkId);
        const student = students.find(s => s.code === data.student_code);
        let grade = "1";
        if (work) {
          const sc = data.analysis.correct;
          const gs = work.gradeScale;
          if (sc >= gs.grade5) grade = "5";
          else if (sc >= gs.grade4) grade = "4";
          else if (sc >= gs.grade3) grade = "3";
          else if (sc >= gs.grade2) grade = "2";
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
      setError(e instanceof Error ? e.message : "Ошибка распознавания");
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

  const opts = OPT_LABELS.slice(0, optionsCount);

  return (
    <div className="animate-slide-up space-y-5">

      {/* Привязка к работе */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
          <Icon name="ClipboardList" size={15} className="text-blue-600" />
          <p className="text-sm font-semibold">Привязать к работе</p>
        </div>
        <div className="p-5 space-y-3">
          {works.length === 0 ? (
            <p className="text-sm text-gray-500">Сначала создайте работу в разделе «Работы»</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Выберите работу</label>
                <select
                  value={selectedWorkId}
                  onChange={e => handleSelectWork(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— без привязки —</option>
                  {works.map(w => (
                    <option key={w.id} value={w.id}>
                      №{w.id} · {w.type}: {w.subject} · {w.classNum}{w.classLetter}
                    </option>
                  ))}
                </select>
              </div>
              {selectedWorkId && (() => {
                const w = works.find(wk => wk.id === selectedWorkId);
                return w ? (
                  <div className="text-xs text-gray-500 space-y-1 flex flex-col justify-center">
                    <p>Вопросов: <span className="font-semibold text-gray-800">{w.totalQuestions}</span></p>
                    <p>Ключ: <span className="font-mono font-semibold text-gray-800">{w.answerKey ? `${w.answerKey.slice(0,12)}…` : "не задан"}</span></p>
                    <p className="text-green-600 font-medium">Результат сохранится автоматически</p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
          {savedStudent && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
              <Icon name="CheckCircle" size={14} className="text-green-600" />
              <p className="text-xs font-medium text-green-700">Результат сохранён: {savedStudent}</p>
            </div>
          )}
        </div>
      </div>

      {/* Настройки бланка */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
          <Icon name="Settings2" size={15} className="text-blue-600" />
          <p className="text-sm font-semibold">Параметры бланка</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Количество вопросов */}
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                Количество вопросов — <span className="font-bold text-gray-800">{questionsCount}</span>
              </label>
              <input
                type="range" min={1} max={80} step={1}
                value={questionsCount}
                onChange={e => setQuestionsCount(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Варианты ответа */}
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Варианты ответа</label>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setOptionsCount(n)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      optionsCount === n
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {OPT_LABELS.slice(0, n).join("/")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ключ ответов */}
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              Ключ ответов
              <span className="ml-1 text-gray-400">
                ({questionsCount} символов: {opts.join(", ")})
              </span>
            </label>
            <div className="relative">
              <input
                value={answerKey}
                onChange={e => {
                  const LAT: Record<string,string> = {
                    "A":"\u0410","B":"\u0411","C":"\u0412","D":"\u0413","E":"\u0414","F":"\u0415",
                    "a":"\u0410","b":"\u0411","c":"\u0412","d":"\u0413","e":"\u0414","f":"\u0415",
                  };
                  const val = e.target.value.split("").map(ch => LAT[ch] ?? ch.toUpperCase()).join("");
                  setAnswerKey(val);
                }}
                placeholder={`Пример: ${opts.slice(0, Math.min(6, questionsCount)).join("")}…`}
                maxLength={questionsCount}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400">
                {answerKey.length}/{questionsCount}
              </span>
            </div>
            {/* Визуальный ключ */}
            {answerKey.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {answerKey.split("").map((ch, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
                      opts.includes(ch)
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-red-50 border-red-200 text-red-600"
                    }`}
                    title={`Вопрос ${i + 1}`}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Зона загрузки */}
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

      {/* Результат */}
      {step === "done" && result && (
        <RecognitionResults
          result={result}
          answerKey={answerKey}
          optionsCount={optionsCount}
          onReset={reset}
        />
      )}

      {/* Массовая обработка */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">Массовая обработка</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <BulkUpload />
    </div>
  );
}