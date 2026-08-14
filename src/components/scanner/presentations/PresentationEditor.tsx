import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { PresentationOutlineFull, PresentationThemePayload } from "@/lib/api";
import { SlidePreview, TitleSlidePreview } from "./SlidePreview";
import { ThemePicker } from "./ThemePicker";

interface PresentationEditorProps {
  topic: string;
  outline: PresentationOutlineFull;
  themeOptions: PresentationThemePayload[];
  initialThemeIndex?: number;
  busy: boolean;
  onDownload: (outline: PresentationOutlineFull, theme: PresentationThemePayload) => void;
  onClose: () => void;
}

/**
 * Редактор презентации: просмотр слайдов, правка текста, выбор оформления,
 * добавление/удаление слайдов — перед финальным скачиванием файла.
 */
export function PresentationEditor({
  topic, outline: initialOutline, themeOptions, initialThemeIndex = 0, busy, onDownload, onClose,
}: PresentationEditorProps) {
  const [outline, setOutline] = useState<PresentationOutlineFull>(initialOutline);
  const [themeIdx, setThemeIdx] = useState(initialThemeIndex);
  // -1 = титульный слайд, 0..n-1 = содержательные слайды
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showThemes, setShowThemes] = useState(false);

  const theme = themeOptions[themeIdx] || themeOptions[0];
  const slides = outline.slides;
  const total = slides.length;

  const updateSlide = (idx: number, patch: Partial<PresentationOutlineFull["slides"][number]>) => {
    setOutline(o => ({
      ...o,
      slides: o.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const updateBullet = (slideIdx: number, bulletIdx: number, value: string) => {
    setOutline(o => ({
      ...o,
      slides: o.slides.map((s, i) => i === slideIdx
        ? { ...s, bullets: s.bullets.map((b, j) => (j === bulletIdx ? value : b)) }
        : s),
    }));
  };

  const removeBullet = (slideIdx: number, bulletIdx: number) => {
    setOutline(o => ({
      ...o,
      slides: o.slides.map((s, i) => i === slideIdx
        ? { ...s, bullets: s.bullets.filter((_, j) => j !== bulletIdx) }
        : s),
    }));
  };

  const addBullet = (slideIdx: number) => {
    setOutline(o => ({
      ...o,
      slides: o.slides.map((s, i) => i === slideIdx && s.bullets.length < 7
        ? { ...s, bullets: [...s.bullets, "Новый тезис"] }
        : s),
    }));
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setOutline(o => ({ ...o, slides: o.slides.filter((_, i) => i !== idx) }));
    setActiveIdx(prev => {
      if (prev === idx) return Math.max(-1, idx - 1);
      if (prev > idx) return prev - 1;
      return prev;
    });
  };

  const addSlide = () => {
    const newSlide = { title: "Новый слайд", bullets: ["Первый тезис", "Второй тезис"], fact: "", image_queries: [] };
    setOutline(o => ({ ...o, slides: [...o.slides, newSlide] }));
    setActiveIdx(slides.length);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setOutline(o => {
      const next = [...o.slides];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...o, slides: next };
    });
    setActiveIdx(target);
  };

  const activeSlide = activeIdx >= 0 ? slides[activeIdx] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-6xl h-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка редактора */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0"
          style={{ background: "hsl(var(--muted))" }}>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{topic}</p>
            <p className="text-[11px] text-muted-foreground">Редактор презентации</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowThemes(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                showThemes ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
              }`}
            >
              <Icon name="Palette" size={14} />
              Дизайн
            </button>
            <button
              onClick={() => onDownload(outline, theme)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg text-white transition-opacity disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0D1B3E, #1B3A6B)" }}
            >
              <Icon name={busy ? "Loader2" : "Download"} size={14} className={busy ? "animate-spin" : ""} />
              {busy ? "Собираем файл…" : "Скачать презентацию"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        {/* Выбор дизайна */}
        {showThemes && (
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
            <p className="text-xs font-bold mb-2.5">Выберите оформление — 4 разных варианта под тему</p>
            <ThemePicker options={themeOptions} selectedIndex={themeIdx} onSelect={setThemeIdx} />
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* Список слайдов */}
          <div className="w-48 sm:w-56 border-r border-border overflow-y-auto styled-scrollbar flex-shrink-0 p-2.5 space-y-2">
            <button
              onClick={() => setActiveIdx(-1)}
              className={`w-full rounded-lg overflow-hidden border-2 transition-all ${
                activeIdx === -1 ? "border-primary" : "border-transparent hover:border-primary/30"
              }`}
            >
              <TitleSlidePreview theme={theme} topic={topic} subtitle={outline.subtitle} />
              <p className="text-[10px] text-center py-1 bg-white font-medium">Титульный слайд</p>
            </button>

            {slides.map((s, i) => (
              <div key={i} className="relative group">
                <button
                  onClick={() => setActiveIdx(i)}
                  className={`w-full rounded-lg overflow-hidden border-2 transition-all ${
                    activeIdx === i ? "border-primary" : "border-transparent hover:border-primary/30"
                  }`}
                >
                  <SlidePreview theme={theme} slide={s} num={i + 1} total={total} />
                  <p className="text-[10px] text-center py-1 bg-white font-medium truncate px-1">{i + 1}. {s.title}</p>
                </button>
                <button
                  onClick={() => removeSlide(i)}
                  disabled={slides.length <= 1}
                  title="Удалить слайд"
                  className="absolute top-1 right-1 w-5 h-5 rounded-md bg-white/90 border border-border opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-all disabled:opacity-0"
                >
                  <Icon name="Trash2" size={10} />
                </button>
              </div>
            ))}

            <button
              onClick={addSlide}
              className="w-full py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              <Icon name="Plus" size={14} />
              Добавить слайд
            </button>
          </div>

          {/* Крупное превью + редактирование */}
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5 space-y-4">
            {activeIdx === -1 ? (
              <>
                <TitleSlidePreview theme={theme} topic={topic} subtitle={outline.subtitle} className="max-w-2xl mx-auto" />
                <div className="max-w-2xl mx-auto">
                  <label className="text-xs font-bold text-foreground block mb-1.5">Подзаголовок</label>
                  <input
                    value={outline.subtitle}
                    onChange={e => setOutline(o => ({ ...o, subtitle: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </>
            ) : activeSlide ? (
              <>
                <SlidePreview theme={theme} slide={activeSlide} num={activeIdx + 1} total={total} className="max-w-2xl mx-auto" />

                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveSlide(activeIdx, -1)} disabled={activeIdx === 0}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                      title="Переместить раньше">
                      <Icon name="ChevronLeft" size={13} />
                    </button>
                    <button onClick={() => moveSlide(activeIdx, 1)} disabled={activeIdx === slides.length - 1}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                      title="Переместить позже">
                      <Icon name="ChevronRight" size={13} />
                    </button>
                    <span className="text-[11px] text-muted-foreground">Слайд {activeIdx + 1} из {slides.length}</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">Заголовок слайда</label>
                    <input
                      value={activeSlide.title}
                      onChange={e => updateSlide(activeIdx, { title: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">Тезисы</label>
                    <div className="space-y-2">
                      {activeSlide.bullets.map((b, bi) => (
                        <div key={bi} className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground mt-2.5 flex-shrink-0">{bi + 1}.</span>
                          <textarea
                            value={b}
                            onChange={e => updateBullet(activeIdx, bi, e.target.value)}
                            rows={2}
                            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <button
                            onClick={() => removeBullet(activeIdx, bi)}
                            disabled={activeSlide.bullets.length <= 1}
                            className="w-8 h-8 mt-0.5 rounded-lg border border-border flex items-center justify-center flex-shrink-0 hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-30"
                          >
                            <Icon name="Trash2" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {activeSlide.bullets.length < 7 && (
                      <button
                        onClick={() => addBullet(activeIdx)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-70 transition-opacity"
                      >
                        <Icon name="Plus" size={13} />
                        Добавить тезис
                      </button>
                    )}
                  </div>

                  {activeSlide.fact !== undefined && (
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1.5">
                        Интересный факт <span className="text-muted-foreground font-normal">(необязательно)</span>
                      </label>
                      <textarea
                        value={activeSlide.fact || ""}
                        onChange={e => updateSlide(activeIdx, { fact: e.target.value })}
                        rows={2}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}