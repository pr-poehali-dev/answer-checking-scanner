import type { PresentationThemePayload, PresentationSlideFull } from "@/lib/api";

/** Соотношение сторон слайда 13.333×7.5" (16:9), как в PPTX-билдере на backend. */
const ASPECT = 13.333 / 7.5;

function hex(c?: string) {
  if (!c) return "#000000";
  return c.startsWith("#") ? c : `#${c}`;
}

interface HeaderProps {
  theme: PresentationThemePayload;
  title: string;
  num: number;
  total: number;
}

/** Имитация шапки содержательного слайда — повторяет один из 8 layout backend. */
function ContentHeader({ theme, title, num, total }: HeaderProps) {
  const layout = theme.layout || "top_banner";
  const titleFont = theme.font_title || "inherit";

  if (layout === "sidebar_dark") {
    return (
      <div className="absolute inset-0 flex">
        <div className="flex flex-col items-center justify-start pt-2 w-[14%] h-full"
          style={{ background: hex(theme.accent) }}>
          <span className="text-white font-bold" style={{ fontSize: "9%", color: hex(theme.accent2) }}>{String(num).padStart(2, "0")}</span>
          <span className="text-[7px] opacity-70" style={{ color: hex(theme.title_sub) }}>/ {String(total).padStart(2, "0")}</span>
        </div>
        <div className="flex-1 h-[16%] flex items-center px-3" style={{ background: hex(theme.accent) }}>
          <span className="font-bold truncate" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5.5%" }}>{title}</span>
        </div>
      </div>
    );
  }
  if (layout === "split_diagonal") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[20%] flex items-center"
        style={{ background: hex(theme.accent) }}>
        <span className="flex-1 px-3 font-bold truncate" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5.5%" }}>{title}</span>
        <div className="h-full w-[22%] flex items-center justify-center font-bold"
          style={{ background: hex(theme.accent2), color: hex(theme.accent), fontSize: "5%" }}>
          {String(num).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </div>
      </div>
    );
  }
  if (layout === "left_header") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[21%] flex items-center px-3 gap-2"
        style={{ background: hex(theme.accent) }}>
        <div className="flex items-center justify-center rounded font-bold flex-shrink-0"
          style={{ background: hex(theme.accent2), color: hex(theme.accent), width: "9%", height: "62%", fontSize: "4.5%" }}>
          {num}
        </div>
        <span className="font-bold truncate flex-1" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5.5%" }}>{title}</span>
      </div>
    );
  }
  if (layout === "center_frame") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[22%] flex flex-col items-center justify-center"
        style={{ background: hex(theme.bg) }}>
        <span className="text-[7px] font-bold" style={{ color: hex(theme.accent2) }}>{num} / {total}</span>
        <span className="font-bold text-center px-4" style={{ color: hex(theme.accent), fontFamily: titleFont, fontSize: "5.2%" }}>{title}</span>
      </div>
    );
  }
  if (layout === "corner_tag") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[20%] flex items-center"
        style={{ background: hex(theme.bg) }}>
        <span className="flex-1 px-3 font-bold truncate" style={{ color: hex(theme.accent), fontFamily: titleFont, fontSize: "5.2%" }}>{title}</span>
        <div className="h-full flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: hex(theme.accent), color: hex(theme.accent2), width: "12%", fontSize: "5%" }}>
          {String(num).padStart(2, "0")}
        </div>
      </div>
    );
  }
  if (layout === "ribbon") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[18%] flex items-center"
        style={{ background: hex(theme.accent) }}>
        <div className="h-full flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: hex(theme.accent2), color: hex(theme.accent), width: "18%", fontSize: "6%" }}>
          {String(num).padStart(2, "0")}
        </div>
        <span className="flex-1 px-3 font-bold truncate" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5%" }}>{title}</span>
      </div>
    );
  }
  if (layout === "stacked_bar") {
    return (
      <div className="absolute top-0 left-0 right-0 h-[18%] flex items-center gap-2 px-3"
        style={{ background: hex(theme.accent) }}>
        <span className="font-bold flex-shrink-0" style={{ color: hex(theme.accent2), fontSize: "5.5%" }}>{String(num).padStart(2, "0")}</span>
        <span className="font-bold truncate" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5%" }}>{title}</span>
      </div>
    );
  }
  // top_banner (default)
  return (
    <div className="absolute top-0 left-0 right-0 h-[19%] flex items-center px-3 gap-2"
      style={{ background: hex(theme.accent) }}>
      <span className="text-[7px] font-bold flex-shrink-0" style={{ color: hex(theme.accent2) }}>
        {String(num).padStart(2, "0")}/{String(total).padStart(2, "0")}
      </span>
      <span className="font-bold truncate flex-1" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "5.5%" }}>{title}</span>
    </div>
  );
}

const headerHeightPct: Record<string, number> = {
  sidebar_dark: 16, split_diagonal: 20, left_header: 21, center_frame: 22,
  corner_tag: 20, ribbon: 18, stacked_bar: 18, top_banner: 19,
};

interface SlidePreviewProps {
  theme: PresentationThemePayload;
  slide: PresentationSlideFull;
  num: number;
  total: number;
  className?: string;
}

/** HTML/CSS-имитация одного содержательного слайда — приближённо повторяет реальный PPTX. */
export function SlidePreview({ theme, slide, num, total, className = "" }: SlidePreviewProps) {
  const sidebar = theme.layout === "sidebar_dark";
  const topPct = headerHeightPct[theme.layout] ?? 19;
  const bodyFont = theme.font_body || "inherit";
  const marker = theme.bullet_marker || "▸";

  return (
    <div
      className={`relative overflow-hidden rounded-md shadow-sm border border-black/5 ${className}`}
      style={{ aspectRatio: ASPECT, background: hex(theme.bg) }}
    >
      <ContentHeader theme={theme} title={slide.title || "Заголовок слайда"} num={num} total={total} />
      <div
        className="absolute bottom-0 flex flex-col gap-[3%] overflow-hidden"
        style={{
          top: `${topPct + 3}%`,
          left: sidebar ? "16%" : "3%",
          right: "3%",
          bottom: "6%",
        }}
      >
        {(slide.bullets.length ? slide.bullets : ["Тезис появится здесь"]).slice(0, 5).map((b, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="flex-shrink-0 font-bold" style={{ color: hex(theme.accent2), fontSize: "4.2%" }}>{marker}</span>
            <span className="leading-snug line-clamp-2" style={{ color: hex(theme.text), fontFamily: bodyFont, fontSize: "4.2%" }}>
              {b}
            </span>
          </div>
        ))}
      </div>
      {/* нижняя полоса — footer акцент, как в PPTX */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5%]" style={{ background: hex(theme.accent2), opacity: 0.5 }} />
    </div>
  );
}

interface TitleSlidePreviewProps {
  theme: PresentationThemePayload;
  topic: string;
  subtitle: string;
  className?: string;
}

/** HTML/CSS-имитация титульного слайда. */
export function TitleSlidePreview({ theme, topic, subtitle, className = "" }: TitleSlidePreviewProps) {
  const titleFont = theme.font_title || "inherit";
  return (
    <div
      className={`relative overflow-hidden rounded-md shadow-sm border border-black/5 flex flex-col items-center justify-center text-center px-[6%] ${className}`}
      style={{ aspectRatio: ASPECT, background: hex(theme.title_bg) }}
    >
      {theme.label && (
        <span className="uppercase tracking-widest font-bold mb-2" style={{ color: hex(theme.accent2), fontSize: "3.5%" }}>
          {theme.label}
        </span>
      )}
      <span className="font-bold leading-tight line-clamp-3" style={{ color: hex(theme.white), fontFamily: titleFont, fontSize: "7.5%" }}>
        {topic || "Тема презентации"}
      </span>
      {subtitle && (
        <span className="mt-2 line-clamp-2" style={{ color: hex(theme.title_sub), fontSize: "4%" }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}