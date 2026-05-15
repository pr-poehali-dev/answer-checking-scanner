import Icon from "@/components/ui/icon";
import { type OUUser, getPositionLabel } from "./OUTypes";

interface OUProfileSectionProps {
  user: OUUser;
  initials: string;
}

export default function OUProfileSection({ user, initials }: OUProfileSectionProps) {
  return (
    <div className="max-w-lg animate-slide-up space-y-4">
      <h2 className="text-base font-bold text-foreground">Профиль</h2>
      <div className="bg-white border border-border rounded-sm p-5 space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{getPositionLabel(user.institution_position, user.subject)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.institution_name}</p>
          </div>
        </div>
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="User" size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Логин:</span>
            <span className="text-xs font-mono font-medium text-foreground">{user.login}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Building2" size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Учреждение:</span>
            <span className="text-xs text-foreground">{user.institution_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Briefcase" size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Должность:</span>
            <span className="text-xs text-foreground">{getPositionLabel(user.institution_position, user.subject)}</span>
          </div>
        </div>
      </div>

      {user.is_manager && (
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 flex items-start gap-3">
          <Icon name="ShieldCheck" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Доступ к управлению</p>
            <p className="text-xs text-blue-600 mt-0.5">Как {getPositionLabel(user.institution_position)}, вы можете создавать профили сотрудников в разделе «Управление».</p>
          </div>
        </div>
      )}
    </div>
  );
}
