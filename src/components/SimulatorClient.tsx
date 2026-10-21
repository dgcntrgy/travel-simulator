"use client";

import dynamic from "next/dynamic";

// Leaflet (window erişimi) ve tarih bazlı simülasyon tamamen tarayıcıda çalışır; SSR'ı atla.
const Simulator = dynamic(() => import("./Simulator"), {
  ssr: false,
  loading: () => (
    <main className="grid h-dvh w-full place-items-center bg-slate-50 text-sm text-slate-500">
      Simülatör hazırlanıyor…
    </main>
  ),
});

export default function SimulatorClient() {
  return <Simulator />;
}
