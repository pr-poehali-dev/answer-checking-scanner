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

  // Клетки части 1 — 2 колонки
  const perCol = Math.ceil(config.part1Count / 2);
  const col1 = [];
  const col2 = [];
  for (let i = 1; i <= config.part1Count; i++) {
    const cell = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <div style="min-width:22px;text-align:right;font-size:10px;font-weight:bold;">${i}.</div>
        <div style="width:28px;height:28px;border:1.5px solid #000;flex-shrink:0;"></div>
      </div>`;
    if (i <= perCol) col1.push(cell);
    else col2.push(cell);
  }

  // Строки части 2
  let part2Lines = "";
  for (let i = config.part1Count + 1; i <= total; i++) {
    part2Lines += `
      <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px;">
        <div style="font-size:10px;font-weight:bold;min-width:22px;text-align:right;">${i}.</div>
        <div style="flex:1;border-bottom:1.5px solid #000;height:18px;"></div>
      </div>`;
  }

  const blankNum = index + 1;

  return `
    <div class="blank" style="
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      border: 1.5px solid #000;
      padding: 10px 12px;
      box-sizing: border-box;
      page-break-inside: avoid;
      color: #000;
      background: #fff;
    ">
      <!-- Заголовок -->
      <div style="text-align:center;font-weight:bold;font-size:13px;margin-bottom:3px;letter-spacing:0.5px;">
        АОУСПТ — БЛАНК ОТВЕТОВ
      </div>
      <div style="text-align:center;font-size:10px;margin-bottom:3px;">
        ${config.workType.toUpperCase()}&nbsp;&nbsp;${config.subject}&nbsp;&nbsp;${config.classNum}${config.classLetter} класс&nbsp;&nbsp;${config.year} год
      </div>
      <div style="font-size:9px;text-align:center;margin-bottom:5px;color:#333;">
        Номер работы:&nbsp;<b>${config.workId}</b>
        ${config.blanksPerPage === 2 ? `&nbsp;&nbsp;&nbsp;Бланк:&nbsp;<b>${blankNum}</b>` : ""}
      </div>

      <div style="border-top:1.5px solid #000;margin-bottom:6px;"></div>

      <!-- Код ученика -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-weight:bold;font-size:10px;white-space:nowrap;">Код ученика (5 цифр):</span>
        <div style="display:flex;gap:4px;">
          ${[1, 2, 3, 4, 5].map(() => `
            <div style="width:26px;height:26px;border:1.5px solid #000;"></div>
          `).join("")}
        </div>
      </div>

      <!-- ФИО -->
      <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:5px;">
        <span style="font-weight:bold;font-size:10px;white-space:nowrap;">Фамилия, имя, отчество:</span>
        <div style="flex:1;border-bottom:1.5px solid #000;height:16px;"></div>
      </div>

      <!-- Класс / Дата -->
      <div style="display:flex;gap:20px;margin-bottom:6px;">
        <div style="display:flex;align-items:flex-end;gap:4px;">
          <span style="font-weight:bold;font-size:10px;">Класс:</span>
          <div style="width:60px;border-bottom:1.5px solid #000;height:16px;"></div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;">
          <span style="font-weight:bold;font-size:10px;">Дата:</span>
          <div style="width:90px;border-bottom:1.5px solid #000;height:16px;"></div>
        </div>
      </div>

      <div style="border-top:1.5px solid #000;margin-bottom:6px;"></div>

      <!-- Часть 1 -->
      <div style="font-weight:bold;font-size:11px;margin-bottom:2px;">
        Часть 1 — краткий ответ&nbsp;&nbsp;
        <span style="font-size:9px;font-weight:normal;">(задания 1 – ${config.part1Count}, всего ${config.part1Count} заданий)</span>
      </div>
      <div style="font-size:9px;color:#333;margin-bottom:5px;">
        Запишите букву или цифру в клетку. Исправление: зачеркнуть и написать рядом.
      </div>

      <div style="display:flex;gap:16px;margin-bottom:6px;">
        <div style="flex:1;">${col1.join("")}</div>
        <div style="flex:1;">${col2.join("")}</div>
      </div>

      ${config.part2Count > 0 ? `
        <div style="border-top:1.5px solid #000;margin-bottom:6px;"></div>
        <div style="font-weight:bold;font-size:11px;margin-bottom:2px;">
          Часть 2 — развёрнутый ответ&nbsp;&nbsp;
          <span style="font-size:9px;font-weight:normal;">(задания ${config.part1Count + 1} – ${total}, всего ${config.part2Count} заданий)</span>
        </div>
        <div style="font-size:9px;color:#333;margin-bottom:5px;">
          Записывайте ответ на строке. Каждое задание — отдельная строка.
        </div>
        ${part2Lines}
      ` : ""}

      <div style="border-top:1.5px solid #000;margin-top:4px;padding-top:4px;">
        <div style="font-size:9px;margin-bottom:2px;">
          <b>Допустимые буквы:</b>&nbsp;А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я
        </div>
        <div style="font-size:9px;margin-bottom:3px;">
          <b>Допустимые цифры:</b>&nbsp;1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4&nbsp;&nbsp;5&nbsp;&nbsp;6&nbsp;&nbsp;7&nbsp;&nbsp;8&nbsp;&nbsp;9&nbsp;&nbsp;0
        </div>
        <div style="font-size:8px;color:#333;">
          Всего заданий: <b>${total}</b>&nbsp;&nbsp;|&nbsp;&nbsp;
          Не сгибать бланк&nbsp;&nbsp;|&nbsp;&nbsp;
          Писать синей или чёрной ручкой
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
        <div style="text-align:center;font-size:9px;color:#666;margin:4px 0;border-top:1px dashed #bbb;padding-top:3px;">
          линия разреза
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
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      padding: 10mm;
      color: #000;
    }
    @media print {
      body { padding: 6mm; }
      @page { size: A4; margin: 6mm; }
    }
  </style>
</head>
<body>
  ${blanksHTML}
  <script>
    window.onload = function() { window.print(); };
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
    part1Count: 15,
    part2Count: 5,
    blanksPerPage: 2,
    gradeScale: { grade1: 0, grade2: 4, grade3: 8, grade4: 13, grade5: 17 },
    maxScore: 20,
  });

  const total = config.part1Count + config.part2Count;

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-4 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="Printer" size={16} className="text-primary" />
        <p className="text-sm font-semibold">Печать бланка ответов</p>
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
            <label className="text-xs text-muted-foreground block mb-1">Год</label>
            <input type="text" value={config.year} maxLength={4}
              onChange={e => setConfig(c => ({ ...c, year: e.target.value }))}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
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
            <label className="text-xs text-muted-foreground block mb-1">Заданий в части 1</label>
            <input type="number" min={1} max={30} value={config.part1Count}
              onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setConfig(c => ({ ...c, part1Count: v, maxScore: v + c.part2Count })); }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Заданий в части 2</label>
            <input type="number" min={0} max={20} value={config.part2Count}
              onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setConfig(c => ({ ...c, part2Count: v, maxScore: c.part1Count + v })); }}
              className="w-full border border-border rounded-sm px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Итого заданий</label>
            <div className="w-full border border-border rounded-sm px-3 py-2 text-sm mono font-bold bg-muted text-muted-foreground">{total}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 text-xs text-muted-foreground space-y-1 border border-border rounded-sm p-3 bg-muted/30">
            <p className="font-semibold text-foreground">Состав бланка:</p>
            <p>• Заголовок: АОУСПТ, {config.workType}, № {config.workId}</p>
            <p>• Код ученика — 5 пустых клеток</p>
            <p>• Строки: Фамилия Имя Отчество, Класс, Дата</p>
            <p>• <b>Часть 1:</b> {config.part1Count} клеток с номерами заданий (2 колонки)</p>
            {config.part2Count > 0 && <p>• <b>Часть 2:</b> {config.part2Count} строк с номерами заданий</p>}
            <p>• Допустимые буквы и цифры</p>
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
