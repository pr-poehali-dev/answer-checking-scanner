import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

const CONSENT_KEY = "saou_cookie_consent_v1";

/**
 * Баннер согласия на использование файлов cookie. Показывается один раз,
 * пока пользователь не примет решение; выбор запоминается на устройстве.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      if (!saved) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(CONSENT_KEY, "accepted"); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление об использовании файлов cookie"
      className="fixed bottom-0 inset-x-0 z-[9990] px-4 pb-4 sm:pb-5 sm:px-6 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto sm:ml-auto sm:mr-6 bg-white border border-border rounded-xl shadow-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 pointer-events-auto">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Cookie" size={18} className="text-primary" fallback="Info" />
        </div>
        <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed flex-1">
          Мы используем файлы cookie и аналогичные технологии для входа в систему и корректной
          работы сайта. Продолжая пользоваться сайтом, вы соглашаетесь с их использованием —
          подробнее в{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            Политике конфиденциальности
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <Icon name="Check" size={14} />
          Хорошо, принимаю
        </button>
      </div>
    </div>
  );
}