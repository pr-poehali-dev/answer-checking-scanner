import Icon from "@/components/ui/icon";
import { useAppStore } from "@/store/appStore";
import { PresentationsHero } from "./presentations/PresentationsHero";
import { PresentationsForm } from "./presentations/PresentationsForm";
import { PresentationCard } from "./presentations/PresentationCard";

export function PresentationsSection() {
  const { presentations } = useAppStore();

  return (
    <div className="animate-slide-up space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <PresentationsHero />

      {/* ── Форма ─────────────────────────────────────────────────────────── */}
      <PresentationsForm />

      {/* ── История ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--muted))" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="History" size={15} className="text-muted-foreground" />
            <p className="text-sm font-bold">История презентаций</p>
          </div>
          {presentations.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {presentations.length}
            </span>
          )}
        </div>

        {presentations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0D1B3E10, #00B4D820)" }}>
              <Icon name="Presentation" size={26} className="text-primary/50" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Здесь появятся ваши презентации</p>
            <p className="text-xs text-muted-foreground">Создайте первую — займёт около минуты</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {presentations.slice().reverse().map(p => (
              <PresentationCard key={p.id} item={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
