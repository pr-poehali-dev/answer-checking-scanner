import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/appStore";
import { projectApi, presentationApi, type ProjectResponse, type ProjectWorkItem } from "@/lib/api";
import { downloadBase64File, DOCX_MIME, PDF_MIME, WORK_TYPE_LIST, type WorkTypeMeta } from "./projectUtils";
import { toast } from "sonner";

export function ProjectSection() {
  const { teacher } = useAppStore();
  const [selected, setSelected] = useState<WorkTypeMeta>(WORK_TYPE_LIST[0]);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; current?: number; total?: number } | null>(null);
  const [result, setResult] = useState<ProjectResponse | null>(null);
  const [makingPpt, setMakingPpt] = useState(false);
  const [history, setHistory] = useState<ProjectWorkItem[]>([]);

  const loadHistory = useCallback(async () => {
    if (!teacher) return;
    try {
      const res = await projectApi.myWorks(teacher.login);
      setHistory(res.items);
    } catch { /* ignore */ }
  }, [teacher]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (!teacher) return null;

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Укажите тему работы");
      return;
    }
    setLoading(true);
    setResult(null);
    setProgress({ stage: "Запускаем генерацию…" });
    try {
      const res = await projectApi.generate({
        work_type: selected.id,
        topic: topic.trim(),
        subject: subject.trim(),
        description: description.trim(),
        author_name: teacher.name,
        school: teacher.school,
        login: teacher.login,
      }, (info) => setProgress(info));
      setResult(res);
      toast.success(`${res.work_label} готова`, { description: `Объём: ~${res.page_estimate} стр. (${res.word_count} слов)` });
      loadHistory();
    } catch (e) {
      toast.error("Не удалось создать работу", { description: (e as Error).message });
    } finally {
      setProgress(null);
      setLoading(false);
    }
  };

  const makePresentation = async () => {
    if (!result) return;
    setMakingPpt(true);
    try {
      const pres = await presentationApi.generate({
        topic: result.topic,
        description: `Презентация по работе «${result.work_label}»`,
        slidesCount: 10,
        teacherName: teacher.name,
        teacherSchool: teacher.school,
        login: teacher.login,
      });
      if (pres.pptx_url) {
        window.open(pres.pptx_url, "_blank");
      } else if (pres.pptx_b64) {
        downloadBase64File(pres.pptx_b64, pres.filename || "Презентация.pptx",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      }
      toast.success("Презентация по проекту готова");
    } catch (e) {
      toast.error("Не удалось создать презентацию", { description: (e as Error).message });
    } finally {
      setMakingPpt(false);
    }
  };

  return (
    <div className="animate-slide-up space-y-6 w-full">
      {/* Hero */}
      <div className="border border-border rounded-sm bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-sm flex items-center justify-center bg-primary/10 flex-shrink-0">
            <Icon name="Sparkles" size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Проект / Курсовая с помощью нейросети</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Индивидуальные работы, оформленные по стандартам Минобрнауки и Минпросвещения РФ (ГОСТ 7.32, ФГОС).
              Оригинальный авторский текст под проверку на антиплагиат. Выгрузка в DOCX и PDF.
            </p>
          </div>
        </div>
      </div>

      {/* Выбор типа работы */}
      <div>
        <Label className="mb-2 block">Тип работы</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORK_TYPE_LIST.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelected(w)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selected.id === w.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-white hover:bg-muted"
              }`}
            >
              <Icon name={w.icon} size={20} className={selected.id === w.id ? "text-primary" : "text-muted-foreground"} fallback="FileText" />
              <p className="text-sm font-semibold mt-1.5 leading-tight">{w.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{w.volume}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Форма */}
      <div className="border border-border rounded-sm bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <Label>Тема работы *</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Например: Влияние социальных сетей на подростков" maxLength={300} />
          </div>
          <div>
            <Label>Предмет / дисциплина</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Обществознание" maxLength={128} />
          </div>
        </div>
        <div>
          <Label>Пожелания к содержанию (необязательно)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="На что сделать акцент, какие аспекты раскрыть" />
        </div>

        <Button onClick={generate} disabled={loading} size="lg" className="w-full">
          {loading ? (
            <><Icon name="Loader2" size={18} className="mr-2 animate-spin" /> Создаём работу...</>
          ) : (
            <><Icon name="Sparkles" size={18} className="mr-2" /> Создать «{selected.label}»</>
          )}
        </Button>
        {loading && progress && (
          <div className="text-center space-y-1.5">
            <p className="text-xs text-muted-foreground animate-pulse">{progress.stage}</p>
            {progress.total ? (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.current! / progress.total) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">Раздел {progress.current} из {progress.total}</p>
              </>
            ) : null}
            <p className="text-[11px] text-muted-foreground">Большая работа готовится несколько минут — не закрывайте страницу</p>
          </div>
        )}
      </div>

      {/* Результат */}
      {result && (
        <div className="border border-primary/30 rounded-lg bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-primary/5 flex items-center gap-3">
            <Icon name="CheckCircle2" size={20} className="text-green-600" />
            <div className="flex-1">
              <p className="font-bold text-sm">{result.work_label} готова</p>
              <p className="text-xs text-muted-foreground">~{result.page_estimate} страниц · {result.word_count} слов</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Оглавление */}
            {result.chapters.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Содержание</p>
                <ul className="text-sm space-y-0.5">
                  {result.chapters.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Icon name="Dot" size={16} className="text-primary flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Скачивание */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.docx_b64 && (
                <Button variant="outline" onClick={() => downloadBase64File(result.docx_b64!, `${result.filename}.docx`, DOCX_MIME)}>
                  <Icon name="FileText" size={16} className="mr-2 text-blue-600" />
                  Скачать Word (DOCX)
                </Button>
              )}
              {result.pdf_b64 && (
                <Button variant="outline" onClick={() => downloadBase64File(result.pdf_b64!, `${result.filename}.pdf`, PDF_MIME)}>
                  <Icon name="FileText" size={16} className="mr-2 text-red-600" />
                  Скачать PDF
                </Button>
              )}
            </div>

            {/* Презентация по проекту */}
            <Button className="w-full" onClick={makePresentation} disabled={makingPpt}>
              {makingPpt ? (
                <><Icon name="Loader2" size={16} className="mr-2 animate-spin" /> Создаём презентацию...</>
              ) : (
                <><Icon name="Presentation" size={16} className="mr-2" /> Создать презентацию по проекту</>
              )}
            </Button>

            {/* Предпросмотр текста */}
            <details className="border border-border rounded-sm">
              <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none flex items-center gap-2">
                <Icon name="Eye" size={14} />
                Предпросмотр текста
              </summary>
              <div className="px-4 py-3 max-h-96 overflow-y-auto text-sm whitespace-pre-wrap text-muted-foreground border-t border-border">
                {result.text}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* История работ */}
      <div className="bg-white border border-border rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted">
          <div className="flex items-center gap-2.5">
            <Icon name="History" size={15} className="text-muted-foreground" />
            <p className="text-sm font-bold">Мои работы</p>
          </div>
          {history.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{history.length}</span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Здесь появятся созданные работы — можно будет скачать их снова в любой момент.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((w) => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{w.topic}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="text-primary font-medium">{w.work_label}</span>
                    {w.subject && <span>· {w.subject}</span>}
                    <span>· ~{w.page_estimate} стр.</span>
                    <span>· {new Date(w.created_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {w.docx_url && (
                    <a href={w.docx_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-sm text-xs hover:bg-muted transition-colors"
                      title="Скачать Word">
                      <Icon name="FileText" size={13} className="text-blue-600" />
                      DOCX
                    </a>
                  )}
                  {w.pdf_url && (
                    <a href={w.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-sm text-xs hover:bg-muted transition-colors"
                      title="Скачать PDF">
                      <Icon name="FileText" size={13} className="text-red-600" />
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Работа сгенерирована ИИ как оригинальный авторский текст. Проверьте содержание перед сдачей.
      </p>
    </div>
  );
}