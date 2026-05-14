import { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { RecognitionResult } from "./upload-types";

interface Props {
  result: RecognitionResult;
  answerKey: string;
  optionsCount?: number;
  onReset: () => void;
}

const OPT_LABELS = ["А", "Б", "В", "Г", "Д", "Е"];

const LAT_TO_CYR: Record<string, string> = {
  "A":"А","B":"Б","C":"В","D":"Г","E":"Д","F":"Е",
  "a":"А","b":"Б","c":"В","d":"Г","e":"Д","f":"Е",
};
function normChar(ch: string): string {
  return LAT_TO_CYR[ch] ?? ch.toUpperCase();
}
function normKey(key: string): string[] {
  return key.split("").map(normChar);
}

function scoreColor(pct: number) {
  if (pct >= 80) return "text-green-700 bg-green-50 border-green-200";
  if (pct >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
  if (pct >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}
function gradeLabel(pct: number) {
  if (pct >= 85) return "5";
  if (pct >= 70) return "4";
  if (pct >= 50) return "3";
  return "2";
}

export function RecognitionResults({ result, answerKey: initialKey, optionsCount = 4, onReset }: Props) {
  const { student_code, all_answers } = result;
  const opts = OPT_LABELS.slice(0, optionsCount);

  const [editKey, setEditKey] = useState(initialKey);
  const [editing, setEditing] = useState(false);
  const [draftKey, setDraftKey] = useState(initialKey);

  // Весь пересчёт — чистая математика на фронте, без ИИ
  const computed = useMemo(() => {
    const keyArr = normKey(editKey);
    const hasKey = keyArr.some(k => k.trim() !== "");

    const details = all_answers.map((ans, i) => {
      const ka = keyArr[i] ?? "";
      const correct = ka !== "" && ans.toUpperCase() === ka;
      return { student: ans, key: ka, correct };
    });

    const correctCount = details.filter(d => d.correct).length;
    const total = all_answers.length;
    const percent = total > 0 ? Math.round((correctCount / total) * 1000) / 10 : 0;
    return { details, correctCount, total, percent, hasKey };
  }, [editKey, all_answers]);

  const { details, correctCount, total, percent, hasKey } = computed;
  const grade = gradeLabel(percent);

  const applyEdit = () => { setEditKey(draftKey); setEditing(false); };
  const cancelEdit = () => { setDraftKey(editKey); setEditing(false); };

  return (
    <div className="space-y-4">

      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Код ученика</div>
          <div className="text-lg font-mono font-bold text-gray-900 tracking-widest">
            {student_code || "?????"}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Правильных</div>
          <div className="text-lg font-bold text-gray-900">
            {hasKey ? correctCount : "—"}
            <span className="text-sm text-gray-400 font-normal"> / {total}</span>
          </div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${hasKey ? scoreColor(percent) : "bg-gray-50 border-gray-200 text-gray-400"}`}>
          <div className="text-xs mb-1 opacity-70">Процент</div>
          <div className="text-lg font-bold">{hasKey ? `${percent.toFixed(1)}%` : "—"}</div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${hasKey ? scoreColor(percent) : "bg-gray-50 border-gray-200 text-gray-400"}`}>
          <div className="text-xs mb-1 opacity-70">Оценка</div>
          <div className="text-2xl font-bold leading-none mt-1">{hasKey ? grade : "—"}</div>
        </div>
      </div>

      {/* Прогрессбар */}
      {hasKey && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>0%</span>
            <span className="font-semibold text-gray-700">{percent.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent >= 80 ? "bg-green-500" : percent >= 60 ? "bg-blue-500" : percent >= 40 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5 text-gray-400">
            <span>«2» &lt;50%</span>
            <span>«3» 50%</span>
            <span>«4» 70%</span>
            <span>«5» 85%</span>
          </div>
        </div>
      )}

      {/* Таблица ответов */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Шапка с редактором ключа */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Детальные ответы</span>
              {hasKey && (
                <span className="text-xs text-gray-500">{correctCount} верно · {total - correctCount} неверно</span>
              )}
            </div>

            {editing ? (
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <input
                  autoFocus
                  type="text"
                  value={draftKey}
                  onChange={e => setDraftKey(e.target.value)}
                  placeholder="АБВГАБВГ…"
                  className="flex-1 max-w-xs border border-blue-400 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  onKeyDown={e => { if (e.key === "Enter") applyEdit(); if (e.key === "Escape") cancelEdit(); }}
                />
                <button onClick={applyEdit} className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap">
                  Применить
                </button>
                <button onClick={cancelEdit} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-100 whitespace-nowrap">
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setDraftKey(editKey); setEditing(true); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Icon name="Pencil" size={12} />
                {editKey ? "Изменить ключ" : "Добавить ключ"}
              </button>
            )}
          </div>

          {!editing && editKey && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">Ключ:</span>
              <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded tracking-wider">
                {normKey(editKey).join("")}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium w-12">№</th>
                {opts.map(lbl => (
                  <th key={lbl} className="text-center px-2 py-2 text-xs text-gray-500 font-medium w-10">{lbl}</th>
                ))}
                {hasKey && <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Ключ</th>}
                {hasKey && <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Итог</th>}
              </tr>
            </thead>
            <tbody>
              {all_answers.map((ans, i) => {
                const detail     = details[i];
                const keyAns     = detail?.key ?? "";
                const isCorrect  = detail?.correct === true;
                const isWrong    = hasKey && keyAns !== "" && !isCorrect;
                const studentAns = (detail?.student ?? ans).toUpperCase();

                return (
                  <tr
                    key={i}
                    className={`border-b last:border-0 transition-colors ${
                      hasKey && isCorrect ? "bg-green-50" : hasKey && isWrong ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-xs font-bold text-gray-600">{i + 1}</td>
                    {opts.map(lbl => {
                      const selected = studentAns === lbl;
                      const correct  = keyAns === lbl;
                      return (
                        <td key={lbl} className="px-2 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all ${
                            selected && isCorrect  ? "bg-green-500 border-green-500 text-white"
                            : selected && isWrong  ? "bg-red-500 border-red-500 text-white"
                            : correct && !selected && keyAns ? "bg-green-100 border-green-400 text-green-700"
                            : selected             ? "bg-gray-700 border-gray-700 text-white"
                            :                        "border-gray-200 text-gray-300 bg-white"
                          }`}>
                            {selected ? lbl : <span className="opacity-40">{lbl}</span>}
                          </span>
                        </td>
                      );
                    })}
                    {hasKey && (
                      <td className="px-3 py-2 text-center">
                        {keyAns
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{keyAns}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    )}
                    {hasKey && (
                      <td className="px-3 py-2 text-center">
                        {keyAns === ""
                          ? <span className="text-gray-400 text-xs">—</span>
                          : isCorrect
                          ? <Icon name="CheckCircle2" size={16} className="text-green-500 mx-auto" />
                          : <Icon name="XCircle"     size={16} className="text-red-500 mx-auto" />}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
      >
        <Icon name="RefreshCw" size={15} />
        Загрузить другой бланк
      </button>
    </div>
  );
}

export default RecognitionResults;
