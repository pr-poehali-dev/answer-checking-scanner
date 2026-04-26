import { useState } from "react";
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
  blanksPerPage: number;
  gradeScale: GradeScale;
  maxScore: number;
}

function buildBlankHTML(config: BlankConfig, index: number): string {
  const total = config.part1Count + config.part2Count;

  // Клетки части 1
  let part1Cells = "";
  const cols = config.blanksPerPage === 2 ? 8 : 13;
  for (let i = 1; i <= config.part1Count; i++) {
    part1Cells += `
      <div style="display:flex;margin:1px;">
        <div style="width:18px;height:22px;background:#e8e8e8;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;flex-shrink:0;">${i}</div>
        <div style="width:22px;height:22px;border:1px solid #000;border-left:none;"></div>
      </div>`;
  }

  // Строки части 2
  let part2Lines = "";
  for (let i = config.part1Count + 1; i <= total; i++) {
    part2Lines += `
      <div style="display:flex;align-items:flex-end;margin-bottom:6px;gap:4px;">
        <div style="width:18px;height:18px;background:#e8e8e8;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;flex-shrink:0;">${i}</div>
        <div style="flex:1;border-bottom:1px solid #000;height:16px;"></div>
      </div>`;
  }

  // Шкала оценок
  const scaleItems = [1, 2, 3, 4, 5].map(g => {
    const val = config.gradeScale[`grade${g}` as keyof GradeScale];
    return `<span style="margin-right:10px;">Оценка <b>${g}</b> — от ${val} балл.</span>`;
  }).join("");

  const blankNum = index + 1;

  return `
    <div class="blank" style="
      font-family: Arial, sans-serif;
      font-size: 10px;
      border: 1px solid #000;
      padding: 8px 10px;
      box-sizing: border-box;
      page-break-inside: avoid;
      color: #000;
      background: #fff;
    ">
      <!-- Заголовок -->
      <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:2px;">АОУСПТ</div>
      <div style="text-align:center;font-size:9px;font-weight:bold;margin-bottom:2px;">
        ${config.workType.toUpperCase()} &nbsp;|&nbsp; ${config.subject} &nbsp;|&nbsp; ${config.classNum}${config.classLetter} класс &nbsp;|&nbsp; ${config.year} год
      </div>
      <div style="font-size:8px;margin-bottom:4px;">
        Индивидуальный номер работы: <b>${config.workId}</b>
        ${config.blanksPerPage === 2 ? `&nbsp;&nbsp;&nbsp;Бланк: <b>${blankNum}</b>` : ""}
      </div>
      <div style="border-top:1px solid #000;margin-bottom:5px;"></div>

      <!-- Код ученика -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-weight:bold;font-size:9px;white-space:nowrap;">КОД УЧЕНИКА (5 цифр):</span>
        <div style="display:flex;gap:3px;">
          ${[1,2,3,4,5].map(n => `
            <div style="width:22px;height:22px;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:8px;color:#aaa;">${n}</div>
          `).join("")}
        </div>
        <span style="font-size:8px;color:#555;">Впишите цифры разборчиво, по одной в клетку</span>
      </div>

      <!-- ФИО -->
      <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:4px;">
        <span style="font-weight:bold;font-size:9px;white-space:nowrap;">Фамилия Имя Отчество:</span>
        <div style="flex:1;border-bottom:1px solid #000;height:14px;"></div>
      </div>

      <!-- Класс / Дата -->
      <div style="display:flex;gap:16px;margin-bottom:5px;">
        <div style="display:flex;align-items:flex-end;gap:4px;">
          <span style="font-weight:bold;font-size:9px;white-space:nowrap;">Класс:</span>
          <div style="width:60px;border-bottom:1px solid #000;height:14px;"></div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;">
          <span style="font-weight:bold;font-size:9px;white-space:nowrap;">Дата:</span>
          <div style="width:80px;border-bottom:1px solid #000;height:14px;"></div>
        </div>
      </div>

      <div style="border-top:1px solid #000;margin-bottom:5px;"></div>

      <!-- Образцы символов -->
      <div style="font-size:8px;margin-bottom:3px;">
        <b>Допустимые буквы:</b> А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я
      </div>
      <div style="font-size:8px;margin-bottom:5px;">
        <b>Допустимые цифры:</b> 1 2 3 4 5 6 7 8 9
      </div>

      <div style="border-top:1px solid #000;margin-bottom:5px;"></div>

      <!-- Часть 1 -->
      <div style="font-weight:bold;font-size:9px;margin-bottom:3px;">
        Часть 1 — краткий ответ (задания 1–${config.part1Count})
      </div>
      <div style="font-size:8px;margin-bottom:4px;">
        Впишите букву или цифру в клетку. Исправление: зачеркнуть и написать рядом.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:6px;">
        ${part1Cells}
      </div>

      ${config.part2Count > 0 ? `
        <div style="border-top:1px solid #000;margin-bottom:5px;"></div>
        <div style="font-weight:bold;font-size:9px;margin-bottom:4px;">
          Часть 2 — развёрнутый ответ (задания ${config.part1Count + 1}–${total})
        </div>
        ${part2Lines}
      ` : ""}

      <div style="border-top:1px solid #000;margin-top:4px;padding-top:4px;">
        <div style="font-size:8px;margin-bottom:2px;"><b>Шкала оценок:</b> ${scaleItems}</div>
        <div style="font-size:7.5px;color:#444;">
          Максимальный балл: ${config.maxScore} &nbsp;|&nbsp;
          Не сгибать бланк &nbsp;|&nbsp; Писать синей или чёрной ручкой &nbsp;|&nbsp;
          Исправления: зачеркнуть и написать рядом
        </div>
      </div>
    </div>
  `;
}

function printBlanks(config: BlankConfig) {
  const count = config.blanksPerPage;
  let blanksHTML = "";
  for (let i = 0; i < count; i++) {
    blanksHTML += buildBlankHTML(config, i);
    if (i < count - 1) {
      blanksHTML += `
        <div style="text-align:center;font-size:9px;color:#888;margin:4px 0;border-top:1px dashed #999;padding-top:3px;">
          ✂ линия разреза
        </div>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Бланк ответов — ${config.workType} — ${config.workId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #fff;
      padding: 12mm;
      color: #000;
    }
    @media print {
      body { padding: 8mm; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  ${blanksHTML}
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
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

  const total = config.part1Count + config.part2Count;

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-4 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="FileDown" size={16} className="text-primary" />
        <p className="text-sm font-semibold">Скачать пустой бланк ответов (печать)</p>
      </div>
      <div className="p-5 space-y-5">

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

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Шкала оценок (минимальный балл)</p>
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

        <div className="flex items-center gap-4">
          <div className="flex-1 text-xs text-muted-foreground space-y-1 border border-border rounded-sm p-3 bg-muted/30">
            <p className="font-semibold text-foreground">Состав бланка:</p>
            <p>• Заголовок: АОУСПТ, {config.workType}, № {config.workId}</p>
            <p>• 5 клеток для кода ученика (с номерами 1–5)</p>
            <p>• Строки: Фамилия Имя Отчество, Класс, Дата</p>
            <p>• Образцы всех допустимых букв и цифр</p>
            <p>• Часть 1: {config.part1Count} клеток с номерами заданий</p>
            {config.part2Count > 0 && <p>• Часть 2: {config.part2Count} строк с номерами</p>}
            <p>• Шкала оценок 1–5 с баллами</p>
            {config.blanksPerPage === 2 && <p>• 2 бланка на листе с линией разреза</p>}
          </div>
          <button onClick={() => printBlanks(config)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity flex-shrink-0">
            <Icon name="Printer" size={16} />
            Открыть для печати
          </button>
        </div>
      </div>
    </div>
  );
}
