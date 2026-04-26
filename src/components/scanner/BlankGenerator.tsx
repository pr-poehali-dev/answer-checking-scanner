import { useState } from "react";
import { jsPDF } from "jspdf";
import Icon from "@/components/ui/icon";

interface BlankConfig {
  subject: string;
  examType: string;
  year: string;
  totalQuestions: number;
  part1Count: number;
  part2Count: number;
}

function generateBlankPDF(config: BlankConfig) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica");

  // Header
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${config.examType} ${config.year} — Бланк ответов`, pageW / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Предмет: ${config.subject}`, pageW / 2, 25, { align: "center" });

  // Divider
  doc.setDrawColor(60, 80, 120);
  doc.setLineWidth(0.8);
  doc.line(margin, 29, pageW - margin, 29);

  // Student code block
  let y = 36;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("КОД УЧЕНИКА (5 цифр):", margin, y);
  y += 5;

  const codeBoxSize = 10;
  const codeGap = 3;
  const codeTotalW = 5 * codeBoxSize + 4 * codeGap;
  const codeStartX = margin;

  for (let i = 0; i < 5; i++) {
    const bx = codeStartX + i * (codeBoxSize + codeGap);
    doc.setDrawColor(60, 80, 120);
    doc.setLineWidth(0.5);
    doc.rect(bx, y, codeBoxSize, codeBoxSize);
    // digit hint dots
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(String(i + 1), bx + codeBoxSize / 2, y + codeBoxSize - 2.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Instructions next to code box
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Впишите цифры кода разборчиво, по одной в каждую клетку", codeStartX + codeTotalW + 6, y + 4);
  doc.setTextColor(0, 0, 0);

  y += codeBoxSize + 8;

  // Name line
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Фамилия Имя Отчество:", margin, y);
  y += 4;
  doc.setDrawColor(60, 80, 120);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // Class line
  doc.setFont("helvetica", "bold");
  doc.text("Класс / группа:", margin, y);
  doc.line(margin + 38, y, margin + 80, y);
  doc.text("Дата:", margin + 90, y);
  doc.line(margin + 103, y, margin + 140, y);
  y += 7;

  // Part 1 answers
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 60, 120);
  doc.text(`Часть 1 — краткие ответы (задания 1–${config.part1Count})`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Впишите ответ (букву или цифру) в соответствующую клетку. Исправления — зачеркнуть и написать рядом.", margin, y);
  y += 4;

  const cellW = 7.5;
  const cellH = 8;
  const cellGap = 0.8;
  const labW = 6;
  const colCount = 10;
  const rowCount = Math.ceil(config.part1Count / colCount);

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const qNum = row * colCount + col + 1;
      if (qNum > config.part1Count) break;
      const bx = margin + col * (cellW + labW + cellGap * 2);

      // question number label
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(235, 240, 250);
      doc.rect(bx, y, labW, cellH, "F");
      doc.setDrawColor(140, 160, 200);
      doc.setLineWidth(0.3);
      doc.rect(bx, y, labW, cellH);
      doc.setTextColor(40, 60, 120);
      doc.text(String(qNum), bx + labW / 2, y + cellH / 2 + 2.5, { align: "center" });

      // answer cell
      doc.setDrawColor(60, 80, 120);
      doc.setLineWidth(0.4);
      doc.setFillColor(255, 255, 255);
      doc.rect(bx + labW, y, cellW, cellH, "F");
      doc.rect(bx + labW, y, cellW, cellH);
      doc.setTextColor(0, 0, 0);
    }
    y += cellH + 3;
  }

  y += 4;

  // Part 2 answers
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 60, 120);
  doc.text(`Часть 2 — развёрнутые ответы (задания ${config.part1Count + 1}–${config.totalQuestions})`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Запишите ответ в отведённой строке. Для каждого задания — отдельная строка.", margin, y);
  y += 4;

  for (let i = config.part1Count + 1; i <= config.totalQuestions; i++) {
    // question number badge
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(235, 240, 250);
    doc.rect(margin, y, 9, 7, "F");
    doc.setDrawColor(140, 160, 200);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, 9, 7);
    doc.setTextColor(40, 60, 120);
    doc.text(String(i), margin + 4.5, y + 5, { align: "center" });

    // answer line
    doc.setDrawColor(60, 80, 120);
    doc.setLineWidth(0.4);
    doc.setTextColor(0, 0, 0);
    doc.line(margin + 11, y + 6, pageW - margin, y + 6);
    y += 11;
  }

  y += 4;

  // Footer
  doc.setDrawColor(60, 80, 120);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Не сгибайте бланк. Используйте синюю или чёрную ручку. Исправления: зачеркнуть и написать рядом.", pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);

  doc.save(`blank_${config.examType}_${config.subject}_${config.year}.pdf`);
}

export function BlankGenerator() {
  const [config, setConfig] = useState<BlankConfig>({
    subject: "Русский язык",
    examType: "ЕГЭ",
    year: "2026",
    totalQuestions: 33,
    part1Count: 26,
    part2Count: 7,
  });

  const subjects = ["Русский язык", "Математика (база)", "Математика (профиль)", "История", "Обществознание", "Биология", "Физика", "Химия", "Информатика", "Литература", "География", "Иностранный язык"];

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-4 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="FileDown" size={16} className="text-primary" />
        <p className="text-sm font-semibold">Скачать пустой бланк ответов (PDF)</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Тип экзамена</label>
            <select
              value={config.examType}
              onChange={e => setConfig(c => ({ ...c, examType: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option>ЕГЭ</option>
              <option>ОГЭ</option>
              <option>Контрольная</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Предмет</label>
            <select
              value={config.subject}
              onChange={e => setConfig(c => ({ ...c, subject: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {subjects.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Год</label>
            <input
              type="text"
              value={config.year}
              onChange={e => setConfig(c => ({ ...c, year: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 1</label>
            <input
              type="number"
              min={1}
              max={60}
              value={config.part1Count}
              onChange={e => {
                const v = parseInt(e.target.value) || 1;
                setConfig(c => ({ ...c, part1Count: v, part2Count: c.totalQuestions - v, totalQuestions: v + c.part2Count }));
              }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий часть 2</label>
            <input
              type="number"
              min={0}
              max={30}
              value={config.part2Count}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                setConfig(c => ({ ...c, part2Count: v, totalQuestions: c.part1Count + v }));
              }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Итого заданий</label>
            <div className="w-full border border-border rounded-sm px-3 py-2 text-sm mono font-bold bg-muted text-muted-foreground">
              {config.part1Count + config.part2Count}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-border rounded-sm p-4 mb-4 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Предпросмотр структуры бланка</p>
          <div className="space-y-3">
            {/* Code cells */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36 shrink-0">Код ученика (5 клеток)</span>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="w-7 h-7 border-2 rounded-sm flex items-center justify-center text-[9px] text-muted-foreground" style={{ borderColor: "hsl(215 60% 22%)" }}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
            {/* Part 1 */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-muted-foreground w-36 shrink-0 pt-1">Часть 1 ({config.part1Count} ответов)</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: Math.min(config.part1Count, 20) }, (_, i) => (
                  <div key={i} className="flex">
                    <div className="w-4 h-6 flex items-center justify-center text-[8px] font-bold rounded-l-sm" style={{ background: "hsl(215 60% 22% / 0.1)", color: "hsl(215 60% 22%)" }}>{i + 1}</div>
                    <div className="w-6 h-6 border rounded-r-sm" style={{ borderColor: "hsl(215 60% 22% / 0.4)" }} />
                  </div>
                ))}
                {config.part1Count > 20 && <span className="text-xs text-muted-foreground self-center">+{config.part1Count - 20}</span>}
              </div>
            </div>
            {/* Part 2 */}
            {config.part2Count > 0 && (
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground w-36 shrink-0 pt-1">Часть 2 ({config.part2Count} строк)</span>
                <div className="flex-1 space-y-1">
                  {Array.from({ length: Math.min(config.part2Count, 4) }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-4 flex items-center justify-center text-[8px] font-bold rounded-sm" style={{ background: "hsl(215 60% 22% / 0.1)", color: "hsl(215 60% 22%)" }}>{config.part1Count + i + 1}</div>
                      <div className="flex-1 h-4 border-b" style={{ borderColor: "hsl(215 60% 22% / 0.4)" }} />
                    </div>
                  ))}
                  {config.part2Count > 4 && <p className="text-xs text-muted-foreground">+{config.part2Count - 4} строк...</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => generateBlankPDF(config)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <Icon name="Download" size={16} />
          Скачать бланк PDF
        </button>
      </div>
    </div>
  );
}
