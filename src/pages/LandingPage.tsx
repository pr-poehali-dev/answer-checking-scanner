import { useEffect, useState } from "react";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/api";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingAudiences from "@/components/landing/LandingAudiences";
import LandingContent from "@/components/landing/LandingContent";
import LandingFooter from "@/components/landing/LandingFooter";

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
  onTrial?: () => void;
  onOuLogin?: () => void;
}

export default function LandingPage({ onLogin, onRegister, onTrial, onOuLogin }: LandingPageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    subscriptionApi.plans()
      .then(d => setPlans(d.plans))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingHeader
        onLogin={onLogin}
        onRegister={onRegister}
        onOuLogin={onOuLogin}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(v => !v)}
        onScrollTo={scrollTo}
      />
      <LandingHero
        onLogin={onLogin}
        onRegister={onRegister}
        onTrial={onTrial}
      />
      <LandingAudiences onRegister={onRegister} />
      <LandingContent
        onLogin={onLogin}
        onRegister={onRegister}
        onTrial={onTrial}
        plans={plans}
        loadingPlans={loadingPlans}
        onScrollTo={scrollTo}
      />
      <LandingFooter
        onLogin={onLogin}
        onRegister={onRegister}
        onScrollTo={scrollTo}
      />
    </div>
  );
}