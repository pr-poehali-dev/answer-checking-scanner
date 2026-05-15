import Icon from "@/components/ui/icon";

interface CollectiveMember {
  full_name: string;
  position: string;
  position_label: string;
  subject: string | null;
}

interface OUCollectiveSectionProps {
  institutionName: string;
  collective: CollectiveMember[];
}

export default function OUCollectiveSection({ institutionName, collective }: OUCollectiveSectionProps) {
  return (
    <div className="max-w-lg animate-slide-up space-y-4">
      <h2 className="text-base font-bold text-foreground">Коллектив</h2>
      <div className="bg-white border border-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-xs font-semibold text-muted-foreground">{institutionName}</p>
        </div>
        {collective.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="Users" size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">В коллективе пока нет участников</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {collective.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {m.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.position_label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
