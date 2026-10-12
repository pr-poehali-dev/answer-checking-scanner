import { useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { SUBJECTS } from "./types";
import { blankApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

export interface BlankConfig {
  workId: string;
  workTitle: string;
  questionsCount: number;
  optionsCount: number;   // 2–6
  subject: string;
  classLabel: string;
  date: string;
}

const OPTION_LABELS = ["А", "Б", "В", "Г", "Д", "Е"];

const LAYOUTS: [number, number, number][] = [[4, 2, 2], [3, 3, 1], [2, 1, 2], [1, 1, 1]];

/** Те же размеры и правила, что в генераторе PDF (backend/generate-blank/geometry.py). */
const G = {
  SW: 210, SH: 297, SM: 5, GAP: 4, PAD: 7, BUB_R: 2.3, PITCH: 6.6, ROW_H: 6.2, NUM_W: 8, COL_GAP: 1,
  CODE_R: 1.8, CODE_PX: 4.4, CODE_PY: 4.6, CODE_LABEL_W: 4,
  Y_TITLE: 8.3, Y_RULE: 10, Y_INFO: 13, Y_NAME: 18, Y_CODE_LABEL: 22.2, Y_DIGITS: 26, Y_CODE0: 29.5, Y_HEAD: 52.5,
  BOTTOM: 7, BIG: 7, SMALL: 4.5, INSET: 2, INSTR_MIN: 26, INSTR_BELOW: 15,
};

function slotSize(cols: number, rows: number) {
  return [
    (G.SW - 2 * G.SM - G.GAP * (cols - 1)) / cols,
    (G.SH - 2 * G.SM - G.GAP * (rows - 1)) / rows,
  ];
}
const instrBelow = (w: number) => w - 2 * G.PAD - (G.CODE_LABEL_W + 10 * G.CODE_PX) - 3 < G.INSTR_MIN;
const headEnd = (w: number) => G.Y_HEAD + (instrBelow(w) ? G.INSTR_BELOW : 0);
const blockW = (opts: number) => G.NUM_W + (opts - 1) * G.PITCH + 2 * G.BUB_R + G.COL_GAP;
const qCols = (w: number, opts: number) => Math.max(0, Math.min(4, Math.floor((w - 2 * G.PAD) / blockW(opts) + 1e-6)));
const maxRows = (w: number, h: number) => Math.max(0, Math.floor((h - headEnd(w) - G.BOTTOM) / G.ROW_H + 1e-6));

/** Раскладка на лист A4: сколько бланков помещается при данном числе вопросов. */
export function chooseLayout(nQ: number, nOpts: number): { per: number; cols: number; rows: number } {
  for (const [per, cols, rows] of LAYOUTS) {
    const [w, h] = slotSize(cols, rows);
    const qc = qCols(w, nOpts);
    if (qc >= 1 && qc * maxRows(w, h) >= nQ) return { per, cols, rows };
  }
  return { per: 1, cols: 1, rows: 1 };
}

/** Предпросмотр бланка — повторяет PDF: метки в углах, код ученика и кружки ответов. */
function BlankPreview({ config }: { config: BlankConfig }) {
  const { questionsCount: nQ, optionsCount: nOpts } = config;
  const opts = OPTION_LABELS.slice(0, nOpts);
  const { cols, rows } = chooseLayout(nQ, nOpts);
  const [w, h] = slotSize(cols, rows);

  const qc = Math.max(1, qCols(w, nOpts));
  const nRows = Math.ceil(nQ / qc);
  const colStep = (w - 2 * G.PAD) / qc;
  const y0 = headEnd(w);
  const visibleH = Math.min(h, y0 + nRows * G.ROW_H + G.BOTTOM);

  const marks = [
    { x: G.INSET, y: G.INSET, s: G.BIG },
    { x: w - G.INSET - G.SMALL, y: G.INSET, s: G.SMALL },
    { x: G.INSET, y: visibleH - G.INSET - G.SMALL, s: G.SMALL },
    { x: w - G.INSET - G.SMALL, y: visibleH - G.INSET - G.SMALL, s: G.SMALL },
  ];
  const below = instrBelow(w);

  return (
    <svg viewBox={`0 0 ${w} ${visibleH}`}
      className="w-full max-w-[420px] mx-auto border border-gray-200 rounded bg-white shadow-sm"
      style={{ fontFamily: "Arial, sans-serif" }}>
      {marks.map((m, i) => <rect key={i} x={m.x} y={m.y} width={m.s} height={m.s} fill="#000" />)}

      <text x={11} y={G.Y_TITLE} fill="#1e3a5f" fontSize={3} fontWeight="bold">БЛАНК ОТВЕТОВ</text>
      <text x={w - G.PAD} y={G.Y_TITLE} textAnchor="end" fill="#6f7f90" fontSize={2}>№{config.workId}</text>
      <line x1={11} y1={G.Y_RULE} x2={w - G.PAD} y2={G.Y_RULE} stroke="#9fb3c8" strokeWidth={0.2} />
      <text x={G.PAD} y={G.Y_NAME} fill="#1a1a2e" fontSize={2.5} fontWeight="bold">ФИО:</text>
      <line x1={G.PAD + 8} y1={G.Y_NAME + 0.7} x2={w - G.PAD} y2={G.Y_NAME + 0.7} stroke="#9fb3c8" strokeWidth={0.2} />
      <text x={G.PAD} y={G.Y_CODE_LABEL} fill="#1e3a5f" fontSize={2.1} fontWeight="bold">КОД УЧЕНИКА</text>

      {Array.from({ length: 10 }).map((_, d) => (
        <text key={`d${d}`} x={G.PAD + G.CODE_LABEL_W + G.CODE_R + d * G.CODE_PX} y={G.Y_DIGITS}
          textAnchor="middle" fontSize={2.1} fontWeight="bold" fill="#1a1a2e">{d}</text>
      ))}
      {Array.from({ length: 5 }).map((_, p) => (
        <g key={`p${p}`}>
          <text x={G.PAD + G.CODE_LABEL_W - 1.3} y={G.Y_CODE0 + p * G.CODE_PY + 0.7} textAnchor="end" fontSize={1.7} fill="#6f7f90">{p + 1}</text>
          {Array.from({ length: 10 }).map((__, d) => (
            <circle key={d} cx={G.PAD + G.CODE_LABEL_W + G.CODE_R + d * G.CODE_PX} cy={G.Y_CODE0 + p * G.CODE_PY}
              r={G.CODE_R} fill="#fff" stroke="#4a5b70" strokeWidth={0.22} />
          ))}
        </g>
      ))}

      {!below && ["Закрашивайте кружок", "полностью тёмной ручкой.", "Код: в каждой строке", "одна цифра. На вопрос —", "один кружок."].map((t, i) => (
        <text key={i} x={G.PAD + G.CODE_LABEL_W + 10 * G.CODE_PX + 3} y={G.Y_CODE_LABEL + 3 * i} fontSize={1.8} fill="#6f7f90">{t}</text>
      ))}
      {below && ["Закрашивайте кружок", "полностью тёмной ручкой.", "Код: в каждой строке", "одна цифра. На вопрос —", "один кружок."].map((t, i) => (
        <text key={i} x={G.PAD} y={G.Y_CODE0 + 4 * G.CODE_PY + G.CODE_R + 3.4 + i * 3} fontSize={1.8} fill="#6f7f90">{t}</text>
      ))}

      {Array.from({ length: nQ }).map((_, q) => {
        const c = Math.floor(q / nRows);
        const r = q % nRows;
        const xCol = G.PAD + c * colStep;
        const cy = y0 + (r + 0.5) * G.ROW_H;
        return (
          <g key={q}>
            <text x={xCol + G.NUM_W - 1.6} y={cy + 0.9} textAnchor="end" fontSize={2.5} fontWeight="bold" fill="#1a1a2e">{q + 1}.</text>
            {opts.map((o, j) => {
              const cx = xCol + G.NUM_W + G.BUB_R + j * G.PITCH;
              return (
                <g key={o}>
                  <circle cx={cx} cy={cy} r={G.BUB_R} fill="#fff" stroke="#4a5b70" strokeWidth={0.25} />
                  <text x={cx} y={cy + 0.8} textAnchor="middle" fontSize={2.2} fill="#9aa8b8">{o}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}


export function BlankGenerator({ workId, workTitle, questionsCount: initQ, optionsCount: initOpts, onClose }: {
  workId?: string;
  workTitle?: string;
  questionsCount?: number;
  optionsCount?: number;
  onClose?: () => void;
}) {
  const [config, setConfig] = useState<BlankConfig>({
    workId:         workId     || "000001",
    workTitle:      workTitle  || "Контрольная работа",
    questionsCount: initQ      || 20,
    optionsCount:   initOpts   || 4,
    subject:        "",
    classLabel:     "",
    date:           "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Выбор учеников для персональных бланков (код + ФИО)
  const { students } = useAppStore();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState<string>("all");

  // Доступные классы из списка учеников
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => set.add(`${s.classNum}${s.classLetter}`));
    return Array.from(set).sort();
  }, [students]);

  const visibleStudents = useMemo(() => {
    return students
      .filter(s => classFilter === "all" || `${s.classNum}${s.classLetter}` === classFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [students, classFilter]);

  const toggleStudent = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = visibleStudents.every(s => selectedCodes.has(s.code));
    setSelectedCodes(prev => {
      const next = new Set(prev);
      visibleStudents.forEach(s => { if (allSelected) next.delete(s.code); else next.add(s.code); });
      return next;
    });
  };

  const upd = (k: keyof BlankConfig, v: unknown) =>
    setConfig(c => ({ ...c, [k]: v }));

  const perSheet = useMemo(
    () => chooseLayout(config.questionsCount, config.optionsCount).per,
    [config.questionsCount, config.optionsCount],
  );

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const chosen = students.filter(s => selectedCodes.has(s.code));
      const studentsPayload = chosen.map(s => ({
        code: s.code,
        name: s.name,
        classLabel: `${s.classNum}${s.classLetter}`,
      }));
      await blankApi.download({
        workId:         config.workId,
        workTitle:      config.workTitle,
        questionsCount: config.questionsCount,
        optionsCount:   config.optionsCount,
        subject:        config.subject,
        classLabel:     config.classLabel,
        date:           config.date,
        students:       studentsPayload,
      });
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
        <div className="lg:w-72 shrink-0 border-r bg-gray-50 p-4 space-y-4 overflow-y-auto styled-scrollbar">

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

          {/* Печать — раскладка считается автоматически */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Печать</p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Icon name="Info" size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">
                На лист A4 помещается{" "}
                <span className="font-semibold">{perSheet}</span>{" "}
                {perSheet === 1 ? "бланк" : "бланка"}: чем меньше вопросов, тем больше бланков на листе.
                Распечатайте без масштабирования («реальный размер»), затем разрежьте по пунктиру.
              </p>
            </div>
          </section>

          {/* Ученики (персональные бланки с кодом) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ученики (код на бланке)</p>
              {selectedCodes.size > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  {selectedCodes.size}
                </span>
              )}
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-gray-400 bg-white border border-gray-200 rounded-lg p-2.5">
                Список учеников пуст. Будет напечатан пустой бланк: ученик закрасит код сам. Добавьте учеников в разделе «Ученики».
              </p>
            ) : (
              <div className="space-y-2">
                <select
                  value={classFilter}
                  onChange={e => setClassFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все классы</option>
                  {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <button
                  onClick={toggleAllVisible}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                >
                  {visibleStudents.every(s => selectedCodes.has(s.code)) ? "Снять выделение" : "Выбрать всех"}
                </button>

                <div className="max-h-48 overflow-y-auto styled-scrollbar border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                  {visibleStudents.map(s => {
                    const checked = selectedCodes.has(s.code);
                    return (
                      <label key={s.code} className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(s.code)}
                          className="w-4 h-4 accent-blue-600 flex-shrink-0"
                        />
                        <span className="flex-1 text-sm text-gray-800 truncate">{s.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{s.classNum}{s.classLetter}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400">
                  На каждого выбранного — отдельный бланк с его ФИО и уже закрашенным кодом.
                </p>
              </div>
            )}
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
              : <><Icon name="Download" size={16} />
                  {selectedCodes.size > 0 ? `Скачать ${selectedCodes.size} бланк(ов)` : "Скачать пустой бланк"}
                </>
            }
          </button>

          {/* Инфо */}
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-blue-700 mb-1">Как заполнять</div>
            <div>● Закрасить кружок выбранного ответа полностью, тёмной ручкой</div>
            <div>● На один вопрос — один кружок</div>
            <div>● Код ученика: в каждой из 5 строк закрасить одну цифру</div>
            <div>● Фото: бланк целиком, чтобы были видны 4 чёрных квадрата в углах</div>
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