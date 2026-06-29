export { ResultsSection } from "./ResultsSection";
import { ProfileCard } from "./ProfileCard";
import { YadiskCard } from "./YadiskCard";
import { StorageModeCard } from "./StorageModeCard";
import { useAppStore } from "@/store/appStore";

export function SettingsSection() {
  const { storageMode } = useAppStore();
  return (
    <div className="animate-slide-up space-y-6">
      <ProfileCard />
      <StorageModeCard />
      {storageMode === "yadisk" && <YadiskCard />}
    </div>
  );
}