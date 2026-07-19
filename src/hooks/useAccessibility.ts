import { useCallback, useEffect, useState } from "react";

/**
 * Настройки доступности для пользователей с ограничениями по зрению.
 * Сохраняются в localStorage и применяются к элементу <html>:
 *  - contrast        — режим высокой контрастности (чёрный фон, жёлтые акценты);
 *  - fontScale       — масштаб шрифта (1 / 1.15 / 1.3 / 1.5);
 *  - underlineLinks  — подчёркивание всех ссылок.
 */
export interface A11ySettings {
  contrast: boolean;
  fontScale: number;
  underlineLinks: boolean;
}

const STORAGE_KEY = "a11y:settings";

const DEFAULTS: A11ySettings = {
  contrast: false,
  fontScale: 1,
  underlineLinks: false,
};

function readStored(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function applyToDom(s: A11ySettings) {
  const html = document.documentElement;
  html.classList.toggle("a11y-contrast", s.contrast);
  html.classList.toggle("a11y-underline-links", s.underlineLinks);
  html.style.setProperty("--a11y-font-scale", String(s.fontScale));
}

export function useAccessibility() {
  const [settings, setSettings] = useState<A11ySettings>(readStored);

  useEffect(() => {
    applyToDom(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  return { settings, update, reset };
}
