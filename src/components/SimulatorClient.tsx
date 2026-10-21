"use client";

import dynamic from "next/dynamic";
import { useT } from "@/lib/useI18n";

function LoadingScreen() {
  const t = useT();
  return (
    <main className="grid h-dvh w-full place-items-center bg-slate-50 text-sm text-slate-500">{t("app.loading")}</main>
  );
}

// Leaflet (window erişimi) ve tarih bazlı simülasyon tamamen tarayıcıda çalışır; SSR'ı atla.
const Simulator = dynamic(() => import("./Simulator"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function SimulatorClient() {
  return <Simulator />;
}
