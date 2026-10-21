"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Bus,
  Check,
  Crown,
  Footprints,
  Lock,
  MapPin,
  Moon,
  Plane,
  Sparkles,
  Star,
  Target,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
  type LucideIcon,
} from "lucide-react";
import WorldMap from "@/components/map/WorldMap";
import {
  TRANSIT_MODE_META,
  buildTripPlan,
  chosenEvaluation,
  computeTransitCost,
  formatMinutes,
  type CityPlan,
  type HotelEvaluation,
  type TripPlan,
} from "@/lib/routeOptimizer";
import { areaLabel, cityName, intlLocale, transferName, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/useI18n";
import { hotelNightlyFor, hotelTotalFor, roomsFor, useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Hotel, HotelTier, IntercityTransfer, TransitMode, TripRoute } from "@/types/trip";
import { CARD_HOVER, GLASS_CARD, PHOTO_ZOOM, riseIn, SLIDE_FROM_LEFT, SLIDE_FROM_RIGHT, STEP_TRANSITION } from "@/lib/motion";

const MODE_ICON: Record<TransitMode, LucideIcon> = {
  walk: Footprints,
  metro: TrainFrontTunnel,
  bus: Bus,
  tram: TramFront,
  train: TrainFront,
};

const TIER_BADGE: Record<HotelTier, string> = {
  budget: "text-emerald-700",
  central: "text-indigo-700",
  luxury: "text-rose-700",
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Veri setindeki (Türkçe) şehir adı → seçili dilde */
const city = (name: string, locale: Locale) => cityName({ city: name }, locale);

function scoreTone(score: number) {
  if (score >= 90) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 75) return "bg-amber-500/15 text-amber-700 dark:text-amber-200";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

/** Seçim listesi aynı mı? (sıra, id ve gece sayısı) — store'a gereksiz yazmayı önler */
function sameSelection(a: Hotel[], b: Hotel[]) {
  return a.length === b.length && a.every((h, i) => h.id === b[i].id && h.nights === b[i].nights);
}

function HotelImage({ hotel }: { hotel: Hotel }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-200 to-slate-100 dark:from-[#0F1629] dark:to-[#1a2238]">
      {failed ? (
        <div className="absolute inset-0 grid place-items-center text-ink/30">
          <BedDouble size={34} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hotel.image}
          alt={hotel.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", PHOTO_ZOOM)}
        />
      )}
    </div>
  );
}

/** Üstteki algoritma özeti: "X mekana göre en verimli plan: Y Gün A, ardından [Taşıt] ile Z Gün B" */
function PlanSummaryBanner({ plan }: { plan: TripPlan }) {
  const t = useT();
  const [first, ...rest] = plan.cities;
  const forward = plan.transfers.filter((x) => !x.isReturn);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-indigo-500/10 p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl glass-primary">
          <Sparkles size={20} />
        </span>
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
            {t("h.algoTitle")}
          </p>
          <p className="text-sm leading-relaxed text-ink/80 md:text-base">
            {t("h.planIntro", { n: plan.totalPlaces })}{" "}
            <b className="text-ink">{t("h.stay", { days: first.days, city: city(first.city, t.locale) })}</b>
            {t("h.staySuffix")}
            {rest.map((c, i) => (
              <span key={c.city}>
                {t("h.then")}
                <b className="text-ink">{forward[i] ? transferName(t.locale, forward[i].name) : t("mode.train")}</b>
                {t("h.via")}
                <b className="text-ink">{t("h.stay", { days: c.days, city: city(c.city, t.locale) })}</b>
                {t("h.staySuffix")}
              </span>
            ))}
            {t("h.end")}
          </p>

          {/* Zaman çizelgesi */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {plan.cities.map((c, i) => (
              <span key={c.city} className="flex items-center gap-2">
                {i > 0 && forward[i - 1] && <TransferChip transfer={forward[i - 1]} />}
                <span className="glass rounded-full px-3 py-1.5 font-medium text-ink">
                  {t("h.dayRange", { range: c.dayEnd > c.dayStart ? `${c.dayStart}–${c.dayEnd}` : c.dayStart })} ·{" "}
                  {city(c.city, t.locale)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const TRANSFER_ICON: Record<IntercityTransfer["mode"], LucideIcon> = { train: TrainFront, bus: Bus, flight: Plane };

function TransferChip({ transfer }: { transfer: IntercityTransfer }) {
  const t = useT();
  const Icon = TRANSFER_ICON[transfer.mode];
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-rose-500/12 px-2.5 py-1.5 font-medium text-rose-700 dark:text-rose-300">
      <Icon size={12} />
      {formatMinutes(transfer.minutes, t.locale)} · {usd(transfer.cost)}
      <ArrowRight size={11} />
    </span>
  );
}

function HotelCard({
  evaluation,
  chosen,
  onChoose,
  index,
}: {
  evaluation: HotelEvaluation;
  chosen: boolean;
  onChoose: () => void;
  /** Liste sırası: kartlar dalga halinde sırayla gelir */
  index: number;
}) {
  const t = useT();
  const intl = intlLocale(t.locale);
  const { hotel, score, avgDistanceKm } = evaluation;
  const travelers = useTripStore((s) => s.travelers);
  const rooms = roomsFor(travelers);
  const nightly = hotelNightlyFor(hotel, travelers);
  const total = nightly * hotel.nights;

  return (
    <motion.button
      type="button"
      layout
      onClick={onChoose}
      {...riseIn(index)}
      whileHover={{ y: CARD_HOVER.whileHover.y, transition: CARD_HOVER.transition }}
      className={cn(
        "card group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left backdrop-blur-xl transition-shadow",
        chosen ? "border-blue-500/80!" : GLASS_CARD,
      )}
      aria-pressed={chosen}
    >
      <div className="relative h-32 shrink-0">
        <HotelImage hotel={hotel} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <span className={cn("absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold", TIER_BADGE[hotel.tier])}>
          {t(`tier.${hotel.tier}`)}
        </span>
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-slate-900">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          {hotel.rating.toFixed(1)}/10
          <span className="font-normal text-slate-500">({hotel.reviewCount.toLocaleString(intl)})</span>
        </span>
        <AnimatePresence>
          {chosen && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-white shadow-lg"
            >
              <Check size={15} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold leading-snug text-ink">{hotel.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/55">
            <MapPin size={11} /> {areaLabel(t.locale, hotel.area)} · {t("h.avgToPlaces", { km: avgDistanceKm.toLocaleString(intl) })}
          </p>
        </div>

        <span className={cn("flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", scoreTone(score))}>
          <Target size={12} />
          {t("g.routeFit", { n: score })}
        </span>

        <div className="flex flex-wrap gap-1.5">
          {hotel.highlights.map((h) => (
            <span key={h} className="rounded-md bg-ink/[0.05] px-2 py-0.5 text-[11px] text-ink/65">
              {h}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-ink/10 pt-3">
          <div>
            {travelers > 1 && (
              <p className="text-[11px] font-semibold text-ink/60">
                {t("h.paxRooms", { n: travelers, rooms, price: usd(nightly) })}
              </p>
            )}
            <p className="font-mono text-lg font-bold tabular-nums text-ink">
              {usd(nightly)}
              <span className="text-xs font-normal text-ink/50"> {t("unit.perNight")}</span>
            </p>
            <p className="flex items-center gap-1 text-[11px] text-ink/55">
              <Moon size={10} /> {t("h.nightsTotal", { n: hotel.nights, price: usd(total) })}
            </p>
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">{usd(total)}</p>
        </div>
      </div>
    </motion.button>
  );
}

/** Pro: otel → mekan hatlarının nokta atışı dökümü · Ücretsiz: bulanık önizleme + kilit */
function TransitBreakdown({ plan, city: cityPlan, evaluation }: { plan: TripPlan; city: CityPlan; evaluation: HotelEvaluation }) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);
  const travelers = useTripStore((s) => s.travelers);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const perPerson = computeTransitCost(plan, recommendedHotels);

  return (
    <section className="card relative overflow-hidden rounded-3xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <TrainFrontTunnel size={17} className="text-indigo-600 dark:text-indigo-300" />
            {t("h.transitTitle")}
          </h2>
        </div>
        {isPro && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
            <Crown size={11} /> Pro
          </span>
        )}
      </header>

      <div className={cn("divide-y divide-ink/[0.07]", !isPro && "pointer-events-none select-none blur-[6px]")} aria-hidden={!isPro}>
        {evaluation.legs.map((leg) => {
          const place = cityPlan.places.find((p) => p.id === leg.placeId)!;
          const Icon = MODE_ICON[leg.mode];
          const meta = TRANSIT_MODE_META[leg.mode];
          return (
            <div key={leg.placeId} className="flex items-center gap-3 px-5 py-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                style={{ background: meta.color }}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{place.name}</p>
                <p className="truncate text-xs text-ink/55">
                  {t(`mode.${leg.mode}`)}
                  {leg.mode === "walk" ? "" : ` · ${leg.line}`} · {leg.distanceKm.toLocaleString(intlLocale(t.locale))} km
                </p>
                {leg.route && (
                  <p className="truncate text-[11px] font-medium" style={{ color: leg.route.color }}>
                    {leg.route.from.name} ➔ {leg.route.to.name} · {t("unit.stops", { n: leg.route.stops })} ·{" "}
                    {t("unit.every", { n: leg.route.headwayMinutes })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold tabular-nums text-ink">{formatMinutes(leg.minutes, t.locale)}</p>
                <p className="font-mono text-xs tabular-nums text-ink/55">{leg.cost ? `$${leg.cost.toFixed(2)}` : t("common.free")}</p>
              </div>
            </div>
          );
        })}

        {plan.transfers.map((tf) => {
          const Icon = TRANSFER_ICON[tf.mode];
          return (
          <div key={`${tf.from}-${tf.to}`} className="flex items-center gap-3 bg-rose-500/[0.05] px-5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500 text-white">
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {city(tf.from, t.locale)} ➔ {city(tf.to, t.locale)}
                {tf.isReturn && <span className="ml-1.5 text-xs font-normal text-ink/50">{t("itin.forReturn")}</span>}
              </p>
              <p className="truncate text-xs text-ink/55">{transferName(t.locale, tf.name)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold tabular-nums text-ink">{formatMinutes(tf.minutes, t.locale)}</p>
              <p className="font-mono text-xs tabular-nums text-ink/55">{usd(tf.cost)}</p>
            </div>
          </div>
          );
        })}

        <div className="flex items-center justify-between px-5 py-4 text-sm">
          <span className="text-ink/70">
            {t("h.roundTrip", { city: city(cityPlan.city, t.locale) })}{" "}
            <b className="font-mono text-ink">${evaluation.transitCost.toFixed(2)}</b> · {t("h.allTransit")}
          </span>
          <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
            {usd(perPerson)}
            {travelers > 1 && <span className="text-xs font-normal text-ink/50"> × {travelers}</span>}
          </span>
        </div>
      </div>

      {!isPro && (
        <div className="absolute inset-0 top-[72px] grid place-items-center bg-surface/30 p-6">
          <div className="glass max-w-sm rounded-2xl p-5 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-lg">
              <Lock size={18} />
            </span>
            <p className="mt-3 font-semibold text-ink">{t("g.unlock")}</p>
            <p className="mt-1 text-xs text-ink/60">{t("h.lockText")}</p>
            <button
              type="button"
              onClick={openUpgradeModal}
              className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(245,158,11,0.7)] hover:brightness-110"
            >
              <Crown size={14} /> {t("h.tryPro")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function HotelActionBar({ plan }: { plan: TripPlan }) {
  const t = useT();
  const prevStep = useTripStore((s) => s.prevStep);
  const nextStep = useTripStore((s) => s.nextStep);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const ready = plan.cities.length > 0 && recommendedHotels.length === plan.cities.length;
  const travelers = useTripStore((s) => s.travelers);
  const hotelTotal = recommendedHotels.reduce((s, h) => s + hotelTotalFor(h, travelers), 0);

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur lg:static lg:bg-surface/80 md:px-8">
      <button
        type="button"
        onClick={prevStep}
        className="flex shrink-0 items-center gap-1.5 rounded-xl glass-secondary px-3 py-3 text-sm text-ink/70 hover:text-ink"
      >
        <ArrowLeft size={15} />
        <span className="hidden sm:inline">{t("hotel.back")}</span>
      </button>

      <p className="min-w-0 flex-1 truncate px-1 text-xs text-ink/60 sm:text-sm">
        {t("hotel.summary", { d: plan.totalDays, c: plan.cities.length, price: usd(hotelTotal) })}
      </p>

      <button
        type="button"
        disabled={!ready}
        onClick={nextStep}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all",
          ready
            ? "glass-primary"
            : "cursor-not-allowed bg-ink/[0.07] text-ink/35",
        )}
      >
        <span className="hidden xl:inline">{t("hotel.next")}</span>
        <span className="hidden md:inline xl:hidden">{t("hotel.nextShort")}</span>
        <span className="md:hidden">{t("nav.continue")}</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

/** Adım 3: akıllı şehir bölüştürme, otel merkezi ve taşıt simülasyonu */
export default function HotelTransitStep({ destination }: TripRoute) {
  const t = useT();
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const focusedHotelId = useTripStore((s) => s.focusedHotelId);
  const chooseHotel = useTripStore((s) => s.chooseHotel);
  const setFocusedHotel = useTripStore((s) => s.setFocusedHotel);
  const isPro = useTripStore((s) => s.isPro);

  const plan = useMemo(() => buildTripPlan(selectedPlaces, destination), [selectedPlaces, destination]);

  // Plan değişince (ilk giriş / mekan değişimi) şehir başına otel seçimini, gece sayılarını ve ulaşım maliyetini senkronla
  useEffect(() => {
    const s = useTripStore.getState();
    const hotels = plan.cities.flatMap((c) => {
      const evaluation = chosenEvaluation(c, s.recommendedHotels);
      return evaluation ? [evaluation.hotel] : [];
    });
    if (!sameSelection(hotels, s.recommendedHotels)) s.setRecommendedHotels(hotels);

    const cost = computeTransitCost(plan, hotels);
    if (cost !== s.transitCost) s.setTransitCost(cost);

    if (!hotels.some((h) => h.id === s.focusedHotelId)) s.setFocusedHotel(hotels[0]?.id ?? null);
  }, [plan, recommendedHotels]);

  if (plan.cities.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink/60">
        {t("h.needPlace")}
      </div>
    );
  }

  const activeCity =
    plan.cities.find((c) => c.hotels.some((e) => e.hotel.id === focusedHotelId)) ?? plan.cities[0];
  const activeEvaluation = chosenEvaluation(activeCity, recommendedHotels);

  return (
    <motion.div
      {...STEP_TRANSITION}
      className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden lg:grid lg:grid-cols-[56fr_44fr] lg:overflow-hidden"
    >
      {/* Sol: özet, şehir sekmeleri, otel kartları, Pro hat dökümü */}
      <motion.section {...SLIDE_FROM_LEFT} className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="lg:flex-1 lg:overflow-y-auto">
          <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
            <header>
              <h1 className="text-2xl font-bold text-ink md:text-3xl">
                {destination.flag} {t("h.title")}
              </h1>
            </header>

            <PlanSummaryBanner plan={plan} />

            {/* Şehir sekmeleri */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {plan.cities.map((c) => {
                const active = c === activeCity;
                const chosen = chosenEvaluation(c, recommendedHotels);
                return (
                  <button
                    key={c.city}
                    type="button"
                    onClick={() => chosen && setFocusedHotel(chosen.hotel.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors",
                      active
                        ? "border-blue-500/60 bg-blue-500/15 text-ink backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                        : "glass-secondary text-ink/65 hover:text-ink",
                    )}
                  >
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">{city(c.city, t.locale)}</span>
                      <span className="text-[11px] text-ink/55">
                        {t("unit.days", { n: c.days })} · {t("unit.places", { n: c.places.length })}
                      </span>
                    </span>
                    {active && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                  </button>
                );
              })}
            </div>

            {/* İdeal otel bölgesi */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-xs text-ink/60">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <Target size={13} className="text-blue-600 dark:text-blue-300" /> {t("h.idealArea", { city: city(activeCity.city, t.locale) })}
              </span>
              <span className="font-mono">
                {activeCity.center[1].toFixed(4)}°, {activeCity.center[0].toFixed(4)}°
              </span>
              <span>{t("h.centerAvg", { km: activeCity.idealAvgKm.toFixed(1) })}</span>
              <span>
                {t("unit.nights", { n: activeCity.nights })} ·{" "}
                {t("h.visitHours", { n: activeCity.visitHours.toLocaleString(intlLocale(t.locale)) })}
              </span>
            </div>

            {/* Otel kartları */}
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {activeCity.hotels.map((evaluation, i) => (
                <HotelCard
                  key={evaluation.hotel.id}
                  index={i}
                  evaluation={evaluation}
                  chosen={evaluation.hotel.id === activeEvaluation?.hotel.id}
                  onChoose={() => chooseHotel(evaluation.hotel)}
                />
              ))}
            </div>

            {activeEvaluation && <TransitBreakdown plan={plan} city={activeCity} evaluation={activeEvaluation} />}

            <p className="pb-1 text-center text-[10px] text-ink/35">
              {t("h.footer")}
            </p>
          </div>
        </div>

        <HotelActionBar plan={plan} />
      </motion.section>

      {/* Sağ: otel & taşıt haritası */}
      <motion.section {...SLIDE_FROM_RIGHT} className="order-first h-[360px] w-full shrink-0 px-3 pt-3 sm:h-[420px] sm:px-4 sm:pt-4 lg:order-none lg:h-auto lg:p-4 lg:pl-0">
        <div className="relative h-full">
          <WorldMap mode="hotel" className="card h-full w-full rounded-2xl lg:rounded-3xl" />
          <div className="glass pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-xl px-3 py-1.5 text-xs font-medium text-ink/80">
            <span className="flex items-center gap-1.5">
              <BedDouble size={13} className="shrink-0 text-indigo-500" />
              <span className="truncate">{activeEvaluation?.hotel.name ?? city(activeCity.city, t.locale)}</span>
            </span>
          </div>
          <div className="glass pointer-events-none absolute right-3 top-3 hidden flex-col gap-1 rounded-xl px-3 py-2 text-[11px] text-ink/75 sm:flex">
            {isPro ? (
              (Object.keys(TRANSIT_MODE_META) as TransitMode[]).map((m) => (
                <span key={m} className="flex items-center gap-1.5">
                  <span className="h-1 w-4 rounded-full" style={{ background: TRANSIT_MODE_META[m].color }} />
                  {t(`mode.${m}`)}
                </span>
              ))
            ) : (
              <span className="flex items-center gap-1.5">
                <Lock size={11} className="text-amber-500" /> {t("h.linesPro")}
              </span>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
