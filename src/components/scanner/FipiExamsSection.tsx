import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAppStore } from "@/store/appStore";
import { examBuilderApi, type ExamBuilderResponse } from "@/lib/api";
import { downloadDocx } from "./TestsForm";

const OGE_FALLBACK = [
  "Биология", "География", "Иностранный язык", "Информатика",
  "История", "Математика", "Обществознание", "Русский язык",
  "Физика", "Химия",
];
const EGE_FALLBACK = [
  "Биология", "География", "Иностранный язык", "Информатика",
  "История", "Литература", "Математика (база)", "Математика (профиль)",
  "Обществознание", "Русский язык", "Физика", "Химия",
];

type ExamType = "ОГЭ" | "ЕГЭ";

interface HistoryItem {
  id: string;
  examType: ExamType;
  subject: string;
  variantNum: number;
  totalTasks: number;
  totalPoints: number;
  filename: string;
  answers_filename: string;
  createdAt: string;
}

const HISTORY_KEY = "fipi_exams_history";

export function FipiExamsSection() {
  const { teacher } = useAppStore();
  const [examType, setExamType] = useState<ExamType>("ОГЭ");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExamBuilderResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    const fallback = examType === "ОГЭ" ? OGE_FALLBACK : EGE_FALLBACK;
    setSubjects(fallback);
    setSubject(fallback[0]);
    examBuilderApi.getSubjects(examType)
      .then(list => {
        if (list.length) {
          setSubjects(list);
          setSubject(list[0]);
        }
      })
      .catch(() => {});
  }, [examType]);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50))); }
    catch { /* ignore */ }
  };

  const handleGenerate = async () => {
    if (!subject) {
      setError("Выберите предмет");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setLastResult(null);
    try {
      const result = await examBuilderApi.generate({
        examType,
        subject,
        teacherName: teacher?.name || "Учитель",
        teacherSchool: teacher?.school || "",
      });
      setLastResult(result);
      setSuccess(`Вариант №${result.variantNum} готов: ${result.totalTasks} заданий, ${result.totalPoints} баллов.`);

      const item: HistoryItem = {
        id: Date.now().toString(),
        examType: result.examType,
        subject: result.subject,
        variantNum: result.variantNum,
        totalTasks: result.totalTasks,
        totalPoints: result.totalPoints,
        filename: result.filename,
        answers_filename: result.answers_filename,
        createdAt: new Date().toISOString(),
      };
      saveHistory([item, ...history]);
    } catch (e) {
      setError((e as Error).message || "Не удалось создать вариант");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadVariant = () => {
    if (!lastResult) return;
    downloadDocx(lastResult.docx_b64, lastResult.filename);
  };

  const handleDownloadAnswers = () => {
    if (!lastResult) return;
    downloadDocx(lastResult.answers_docx_b64, lastResult.answers_filename);
  };

  const removeHistoryItem = (id: string) => {
    saveHistory(history.filter(h => h.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Icon name="GraduationCap" size={28} className="text-blue-600" />
          Экзамены ФИПИ
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Готовые варианты ЕГЭ и ОГЭ из банка заданий ФИПИ. Без ИИ — мгновенная генерация.
          Каждый вариант собирается случайным образом из официальных заданий по структуре экзамена.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Тип экзамена */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Тип экзамена</label>
          <div className="flex gap-2">
            {(["ОГЭ", "ЕГЭ"] as const).map(t => (
              <button
                key={t}
                onClick={() => setExamType(t)}
                disabled={busy}
                className={`flex-1 py-2.5 px-4 rounded-lg border font-medium transition-colors ${
                  examType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Предмет */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Предмет</label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={busy || !subjects.length}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Кнопка */}
        <button
          onClick={handleGenerate}
          disabled={busy || !subject}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Icon name="Loader2" size={18} className="animate-spin" />
              Создаём вариант…
            </>
          ) : (
            <>
              <Icon name="FileCheck" size={18} />
              Сгенерировать вариант
            </>
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
            <Icon name="AlertCircle" size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm flex items-start gap-2">
            <Icon name="CheckCircle2" size={16} className="flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Скачивание */}
        {lastResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-blue-900">
              {lastResult.examType} · {lastResult.subject} · Вариант №{lastResult.variantNum}
            </div>
            <div className="text-xs text-blue-700">
              Заданий: {lastResult.totalTasks} · Максимальный балл: {lastResult.totalPoints}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadVariant}
                className="flex-1 bg-white hover:bg-gray-50 text-blue-700 border border-blue-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Icon name="Download" size={16} />
                Скачать вариант
              </button>
              <button
                onClick={handleDownloadAnswers}
                className="flex-1 bg-white hover:bg-gray-50 text-green-700 border border-green-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Icon name="KeyRound" size={16} />
                Скачать ответы (для учителя)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* История */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Icon name="History" size={18} />
            История (последние варианты)
          </h3>
          <div className="space-y-2">
            {history.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {item.examType} · {item.subject} · Вариант №{item.variantNum}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString("ru-RU")} · {item.totalTasks} заданий · {item.totalPoints} б.
                  </div>
                </div>
                <button
                  onClick={() => removeHistoryItem(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Удалить из истории"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FipiExamsSection;
