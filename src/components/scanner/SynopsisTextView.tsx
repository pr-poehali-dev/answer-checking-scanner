import { type SynopsisItem } from "@/store/appStore";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}

export function SynopsisTextView({ item }: { item: SynopsisItem }) {
  const lines = item.text.split("\n");

  return (
    <div className="p-5 max-h-[600px] overflow-y-auto">
      <div className="prose prose-sm max-w-none space-y-2">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) {
            return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-foreground">{line.slice(3)}</h2>;
          }
          if (line.startsWith("### ")) {
            return <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>;
          }
          if (line.startsWith("#### ")) {
            return <h4 key={i} className="text-sm font-semibold mt-2 mb-0.5 text-foreground">{line.slice(5)}</h4>;
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={i} className="flex gap-2 text-sm text-foreground/90">
                <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                <span>{renderInline(line.slice(2))}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s(.*)$/);
            if (match) {
              return (
                <div key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-primary font-semibold flex-shrink-0 w-5 text-right">{match[1]}.</span>
                  <span>{renderInline(match[2])}</span>
                </div>
              );
            }
          }
          if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
            return <p key={i} className="text-sm font-semibold text-foreground">{line.slice(2, -2)}</p>;
          }
          if (line.trim() === "" || line === "---") {
            return <div key={i} className="h-2" />;
          }
          return <p key={i} className="text-sm text-foreground/90 leading-relaxed">{renderInline(line)}</p>;
        })}
      </div>
    </div>
  );
}
