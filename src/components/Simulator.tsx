"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import TopBar from "@/components/hud/TopBar";
import AdminPanel from "@/components/modals/AdminPanel";
import AuthModal from "@/components/modals/AuthModal";
import ProUpgradeModal from "@/components/modals/ProUpgradeModal";
import FinalGuideStep from "@/components/steps/FinalGuideStep";
import FlightStep from "@/components/steps/FlightStep";
import HotelTransitStep from "@/components/steps/HotelTransitStep";
import LandingStep from "@/components/steps/LandingStep";
import PlaceDiscoveryStep from "@/components/steps/PlaceDiscoveryStep";
import { useAuthSync } from "@/lib/authClient";
import { useTripStore } from "@/store/useTripStore";

/** Çok silik mimari nokta deseni; homojen mat zeminin üstünde, kenarlara doğru söner */
function DotGridBackdrop() {
  return (
    <div
      aria-hidden
      className="dot-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)] print:hidden"
    />
  );
}

/** Sol üst ve sağ üst köşeden ortaya doğru inen yumuşak sahne ışığı hüzmeleri (renkler globals.css'te temaya göre) */
function CornerSpotlights() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 print:hidden">
      <div className="spotlight-left absolute left-0 top-0 h-full w-full" />
      <div className="spotlight-right absolute right-0 top-0 h-full w-full" />
    </div>
  );
}

/** Kök sahne: sabit üst bar + her adımın kendi tam ekran düzeni (wizard) */
export default function Simulator() {
  const currentStep = useTripStore((s) => s.currentStep);
  const theme = useTripStore((s) => s.theme);
  const origin = useTripStore((s) => s.origin);
  const destination = useTripStore((s) => s.destination);
  const hasFlight = useTripStore((s) => s.selectedFlight !== null);
  // Adım 2+ kalkış/varış/uçuş ister; eksikse Adım 1 gösterilir. Rota prop olarak geçer:
  // AnimatePresence çıkış animasyonunda eski eleman (ve dolu rotası) korunur, reset() sırasında null görmez.
  const route = useMemo(
    () => (origin && destination && hasFlight ? { origin, destination } : null),
    [origin, destination, hasFlight],
  );

  // Oturumu geri yükle + son rota / Pro durumunu kullanıcı kaydına yaz
  useAuthSync();

  // Tailwind `dark:` varyantı ve CSS token'ları <html class="dark"> üzerinden çalışır
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="relative isolate flex h-dvh w-full flex-col bg-[#F8FAFC] text-slate-900 transition-colors duration-300 dark:bg-[#080C16] dark:text-white print:block print:h-auto print:bg-white">
      <DotGridBackdrop />
      <CornerSpotlights />
      <TopBar />
      <main className="relative min-h-0 flex-1 overflow-hidden print:overflow-visible">
        <AnimatePresence mode="wait">
          {currentStep === 0 ? (
            <LandingStep key="step-0" />
          ) : currentStep === 1 || !route ? (
            <FlightStep key="step-1" />
          ) : currentStep === 2 ? (
            <PlaceDiscoveryStep key="step-2" {...route} />
          ) : currentStep === 3 ? (
            <HotelTransitStep key="step-3" {...route} />
          ) : (
            <FinalGuideStep key="step-4" {...route} />
          )}
        </AnimatePresence>
      </main>
      <ProUpgradeModal />
      <AuthModal />
      <AdminPanel />
    </div>
  );
}
