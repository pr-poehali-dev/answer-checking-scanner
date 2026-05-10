import Icon from "@/components/ui/icon";
import { RecognitionResult } from "./upload-types";

interface Props {
  result: RecognitionResult;
  answerKey: string;
  optionsCount?: number;
  onReset: () => void;
}

const OPT_LABELS = ["А", "Б", "В", "Г", "Д", "Е"];

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

export function RecognitionResults({ result, answerKey, optionsCount = 4, onReset }: Props) {
  const { analysis, student_code, all_answers } = result;
  const pct   = analysis.percent ?? 0;
  const grade = gradeLabel(pct);
  const opts  = OPT_LABELS.slice(0, optionsCount);
  const key   = answerKey.toUpperCase().split("");

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
            {analysis.correct}
            <span className="text-sm text-gray-400 font-normal"> / {analysis.total}</span>
          </div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${scoreColor(pct)}`}>
          <div className="text-xs mb-1 opacity-70">Процент</div>
          <div className="text-lg font-bold">{pct.toFixed(1)}%</div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${scoreColor(pct)}`}>
          <div className="text-xs mb-1 opacity-70">Оценка</div>
          <div className="text-2xl font-bold leading-none mt-1">{grade}</div>
        </div>
      </div>

      {/* Прогрессбар */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>0%</span>
          <span className="font-semibold text-gray-700">{pct.toFixed(1)}%</span>
          <span>100%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5 text-gray-400">
          <span>«2» &lt;50%</span>
          <span>«3» 50%</span>
          <span>«4» 70%</span>
          <span>«5» 85%</span>
        </div>
      </div>

      {/* Таблица ответов A/B/C/D */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Детальные ответы</span>
          <span className="text-xs text-gray-500">{analysis.correct} верно · {analysis.wrong} неверно</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium w-12">№</th>
                {opts.map(lbl => (
                  <th key={lbl} className="text-center px-2 py-2 text-xs text-gray-500 font-medium w-10">{lbl}</th>
                ))}
                <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Ключ</th>
                <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Итог</th>
              </tr>
            </thead>
            <tbody>
              {all_answers.map((ans, i) => {
                const keyAns = key[i] || "";
                const isCorrect = keyAns && ans.toUpperCase() === keyAns;
                const isWrong   = keyAns && ans && !isCorrect;

                return (
                  <tr
                    key={i}
                    className={`border-b last:border-0 transition-colors ${
                      isCorrect ? "bg-green-50" : isWrong ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-xs font-bold text-gray-600">{i + 1}</td>
                    {opts.map(lbl => {
                      const selected = ans.toUpperCase() === lbl;
                      const correct  = keyAns === lbl;
                      return (
                        <td key={lbl} className="px-2 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all ${
                            selected && isCorrect
                              ? "bg-green-500 border-green-500 text-white"
                              : selected && isWrong
                              ? "bg-red-500 border-red-500 text-white"
                              : correct && !selected && keyAns
                              ? "bg-green-100 border-green-400 text-green-700"
                              : selected
                              ? "bg-gray-700 border-gray-700 text-white"
                              : "border-gray-200 text-gray-300 bg-white"
                          }`}>
                            {selected ? lbl : <span className="opacity-40">{lbl}</span>}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      {keyAns
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{keyAns}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!keyAns
                        ? <span className="text-gray-400 text-xs">—</span>
                        : isCorrect
                        ? <Icon name="CheckCircle2" size={16} className="text-green-500 mx-auto" />
                        : <Icon name="XCircle" size={16} className="text-red-500 mx-auto" />
                      }
                    </td>
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