import { useState } from "react";
import Icon from "@/components/ui/icon";
import { WORK_TYPES, SUBJECTS } from "./types";
import { blankApi } from "@/lib/api";

export interface BlankConfig {
  workId: string;
  workTitle: string;
  questionsCount: number;
  optionsCount: number;   // 2–6
  perPage: 1 | 2 | 4;
  subject: string;
  classLabel: string;
  date: string;
}

const OPTION_LABELS = ["А", "Б", "В", "Г", "Д", "Е"];

/** Предпросмотр бланка — точное отображение реального PDF */
function BlankPreview({ config }: { config: BlankConfig }) {
  const { questionsCount, optionsCount } = config;
  const opts = OPTION_LABELS.slice(0, optionsCount);

  const nCols   = questionsCount <= 15 ? 1 : questionsCount <= 40 ? 2 : 3;
  const nRows   = Math.ceil(questionsCount / nCols);

  const PAD     = 10;
  const HDR_H   = 36;
  const META_H  = 46;
  const HDR_OPT = 18;
  const ROW_H   = 22;
  const NUM_W   = 22;
  const CELL_W  = Math.min(28, Math.floor((220 - NUM_W) / optionsCount));
  const COL_W   = NUM_W + CELL_W * optionsCount + 6;
  const R       = Math.min(CELL_W * 0.32, 7);

  // Блок кода ученика — 5 столбцов × 10 цифр (0-9)
  const CR      = 7;   // радиус кружка кода
  const C_GAP_X = CR * 2 + 4;
  const C_GAP_Y = CR * 2 + 2;
  const CODE_COLS = 5;
  const CODE_ROWS = 10;
  const CODE_HDR_H = 24;  // «КОД УЧЕНИКА» + номера столбцов
  const CODE_BLOCK_H = CODE_HDR_H + CODE_ROWS * C_GAP_Y + 8;

  const FOOT_H  = 20;  // строка снизу с инфо
  const svgW    = PAD * 2 + COL_W * nCols;
  const svgH    = HDR_H + META_H + HDR_OPT + nRows * ROW_H + CODE_BLOCK_H + FOOT_H + 10;

  const gridTop = HDR_H + META_H + HDR_OPT;
  const codeTop = gridTop + nRows * ROW_H + 6;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full border border-gray-300 rounded bg-white shadow"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {/* Рамка */}
      <rect x={0} y={0} width={svgW} height={svgH} fill="white" stroke="#1e3a5f" strokeWidth={1} />

      {/* Шапка */}
      <rect x={0} y={0} width={svgW} height={HDR_H} fill="#1a1a2e" />
      <text x={svgW / 2} y={HDR_H * 0.6} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">
        БЛАНК ОТВЕТОВ
      </text>
      <text x={svgW - PAD} y={HDR_H * 0.6} textAnchor="end" fill="#8898aa" fontSize={7}>
        № {config.workId}
      </text>

      {/* Поля ученика */}
      <rect x={0} y={HDR_H} width={svgW} height={META_H} fill="#f0f4f8" />
      <text x={PAD} y={HDR_H + 16} fill="#1a1a2e" fontSize={7.5} fontWeight="bold">ФИО:</text>
      <line x1={PAD + 26} y1={HDR_H + 16} x2={svgW * 0.62} y2={HDR_H + 16} stroke="#c8d6e5" strokeWidth={0.7} />
      <text x={svgW * 0.64} y={HDR_H + 16} fill="#1a1a2e" fontSize={7.5} fontWeight="bold">Класс:</text>
      <line x1={svgW * 0.64 + 30} y1={HDR_H + 16} x2={svgW - PAD} y2={HDR_H + 16} stroke="#c8d6e5" strokeWidth={0.7} />
      <text x={PAD} y={HDR_H + 35} fill="#1a1a2e" fontSize={7.5} fontWeight="bold">Предмет:</text>
      <line x1={PAD + 46} y1={HDR_H + 35} x2={svgW * 0.52} y2={HDR_H + 35} stroke="#c8d6e5" strokeWidth={0.7} />
      <text x={svgW * 0.54} y={HDR_H + 35} fill="#1a1a2e" fontSize={7.5} fontWeight="bold">Дата:</text>
      <line x1={svgW * 0.54 + 28} y1={HDR_H + 35} x2={svgW - PAD} y2={HDR_H + 35} stroke="#c8d6e5" strokeWidth={0.7} />

      {/* Черта под полями */}
      <line x1={0} y1={HDR_H + META_H} x2={svgW} y2={HDR_H + META_H} stroke="#1e3a5f" strokeWidth={0.6} />

      {/* Заголовки вариантов А Б В Г */}
      {Array.from({ length: nCols }).map((_, ci) => {
        const colX = PAD + ci * COL_W;
        return opts.map((lbl, oi) => (
          <text key={`hdr-${ci}-${oi}`}
            x={colX + NUM_W + oi * CELL_W + CELL_W / 2}
            y={HDR_H + META_H + HDR_OPT - 4}
            textAnchor="middle" fill="#1e3a5f" fontSize={8} fontWeight="bold"
          >{lbl}</text>
        ));
      })}
      <line x1={0} y1={gridTop} x2={svgW} y2={gridTop} stroke="#c8d6e5" strokeWidth={0.5} />

      {/* Строки вопросов */}
      {Array.from({ length: questionsCount }).map((_, qi) => {
        const ci   = qi % nCols;
        const ri   = Math.floor(qi / nCols);
        const rx   = PAD + ci * COL_W;
        const ry   = gridTop + ri * ROW_H;
        const midY = ry + ROW_H / 2;
        return (
          <g key={qi}>
            {ri % 2 === 0 && <rect x={rx} y={ry} width={COL_W} height={ROW_H} fill="#f0f4f8" />}
            <line x1={rx} y1={ry + ROW_H} x2={rx + COL_W} y2={ry + ROW_H} stroke="#c8d6e5" strokeWidth={0.3} />
            <text x={rx + NUM_W - 3} y={midY + 3} textAnchor="end" fill="#1a1a2e" fontSize={7.5} fontWeight="bold">
              {qi + 1}.
            </text>
            {opts.map((lbl, oi) => {
              const cx = rx + NUM_W + oi * CELL_W + CELL_W / 2;
              return (
                <g key={oi}>
                  <circle cx={cx} cy={midY} r={R} fill="white" stroke="#1e3a5f" strokeWidth={0.7} />
                  <text x={cx} y={midY + R * 0.42} textAnchor="middle" fill="#8898aa" fontSize={R * 1.3} fontWeight="bold">
                    {lbl}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Разделитель перед кодом */}
      <line x1={0} y1={codeTop - 2} x2={svgW} y2={codeTop - 2} stroke="#1e3a5f" strokeWidth={0.6} />

      {/* Блок КОД УЧЕНИКА — 5 × 10 кружков */}
      <text x={PAD} y={codeTop + 12} fill="#1a1a2e" fontSize={7.5} fontWeight="bold">КОД УЧЕНИКА</text>
      <text x={PAD + CODE_COLS * C_GAP_X + 8} y={codeTop + 12} fill="#8898aa" fontSize={6}>
        (закрасьте одну цифру в каждом столбце)
      </text>

      {/* Номера столбцов */}
      {Array.from({ length: CODE_COLS }).map((_, col) => (
        <text key={`cn-${col}`}
          x={PAD + col * C_GAP_X + CR}
          y={codeTop + CODE_HDR_H - 2}
          textAnchor="middle" fill="#1e3a5f" fontSize={7} fontWeight="bold"
        >{col + 1}</text>
      ))}

      {/* Кружки 0-9 */}
      {Array.from({ length: CODE_ROWS }).map((_, row) =>
        Array.from({ length: CODE_COLS }).map((_, col) => {
          const cx = PAD + col * C_GAP_X + CR;
          const cy = codeTop + CODE_HDR_H + row * C_GAP_Y + CR;
          return (
            <g key={`c-${col}-${row}`}>
              <circle cx={cx} cy={cy} r={CR} fill="white" stroke="#1e3a5f" strokeWidth={0.8} />
              <text x={cx} y={cy + CR * 0.42} textAnchor="middle" fill="#8898aa" fontSize={CR * 1.1} fontWeight="bold">
                {row}
              </text>
            </g>
          );
        })
      )}

      {/* Нижняя строка */}
      {(() => {
        const footY = codeTop + CODE_BLOCK_H;
        return (
          <>
            <line x1={0} y1={footY} x2={svgW} y2={footY} stroke="#c8d6e5" strokeWidth={0.4} />
            <text x={PAD} y={footY + 13} fill="#8898aa" fontSize={6}>
              Вопросов: {questionsCount}  |  Варианты: {opts.join(", ")}  |  Писать чёрной ручкой
            </text>
          </>
        );
      })()}
    </svg>
  );
}


export function BlankGenerator({ workId, workTitle, questionsCount: initQ, onClose }: {
  workId?: string;
  workTitle?: string;
  questionsCount?: number;
  onClose?: () => void;
}) {
  const [config, setConfig] = useState<BlankConfig>({
    workId:         workId     || "000001",
    workTitle:      workTitle  || "Контрольная работа",
    questionsCount: initQ      || 20,
    optionsCount:   4,
    perPage:        2,
    subject:        "",
    classLabel:     "",
    date:           "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (k: keyof BlankConfig, v: unknown) =>
    setConfig(c => ({ ...c, [k]: v }));

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await blankApi.download({
        workId:         config.workId,
        workTitle:      config.workTitle,
        questionsCount: config.questionsCount,
        optionsCount:   config.optionsCount,
        perPage:        config.perPage,
        subject:        config.subject,
        classLabel:     config.classLabel,
        date:           config.date,
      });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${res.pdf_b64}`;
      link.download = res.filename;
      link.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const opts = OPTION_LABELS.slice(0, config.optionsCount);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Шапка */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white">
        <div className="flex items-center gap-2">
          <Icon name="FileSpreadsheet" size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900">Генератор бланков</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <Icon name="X" size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-0 flex-1 overflow-auto">
        {/* Настройки */}
        <div className="lg:w-72 shrink-0 border-r bg-gray-50 p-4 space-y-4 overflow-y-auto">

          {/* Работа */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Работа</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Название</label>
                <input
                  value={config.workTitle}
                  onChange={e => upd("workTitle", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Контрольная работа"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Предмет</label>
                  <select
                    value={config.subject}
                    onChange={e => upd("subject", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Класс</label>
                  <input
                    value={config.classLabel}
                    onChange={e => upd("classLabel", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="9А"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Дата</label>
                <input
                  type="date"
                  value={config.date}
                  onChange={e => upd("date", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Структура */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Структура</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Количество вопросов</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={5} max={80} step={1}
                    value={config.questionsCount}
                    onChange={e => upd("questionsCount", Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="w-8 text-center text-sm font-semibold text-blue-700">
                    {config.questionsCount}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-2 block">Варианты ответа</label>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => upd("optionsCount", n)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        config.optionsCount === n
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {OPTION_LABELS.slice(0, n).join("/")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Печать */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Печать</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([1, 2, 4] as const).map(n => (
                <button
                  key={n}
                  onClick={() => upd("perPage", n)}
                  className={`py-2.5 rounded-lg border text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                    config.perPage === n
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Icon name={n === 1 ? "Square" : n === 2 ? "RectangleVertical" : "Grid2x2"} size={16} />
                  {n === 1 ? "1 на A4" : n === 2 ? "2 на A4" : "4 на A4"}
                </button>
              ))}
            </div>
          </section>

          {/* Ошибка */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
              <Icon name="AlertCircle" size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Кнопка */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
          >
            {loading
              ? <><Icon name="Loader2" size={16} className="animate-spin" /> Генерируем PDF…</>
              : <><Icon name="Download" size={16} /> Скачать PDF</>
            }
          </button>

          {/* Инфо */}
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-blue-700 mb-1">Как заполнять</div>
            <div>● — закрасить кружок выбранного ответа</div>
            <div>✕ — зачеркнуть ошибочный, закрасить верный</div>
            <div>Код ученика — 5 цифр для автоматической привязки</div>
          </div>
        </div>

        {/* Предпросмотр */}
        <div className="flex-1 bg-gray-100 p-5 overflow-auto flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">Предпросмотр</p>
            <div className="flex gap-1.5">
              {opts.map(lbl => (
                <span key={lbl} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                  {lbl}
                </span>
              ))}
              <span className="text-xs text-gray-500 ml-2 self-center">{config.questionsCount} вопр.</span>
            </div>
          </div>

          <div className="max-w-xl mx-auto w-full">
            <BlankPreview config={config} />
          </div>

          <p className="text-center text-xs text-gray-400">
            Предпросмотр приблизительный. Итоговый PDF формируется точно под A4.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BlankGenerator;