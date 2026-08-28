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

/** Предпросмотр бланка — компактный, точно соответствует PDF */
function BlankPreview({ config }: { config: BlankConfig }) {
  const { questionsCount, optionsCount } = config;
  const opts = OPTION_LABELS.slice(0, optionsCount);

  // Раскладка колонок — как в генераторе PDF
  const nCols = questionsCount <= 8 ? 1 : questionsCount <= 24 ? 2 : 3;
  const nRows = Math.ceil(questionsCount / nCols);

  // Размеры в SVG-пикселях (≈2.6 px на мм печатного бланка)
  const PAD = 9;
  const CELL = 18;        // клетка под рукописный символ
  const NUM_W = 16;
  const PAIR_W = NUM_W + CELL + 4;
  const ROW_H = CELL + 6;
  const CODE_CELLS = 5;
  const CODE_STEP = CELL + 3;
  const HEAD_H = 82;      // шапка: заголовок, ФИО, код, подсказка

  const gridW = nCols * PAIR_W;
  const codeW = CODE_CELLS * CODE_STEP;
  const svgW = Math.max(gridW, codeW) + 2 * PAD;
  const svgH = HEAD_H + nRows * ROW_H + PAD;

  const codeY = 52;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full border border-gray-200 rounded bg-white shadow-sm"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <rect x={0} y={0} width={svgW} height={svgH} fill="white" />

      {/* Заголовок */}
      <text x={PAD} y={13} fill="#1e3a5f" fontSize={9} fontWeight="bold">БЛАНК ОТВЕТОВ</text>
      <text x={svgW - PAD} y={13} textAnchor="end" fill="#8898aa" fontSize={6}>№{config.workId}</text>
      <line x1={PAD} y1={17} x2={svgW - PAD} y2={17} stroke="#9fb3c8" strokeWidth={0.6} />

      {/* ФИО */}
      <text x={PAD} y={29} fill="#1a1a2e" fontSize={7} fontWeight="bold">ФИО:</text>
      <line x1={PAD + 24} y1={30} x2={svgW - PAD} y2={30} stroke="#9fb3c8" strokeWidth={0.6} />

      {/* Подпись предмета/класса */}
      {(config.subject || config.classLabel) && (
        <text x={PAD} y={41} fill="#8898aa" fontSize={6}>
          {[config.subject, config.classLabel].filter(Boolean).join(" · ")}
        </text>
      )}

      {/* Код ученика — 5 клеток */}
      <text x={PAD} y={codeY - 3} fill="#1e3a5f" fontSize={5.6} fontWeight="bold">КОД УЧЕНИКА</text>
      {Array.from({ length: CODE_CELLS }).map((_, i) => (
        <rect key={`c${i}`} x={PAD + i * CODE_STEP} y={codeY} width={CELL} height={CELL}
          fill="white" stroke="#9fb3c8" strokeWidth={0.9} />
      ))}
      <text x={PAD} y={codeY + CELL + 9} fill="#8898aa" fontSize={5.4}>
        Впишите букву: {opts.join(" ")} · лишние вопросы — Z
      </text>

      {/* Пары «номер вопроса → клетка для буквы» */}
      {Array.from({ length: questionsCount }).map((_, qi) => {
        const ci = Math.floor(qi / nRows);
        const ri = qi % nRows;
        const px = PAD + ci * PAIR_W;
        const py = HEAD_H + ri * ROW_H;
        return (
          <g key={qi}>
            <text x={px + NUM_W - 3} y={py + CELL * 0.68} textAnchor="end"
              fill="#1a1a2e" fontSize={7} fontWeight="bold">{qi + 1}.</text>
            <rect x={px + NUM_W} y={py} width={CELL} height={CELL}
              fill="white" stroke="#9fb3c8" strokeWidth={0.8} />
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

  // Выбор учеников для персональных бланков (QR + ФИО)
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

  // Сколько бланков влезает на лист A4 — повторяет расчёт генератора PDF
  const perSheet = useMemo(() => {
    const nQ = config.questionsCount;
    const nCols = nQ <= 8 ? 1 : nQ <= 24 ? 2 : 3;
    const nRows = Math.ceil(nQ / nCols);
    const MM = 1;
    const CELL = 7.0, GAP_C = 1.6, NUM_W = 6.2, PAD_B = 3.5;
    const PAIR_W = NUM_W + CELL + GAP_C;
    const ROW_H = CELL + 2.4;
    const HEAD_H = 31.5;
    const bw = Math.max(nCols * PAIR_W, 5 * (CELL + 1.2)) + 2 * PAD_B;
    const bh = HEAD_H + nRows * ROW_H + PAD_B;
    const pw = 210 * MM, ph = 297 * MM, margin = 8, gap = 4;
    const cols = Math.max(1, Math.floor((pw - 2 * margin + gap) / (bw + gap)));
    const rows = Math.max(1, Math.floor((ph - 2 * margin + gap) / (bh + gap)));
    return cols * rows;
  }, [config.questionsCount]);

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
                Бланки компактные — на лист A4 помещается{" "}
                <span className="font-semibold">{perSheet}</span>{" "}
                {perSheet === 1 ? "бланк" : perSheet < 5 ? "бланка" : "бланков"}.
                Между ними печатаются линии отреза.
              </p>
            </div>
          </section>

          {/* Ученики (персональные бланки с QR) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ученики (QR на бланке)</p>
              {selectedCodes.size > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  {selectedCodes.size}
                </span>
              )}
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-gray-400 bg-white border border-gray-200 rounded-lg p-2.5">
                Список учеников пуст. Будет напечатан пустой бланк без QR. Добавьте учеников в разделе «Ученики».
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
                  На каждого выбранного — отдельный бланк с его ФИО и персональным QR-кодом.
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
            <div>● — закрасить кружок выбранного ответа</div>
            <div>✕ — зачеркнуть ошибочный, закрасить верный</div>
            <div>QR-код определяет ученика автоматически</div>
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