import { useEffect, useState } from "react";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/api";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingAudiences from "@/components/landing/LandingAudiences";
import LandingContent from "@/components/landing/LandingContent";
import LandingFooter from "@/components/landing/LandingFooter";
import { usePageMeta, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "@/hooks/usePageMeta";

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
  onTrial?: () => void;
  onOuLogin?: () => void;
}

export default function LandingPage({ onLogin, onRegister, onTrial, onOuLogin }: LandingPageProps) {
  usePageMeta({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    subscriptionApi.plans()
      .then(d => setPlans(d.plans))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  // Скрытый вход в УДС: удержать Tab и нажать Q
  useEffect(() => {
    let tabDown = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") tabDown = true;
      if (tabDown && (e.key === "q" || e.key === "Q" || e.key === "й" || e.key === "Й")) {
        e.preventDefault();
        window.location.href = "/piot-colldent19";
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab") tabDown = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
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