import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

interface CollectiveMember {
  full_name: string;
  position: string;
  position_label: string;
  subject: string | null;
}

export default function CollectiveSection() {
  const { teacher } = useAppStore();
  const [members, setMembers] = useState<CollectiveMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher) return;
    authApi.getCollectiveByToken(teacher.authToken, teacher.login)
      .then(d => setMembers(d.members))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teacher]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-white border border-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-xs font-semibold text-muted-foreground">Сотрудники учреждения</p>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="Users" size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">В коллективе пока нет участников</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m, i) => (
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
