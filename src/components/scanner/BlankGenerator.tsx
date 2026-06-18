import { useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { WORK_TYPES, SUBJECTS } from "./types";
import { blankApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

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

/** Предпросмотр бланка — компактный, точно соответствует PDF */
function BlankPreview({ config }: { config: BlankConfig }) {
  const { questionsCount, optionsCount } = config;
  const opts = OPTION_LABELS.slice(0, optionsCount);

  const nCols  = questionsCount <= 15 ? 1 : questionsCount <= 40 ? 2 : 3;
  const nRows  = Math.ceil(questionsCount / nCols);

  // Размеры — в SVG-пикселях (масштаб ≈ 2.5px/мм)
  const PAD    = 10;
  const HDR_H  = 28;   // шапка
  const META_H = 30;   // поля ученика
  const HDR_G  = 14;   // заголовок А Б В Г
  const NUM_W  = 20;
  const CELL_W = Math.min(22, Math.floor(180 / optionsCount));
  const COL_W  = NUM_W + CELL_W * optionsCount + 4;
  const R      = Math.min(CELL_W * 0.38, 7);
  const ROW_H  = R * 2 + 5;

  // Идентификация ученика: QR-код с реперами
  const QR_SIZE = 40;       // сторона QR в превью
  const QR_PAD  = 4;        // отступ репера от QR
  const QR_ACS  = 5;        // размер репера зоны QR
  const CODE_H  = QR_SIZE + 2 * (QR_PAD + QR_ACS) + 6;

  const FOOT_H = 16;
  const CODE_GAP = 14;   // зазор между ответами и зоной QR
  const svgW   = PAD * 2 + COL_W * nCols;
  const svgH   = HDR_H + META_H + HDR_G + nRows * ROW_H + CODE_GAP + CODE_H + FOOT_H + 6;

  const gridTop = HDR_H + META_H + HDR_G;
  const gridBottom = gridTop + nRows * ROW_H;
  const codeTop = gridBottom + CODE_GAP;

  // Зона QR
  const qrCx = PAD + QR_ACS + QR_PAD + QR_SIZE / 2;
  const qrCy = codeTop + QR_ACS + QR_PAD + QR_SIZE / 2;

  // Реперы (чёрные квадраты) — как на печатном бланке
  const AS = 6;          // размер репера ответов
  const axL = PAD * 0.5;
  const axR = svgW - PAD * 0.5;
  const ayT = gridTop + 1;
  const ayB = gridBottom - 1;

  const Anchor = ({ x, y, s }: { x: number; y: number; s: number }) => (
    <rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill="#111" />
  );

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full border border-gray-200 rounded bg-white shadow-sm"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <rect x={0} y={0} width={svgW} height={svgH} fill="white" />

      {/* Шапка — только текст, без тёмной плашки */}
      <text x={svgW/2} y={HDR_H*0.6} textAnchor="middle" fill="#1e3a5f" fontSize={9} fontWeight="bold">БЛАНК ОТВЕТОВ</text>
      <text x={svgW - PAD} y={HDR_H*0.6} textAnchor="end" fill="#8898aa" fontSize={6.5}>№ {config.workId}</text>
      <line x1={PAD} y1={HDR_H-2} x2={svgW-PAD} y2={HDR_H-2} stroke="#c8d6e5" strokeWidth={0.5}/>

      {/* Поля ученика — только линии */}
      <text x={PAD} y={HDR_H + 13} fill="#1a1a2e" fontSize={7} fontWeight="bold">ФИО:</text>
      <line x1={PAD+22} y1={HDR_H+13} x2={svgW*0.61} y2={HDR_H+13} stroke="#c8d6e5" strokeWidth={0.6}/>
      <text x={svgW*0.63} y={HDR_H+13} fill="#1a1a2e" fontSize={7} fontWeight="bold">Класс:</text>
      <line x1={svgW*0.63+28} y1={HDR_H+13} x2={svgW-PAD} y2={HDR_H+13} stroke="#c8d6e5" strokeWidth={0.6}/>
      <text x={PAD} y={HDR_H+26} fill="#1a1a2e" fontSize={7} fontWeight="bold">Предмет:</text>
      <line x1={PAD+40} y1={HDR_H+26} x2={svgW*0.52} y2={HDR_H+26} stroke="#c8d6e5" strokeWidth={0.6}/>
      <text x={svgW*0.54} y={HDR_H+26} fill="#1a1a2e" fontSize={7} fontWeight="bold">Дата:</text>
      <line x1={svgW*0.54+24} y1={HDR_H+26} x2={svgW-PAD} y2={HDR_H+26} stroke="#c8d6e5" strokeWidth={0.6}/>
      <line x1={PAD} y1={HDR_H+META_H} x2={svgW-PAD} y2={HDR_H+META_H} stroke="#c8d6e5" strokeWidth={0.5}/>

      {/* Заголовки А Б В Г */}
      {Array.from({length: nCols}).map((_, ci) =>
        opts.map((lbl, oi) => (
          <text key={`h${ci}${oi}`}
            x={PAD + ci*COL_W + NUM_W + oi*CELL_W + CELL_W/2}
            y={HDR_H + META_H + HDR_G - 3}
            textAnchor="middle" fill="#1e3a5f" fontSize={7} fontWeight="bold"
          >{lbl}</text>
        ))
      )}

      {/* Вопросы — кружки, без зебры и вертикальных линий */}
      {Array.from({length: questionsCount}).map((_, qi) => {
        const ci = Math.floor(qi / nRows);
        const ri = qi % nRows;
        const rx = PAD + ci * COL_W;
        const ry = gridTop + ri * ROW_H;
        const my = ry + ROW_H / 2;
        return (
          <g key={qi}>
            <text x={rx+NUM_W-2} y={my+2.5} textAnchor="end" fill="#1a1a2e" fontSize={7} fontWeight="bold">{qi+1}.</text>
            {opts.map((lbl, oi) => {
              const cx = rx + NUM_W + oi*CELL_W + CELL_W/2;
              return (
                <g key={oi}>
                  <circle cx={cx} cy={my} r={R} fill="white" stroke="#1e3a5f" strokeWidth={0.6}/>
                  <text x={cx} y={my+R*0.4} textAnchor="middle" fill="#8898aa" fontSize={R*1.3} fontWeight="bold">{lbl}</text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Реперы зоны ответов */}
      <Anchor x={axL} y={ayT} s={AS}/>
      <Anchor x={axR} y={ayT} s={AS}/>
      <Anchor x={axL} y={ayB} s={AS}/>
      <Anchor x={axR} y={ayB} s={AS}/>

      {/* Зона идентификации: QR-код ученика (заглушка превью) */}
      <rect x={qrCx - QR_SIZE/2} y={qrCy - QR_SIZE/2} width={QR_SIZE} height={QR_SIZE} fill="white" stroke="#1e3a5f" strokeWidth={0.6}/>
      <text x={qrCx} y={qrCy + 2} textAnchor="middle" fill="#8898aa" fontSize={6}>QR ученика</text>
      <text x={qrCx + QR_SIZE/2 + QR_ACS + 8} y={qrCy - 2} fill="#1a1a2e" fontSize={6.5} fontWeight="bold">ИДЕНТИФИКАЦИЯ УЧЕНИКА</text>
      <text x={qrCx + QR_SIZE/2 + QR_ACS + 8} y={qrCy + 8} fill="#8898aa" fontSize={5}>QR определяет ученика автоматически</text>

      {/* 4 репера вокруг QR */}
      <Anchor x={qrCx - QR_SIZE/2 - QR_PAD - QR_ACS/2} y={qrCy - QR_SIZE/2 - QR_PAD - QR_ACS/2} s={QR_ACS}/>
      <Anchor x={qrCx + QR_SIZE/2 + QR_PAD + QR_ACS/2} y={qrCy - QR_SIZE/2 - QR_PAD - QR_ACS/2} s={QR_ACS}/>
      <Anchor x={qrCx - QR_SIZE/2 - QR_PAD - QR_ACS/2} y={qrCy + QR_SIZE/2 + QR_PAD + QR_ACS/2} s={QR_ACS}/>
      <Anchor x={qrCx + QR_SIZE/2 + QR_PAD + QR_ACS/2} y={qrCy + QR_SIZE/2 + QR_PAD + QR_ACS/2} s={QR_ACS}/>

      {/* Нижняя строка */}
      <text x={PAD} y={svgH-4} fill="#8898aa" fontSize={5.5}>
        Вопросов: {questionsCount}  |  Варианты: {opts.join(", ")}  |  Заполнять чёрной ручкой
      </text>
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
        perPage:        config.perPage,
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

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
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