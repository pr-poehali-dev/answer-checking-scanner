export { ResultsSection } from "./ResultsSection";
import { ProfileCard } from "./ProfileCard";
import { YadiskCard } from "./YadiskCard";

export function SettingsSection() {
  return (
    <div className="animate-slide-up space-y-6">
      <ProfileCard />
      <YadiskCard />
    </div>
  );
}
