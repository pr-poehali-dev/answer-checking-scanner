import { useState } from "react";
import { jsPDF } from "jspdf";
import Icon from "@/components/ui/icon";
import { WORK_TYPES, SUBJECTS } from "./types";
import { GradeScale } from "@/store/appStore";

interface BlankConfig {
  workType: string;
  subject: string;
  classNum: number;
  classLetter: string;
  year: string;
  workId: string;
  part1Count: number;
  part2Count: number;
  blanksPerPage: number; // 1 или 2
  gradeScale: GradeScale;
  maxScore: number;
}

const CYRILLIC_EXAMPLE = "А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я";
const DIGITS_EXAMPLE = "1 2 3 4 5 6 7 8 9";

function drawBlank(doc: jsPDF, config: BlankConfig, startX: number, startY: number, blankW: number) {
  const margin = 5;
  const contentW = blankW - margin * 2;
  let y = startY + margin;
  const x = startX + margin;

  // Рамка всего бланка
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(startX, startY, blankW, 0); // верхняя линия рамки

  // Заголовок
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("АОУСПТ", x + contentW / 2, y + 3, { align: "center" });
  y += 5;

  doc.setFontSize(7);
  doc.text(`${config.workType.toUpperCase()} · ${config.subject} · ${config.classNum}${config.classLetter} · ${config.year}`, x + contentW / 2, y, { align: "center" });
  y += 3.5;

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Индивидуальный номер работы: ${config.workId}`, x, y);
  y += 4;

  // Разделитель
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(x, y, x + contentW, y);
  y += 3;

  // КОД УЧЕНИКА
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("КОД УЧЕНИКА (5 цифр):", x, y + 2.5);

  const boxSz = 7;
  const boxGap = 1.5;
  const codeStartX = x + 44;
  for (let i = 0; i < 5; i++) {
    const bx = codeStartX + i * (boxSz + boxGap);
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.rect(bx, y - 1, boxSz, boxSz);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(String(i + 1), bx + boxSz / 2, y + boxSz - 3, { align: "center" });
    doc.setTextColor(0);
  }
  y += boxSz + 2;

  // ФИО
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("Фамилия Имя Отчество:", x, y + 2);
  doc.setLineWidth(0.3);
  doc.line(x + 40, y + 2, x + contentW, y + 2);
  y += 5;

  // Класс / Дата
  doc.text("Класс:", x, y + 2);
  doc.line(x + 12, y + 2, x + 35, y + 2);
  doc.text("Дата:", x + 38, y + 2);
  doc.line(x + 50, y + 2, x + contentW, y + 2);
  y += 5;

  // Разделитель
  doc.setLineWidth(0.3);
  doc.line(x, y, x + contentW, y);
  y += 3;

  // Образцы букв и цифр
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("Используйте только русские буквы и цифры:", x, y + 2);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.text("Буквы: " + CYRILLIC_EXAMPLE, x, y + 2);
  y += 3.5;
  doc.text("Цифры: " + DIGITS_EXAMPLE, x, y + 2);
  y += 4;

  doc.setLineWidth(0.25);
  doc.line(x, y, x + contentW, y);
  y += 3;

  // ЧАСТЬ 1
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Часть 1 — краткий ответ (задания 1–${config.part1Count})`, x, y + 2);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Впишите букву или цифру в клетку. Исправление: зачеркнуть и написать рядом.", x, y + 1.5);
  y += 4;

  const cellW = 6.5;
  const cellH = 7;
  const labW = 5;
  const colCount = config.blanksPerPage === 2 ? 8 : 13;
  const rowCount = Math.ceil(config.part1Count / colCount);
  const cellStep = cellW + labW + 0.5;

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const qNum = row * colCount + col + 1;
      if (qNum > config.part1Count) break;
      const bx = x + col * cellStep;

      // номер задания — серый фон
      doc.setFillColor(220);
      doc.rect(bx, y, labW, cellH, "F");
      doc.setDrawColor(0);
      doc.setLineWidth(0.25);
      doc.rect(bx, y, labW, cellH);
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(String(qNum), bx + labW / 2, y + cellH / 2 + 1.8, { align: "center" });

      // клетка ответа — белая
      doc.setFillColor(255);
      doc.rect(bx + labW, y, cellW, cellH, "F");
      doc.rect(bx + labW, y, cellW, cellH);
    }
    y += cellH + 2;
  }

  y += 2;

  // ЧАСТЬ 2
  if (config.part2Count > 0) {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Часть 2 — развёрнутый ответ (задания ${config.part1Count + 1}–${config.part1Count + config.part2Count})`, x, y + 2);
    y += 4;

    for (let i = 1; i <= config.part2Count; i++) {
      const qNum = config.part1Count + i;
      doc.setFillColor(220);
      doc.rect(x, y, 7, 6, "F");
      doc.setDrawColor(0);
      doc.setLineWidth(0.25);
      doc.rect(x, y, 7, 6);
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.text(String(qNum), x + 3.5, y + 4, { align: "center" });

      doc.setLineWidth(0.3);
      doc.line(x + 9, y + 5, x + contentW, y + 5);
      y += 8;
    }
    y += 1;
  }

  // ШКАЛА ОЦЕНОК
  doc.setLineWidth(0.3);
  doc.line(x, y, x + contentW, y);
  y += 3;

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("Шкала оценок:", x, y + 2);

  const grades = [
    { g: "1", from: config.gradeScale.grade1 },
    { g: "2", from: config.gradeScale.grade2 },
    { g: "3", from: config.gradeScale.grade3 },
    { g: "4", from: config.gradeScale.grade4 },
    { g: "5", from: config.gradeScale.grade5 },
  ];
  const gStep = contentW / 6;
  grades.forEach((gr, i) => {
    const gx = x + 32 + i * gStep;
    doc.text(`«${gr.g}» — от ${gr.from} б.`, gx, y + 2);
  });
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(`Макс. баллов: ${config.maxScore} · Не сгибать. Писать синей или чёрной ручкой. Исправления: зачеркнуть, написать рядом.`, x, y + 2);
  y += 5;

  // Нижняя линия рамки
  doc.setLineWidth(0.8);
  doc.setDrawColor(0);
  doc.line(startX, y, startX + blankW, y);

  return y - startY; // высота бланка
}

export function BlankGenerator() {
  const [config, setConfig] = useState<BlankConfig>({
    workType: "Проверочная работа",
    subject: "Русский язык",
    classNum: 9,
    classLetter: "А",
    year: "2026",
    workId: "000000",
    part1Count: 20,
    part2Count: 3,
    blanksPerPage: 2,
    gradeScale: { grade1: 0, grade2: 5, grade3: 10, grade4: 15, grade5: 19 },
    maxScore: 23,
  });

  const handleGenerate = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const pageMargin = 8;

    if (config.blanksPerPage === 1) {
      const blankW = pageW - pageMargin * 2;
      drawBlank(doc, config, pageMargin, pageMargin, blankW);
    } else {
      // 2 бланка на странице с пунктирной линией разреза
      const blankW = pageW - pageMargin * 2;
      const halfH = (pageH - pageMargin * 3) / 2;

      drawBlank(doc, config, pageMargin, pageMargin, blankW);

      // Пунктирная линия разреза
      const midY = pageMargin + halfH + pageMargin / 2;
      doc.setDrawColor(100);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(pageMargin, midY, pageW - pageMargin, midY);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(5);
      doc.setTextColor(100);
      doc.text("✂ линия разреза", pageW / 2, midY - 1, { align: "center" });
      doc.setTextColor(0);

      drawBlank(doc, config, pageMargin, midY + 2, blankW);
    }

    const fname = `blank_${config.workId}_${config.classNum}${config.classLetter}_${config.subject.replace(/ /g, "_")}.pdf`;
    doc.save(fname);
  };

  const total = config.part1Count + config.part2Count;

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-4 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="FileDown" size={16} className="text-primary" />
        <p className="text-sm font-semibold">Скачать пустой бланк ответов (PDF)</p>
      </div>
      <div className="p-5 space-y-5">

        {/* Основные параметры */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Тип работы</label>
            <select value={config.workType} onChange={e => setConfig(c => ({ ...c, workType: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Предмет</label>
            <select value={config.subject} onChange={e => setConfig(c => ({ ...c, subject: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Год</label>
            <input type="text" value={config.year} onChange={e => setConfig(c => ({ ...c, year: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Класс</label>
            <div className="flex gap-2">
              <select value={config.classNum} onChange={e => setConfig(c => ({ ...c, classNum: Number(e.target.value) }))}
                className="flex-1 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {Array.from({ length: 11 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={config.classLetter} onChange={e => setConfig(c => ({ ...c, classLetter: e.target.value }))}
                className="w-20 border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {["А", "Б", "В", "Г", "Д"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Номер работы</label>
            <input type="text" value={config.workId} maxLength={6}
              onChange={e => setConfig(c => ({ ...c, workId: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Бланков на листе А4</label>
            <div className="flex gap-2">
              {[1, 2].map(n => (
                <button key={n} onClick={() => setConfig(c => ({ ...c, blanksPerPage: n }))}
                  className={`flex-1 py-2 text-sm font-semibold rounded-sm border transition-colors ${config.blanksPerPage === n ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {n} {n === 1 ? "бланк" : "бланка"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Задания */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 1</label>
            <input type="number" min={1} max={60} value={config.part1Count}
              onChange={e => { const v = parseInt(e.target.value) || 1; setConfig(c => ({ ...c, part1Count: v, maxScore: v + c.part2Count })); }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 2</label>
            <input type="number" min={0} max={20} value={config.part2Count}
              onChange={e => { const v = parseInt(e.target.value) || 0; setConfig(c => ({ ...c, part2Count: v, maxScore: c.part1Count + v })); }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Итого заданий</label>
            <div className="w-full border border-border rounded-sm px-3 py-2 text-sm mono font-bold bg-muted text-muted-foreground">{total}</div>
          </div>
        </div>

        {/* Шкала оценок */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Шкала оценок (минимальный балл для оценки)</p>
          <div className="grid grid-cols-5 gap-3">
            {([1, 2, 3, 4, 5] as const).map(g => (
              <div key={g}>
                <label className="text-xs text-muted-foreground block mb-1 text-center">
                  Оценка <span className="font-bold" style={{ color: g >= 5 ? "#22c55e" : g >= 4 ? "#3b82f6" : g >= 3 ? "#f59e0b" : "#ef4444" }}>{g}</span>
                </label>
                <input type="number" min={0} max={total}
                  value={config.gradeScale[`grade${g}` as keyof GradeScale]}
                  onChange={e => setConfig(c => ({ ...c, gradeScale: { ...c.gradeScale, [`grade${g}`]: parseInt(e.target.value) || 0 } }))}
                  className="w-full border border-border rounded-sm px-2 py-2 text-sm mono text-center font-bold focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
          </div>
        </div>

        {/* Превью + скачать */}
        <div className="flex items-start gap-4">
          <div className="flex-1 border border-border rounded-sm p-3 bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-2">Структура бланка:</p>
            <p>▪ Заголовок: АОУСПТ · {config.workType} · № {config.workId}</p>
            <p>▪ 5 клеток для кода ученика</p>
            <p>▪ Строки: ФИО, класс, дата</p>
            <p>▪ Примеры букв: А Б В Г Д Е Ж...</p>
            <p>▪ Часть 1: {config.part1Count} клеток ({config.blanksPerPage === 2 ? "8" : "13"} в ряд)</p>
            {config.part2Count > 0 && <p>▪ Часть 2: {config.part2Count} строк</p>}
            <p>▪ Шкала оценок в нижней части</p>
            {config.blanksPerPage === 2 && <p>▪ 2 бланка на листе с линией разреза</p>}
            <p className="font-medium text-foreground mt-2">Формат: чёрно-белый, А4</p>
          </div>
          <button onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity flex-shrink-0">
            <Icon name="Download" size={16} />
            Скачать PDF
          </button>
        </div>
      </div>
    </div>
  );
}
