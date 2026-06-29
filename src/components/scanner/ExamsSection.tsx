import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState } from "@/hooks/usePersistedState";
import { appStore, useAppStore } from "@/store/appStore";
import { examApi, type ExamResponse } from "@/lib/api";
import { downloadDocx } from "./TestsForm";
import { yadisk, ROOT_FOLDER } from "@/lib/yadisk";

const EXAMS_FOLDER = `${ROOT_FOLDER}/ОГЭ_ЕГЭ`;

const OGE_SUBJECTS_FALLBACK = [
  "Биология", "География", "Иностранный язык", "Информатика",
  "История", "Математика", "Обществознание", "Русский язык",
  "Физика", "Химия",
];
const EGE_SUBJECTS_FALLBACK = [
  "Биология", "География", "Иностранный язык", "История",
  "Информатика", "Литература", "Математика (база)", "Математика (профиль)",
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
  yadiskPath: string | null;
}

export function ExamsSection() {
  const { teacher, yadiskConnected } = useAppStore();

  const [examType, setExamType] = usePersistedState<ExamType>("exams:examType", "ОГЭ");
  const [subject, setSubject] = usePersistedState("exams:subject", "");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExamResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("exams_history") || "[]");
    } catch {
      return [];
    }
  });

  // Загружаем список предметов при смене типа экзамена
  useEffect(() => {
    const fallback = examType === "ОГЭ" ? OGE_SUBJECTS_FALLBACK : EGE_SUBJECTS_FALLBACK;
    // Сохраняем выбранный предмет, если он есть в новом списке (восстановление черновика)
    const keepIfValid = (list: string[]) =>
      setSubject(prev => (prev && list.includes(prev) ? prev : list[0]));
    setSubjects(fallback);
    keepIfValid(fallback);
    examApi.getSubjects(examType)
      .then(list => {
        if (list.length) {
          setSubjects(list);
          keepIfValid(list);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examType]);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem("exams_history", JSON.stringify(items.slice(0, 30)));
  };

  const generate = async () => {
    if (!subject) { setError("Выберите предмет"); return; }
    if (!teacher) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    setLastResult(null);
    setProgress(null);

    try {
      const result = await examApi.generate({
        examType,
        subject,
        teacherName: teacher.name,
        teacherSchool: teacher.school,
        login: teacher.login,
      }, (done, total, stageText) => {
        setStage(stageText);
        setProgress({ done, total });
      });

      setLastResult(result);

      let yadiskPath: string | null = null;

      // Скачиваем вариант
      downloadDocx(result.docx_b64, result.filename);

      // Скачиваем ответы
      setTimeout(() => {
        downloadDocx(result.answers_docx_b64, result.answers_filename);
      }, 800);

      // Загрузка на Я.Диск
      if (yadiskConnected && teacher.yadiskToken) {
        try {
          setStage("Загружаем на Яндекс.Диск…");
          await yadisk.ensureFolder(teacher.yadiskToken, EXAMS_FOLDER);
          const date = new Date().toISOString().slice(0, 10);
          yadiskPath = `${EXAMS_FOLDER}/${date}_${result.filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, yadiskPath, result.docx_b64, true);
          const answersPath = `${EXAMS_FOLDER}/${date}_${result.answers_filename}`;
          await yadisk.uploadBinary(teacher.yadiskToken, answersPath, result.answers_docx_b64, true);
        } catch {
          /* не блокируем при ошибке Я.Диск */
        }
      }

      const item: HistoryItem = {
        id: String(Date.now()),
        examType,
        subject,
        variantNum: result.variantNum,
        totalTasks: result.totalTasks,
        totalPoints: result.totalPoints,
        filename: result.filename,
        answers_filename: result.answers_filename,
        createdAt: new Date().toISOString(),
        yadiskPath,
      };
      saveHistory([item, ...history]);

      if (result.balance_rub !== undefined) {
        appStore.setAiBalance(Math.round(result.balance_rub * 100));
      }

      const spentStr = (result.spent_rub ?? 0) > 0 ? ` · Списано: ${result.spent_rub!.toFixed(2)} ₽` : '';
      setSuccess(
        `Вариант ${result.variantNum} готов! ${result.totalTasks} заданий, ${result.totalPoints} баллов.${spentStr} ` +
        (yadiskPath ? "Сохранён на Я.Диск." : "Скачан локально.")
      );
    } catch (e) {
      setError((e as Error).message || "Не удалось создать вариант");
    } finally {
      setBusy(false);
      setStage("");
      setProgress(null);
    }
  };

  const redownload = (item: HistoryItem) => {
    if (!lastResult || lastResult.variantNum !== item.variantNum) {
      setError("Перегенерируйте вариант — файл не сохраняется в браузере.");
      return;
    }
    downloadDocx(lastResult.docx_b64, lastResult.filename);
    setTimeout(() => downloadDocx(lastResult.answers_docx_b64, lastResult.answers_filename), 600);
  };

  const removeHistory = (id: string) => {
    saveHistory(history.filter(h => h.id !== id));
  };

  return (
    <div className="animate-slide-up space-y-5">
      {/* Hero */}
      <div
        className="border border-border rounded-sm overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(270 60% 28%) 0%, hsl(270 50% 38%) 100%)" }}
      >
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="GraduationCap" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Варианты ОГЭ и ЕГЭ по структуре ФИПИ</h2>
          <p className="text-xs opacity-80">
            ИИ создаёт полноценный вариант экзамена строго по структуре ФИПИ: нужное количество заданий,
            правильные типы (выбор ответа, краткий ответ, развёрнутый), темы из кодификатора.
            Скачайте вариант для учеников и ответы для учителя.
          </p>
        </div>
      </div>

      {/* Форма */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры варианта</p>
        </div>
        <div className="p-5 space-y-4">

          {/* ОГЭ / ЕГЭ */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Тип экзамена</label>
            <div className="grid grid-cols-2 gap-3">
              {(["ОГЭ", "ЕГЭ"] as ExamType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExamType(t)}
                  disabled={busy}
                  className={`px-4 py-4 text-left border rounded-sm transition-colors ${
                    examType === t
                      ? "border-purple-600 bg-purple-50"
                      : "border-border hover:bg-muted"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      name="GraduationCap"
                      size={16}
                      className={examType === t ? "text-purple-600" : "text-muted-foreground"}
                    />
                    <span className={`text-base font-bold ${examType === t ? "text-purple-700" : "text-foreground"}`}>{t}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t === "ОГЭ" ? "9 класс · Государственная итоговая аттестация" : "11 класс · Единый государственный экзамен"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Предмет */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Предмет</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={busy}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Инфо о структуре */}
          <div className="bg-purple-50 border border-purple-200 rounded-sm p-3">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={14} className="text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-800 mb-0.5">Структура строго по ФИПИ</p>
                <p className="text-xs text-purple-700">
                  Для каждого задания ИИ генерирует случайный вариант из тем кодификатора {examType}.
                  Вы получите два файла: вариант для учеников и ответы с критериями для учителя.
                </p>
              </div>
            </div>
          </div>

          {/* Ошибка / Успех */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-3 py-2.5">
              <Icon name="AlertCircle" size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-sm px-3 py-2.5">
              <Icon name="CheckCircle2" size={14} className="text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Кнопка */}
          <button
            type="button"
            onClick={generate}
            disabled={busy || !subject}
            className="w-full py-3 rounded-sm font-semibold text-sm text-white transition-opacity disabled:opacity-50"
            style={{ background: busy ? "#9B6FBB" : "hsl(270 60% 35%)" }}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Loader2" size={16} className="animate-spin" />
                {stage || "Генерируем вариант…"}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Sparkles" size={16} />
                Сгенерировать вариант {examType} · {subject || "выберите предмет"}
              </span>
            )}
          </button>

          {busy && (
            <div className="space-y-2">
              {progress && progress.total > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{stage}</span>
                    <span className="text-xs font-semibold text-purple-700">
                      {progress.done} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((progress.done / progress.total) * 100)}%`,
                        background: "hsl(270 60% 45%)",
                      }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">
                ИИ генерирует каждое задание по теме кодификатора ФИПИ — это занимает несколько минут
              </p>
            </div>
          )}
        </div>
      </div>

      {/* История */}
      {history.length > 0 && (
        <div className="border border-border rounded-sm bg-white">
          <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
            <p className="text-sm font-semibold">История вариантов</p>
            <span className="text-xs text-muted-foreground">{history.length} вариантов</span>
          </div>
          <div className="divide-y divide-border">
            {history.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: "hsl(270 60% 94%)" }}>
                    <Icon name="GraduationCap" size={16} className="text-purple-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {item.examType} · {item.subject} · Вариант {item.variantNum}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.totalTasks} заданий · {item.totalPoints} баллов · {" "}
                      {new Date(item.createdAt).toLocaleDateString("ru")}
                      {item.yadiskPath && " · Я.Диск"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Скачать снова"
                    onClick={() => redownload(item)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="Download" size={15} />
                  </button>
                  <button
                    type="button"
                    title="Удалить из истории"
                    onClick={() => removeHistory(item.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                  >
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamsSection;