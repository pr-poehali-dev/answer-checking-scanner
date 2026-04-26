import { useState } from "react";
import Icon from "@/components/ui/icon";
import { recognizeApi } from "@/lib/api";
import { appStore, useAppStore, Work, GradeScale } from "@/store/appStore";

interface BulkItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  studentCode?: string;
  studentName?: string;
  correct?: number;
  total?: number;
  grade?: string;
  confidence?: number;
  error?: string;
}

function calcGrade(correct: number, gs: GradeScale): string {
  if (correct >= gs.grade5) return "5";
  if (correct >= gs.grade4) return "4";
  if (correct >= gs.grade3) return "3";
  if (correct >= gs.grade2) return "2";
  return "1";
}

export function BulkUpload() {
  const { works, students } = useAppStore();
  const [workId, setWorkId] = useState("");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: BulkItem[] = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(f => ({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
        file: f,
        status: "pending",
      }));
    setItems(prev => [...prev, ...newItems]);
    setDoneCount(0);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const clearAll = () => {
    setItems([]);
    setDoneCount(0);
  };

  const processAll = async () => {
    const work: Work | undefined = works.find(w => w.id === workId);
    if (!work) {
      alert("Сначала выберите работу для привязки результатов");
      return;
    }
    setBusy(true);
    setDoneCount(0);

    let processed = 0;
    // Последовательно — чтобы не убить бэкенд параллельными запросами
    for (const it of items) {
      if (it.status === "done") {
        processed++;
        continue;
      }
      setItems(prev => prev.map(i => i.id === it.id ? { ...i, status: "processing" } : i));
      try {
        const resp = await recognizeApi.recognize(it.file, {
          questionsCount: work.totalQuestions,
          answerKey: work.answerKey,
        });
        const correct = resp.analysis.correct;
        const grade = calcGrade(correct, work.gradeScale);
        const student = students.find(s => s.code === resp.studentCode);

        appStore.addResult({
          workId: work.id,
          studentCode: resp.studentCode,
          answers: resp.answers,
          correctCount: correct,
          totalCount: resp.analysis.total,
          score: correct,
          grade,
          scannedAt: new Date().toISOString(),
        });

        setItems(prev => prev.map(i => i.id === it.id ? {
          ...i,
          status: "done",
          studentCode: resp.studentCode,
          studentName: student?.name,
          correct,
          total: resp.analysis.total,
          grade,
          confidence: resp.averageConfidence,
        } : i));
      } catch (e) {
        setItems(prev => prev.map(i => i.id === it.id ? {
          ...i,
          status: "error",
          error: (e as Error).message,
        } : i));
      }
      processed++;
      setDoneCount(processed);
    }
    setBusy(false);
  };

  const stats = {
    total: items.length,
    done: items.filter(i => i.status === "done").length,
    err: items.filter(i => i.status === "error").length,
    pending: items.filter(i => i.status === "pending" || i.status === "processing").length,
  };

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-5 py-3 border-b border-border bg-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Layers" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Массовая загрузка бланков</p>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {stats.done} готово · {stats.err} с ошибкой · {stats.pending} в очереди
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Выбор работы */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Привязать пакет к работе</label>
          <select
            value={workId}
            onChange={e => setWorkId(e.target.value)}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— выберите работу —</option>
            {works.map(w => (
              <option key={w.id} value={w.id}>
                №{w.id} · {w.type}: {w.subject} · {w.classNum}{w.classLetter}
              </option>
            ))}
          </select>
        </div>

        {/* Drop zone */}
        <label
          className="block border-2 border-dashed border-border rounded-sm p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
        >
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
            disabled={busy}
          />
          <Icon name="UploadCloud" size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Выберите несколько фото или сканов</p>
          <p className="text-xs text-muted-foreground">JPG, PNG · можно перетащить целую папку</p>
        </label>

        {/* Список */}
        {items.length > 0 && (
          <div className="border border-border rounded-sm">
            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold">Файлов: {items.length}</span>
              <div className="flex gap-2">
                <button
                  onClick={clearAll}
                  disabled={busy}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >Очистить</button>
                <button
                  onClick={processAll}
                  disabled={busy || !workId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Play" size={12} />}
                  {busy ? `Обработка ${doneCount}/${items.length}` : "Распознать все"}
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {items.map(it => (
                <div key={it.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                  <Icon
                    name={
                      it.status === "done" ? "CheckCircle2" :
                      it.status === "error" ? "AlertCircle" :
                      it.status === "processing" ? "Loader2" :
                      "FileImage"
                    }
                    size={14}
                    className={
                      it.status === "done" ? "text-green-600" :
                      it.status === "error" ? "text-destructive" :
                      it.status === "processing" ? "animate-spin text-primary" :
                      "text-muted-foreground"
                    }
                  />
                  <span className="flex-1 truncate font-medium">{it.file.name}</span>
                  {it.status === "done" && (
                    <>
                      <span className="mono text-muted-foreground">код {it.studentCode}</span>
                      {it.studentName && <span className="truncate max-w-[160px]">{it.studentName}</span>}
                      <span className="mono">{it.correct}/{it.total}</span>
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-sm font-bold"
                        style={{
                          background: it.grade === "5" ? "#22c55e20" : it.grade === "4" ? "#3b82f620" : it.grade === "3" ? "#f59e0b20" : "#ef444420",
                          color: it.grade === "5" ? "#16a34a" : it.grade === "4" ? "#2563eb" : it.grade === "3" ? "#d97706" : "#dc2626",
                        }}
                      >{it.grade}</span>
                    </>
                  )}
                  {it.status === "error" && (
                    <span className="text-destructive truncate max-w-[300px]">{it.error}</span>
                  )}
                  {!busy && (
                    <button
                      onClick={() => removeItem(it.id)}
                      className="p-1 hover:bg-muted rounded-sm text-muted-foreground hover:text-destructive"
                    ><Icon name="X" size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!workId && items.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-sm bg-amber-50 border border-amber-200">
            <Icon name="AlertCircle" size={14} className="text-amber-600" />
            <p className="text-xs text-amber-700">Выберите работу выше — без неё результаты не сохранить</p>
          </div>
        )}
      </div>
    </div>
  );
}
