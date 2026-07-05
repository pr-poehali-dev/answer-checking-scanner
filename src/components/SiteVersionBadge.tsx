import { APP_VERSION, SITE_REVISION_DATE } from "@/lib/appVersion";

/**
 * Ненавязчивая отметка версии сайта в правом нижнем углу.
 * Отображается на каждой странице поверх контента, самым мелким шрифтом.
 */
export default function SiteVersionBadge() {
  return (
    <div className="pointer-events-none fixed bottom-1 right-1 z-[9999] select-none text-[9px] leading-none text-muted-foreground/50">
      v{APP_VERSION} · ред. {SITE_REVISION_DATE}
    </div>
  );
}
