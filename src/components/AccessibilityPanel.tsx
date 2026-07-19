import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { useAccessibility } from "@/hooks/useAccessibility";

const FONT_STEPS = [
  { label: "A", value: 1, title: "Обычный размер" },
  { label: "A+", value: 1.15, title: "Крупный" },
  { label: "A++", value: 1.3, title: "Очень крупный" },
  { label: "A+++", value: 1.5, title: "Максимальный" },
];

/**
 * Панель доступности («Версия для слабовидящих»).
 * Плавающая кнопка + всплывающая панель с настройками контраста,
 * размера шрифта и подчёркивания ссылок. Полностью управляется с клавиатуры,
 * снабжена aria-атрибутами для программ экранного доступа.
 */
export default function AccessibilityPanel() {
  const { settings, update, reset } = useAccessibility();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Закрытие по Esc и по клику вне панели
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Настройки доступности для слабовидящих"
        className="fixed bottom-4 left-4 z-[9998] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        <Icon name="Eye" size={22} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Настройки доступности"
          className="fixed bottom-20 left-4 z-[9999] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Icon name="Accessibility" size={18} fallback="Eye" />
              Доступность
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть панель доступности"
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* Высокая контрастность */}
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="a11y-contrast" className="text-sm font-medium">
              Высокая контрастность
            </label>
            <button
              id="a11y-contrast"
              type="button"
              role="switch"
              aria-checked={settings.contrast}
              onClick={() => update({ contrast: !settings.contrast })}
              className={`relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                settings.contrast ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.contrast ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Размер шрифта */}
          <div className="space-y-2">
            <p className="text-sm font-medium" id="a11y-font-label">
              Размер текста
            </p>
            <div
              className="grid grid-cols-4 gap-1.5"
              role="group"
              aria-labelledby="a11y-font-label"
            >
              {FONT_STEPS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  title={s.title}
                  aria-pressed={settings.fontScale === s.value}
                  onClick={() => update({ fontScale: s.value })}
                  className={`py-2 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    settings.fontScale === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Подчёркивание ссылок */}
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="a11y-links" className="text-sm font-medium">
              Подчёркивать ссылки
            </label>
            <button
              id="a11y-links"
              type="button"
              role="switch"
              aria-checked={settings.underlineLinks}
              onClick={() => update({ underlineLinks: !settings.underlineLinks })}
              className={`relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                settings.underlineLinks ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.underlineLinks ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full py-2 rounded-md border border-border text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Сбросить настройки
          </button>
        </div>
      )}
    </>
  );
}
