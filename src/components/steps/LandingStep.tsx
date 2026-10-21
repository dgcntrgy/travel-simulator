"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Compass,
  Crown,
  MapPinned,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AIRPORTS, ALL_AIRPORTS, FEATURED_DESTINATIONS } from "@/data/airports";
import { getFlights } from "@/data/mockFlights";
import { getPlacesForDestination, getRegions } from "@/data/mockPlaces";
import CitySelectDropdown from "@/components/ui/CitySelectDropdown";
import { cityName, countryName, type TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/useI18n";
import { useTripStore } from "@/store/useTripStore";
import type { Airport } from "@/types/trip";
import { cn } from "@/lib/cn";
import { CARD_HOVER, PHOTO_ZOOM, RISE_ITEM, STAGGER_PARENT, STEP_TRANSITION } from "@/lib/motion";

const HOW_IT_WORKS: { icon: LucideIcon; title: TranslationKey; text: TranslationKey }[] = [
  { icon: Plane, title: "landing.how1Title", text: "landing.how1Text" },
  { icon: Compass, title: "landing.how2Title", text: "landing.how2Text" },
  { icon: BedDouble, title: "landing.how3Title", text: "landing.how3Text" },
];

const HIGHLIGHTS: { icon: LucideIcon; label: TranslationKey }[] = [
  { icon: Route, label: "landing.hl1" },
  { icon: MapPinned, label: "landing.hl2" },
  { icon: Wallet, label: "landing.hl3" },
];

/** Bento ızgarasında ilk kart büyük (2×2), diğerleri tek hücre */
function PopularRouteCard({ destination, large }: { destination: Airport; large: boolean }) {
  const t = useT();
  // Kalkış henüz seçilmediyse "İstanbul'dan itibaren" fiyatı gösterilir
  const origin = useTripStore((s) => s.origin) ?? AIRPORTS.IST;
  const departureDate = useTripStore((s) => s.departureDate);
  const setDestination = useTripStore((s) => s.setDestination);
  const setStep = useTripStore((s) => s.setStep);

  const { cover, regions, fromPrice } = useMemo(() => {
    const places = getPlacesForDestination(destination.code);
    const flights = getFlights(origin, destination, departureDate);
    return {
      cover: places[0]?.fallbackImage ?? null,
      regions: getRegions(places),
      fromPrice: flights.length ? Math.min(...flights.map((f) => f.price)) : null,
    };
  }, [destination, origin, departureDate]);

  return (
    <motion.button
      type="button"
      variants={RISE_ITEM}
      onClick={() => {
        setDestination(destination);
        setStep(1);
      }}
      whileHover={{ y: CARD_HOVER.whileHover.y, transition: CARD_HOVER.transition }}
      className={cn(
        "card group relative overflow-hidden rounded-3xl text-left",
        large && "sm:col-span-2 lg:col-span-1 lg:row-span-2",
      )}
    >
      <div className="absolute inset-0 bg-slate-200 dark:bg-[#1a2238]">
        {cover && (
          // Harici kaynak (Unsplash) için remotePatterns gerektirmeyen düz <img>
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={cityName(destination, t.locale)}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={cn("h-full w-full object-cover", PHOTO_ZOOM)}
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      {fromPrice !== null && (
        <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-xl">
          {t("landing.fromPrice", { price: `$${fromPrice.toLocaleString("en-US")}` })}
        </span>
      )}
      <div className={cn("absolute inset-x-0 bottom-0 p-4 text-white", large && "md:p-6")}>
        <div className="flex items-center gap-2">
          <span className={cn("drop-shadow", large ? "text-3xl" : "text-xl")}>{destination.flag}</span>
          <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[11px] backdrop-blur-sm">
            {origin.code} → {destination.code}
          </span>
        </div>
        <h3 className={cn("mt-2 font-semibold", large ? "text-2xl md:text-3xl" : "text-lg")}>{countryName(destination, t.locale)}</h3>
        <p className="mt-0.5 truncate text-sm text-white/75">{regions.join(" · ")}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white/90 transition-colors group-hover:text-white">
          {t("landing.planRoute")} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
}

/** Kalkış/varış aynı şehirde mi? (IST↔SAW) — bu çiftte uçuş yok */
const sameCity = (a: Airport | null, b: Airport) => !!a && (a.code === b.code || a.city === b.city);

/** Hero altındaki hızlı rota önizleme çubuğu: Nereden ➔ Nereye ➔ Planlamaya Başla */
function QuickRouteBar() {
  const t = useT();
  const origin = useTripStore((s) => s.origin);
  const destination = useTripStore((s) => s.destination);
  const setOrigin = useTripStore((s) => s.setOrigin);
  const setDestination = useTripStore((s) => s.setDestination);
  const setStep = useTripStore((s) => s.setStep);

  return (
    <div className="glass-secondary relative z-50 mx-auto flex w-full max-w-3xl overflow-visible flex-col items-stretch gap-1 rounded-3xl p-2 text-left md:flex-row md:items-center">
      <CitySelectDropdown
        label={t("landing.from")}
        icon={PlaneTakeoff}
        value={origin}
        options={ALL_AIRPORTS}
        isDisabled={(a) => sameCity(destination, a)}
        disabledHint={t("dd.sameAsDestination")}
        onChange={setOrigin}
      />
      <ArrowRight aria-hidden size={16} className="hidden shrink-0 text-ink/25 md:block" />
      <CitySelectDropdown
        label={t("landing.to")}
        icon={PlaneLanding}
        value={destination}
        options={ALL_AIRPORTS}
        isDisabled={(a) => sameCity(origin, a)}
        disabledHint={t("dd.sameAsOrigin")}
        onChange={setDestination}
      />
      <motion.button
        type="button"
        onClick={() => setStep(1)}
        whileTap={{ scale: 0.98 }}
        className="flex shrink-0 items-center justify-center gap-2 rounded-2xl glass-primary px-6 py-4 text-[15px] font-semibold"
      >
        {t("landing.start")} <ArrowRight size={18} />
      </motion.button>
    </div>
  );
}

/** Adım 0: sade, ürün odaklı karşılama ekranı (hero + rota çubuğu + Bento destinasyonlar) */
export default function LandingStep() {
  const t = useT();
  const setStep = useTripStore((s) => s.setStep);

  return (
    <motion.div {...STEP_TRANSITION} className="absolute inset-0 overflow-y-auto">
      {/* Hero */}
      <motion.section variants={STAGGER_PARENT} initial="hidden" animate="show" className="relative z-50">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-14 text-center md:pt-20">
          <motion.h1
            variants={RISE_ITEM}
            className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-ink md:text-6xl"
          >
            {t("landing.heroA")}
            <span className="text-blue-600 dark:text-blue-400">{t("landing.heroEm")}</span>
            {t("landing.heroB")}
          </motion.h1>
          <motion.p
            variants={RISE_ITEM}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink/60 md:text-lg"
          >
            {t("landing.heroText")}
          </motion.p>

          <motion.div variants={RISE_ITEM} className="relative z-50 mt-9">
            <QuickRouteBar />
          </motion.div>
          <motion.div
            variants={RISE_ITEM}
            className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink/55"
          >
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon size={14} className="text-blue-600 dark:text-blue-400" /> {t(label)}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Popüler rotalar — Bento Grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              {t("landing.popularEyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink md:text-3xl">{t("landing.popularTitle")}</h2>
          </div>
          <p className="text-sm text-ink/55">
            {t("landing.popularText", { n: ALL_AIRPORTS.length })}
          </p>
        </div>
        <motion.div
          variants={STAGGER_PARENT}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid auto-rows-[13rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURED_DESTINATIONS.map((d, i) => (
            <PopularRouteCard key={d.code} destination={d} large={i === 0} />
          ))}
        </motion.div>
      </section>

      {/* Nasıl çalışır */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            {t("landing.howEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink md:text-3xl">{t("landing.howTitle")}</h2>
        </div>
        <motion.div
          variants={STAGGER_PARENT}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
            <motion.div key={title} variants={RISE_ITEM} className="card relative rounded-3xl p-6">
              <span className="absolute right-5 top-5 font-mono text-4xl font-bold text-ink/[0.06]">0{i + 1}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600/10 text-blue-600 ring-1 ring-inset ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-400/20">
                <Icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{t(title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{t(text)}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pro tanıtımı + footer */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="card flex flex-col items-start justify-between gap-5 rounded-3xl p-6 md:flex-row md:items-center md:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <Crown size={22} />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">{t("landing.proTitle")}</h3>
              <p className="mt-1 max-w-xl text-sm text-ink/60">{t("landing.proText")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex shrink-0 items-center gap-2 rounded-xl glass-secondary px-5 py-3 text-sm font-semibold text-ink active:scale-[0.98]"
          >
            {t("landing.tryFree")} <ArrowRight size={16} />
          </button>
        </div>
        <p className="mt-10 text-center text-xs text-ink/40">
          {t("landing.credits")}
        </p>
      </section>
    </motion.div>
  );
}
