export { ResultsSection } from "./ResultsSection";
import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ProfileCard } from "./ProfileCard";
import { YadiskCard } from "./YadiskCard";
import { StorageModeCard } from "./StorageModeCard";
import { BillingCard } from "./BillingCard";
import { useAppStore } from "@/store/appStore";

type SettingsTab = "profile" | "billing";

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "profile", label: "Профиль и хранилище", icon: "User" },
  { id: "billing", label: "Оплаты, карты, автоплатежи", icon: "CreditCard" },
];

export function SettingsSection() {
  const { storageMode } = useAppStore();
  const [tab, setTab] = useState<SettingsTab>("profile");

  return (
    <div className="animate-slide-up space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-sm border transition-colors ${
              tab === t.id
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Icon name={t.icon} size={13} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="space-y-6">
          <ProfileCard />
          <StorageModeCard />
          {storageMode === "yadisk" && <YadiskCard />}
        </div>
      ) : (
        <BillingCard />
      )}
    </div>
  );
}
