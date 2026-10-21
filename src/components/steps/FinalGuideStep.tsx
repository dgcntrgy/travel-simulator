"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Bus,
  CalendarDays,
  Coffee,
  Crown,
  ExternalLink,
  Languages,
  Lightbulb,
  Lock,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Printer,
  RotateCcw,
  Star,
  Ticket,
  TrainFront,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import WorldMap from "@/components/map/WorldMap";
import { CATEGORY_META } from "@/data/mockPlaces";
import { PHRASE_BOOKS, PHRASE_CATEGORIES, PHRASE_KEYS, type PhraseCategory } from "@/data/languageCards";
import { LANGUAGES, getDestinationProfile, type LanguageCode, type LanguagePack } from "@/lib/globalDiscovery";
import { DAY_SLOTS, SLOT_META, buildItinerary, type DaySlot, type FreeNote, type ItineraryDay, type ItineraryItem } from "@/lib/itinerary";
import {
  TRANSIT_MODE_META,
  buildTripPlan,
  chosenEvaluation,
  directionsUrl,
  formatFrequency,
  formatMinutes,
  legSteps,
  stationLabel,
  type TripPlan,
} from "@/lib/routeOptimizer";
import {
  areaLabel,
  cityName,
  countryName,
  formatDurationLocale,
  intlLocale,
  languageName,
  lineColorName,
  transferName,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import { fetchLocalTitles, fetchWikiImage } from "@/lib/wikipedia";
import { useT, type T } from "@/lib/useI18n";
import { computeBudget, hotelNightlyFor, hotelTotalFor, roomsFor, useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Airport, Flight, Hotel, IntercityTransfer, Place, TransitLeg, TripRoute } from "@/types/trip";
import { STEP_TRANSITION } from "@/lib/motion";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const TRANSFER_ICON: Record<IntercityTransfer["mode"], LucideIcon> = { train: TrainFront, bus: Bus, flight: Plane };

function formatDate(
  date: Date | null,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
) {
  return date ? date.toLocaleDateString(intlLocale(locale), opts) : "";
}

/** Veri setindeki (Türkçe) şehir adı → seçili dilde */
const city = (name: string, locale: Locale) => cityName({ city: name }, locale);

/** Serbest zaman önerisi seçili dilde */
function freeNoteText(t: T, item: { note: FreeNote; city: string }): string {
  return item.note === "explore" ? t("itin.noteExplore", { city: city(item.city, t.locale) }) : t("itin.noteArrival");
}

/**
 * PDF / çevrimdışı cep rehberi SADECE Pro'da: ücretsiz modda `window.print()` hiç çağrılmaz, satın alma penceresi açılır.
 * Yazdırma öncesi geçici olarak açık temaya geçer (koyu zeminli PDF çıkmasın); `afterprint` ile temaya geri döner.
 */
function printGuide() {
  const { isPro, openUpgradeModal } = useTripStore.getState();
  if (!isPro) {
    openUpgradeModal();
    return;
  }
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  if (wasDark) root.classList.remove("dark");
  const restore = () => {
    if (wasDark) root.classList.add("dark");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

function SectionTitle({ icon: Icon, children, aside }: { icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink/70">
        <Icon size={15} className="text-blue-600 dark:text-blue-400" />
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** Ücretsiz modda kilitli içeriğin üstüne bulanık kaplama + "Pro ile Kilidi Aç" */
function ProLock({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div aria-hidden className="pointer-events-none select-none blur-[5px] saturate-50 print:hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/40 p-4 text-center print:static print:bg-transparent">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink/80">
          <Lock size={13} className="text-amber-500" /> {label}
        </span>
        <button
          type="button"
          onClick={openUpgradeModal}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_-8px_rgba(245,158,11,0.7)] hover:brightness-110 print:hidden"
        >
          <Crown size={13} /> {t("g.unlock")}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Üst özet

function GuideHero({
  plan,
  itinerary,
  destination,
  total,
}: {
  plan: TripPlan;
  itinerary: ItineraryDay[];
  destination: Airport;
  total: number;
}) {
  const t = useT();
  const travelers = useTripStore((s) => s.travelers);
  const isPro = useTripStore((s) => s.isPro);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);
  const nights = plan.cities.reduce((s, c) => s + c.nights, 0);
  const forward = plan.transfers.filter((x) => !x.isReturn);
  const first = itinerary[0]?.date ?? null;
  const last = itinerary.at(-1)?.date ?? null;

  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: CalendarDays, label: t("budget.total"), value: `${t("unit.days", { n: plan.totalDays })} · ${t("unit.nights", { n: nights })}` },
    {
      icon: MapPin,
      label: t("g.statRoute"),
      value: `${t("unit.cities", { n: plan.cities.length })} · ${t("unit.places", { n: plan.totalPlaces })}`,
    },
    { icon: Users, label: t("flight.pax"), value: t("unit.people", { n: travelers }) },
    { icon: Wallet, label: t("g.statEstimated"), value: usd(total) },
  ];

  return (
    <section className="card relative overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl print:hidden" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl print:hidden" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-ink md:text-4xl">
            <span className="mr-2">{destination.flag}</span>
            {t("g.title", { country: countryName(destination, t.locale) })}
          </h1>
          {first && (
            <p className="mt-1.5 text-sm text-ink/60">
              {formatDate(first, t.locale, { day: "numeric", month: "long" })} –{" "}
              {formatDate(last, t.locale, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {plan.cities.map((c, i) => (
              <Fragment key={c.city}>
                {i > 0 && forward[i - 1] && (
                  <span className="flex items-center gap-1 text-xs text-ink/50">
                    <ArrowRight size={12} /> {transferName(t.locale, forward[i - 1].name)} <ArrowRight size={12} />
                  </span>
                )}
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-medium text-ink">
                  {city(c.city, t.locale)} <span className="text-ink/55">· {t("unit.days", { n: c.days })}</span>
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 print:hidden">
          {isPro ? (
            <button
              type="button"
              onClick={printGuide}
              className="flex items-center justify-center gap-2 rounded-xl glass-primary px-5 py-3 text-sm font-semibold text-white"
            >
              <Printer size={16} /> {t("g.pdfDownload")}
            </button>
          ) : (
            <button
              type="button"
              onClick={openUpgradeModal}
              title={t("guide.pdfLockedTitle")}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
            >
              🔒{t("guide.pdfLocked")}
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-ink/10 bg-ink/[0.03] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50">
              <Icon size={12} /> {label}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Bütçe

interface BudgetLine {
  label: string;
  detail: string;
  amount: number;
}

interface BudgetCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  amount: number;
  lines: BudgetLine[];
}

function useBudgetCategories(plan: TripPlan): { categories: BudgetCategory[]; total: number } {
  const t = useT();
  const budget = useTripStore(useShallow(computeBudget));
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const travelers = useTripStore((s) => s.travelers);

  return useMemo(() => {
    const hotelOrder = plan.cities.map((c) => c.city);
    const hotels = [...recommendedHotels].sort(
      (a, b) => hotelOrder.indexOf(a.cityRegion) - hotelOrder.indexOf(b.cityRegion),
    );
    const people = t("unit.people", { n: travelers });

    const categories: BudgetCategory[] = [
      {
        key: "flight",
        label: t("budget.catFlight"),
        icon: Plane,
        color: "#38bdf8",
        amount: budget.flight,
        lines: selectedFlight
          ? [
              {
                label: `${selectedFlight.airline} · ${selectedFlight.flightNumber}`,
                detail: t("g.flightRT", { people, price: usd(selectedFlight.price) }),
                amount: budget.flight,
              },
            ]
          : [],
      },
      {
        key: "hotel",
        label: t("budget.catHotel"),
        icon: BedDouble,
        color: "#818cf8",
        amount: budget.hotel,
        lines: hotels.map((h) => ({
          label: `${h.name} (${city(h.cityRegion, t.locale)})`,
          detail: `${t("unit.nights", { n: h.nights })} × ${usd(hotelNightlyFor(h, travelers))} · ${t("unit.rooms", { n: roomsFor(travelers) })}`,
          amount: hotelTotalFor(h, travelers),
        })),
      },
      {
        key: "transit",
        label: t("budget.catTransit"),
        icon: TrainFront,
        color: "#22d3ee",
        amount: budget.transit,
        lines: [
          ...plan.cities.map((c) => {
            const evaluation = chosenEvaluation(c, recommendedHotels);
            return {
              label: t("g.cityTransit", { city: city(c.city, t.locale) }),
              detail: t("g.cityTransitDetail", { places: t("unit.places", { n: c.places.length }), people }),
              amount: (evaluation?.transitCost ?? 0) * travelers,
            };
          }),
          ...plan.transfers.map((tf) => ({
            label: `${city(tf.from, t.locale)} ➔ ${city(tf.to, t.locale)}${tf.isReturn ? ` ${t("g.returnSuffix")}` : ""}`,
            detail: `${transferName(t.locale, tf.name)} × ${people}`,
            amount: tf.cost * travelers,
          })),
        ],
      },
      {
        key: "food",
        label: t("budget.catFood"),
        icon: Ticket,
        color: "#fbbf24",
        amount: budget.foodAndEntries,
        lines: selectedPlaces
          .filter((p) => p.estimatedCost > 0)
          .map((p) => ({
            label: p.name,
            detail: `${t(`cat.${p.category}`)} · ${people} × ${usd(p.estimatedCost)}`,
            amount: p.estimatedCost * travelers,
          })),
      },
    ];
    return { categories, total: budget.total };
  }, [plan, budget, selectedFlight, recommendedHotels, selectedPlaces, travelers, t]);
}

function BudgetTable({ categories, total, days }: { categories: BudgetCategory[]; total: number; days: number }) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const travelers = useTripStore((s) => s.travelers);

  const details = (
    <div className="space-y-3">
      {categories.map((c) => (
        <div key={c.key}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: c.color }}>
            {c.label}
          </p>
          {c.lines.length === 0 ? (
            <p className="text-xs text-ink/45">{t("g.noItems")}</p>
          ) : (
            c.lines.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                <span className="min-w-0">
                  <span className="text-ink/85">{l.label}</span>
                  <span className="block text-[11px] text-ink/45">{l.detail}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-ink/80">{usd(l.amount)}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section className="card print-break-avoid rounded-3xl p-5">
      <SectionTitle icon={Wallet} aside={<span className="text-[11px] text-ink/45">USD · {t("unit.people", { n: travelers })}</span>}>
        {t("g.budgetTitle")}
      </SectionTitle>

      {/* Oransal şerit */}
      <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
        {categories.map((c) =>
          c.amount > 0 ? (
            <span key={c.key} style={{ width: `${(c.amount / Math.max(1, total)) * 100}%`, background: c.color }} />
          ) : null,
        )}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {categories.map((c, i) => (
            <tr key={c.key} className="border-b border-ink/[0.07]">
              <td className="py-2.5">
                <span className="flex items-center gap-2 text-ink/85">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
                    style={{ background: c.color }}
                  >
                    <c.icon size={14} />
                  </span>
                  {c.label}
                  {i < categories.length - 1 && <span className="text-ink/30">+</span>}
                </span>
              </td>
              <td className="py-2.5 text-right text-[11px] text-ink/45">
                %{Math.round((c.amount / Math.max(1, total)) * 100)}
              </td>
              <td className="py-2.5 pl-3 text-right font-mono font-semibold tabular-nums text-ink">{usd(c.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold text-ink">{t("budget.grandTotal")}</td>
            <td />
            <td className="pt-3 pl-3 text-right font-mono text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {usd(total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 flex justify-between text-[11px] text-ink/50">
        <span>{t("g.perPersonApprox", { v: usd(total / Math.max(1, travelers)) })}</span>
        <span>{t("g.dailyApprox", { v: usd(total / Math.max(1, days)) })}</span>
      </p>

      <div className="mt-4 border-t border-dashed border-ink/15 pt-4">
        {isPro ? details : <ProLock label={t("g.budgetLocked")}>{details}</ProLock>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Uçuş & oteller

function FlightSummary({ flight }: { flight: Flight | null }) {
  const t = useT();
  if (!flight) {
    return (
      <section className="card rounded-3xl p-5 text-sm text-ink/55">
        <SectionTitle icon={Plane}>{t("budget.flight")}</SectionTitle>
        {t("g.noFlight")}
      </section>
    );
  }
  return (
    <section className="card print-break-avoid rounded-3xl p-5">
      <SectionTitle icon={Plane} aside={<span className="font-mono text-xs text-ink/50">{flight.flightNumber}</span>}>
        {t("g.flightSummary")}
      </SectionTitle>
      <p className="text-sm font-semibold text-ink">{flight.airline}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-semibold text-ink">{flight.departureTime}</p>
          <p className="flex items-center gap-1 text-xs text-ink/55">
            <PlaneTakeoff size={12} /> {cityName(flight.origin, t.locale)} · {flight.origin.code}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center text-[11px] text-ink/50">
          <span>{formatDurationLocale(t.locale, flight.totalDurationMinutes)}</span>
          <span className="my-1 h-px w-full bg-gradient-to-r from-blue-500/60 to-blue-400/60" />
          <span className={flight.layover ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}>
            {flight.layover
              ? t("g.layoverAt", {
                  city: cityName(flight.layover.airport, t.locale),
                  dur: formatDurationLocale(t.locale, flight.layover.durationMinutes),
                })
              : t("flight.direct")}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-semibold text-ink">
            {flight.arrivalTime}
            {flight.arrivalDayOffset > 0 && (
              <sup className="ml-0.5 text-[10px] text-amber-600 dark:text-amber-400">+{flight.arrivalDayOffset}</sup>
            )}
          </p>
          <p className="flex items-center justify-end gap-1 text-xs text-ink/55">
            {flight.destination.code} · {cityName(flight.destination, t.locale)} <PlaneLanding size={12} />
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink/45">
        {t("g.baggage", {
          cabin: flight.cabinBaggageKg,
          bag: flight.checkedBaggageKg ? `${flight.checkedBaggageKg}kg` : t("g.extra"),
          price: usd(flight.price),
        })}
      </p>
    </section>
  );
}

function HotelsSummary({ plan }: { plan: TripPlan }) {
  const t = useT();
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const travelers = useTripStore((s) => s.travelers);
  return (
    <section className="card print-break-avoid rounded-3xl p-5">
      <SectionTitle icon={BedDouble}>{t("budget.catHotel")}</SectionTitle>
      <div className="space-y-3">
        {plan.cities.map((c) => {
          const evaluation = chosenEvaluation(c, recommendedHotels);
          if (!evaluation) return null;
          const { hotel, score } = evaluation;
          return (
            <div key={c.city} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <BedDouble size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{hotel.name}</p>
                <p className="truncate text-[11px] text-ink/50">
                  {city(c.city, t.locale)} · {areaLabel(t.locale, hotel.area)} · {t(`tier.${hotel.tier}.short`)}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink/55">
                  <span className="flex items-center gap-0.5">
                    <Star size={10} className="fill-amber-400 text-amber-400" /> {hotel.rating}
                  </span>
                  <span>{t("g.routeFit", { n: score })}</span>
                </p>
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <p className="font-semibold text-ink">{t("unit.nights", { n: c.nights })}</p>
                <p className="text-ink/50">
                  {usd(hotelNightlyFor(hotel, travelers))}
                  {t("unit.perNight")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Gün gün zaman çizelgesi

function ItineraryRow({
  item,
  hotel,
  destination,
  origin,
}: {
  item: ItineraryItem;
  hotel?: Hotel;
  destination: Airport;
  origin: Airport;
}) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);

  let icon: LucideIcon = MapPin;
  let accent = "bg-ink/[0.06] text-ink/70";
  let body: React.ReactNode = null;

  switch (item.kind) {
    case "arrival":
      icon = PlaneLanding;
      accent = "bg-blue-500/15 text-blue-600 dark:text-blue-400";
      body = (
        <>
          <p className="text-sm font-medium text-ink">
            {t("itin.arrivalAt", { place: destination.airportName, code: destination.code })}
          </p>
          <p className="text-xs text-ink/55">
            {item.flight ? `${item.flight.airline} · ${item.flight.flightNumber}` : t("itin.noFlight")} · {t("itin.arrivalSub")}
          </p>
        </>
      );
      break;
    case "checkin":
      icon = BedDouble;
      accent = "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300";
      body = (
        <>
          <p className="text-sm font-medium text-ink">
            {t("itin.checkin")} · {item.hotel.name}
          </p>
          <p className="text-xs text-ink/55">{areaLabel(t.locale, item.hotel.area)}</p>
        </>
      );
      break;
    case "transfer": {
      icon = TRANSFER_ICON[item.transfer.mode];
      accent = "bg-rose-500/15 text-rose-600 dark:text-rose-300";
      body = (
        <>
          <p className="text-sm font-medium text-ink">
            {city(item.transfer.from, t.locale)} ➔ {city(item.transfer.to, t.locale)}
            {item.transfer.isReturn && <span className="font-normal text-ink/50"> {t("itin.forReturn")}</span>}
          </p>
          <p className="text-xs text-ink/55">
            {transferName(t.locale, item.transfer.name)} · {formatMinutes(item.transfer.minutes, t.locale)} ·{" "}
            {t("common.perPerson")} {usd(item.transfer.cost)}
          </p>
        </>
      );
      break;
    }
    case "free":
      icon = Coffee;
      accent = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
      body = <p className="text-sm text-ink/75">{freeNoteText(t, item)}</p>;
      break;
    case "departure":
      icon = PlaneTakeoff;
      accent = "bg-blue-500/15 text-blue-600 dark:text-blue-400";
      body = (
        <>
          <p className="text-sm font-medium text-ink">
            {t("itin.departureRow", { from: destination.code, to: origin.code })}
          </p>
          <p className="text-xs text-ink/55">{t("itin.departureTip")}</p>
        </>
      );
      break;
    case "place": {
      const { place, leg } = item;
      const meta = CATEGORY_META[place.category];
      icon = MapPin;
      accent = "text-white";
      body = (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink">
            {place.name}
            <span className="text-[11px] font-normal" style={{ color: meta.color }}>
              {t(`cat.${place.category}`)}
            </span>
            <span className="text-[11px] font-normal text-ink/45">
              {t("unit.hours", { n: place.recommendedDuration.toLocaleString(intlLocale(t.locale)) })} ·{" "}
              {place.estimatedCost ? `~${usd(place.estimatedCost)}` : t("common.free")}
            </span>
          </p>
          {leg &&
            (isPro ? (
              <div className="mt-1.5">
                <TransitStrip leg={leg} place={place} hotel={hotel} arrival={item.time} variant="full" />
              </div>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/45">
                <Lock size={11} className="text-amber-500" /> {t("itin.transitPro")}
              </p>
            ))}
          {place.story && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink/60 print:line-clamp-4">{place.story}</p>}
          {isPro && place.mustDo && (
            <p className="mt-2 flex gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-ink/75">
              <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                <b className="text-amber-700 dark:text-amber-300">{t("itin.localTip")} </b>
                {place.mustDo}
              </span>
            </p>
          )}
        </>
      );
      return (
        <li className="flex gap-3">
          <span className="w-11 shrink-0 pt-1 font-mono text-xs tabular-nums text-ink/50">{item.time}</span>
          <span
            className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", accent)}
            style={{ background: meta.color }}
          >
            <MapPin size={13} />
          </span>
          <div className="min-w-0 flex-1 pb-1">{body}</div>
        </li>
      );
    }
  }

  const Icon = icon;
  return (
    <li className="flex gap-3">
      <span className="w-11 shrink-0 pt-1 font-mono text-xs tabular-nums text-ink/50">{item.time}</span>
      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", accent)}>
        <Icon size={13} />
      </span>
      <div className="min-w-0 flex-1 pb-1">{body}</div>
    </li>
  );
}

/** Bir günün kişi başı tahmini harcaması: girişler + otelden ulaşım + şehirler arası transfer */
function dayCost(day: ItineraryDay): number {
  return day.items.reduce((sum, item) => {
    if (item.kind === "place") return sum + item.place.estimatedCost + (item.leg?.cost ?? 0);
    if (item.kind === "transfer") return sum + item.transfer.cost;
    return sum;
  }, 0);
}

/**
 * Yalnızca çıktı (PDF) için gün kartı: her gün kendi A4 sayfasında (`.print-day` → break-before: page).
 * Bilerek animasyonsuz: `whileInView` ile opacity 0 başlayan kartlar ekranda hiç görünmediği için yazdırmada boş kalıyordu.
 */
function DayCard({ day, destination, origin }: { day: ItineraryDay; destination: Airport; origin: Airport }) {
  const t = useT();
  const cost = dayCost(day);
  return (
    <article className="print-day overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900">
      <header className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 font-mono text-lg font-bold text-white">
            {day.day}
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold">
              {t("unit.dayN", { n: day.day })} · {city(day.city, t.locale)}
            </p>
            <p className="text-[11px] capitalize text-slate-500">{formatDate(day.date, t.locale)}</p>
          </div>
        </div>
        <div className="text-right text-[11px] leading-tight text-slate-500">
          {day.hotel && (
            <p className="flex items-center justify-end gap-1">
              <BedDouble size={11} /> {day.hotel.name}
            </p>
          )}
          <p className="mt-0.5">
            {t("itin.dayCost")} <b className="font-mono text-slate-900">{usd(cost)}</b>
          </p>
        </div>
      </header>
      <div className="divide-y divide-slate-200">
        {DAY_SLOTS.map((slot) => {
          const items = day.items.filter((i) => i.slot === slot);
          return (
            <section key={slot} className="print-slot grid grid-cols-[7.5rem_1fr] gap-4 px-5 py-4">
              <div className="leading-tight">
                <p className="text-sm font-semibold">
                  {SLOT_META[slot].emoji} {t(`slot.${slot}`)}
                </p>
                <p className="font-mono text-[10px] text-slate-500">{SLOT_META[slot].range}</p>
              </div>
              {items.length > 0 ? (
                <ol className="space-y-3">
                  {items.map((item, i) => (
                    <ItineraryRow key={`${item.kind}-${i}`} item={item} hotel={day.hotel} destination={destination} origin={origin} />
                  ))}
                </ol>
              ) : (
                <p className="self-center text-xs italic text-slate-400">{t("itin.free")}</p>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ Rezervasyon & Harekete Geç

/** Date → "YYYY-MM-DD" (yerel) */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Date → "YYMMDD" (Skyscanner URL biçimi) */
const yymmdd = (date: Date) => isoDate(date).slice(2).replace(/-/g, "");

/** Seçilen rota + tarih için gerçek uçuş arama sayfaları (yeni sekmede açılır) */
function flightSearchLinks(origin: Airport, destination: Airport, depart: Date | null, ret: Date | null, travelers: number) {
  const dates = depart && ret ? ` on ${isoDate(depart)} through ${isoDate(ret)}` : "";
  const google = `https://www.google.com/travel/flights?q=${encodeURIComponent(
    `Flights to ${destination.code} from ${origin.code}${dates}`,
  )}`;
  const sky =
    `https://www.skyscanner.com/transport/flights/${origin.code.toLowerCase()}/${destination.code.toLowerCase()}/` +
    (depart && ret ? `${yymmdd(depart)}/${yymmdd(ret)}/` : "") +
    `?adultsv2=${travelers}`;
  const kiwi =
    `https://www.kiwi.com/en/search/results/${origin.code}/${destination.code}/` +
    (depart && ret ? `${isoDate(depart)}/${isoDate(ret)}` : "anytime/anytime") +
    `?adults=${travelers}`;
  return [
    { label: "Google Flights", href: google },
    { label: "Skyscanner", href: sky },
    { label: "Kiwi.com", href: kiwi },
  ];
}

function bookingUrl(hotel: Hotel, checkin: Date | null, nights: number, travelers: number): string {
  const params = new URLSearchParams({
    ss: `${hotel.name} ${hotel.cityRegion}`,
    group_adults: String(travelers),
    no_rooms: "1",
  });
  if (checkin) {
    params.set("checkin", isoDate(checkin));
    params.set("checkout", isoDate(new Date(checkin.getTime() + Math.max(1, nights) * 86_400_000)));
  }
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Planı bitiren kullanıcı tek tıkla gerçek sitelerde uçak bileti ve otel arar */
function BookingLinks({
  plan,
  itinerary,
  origin,
  destination,
}: {
  plan: TripPlan;
  itinerary: ItineraryDay[];
  origin: Airport;
  destination: Airport;
}) {
  const t = useT();
  const flight = useTripStore((s) => s.selectedFlight);
  const travelers = useTripStore((s) => s.travelers);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);

  // Gidiş = varış gününden uçuş süresi kadar önce (kalkış tarihi), dönüş = rehberin son günü
  const firstDay = itinerary[0]?.date ?? null;
  const depart = firstDay && flight ? new Date(firstDay.getTime() - flight.arrivalDayOffset * 86_400_000) : firstDay;
  const ret = itinerary.at(-1)?.date ?? null;
  const flightLinks = flightSearchLinks(origin, destination, depart, ret, travelers);

  return (
    <section className="card relative overflow-hidden rounded-3xl p-5 md:p-6 print:hidden">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative">
        <SectionTitle
          icon={Ticket}
          aside={<span className="text-[11px] text-ink/45">{t("g.bookAside")}</span>}
        >
          {t("g.bookTitle")}
        </SectionTitle>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Uçak bileti */}
          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                  {t("g.flightTicket")}
                </p>
                <p className="mt-1 truncate text-base font-semibold text-ink">
                  {flight ? flight.airline : t("itin.noFlight")}
                  <span className="ml-2 font-mono text-xs font-normal text-ink/50">
                    {origin.code} → {destination.code}
                  </span>
                </p>
                <p className="text-xs text-ink/55">
                  {flight
                    ? `${
                        flight.type === "direct" || !flight.layover
                          ? t("flight.direct")
                          : t("g.viaCity", { city: cityName(flight.layover.airport, t.locale) })
                      } · ${formatDurationLocale(t.locale, flight.totalDurationMinutes)}`
                    : t("g.findBest")}
                  {depart &&
                    ret &&
                    ` · ${formatDate(depart, t.locale, { day: "numeric", month: "short" })} – ${formatDate(ret, t.locale, { day: "numeric", month: "short" })}`}
                </p>
              </div>
              {flight && (
                <div className="shrink-0 text-right leading-tight">
                  <p className="font-mono text-xl font-bold tabular-nums text-ink">{usd(flight.price)}</p>
                  <p className="text-[10px] text-ink/45">{t("g.perPersonRT")}</p>
                </div>
              )}
            </div>
            <a
              {...EXTERNAL}
              href={flightLinks[0].href}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl glass-primary px-4 py-3 text-sm font-semibold text-white"
            >
              <Plane size={15} />
              {t("g.buyTicket")}
              {flight && <span className="font-normal opacity-90">· {flight.airline} {usd(flight.price * travelers)}</span>}
              <ExternalLink size={13} />
            </a>
            <div className="mt-2 flex flex-wrap gap-2">
              {flightLinks.slice(1).map((l) => (
                <a
                  key={l.label}
                  {...EXTERNAL}
                  href={l.href}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs font-medium text-ink/75 hover:border-blue-500/40 hover:text-ink"
                >
                  {l.label} <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>

          {/* Oteller */}
          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
              {t("g.yourHotels")}
            </p>
            <div className="mt-2 space-y-2">
              {plan.cities.map((c) => {
                const hotel = chosenEvaluation(c, recommendedHotels)?.hotel;
                if (!hotel) return null;
                const checkin = itinerary[c.dayStart - 1]?.date ?? null;
                return (
                  <div key={c.city} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface px-3 py-2.5">
                    <BedDouble size={16} className="shrink-0 text-indigo-500 dark:text-indigo-300" />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-medium text-ink">{hotel.name}</p>
                      <p className="truncate text-[11px] text-ink/50">
                        {city(c.city, t.locale)} · {t("unit.nights", { n: c.nights })} × {usd(hotelNightlyFor(hotel, travelers))}
                        {checkin && ` · ${t("g.checkin", { date: formatDate(checkin, t.locale, { day: "numeric", month: "short" }) })}`}
                      </p>
                    </div>
                    <a
                      {...EXTERNAL}
                      href={bookingUrl(hotel, checkin, c.nights, travelers)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg glass-primary px-3 py-2 text-xs font-semibold text-white"
                    >
                      {t("g.book")} <ExternalLink size={11} />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Haftalık ders programı (timetable grid)

/** Zaman dilimi renk dili: Sabah kehribar, Öğle zümrüt, İkindi gökyüzü, Akşam mor/indigo */
const SLOT_THEME: Record<DaySlot, { badge: string; cell: string; empty: string }> = {
  morning: {
    badge: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30",
    cell: "bg-gradient-to-br from-amber-400/[0.09] to-orange-500/[0.03]",
    empty: "border-amber-500/20",
  },
  noon: {
    badge: "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30",
    cell: "bg-gradient-to-br from-emerald-400/[0.09] to-teal-500/[0.03]",
    empty: "border-emerald-500/20",
  },
  afternoon: {
    badge: "bg-gradient-to-br from-sky-400 to-blue-600 shadow-sky-500/30",
    cell: "bg-gradient-to-br from-sky-400/[0.09] to-blue-500/[0.03]",
    empty: "border-blue-500/20",
  },
  evening: {
    badge: "bg-gradient-to-br from-violet-500 to-indigo-700 shadow-indigo-500/30",
    cell: "bg-gradient-to-br from-violet-500/[0.1] to-indigo-600/[0.04]",
    empty: "border-indigo-500/20",
  },
};

/** Şehir sütunlarını ayırt etmek için renkler (plan sırasıyla) */
const CITY_COLORS = ["#0ea5e9", "#8b5cf6", "#f97316", "#10b981", "#ec4899"];

interface ItemVisual {
  icon: LucideIcon;
  color: string;
  kicker: string;
  title: string;
  subtitle?: string;
}

function itemVisual(item: ItineraryItem, destination: Airport, origin: Airport, travelers: number, t: T): ItemVisual {
  switch (item.kind) {
    case "arrival":
      return {
        icon: PlaneLanding,
        color: "#0ea5e9",
        kicker: t("itin.arrival"),
        title: t("itin.arrivalAt", { place: cityName(destination, t.locale), code: destination.code }),
        subtitle: item.flight ? `${item.flight.airline} · ${item.flight.flightNumber}` : undefined,
      };
    case "checkin":
      return {
        icon: BedDouble,
        color: "#6366f1",
        kicker: t("itin.checkin"),
        title: item.hotel.name,
        subtitle: `${areaLabel(t.locale, item.hotel.area)} · ${usd(hotelNightlyFor(item.hotel, travelers))}${t("unit.perNight")}`,
      };
    case "transfer":
      return {
        icon: TRANSFER_ICON[item.transfer.mode],
        color: "#f43f5e",
        kicker: item.transfer.isReturn ? t("itin.returnTrip") : t("itin.cityChange"),
        title: `${city(item.transfer.from, t.locale)} ➔ ${city(item.transfer.to, t.locale)}`,
        subtitle: `${transferName(t.locale, item.transfer.name)} · ${formatMinutes(item.transfer.minutes, t.locale)}`,
      };
    case "free":
      return { icon: Coffee, color: "#10b981", kicker: t("itin.free"), title: freeNoteText(t, item) };
    case "departure":
      return {
        icon: PlaneTakeoff,
        color: "#0ea5e9",
        kicker: t("itin.returnFlight"),
        title: `${destination.code} ➔ ${origin.code}`,
        subtitle: t("itin.toAirport"),
      };
    case "place":
      return {
        icon: MapPin,
        color: CATEGORY_META[item.place.category].color,
        kicker: t(`cat.${item.place.category}`),
        title: item.place.name,
      };
  }
}

/** Mekan küçük resmi: önbellekteki Wikipedia görseli → yedek görsel → kategori rengi */
function PlaceThumb({ place, className }: { place: Place; className?: string }) {
  const isLive = place.source === "live";
  const [src, setSrc] = useState<string | null>(isLive ? place.fallbackImage : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLive) return;
    let active = true;
    fetchWikiImage(place.wikiTitle).then((wiki) => {
      if (active) setSrc(wiki ?? place.fallbackImage);
    });
    return () => {
      active = false;
    };
  }, [isLive, place.wikiTitle, place.fallbackImage]);

  return (
    <span
      className={cn("block shrink-0 overflow-hidden bg-slate-200 dark:bg-[#1a2238]", className)}
      style={failed || !src ? { background: `${CATEGORY_META[place.category].color}33` } : undefined}
    >
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => (src !== place.fallbackImage ? setSrc(place.fallbackImage) : setFailed(true))}
        />
      )}
    </span>
  );
}

/** "HH:MM" ± dakika (gün içinde sarar) */
function shiftClock(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * 🚇 Ulaşım & Yol Tarifi Şeridi: otelden hareket saati, binilecek ➔ inilecek istasyon, hat, sefer sıklığı,
 * yolculuk süresi ve Google Maps toplu taşıma tarifi linki.
 * - `cell`: haftalık ızgara hücresinde kompakt (ücretsizde bulanık + kilit)
 * - `full`: detay penceresi ve PDF gün kartı (adım adım tarif dahil)
 */
function TransitStrip({
  leg,
  place,
  hotel,
  arrival,
  variant,
}: {
  leg: TransitLeg;
  place: Place;
  hotel?: Hotel;
  /** Mekana varış saati (itinerary `time`) */
  arrival: string;
  variant: "cell" | "full";
}) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);
  const meta = TRANSIT_MODE_META[leg.mode];
  const km = leg.distanceKm.toLocaleString(intlLocale(t.locale));
  const route = leg.route;
  const color = route?.color ?? meta.color;
  const depart = shiftClock(arrival, -leg.minutes);
  const url = hotel ? directionsUrl(hotel.coordinates, place.coordinates, leg.mode) : null;
  const tint = { borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` };

  const link = url && (
    <a
      {...EXTERNAL}
      href={url}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
    >
      {t("g.directions")}
    </a>
  );

  if (variant === "cell") {
    const body = (
      <div className="space-y-0.5 rounded-lg border px-2 py-1.5 text-[10.5px] leading-snug text-ink/70" style={tint}>
        <p className="flex items-center justify-between gap-1 font-semibold" style={{ color }}>
          <span className="truncate">
            {meta.emoji} {t("g.departs", { time: depart })}
          </span>
          <span className="shrink-0 font-mono">{formatMinutes(leg.minutes, t.locale)}</span>
        </p>
        {route ? (
          <>
            <p className="truncate font-medium text-ink/85">
              {route.from.name} ➔ {route.to.name}
            </p>
            <p className="truncate">
              {route.line} · {t("unit.every", { n: route.headwayMinutes })}
            </p>
          </>
        ) : (
          <p className="truncate">{t("g.walkFromHotel", { km })}</p>
        )}
        {link && <p className="truncate pt-0.5">{link}</p>}
      </div>
    );
    if (isPro) return body;
    return (
      <div className="relative">
        <div aria-hidden className="pointer-events-none select-none blur-[3px] saturate-50">
          {body}
        </div>
        <button
          type="button"
          onClick={openUpgradeModal}
          className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg text-[10.5px] font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
        >
          <Lock size={11} /> {t("g.directionsPro")}
        </button>
      </div>
    );
  }

  const facts: [string, string][] = route
    ? [
        [t("g.fDepart"), t("g.departsHotel", { time: depart })],
        [t("g.fBoardAlight"), `${stationLabel(t.locale, leg.mode, route.from.name)} ➔ ${stationLabel(t.locale, leg.mode, route.to.name)}`],
        [t("g.fLine"), `${route.line} · ${lineColorName(t.locale, route.colorName)} · ${t("g.direction", { dir: route.direction })}`],
        [t("g.fFreq"), formatFrequency(route, t.locale)],
        [t("g.fDuration"), `${formatMinutes(leg.minutes, t.locale)} · ${t("unit.stops", { n: route.stops })}`],
        [t("g.fTicket"), leg.cost ? t("g.perPersonPrice", { price: usd(leg.cost) }) : t("common.free")],
      ]
    : [
        [t("g.fDepart"), t("g.departsHotel", { time: depart })],
        [t("mode.walk"), `${formatMinutes(leg.minutes, t.locale)} · ${km} km`],
      ];

  return (
    <div className="print-break-avoid rounded-xl border p-3 text-xs" style={tint}>
      <p className="flex items-center gap-1.5 font-semibold" style={{ color }}>
        {t("g.stripTitle")}
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {facts.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-ink/50">{k}</dt>
            <dd className="font-medium text-ink/85">{v}</dd>
          </Fragment>
        ))}
      </dl>
      <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-ink/75">
        {legSteps(leg, place, t.locale).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {link && <p className="mt-2">{link}</p>}
    </div>
  );
}

/** Izgara hücresindeki tıklanabilir renkli blok */
function SlotCard({
  item,
  hotel,
  destination,
  origin,
  onOpen,
}: {
  item: ItineraryItem;
  hotel?: Hotel;
  destination: Airport;
  origin: Airport;
  onOpen: () => void;
}) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const travelers = useTripStore((s) => s.travelers);
  const v = itemVisual(item, destination, origin, travelers, t);
  const Icon = v.icon;

  let footer: React.ReactNode = null;
  if (item.kind === "place") {
    const { place, leg } = item;
    const meta = leg ? TRANSIT_MODE_META[leg.mode] : null;
    footer = (
      <>
        <span className="font-mono font-semibold text-ink/80">{place.estimatedCost ? `~${usd(place.estimatedCost)}` : t("common.free")}</span>
        {meta && leg && (
          <span className="flex items-center gap-1 truncate" style={{ color: meta.color }}>
            {meta.emoji} {t(`mode.${leg.mode}`)}
            {isPro ? ` · ${formatMinutes(leg.minutes, t.locale)}` : ""}
          </span>
        )}
      </>
    );
  } else if (item.kind === "transfer") {
    footer = (
      <>
        <span className="font-mono font-semibold text-ink/80">{usd(item.transfer.cost)}</span>
        <span className="truncate text-ink/55">{t("common.perPerson")}</span>
      </>
    );
  } else if (item.kind === "checkin") {
    footer = <span className="truncate text-ink/55">{t(`tier.${item.hotel.tier}.short`)}</span>;
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="group space-y-1.5 rounded-xl border border-ink/10 border-l-[3px] p-2.5 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeftColor: v.color, background: `color-mix(in srgb, ${v.color} 9%, var(--surface))` }}
    >
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1.5 text-left active:scale-[0.98]">
        <span className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-[0.1em]" style={{ color: v.color }}>
            <Icon size={11} /> {v.kicker}
          </span>
          <span className={cn("rounded-full px-1.5 py-px font-mono font-semibold tabular-nums text-white shadow-sm", SLOT_THEME[item.slot].badge)}>
            {item.time}
          </span>
        </span>
        <span className="flex items-start gap-2">
          {item.kind === "place" && <PlaceThumb place={item.place} className="h-10 w-10 rounded-lg" />}
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[13px] font-semibold leading-snug text-ink", item.kind === "free" ? "line-clamp-3 font-normal text-ink/75" : "line-clamp-2")}>
              {v.title}
            </span>
            {v.subtitle && <span className="mt-0.5 block truncate text-[11px] text-ink/50">{v.subtitle}</span>}
          </span>
        </span>
        {footer && <span className="flex items-center justify-between gap-2 text-[11px]">{footer}</span>}
      </button>
      {item.kind === "place" && item.leg && (
        <TransitStrip leg={item.leg} place={item.place} hotel={hotel} arrival={item.time} variant="cell" />
      )}
    </motion.div>
  );
}

/** Detay penceresi: hücreye tıklayınca mekan hikayesi / ulaşım / maliyet */
function ItemDetailModal({
  item,
  day,
  destination,
  origin,
  onClose,
}: {
  item: ItineraryItem | null;
  day: ItineraryDay | null;
  destination: Airport;
  origin: Airport;
  onClose: () => void;
}) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const travelers = useTripStore((s) => s.travelers);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const v = item ? itemVisual(item, destination, origin, travelers, t) : null;

  let body: React.ReactNode = null;
  if (item) {
    switch (item.kind) {
      case "place": {
        const { place, leg } = item;
        const legInfo = leg && (
          <TransitStrip leg={leg} place={place} hotel={day?.hotel} arrival={item.time} variant="full" />
        );
        body = (
          <>
            <p className="text-sm leading-relaxed text-ink/75">{place.story}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink/45">{t("g.estCost")}</p>
                <p className="font-mono text-base font-semibold text-ink">
                  {place.estimatedCost ? usd(place.estimatedCost) : t("common.free")}
                </p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink/45">{t("g.recDuration")}</p>
                <p className="font-mono text-base font-semibold text-ink">
                  {t("unit.hours", { n: place.recommendedDuration.toLocaleString(intlLocale(t.locale)) })}
                </p>
              </div>
            </div>
            {legInfo && (isPro ? legInfo : <ProLock label={t("g.stationsPro")}>{legInfo}</ProLock>)}
            {place.mustDo &&
              (isPro ? (
                <p className="flex gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-ink/75">
                  <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>
                    <b className="text-amber-700 dark:text-amber-300">{t("itin.localTip")} </b>
                    {place.mustDo}
                  </span>
                </p>
              ) : (
                <ProLock label={t("g.tipPro")}>
                  <p className="rounded-xl border border-amber-500/25 px-3 py-2 text-xs">{place.mustDo}</p>
                </ProLock>
              ))}
            <a
              {...EXTERNAL}
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(place.wikiTitle)}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("g.readWiki")} <ExternalLink size={11} />
            </a>
          </>
        );
        break;
      }
      case "arrival":
        body = (
          <p className="text-sm leading-relaxed text-ink/75">
            {t("itin.arrivalDetail", { airport: destination.airportName, code: destination.code })}{" "}
            {item.flight
              ? t("itin.arrivalLocal", {
                  flight: `${item.flight.airline} ${item.flight.flightNumber}`,
                  time: item.flight.arrivalTime,
                })
              : ""}{" "}
            {t("itin.arrivalRest")}
          </p>
        );
        break;
      case "checkin":
        body = (
          <p className="text-sm leading-relaxed text-ink/75">
            {item.hotel.name} · {areaLabel(t.locale, item.hotel.area)}. {t(`tier.${item.hotel.tier}`)} · ⭐ {item.hotel.rating}/10 ·{" "}
            {usd(hotelNightlyFor(item.hotel, travelers))}
            {t("unit.perNight")}. {item.hotel.highlights.join(" · ")}
          </p>
        );
        break;
      case "transfer":
        body = (
          <p className="text-sm leading-relaxed text-ink/75">
            {transferName(t.locale, item.transfer.name)}: {city(item.transfer.from, t.locale)} ➔{" "}
            {city(item.transfer.to, t.locale)} · {formatMinutes(item.transfer.minutes, t.locale)} · {t("common.perPerson")}{" "}
            {usd(item.transfer.cost)}. {item.transfer.isReturn ? t("itin.transferReturn") : t("itin.transferForward")}
          </p>
        );
        break;
      case "free":
        body = <p className="text-sm leading-relaxed text-ink/75">{freeNoteText(t, item)}</p>;
        break;
      case "departure":
        body = (
          <p className="text-sm leading-relaxed text-ink/75">
            {t("itin.departureDetail", { from: destination.code, to: origin.code })}
          </p>
        );
        break;
    }
  }

  return createPortal(
    <AnimatePresence>
      {item && v && (
        <motion.div
          key="timetable-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[2000] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={v.title}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl"
          >
            {item.kind === "place" ? (
              <div className="relative h-48">
                <PlaceThumb place={item.place} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            ) : (
              <div className="h-2" style={{ background: v.color }} />
            )}
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: v.color }}>
                    <v.icon size={12} /> {v.kicker}
                    {day && (
                      <span className="font-normal normal-case tracking-normal text-ink/50">
                        · {t("unit.dayN", { n: day.day })} ({city(day.city, t.locale)}) · {item.time}
                      </span>
                    )}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-ink">{v.title.length > 80 ? v.kicker : v.title}</h3>
                  {v.subtitle && <p className="text-sm text-ink/55">{v.subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("common.close")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl glass-secondary text-ink/60 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
              {body}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Haftalık ders programı: sütunlar = günler, satırlar = 4 zaman dilimi */
function TimetableGrid({
  plan,
  itinerary,
  destination,
  origin,
}: {
  plan: TripPlan;
  itinerary: ItineraryDay[];
  destination: Airport;
  origin: Airport;
}) {
  const t = useT();
  const [open, setOpen] = useState<{ day: number; index: number } | null>(null);
  const openDay = open ? itinerary.find((d) => d.day === open.day) ?? null : null;
  const openItem = openDay && open ? openDay.items[open.index] ?? null : null;
  const close = useCallback(() => setOpen(null), []);

  const cityColor = (city: string) =>
    CITY_COLORS[Math.max(0, plan.cities.findIndex((c) => c.city === city)) % CITY_COLORS.length];

  const LABEL_COL = 156;
  const DAY_COL = 216;

  return (
    <section className="card overflow-hidden rounded-3xl print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <SectionTitle icon={CalendarDays}>{t("g.weekly")}</SectionTitle>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-ink/55">
          {plan.cities.map((c) => (
            <span key={c.city} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cityColor(c.city) }} />
              {city(c.city, t.locale)} · {t("unit.days", { n: c.days })}
            </span>
          ))}
          <span className="text-ink/40">{t("g.clickHint")}</span>
          <span className="text-ink/40 lg:hidden">{t("g.scrollHint")}</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          className="grid gap-2 px-5"
          style={{
            gridTemplateColumns: `${LABEL_COL}px repeat(${itinerary.length}, minmax(${DAY_COL}px, 1fr))`,
            minWidth: LABEL_COL + itinerary.length * (DAY_COL + 8) + 40,
          }}
        >
          {/* Başlık satırı: günler */}
          <div className="sticky left-0 z-10 bg-surface/95 backdrop-blur" />
          {itinerary.map((day) => {
            const color = cityColor(day.city);
            const moving = day.items.some((i) => i.kind === "transfer" && !i.transfer.isReturn);
            return (
              <div
                key={day.day}
                className="rounded-xl border-t-4 bg-ink/[0.04] px-3 py-2"
                style={{ borderTopColor: color }}
              >
                <p className="text-sm font-bold text-ink">
                  {t("unit.dayN", { n: day.day })} <span style={{ color }}>({city(day.city, t.locale)})</span>
                </p>
                <p className="flex items-center justify-between gap-2 text-[11px] text-ink/50">
                  <span className="capitalize">{formatDate(day.date, t.locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                  {moving && <span className="rounded-full bg-rose-500/12 px-1.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">🚄 {t("itin.cityChange")}</span>}
                  {day.day === 1 && <span className="rounded-full bg-blue-500/12 px-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">✈️ {t("itin.arrival")}</span>}
                </p>
              </div>
            );
          })}

          {/* Zaman dilimi satırları */}
          {DAY_SLOTS.map((slot) => (
            <Fragment key={slot}>
              <div className="sticky left-0 z-10 flex flex-col justify-center gap-1.5 rounded-xl border border-ink/10 bg-surface/95 px-3 py-2 backdrop-blur">
                <span
                  className={cn(
                    "flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-md",
                    SLOT_THEME[slot].badge,
                  )}
                >
                  {SLOT_META[slot].emoji} {t(`slot.${slot}`)}
                </span>
                <p className="font-mono text-[11px] text-ink/45">{SLOT_META[slot].range}</p>
              </div>
              {itinerary.map((day) => {
                const entries = day.items
                  .map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.slot === slot);
                return (
                  <div
                    key={`${slot}-${day.day}`}
                    className={cn(
                      "min-h-[92px] rounded-xl p-1.5",
                      entries.length
                        ? cn("space-y-1.5", SLOT_THEME[slot].cell)
                        : cn("grid place-items-center border border-dashed", SLOT_THEME[slot].empty),
                    )}
                  >
                    {entries.length === 0 ? (
                      <span className="text-[11px] text-ink/30">{t("itin.freeShort")}</span>
                    ) : (
                      entries.map(({ item, index }) => (
                        <SlotCard
                          key={index}
                          item={item}
                          hotel={day.hotel}
                          destination={destination}
                          origin={origin}
                          onOpen={() => setOpen({ day: day.day, index })}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <ItemDetailModal item={openItem} day={openDay} destination={destination} origin={origin} onClose={close} />
    </section>
  );
}

// ------------------------------------------------------------------ Dil & adres kartları

/** Kartın tam ekran / sesli gösterim verisi */
interface ShowCard {
  id: string;
  /** Kart başlığındaki anlam (arayüz dilinde) */
  meaning: string;
  /** Dev puntoyla gösterilen yerel yazılış */
  local: string;
  pron: string;
  /** Adres kartında yerel ad altındaki satırlar (asıl ad, semt, GPS) */
  details?: string[];
  /** Adres kartında "Lütfen beni bu adrese götürün" cümlesi */
  request?: string;
  emoji: string;
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

/** Şoföre / garsona uzatılan tam ekran kart: yerel yazılış dev puntoyla, okunuş altında */
function FullscreenPhrase({
  card,
  lang,
  langName,
  speechLang,
  onClose,
}: {
  card: ShowCard | null;
  lang: LanguagePack;
  /** Hedef dilin adı, arayüz dilinde */
  langName: string;
  speechLang: string;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  return createPortal(
    <AnimatePresence>
      {card && (
        <motion.div
          key="phrase-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label={card.meaning}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[2100] flex flex-col bg-white text-slate-900 print:hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <p className="text-sm font-semibold text-slate-500">
              {card.emoji} {card.meaning} · {langName}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => speak(card.request ? `${card.request}. ${card.local}` : card.local, speechLang)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t("g.speak")}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 text-center">
            {card.request && (
              <p className="text-[clamp(1.4rem,4.5vw,2.75rem)] font-bold leading-tight" dir={lang.rtl ? "rtl" : undefined}>
                {card.request}
              </p>
            )}
            <p
              className="max-w-[18ch] break-words text-[clamp(2.5rem,9vw,6.5rem)] font-black leading-[1.1] tracking-tight"
              dir={lang.rtl ? "rtl" : undefined}
            >
              {card.local}
            </p>
            {card.details?.map((d) => (
              <p key={d} className="text-lg text-slate-600 md:text-2xl">
                {d}
              </p>
            ))}
            <div className="max-w-3xl rounded-2xl bg-slate-100 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("g.pron")}</p>
              <p className="mt-1 text-xl font-medium italic text-slate-800 md:text-3xl">{card.pron}</p>
            </div>
          </div>
          <p className="pb-4 text-center text-xs text-slate-400">{t("g.handPhone")}</p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PhraseCardView({
  card,
  lang,
  speechLang,
  onShow,
}: {
  card: ShowCard;
  lang: LanguagePack;
  speechLang: string;
  onShow: () => void;
}) {
  const t = useT();
  return (
    <div className="print-break-avoid rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5 print:border-slate-300 print:bg-white">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
        {card.emoji} {card.meaning}
      </p>
      {card.request && (
        <p className="mt-1.5 text-sm font-semibold text-ink/80" dir={lang.rtl ? "rtl" : undefined}>
          {card.request}
        </p>
      )}
      <p className="mt-1 text-lg font-bold leading-snug text-ink" dir={lang.rtl ? "rtl" : undefined}>
        {card.local}
      </p>
      {card.details?.map((d) => (
        <p key={d} className="text-xs text-ink/55">
          {d}
        </p>
      ))}
      <p className="mt-1 text-xs italic text-ink/55">🗣️ {card.pron}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5 print:hidden">
        <button
          type="button"
          onClick={onShow}
          className="flex items-center gap-1 rounded-lg glass-primary px-2.5 py-1.5 text-[11px] font-semibold text-white"
        >
          {t("g.fullscreen")}
        </button>
        <button
          type="button"
          onClick={() => speak(card.request ? `${card.request}. ${card.local}` : card.local, speechLang)}
          aria-label={t("g.speakAria")}
          className="rounded-lg glass-secondary px-2.5 py-1.5 text-[11px] font-semibold text-ink/70 hover:text-ink"
        >
          🔊
        </button>
      </div>
    </div>
  );
}

/**
 * Pro dil kartları (5 sekme): seçilen otel & mekanların yerel dildeki adres kartları + taksi/metro, restoran,
 * alışveriş/tax-free ve acil durum ifadeleri. Ücretsiz: yalnız ilk 2 ifade kartı açık.
 */
function PhraseCards({ plan, langCode, country }: { plan: TripPlan; langCode: LanguageCode; country: string }) {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const lang = LANGUAGES[langCode];
  const langName = languageName(langCode, lang.name, t.locale);
  const book = PHRASE_BOOKS[langCode];
  const [tab, setTab] = useState<PhraseCategory>(isPro ? "address" : "transit");
  const [shown, setShown] = useState<ShowCard | null>(null);
  const closeShown = useCallback(() => setShown(null), []);

  const hotels = plan.cities
    .map((c) => chosenEvaluation(c, recommendedHotels)?.hotel)
    .filter((h): h is Hotel => Boolean(h));
  const places = plan.cities.flatMap((c) => c.places);

  // Mekanların yerel dildeki adları (Wikipedia langlinks; ücretsiz, anahtarsız) — yalnız Pro'da istenir
  const titlesKey = `${langCode}|${places.map((p) => p.wikiTitle).join("|")}`;
  const [localNames, setLocalNames] = useState<{ key: string; names: Record<string, string> }>({ key: "", names: {} });
  useEffect(() => {
    if (!isPro) return;
    let active = true;
    fetchLocalTitles(
      places.map((p) => p.wikiTitle),
      langCode,
    ).then((names) => active && setLocalNames({ key: titlesKey, names }));
    return () => {
      active = false;
    };
    // `places` titlesKey ile birebir değişir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, titlesKey, langCode]);
  const names = localNames.key === titlesKey ? localNames.names : {};

  const addressCards: ShowCard[] = [
    ...hotels.map((h) => ({
      id: `addr-${h.id}`,
      emoji: "🏨",
      meaning: t("g.myHotel", { city: city(h.cityRegion, t.locale) }),
      request: lang.takeMe,
      local: h.name,
      pron: book.takeMePron,
      details: [`${areaLabel(t.locale, h.area)}, ${city(h.cityRegion, t.locale)}, ${country}`, `GPS ${h.coordinates[1].toFixed(5)}, ${h.coordinates[0].toFixed(5)}`],
    })),
    ...places.map((p) => {
      const local = names[p.wikiTitle];
      return {
        id: `addr-${p.id}`,
        emoji: "📍",
        meaning: `${p.name} · ${city(p.cityRegion, t.locale)}`,
        request: lang.takeMe,
        local: local ?? p.name,
        pron: book.takeMePron,
        details: [
          ...(local && local !== p.name ? [p.name] : []),
          `${city(p.cityRegion, t.locale)}, ${country} · GPS ${p.coordinates[1].toFixed(5)}, ${p.coordinates[0].toFixed(5)}`,
        ],
      };
    }),
  ];

  const phraseCards = PHRASE_KEYS.map(({ key, category }, index) => {
    const [local, pron, variant] = book.phrases[key];
    const cat = PHRASE_CATEGORIES.find((c) => c.id === category)!;
    const meaning = t((variant ? `ph.${key}.${variant}` : `ph.${key}`) as TranslationKey);
    return { card: { id: key, emoji: cat.emoji, meaning, local, pron } as ShowCard, category, free: index < 2 };
  });
  const totalCards = addressCards.length + phraseCards.length;

  const renderCard = (card: ShowCard) => (
    <PhraseCardView key={card.id} card={card} lang={lang} speechLang={book.speechLang} onShow={() => setShown(card)} />
  );

  let tabContent: React.ReactNode;
  if (tab === "address") {
    const grid = <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">{addressCards.map(renderCard)}</div>;
    tabContent = isPro ? grid : <ProLock label={t("g.addrLocked", { n: addressCards.length })}>{grid}</ProLock>;
  } else {
    const items = phraseCards.filter((p) => p.category === tab);
    const open = items.filter((p) => isPro || p.free);
    const locked = items.filter((p) => !isPro && !p.free);
    tabContent = (
      <div className="space-y-2.5">
        {open.length > 0 && <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">{open.map((p) => renderCard(p.card))}</div>}
        {locked.length > 0 && (
          <ProLock label={t("g.moreLocked", { n: locked.length })}>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">{locked.map((p) => renderCard(p.card))}</div>
          </ProLock>
        )}
      </div>
    );
  }

  return (
    <section className="card rounded-3xl p-5">
      <SectionTitle
        icon={Languages}
        aside={
          <span className="text-[11px] text-ink/45">
            {langName} · {t("unit.cards", { n: totalCards })}
          </span>
        }
      >
        {t("g.langCards")}
      </SectionTitle>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 print:hidden">
        {PHRASE_CATEGORIES.map((c) => {
          const count = c.id === "address" ? addressCards.length : phraseCards.filter((p) => p.category === c.id).length;
          const active = c.id === tab;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setTab(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                active
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "border-ink/10 text-ink/60 hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              {c.emoji} {t(`pc.${c.id}`)}
              <span className="font-mono text-ink/40">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="print:hidden">{tabContent}</div>

      {/* PDF: tüm kategoriler alt alta (Pro çıktısı) */}
      <div className="hidden space-y-4 print:block">
        {PHRASE_CATEGORIES.map((c) => {
          const cards = c.id === "address" ? addressCards : phraseCards.filter((p) => p.category === c.id).map((p) => p.card);
          return (
            <div key={c.id} className="print-break-avoid">
              <p className="mb-2 text-sm font-bold text-slate-900">
                {c.emoji} {t(`pc.${c.id}`)}
              </p>
              <div className="grid grid-cols-2 gap-2">{cards.map(renderCard)}</div>
            </div>
          );
        })}
      </div>

      <FullscreenPhrase card={shown} lang={lang} langName={langName} speechLang={book.speechLang} onClose={closeShown} />
    </section>
  );
}

// ------------------------------------------------------------------ Adım

function GuideActionBar() {
  const t = useT();
  const isPro = useTripStore((s) => s.isPro);
  const prevStep = useTripStore((s) => s.prevStep);
  const reset = useTripStore((s) => s.reset);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);

  return (
    <div className="flex items-center gap-3 border-t border-ink/10 bg-surface/80 px-4 py-3 backdrop-blur md:px-8 print:hidden">
      <button
        type="button"
        onClick={prevStep}
        className="flex shrink-0 items-center gap-1.5 rounded-xl glass-secondary px-3 py-3 text-sm text-ink/70 hover:text-ink"
      >
        <ArrowLeft size={15} />
        <span className="hidden sm:inline">{t("guide.back")}</span>
      </button>
      <p className="min-w-0 flex-1 truncate text-xs text-ink/55 sm:text-sm">
        {isPro ? t("guide.proOn") : t("guide.free")}
      </p>
      <button
        type="button"
        onClick={reset}
        className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink"
      >
        <RotateCcw size={15} />
        <span className="hidden sm:inline">{t("guide.newTrip")}</span>
      </button>
      {isPro ? (
        <button
          type="button"
          onClick={printGuide}
          className="flex shrink-0 items-center gap-2 rounded-xl glass-primary px-5 py-3 text-sm font-semibold text-white"
        >
          <Printer size={16} />
          <span className="hidden md:inline">{t("guide.pdf")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openUpgradeModal}
          title={t("guide.pdfLockedTitle")}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
        >
          🔒<span className="hidden md:inline">{t("guide.pdfLocked")}</span>
        </button>
      )}
    </div>
  );
}

/** Adım 4: Kişisel tur rehberi — üst özet, bütçe kırılımı, gün gün plan, dil kartları ve yazdırılabilir çıktı */
export default function FinalGuideStep({ origin, destination }: TripRoute) {
  const t = useT();
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const departureDate = useTripStore((s) => s.departureDate);
  const isPro = useTripStore((s) => s.isPro);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);
  const setStep = useTripStore((s) => s.setStep);

  const plan = useMemo(() => buildTripPlan(selectedPlaces, destination), [selectedPlaces, destination]);
  const itinerary = useMemo(
    () => buildItinerary(plan, recommendedHotels, selectedFlight, departureDate),
    [plan, recommendedHotels, selectedFlight, departureDate],
  );
  const { categories, total } = useBudgetCategories(plan);
  const profile = getDestinationProfile(destination);

  const motionProps = STEP_TRANSITION;

  if (plan.cities.length === 0) {
    return (
      <motion.div {...motionProps} className="absolute inset-0 grid place-items-center p-4">
        <div className="card max-w-md rounded-3xl p-8 text-center">
          <MapPin size={28} className="mx-auto text-blue-500" />
          <h1 className="mt-3 text-xl font-bold text-ink">{t("g.needPlaces")}</h1>
          <p className="mt-2 text-sm text-ink/60">{t("g.needPlacesText")}</p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-5 rounded-xl glass-primary px-5 py-3 text-sm font-semibold text-white"
          >
            {t("g.discover")}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...motionProps} className={cn("print-guide absolute inset-0 flex flex-col print:static", !isPro && "print-locked")}>
      {/* Ücretsiz planda Ctrl+P ile de rehber basılmaz (globals.css `.print-locked`) */}
      <div className="print-lock-note hidden p-10 text-center text-slate-900">
        <p className="text-2xl font-bold">{t("g.printLockTitle")}</p>
        <p className="mt-3 text-sm text-slate-600">{t("g.printLockText")}</p>
      </div>
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:space-y-4 print:p-0">
          {/* PDF 1. sayfa (kapak & finansal özet): başlık + hero + uçuş + oteller + bütçe; ardından sayfa sonu */}
          <div className="print-cover space-y-6 print:space-y-3">
            <div className="hidden border-b border-slate-300 pb-2 print:flex print:items-end print:justify-between">
              <p className="text-lg font-bold text-slate-900">{t("g.printHeader")}</p>
              <p className="text-xs text-slate-500">
                {cityName(origin, t.locale)} ➔ {countryName(destination, t.locale)} ·{" "}
                {t("g.created", { date: new Date().toLocaleDateString(intlLocale(t.locale)) })}
              </p>
            </div>

            <GuideHero plan={plan} itinerary={itinerary} destination={destination} total={total} />

            {/* Yalnız çıktıda: ekranda bu kartlar alttaki ızgarada */}
            <div className="hidden print:block print:space-y-3">
              <div className="print-cover-row">
                <FlightSummary flight={selectedFlight} />
                <HotelsSummary plan={plan} />
              </div>
              <BudgetTable categories={categories} total={total} days={plan.totalDays} />
            </div>
          </div>

          <BookingLinks plan={plan} itinerary={itinerary} origin={origin} destination={destination} />

          {!isPro && (
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-5 py-4 sm:flex-row sm:items-center print:hidden">
              <p className="text-sm text-ink/75">
                <b className="text-ink">{t("g.freeBannerB")}</b> {t("g.freeBannerText")}
              </p>
              <button
                type="button"
                onClick={openUpgradeModal}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                <Crown size={15} /> {t("g.goPro")}
              </button>
            </div>
          )}

          {/* Ekranda: haftalık ders programı ızgarası */}
          <TimetableGrid plan={plan} itinerary={itinerary} destination={destination} origin={origin} />

          {/* Çıktıda (PDF): her gün kendi A4 sayfasında — geniş ızgara A4'e sığmaz */}
          <div className="print-timetable hidden print:block">
            {itinerary.map((day) => (
              <DayCard key={day.day} day={day} destination={destination} origin={origin} />
            ))}
          </div>

          {/* Bütçe, uçuş, otel, harita, dil kartları */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 print:block print:space-y-4">
            {/* Çıktıda bu üçü kapak sayfasında basılır */}
            <div className="min-w-0 print:hidden">
              <BudgetTable categories={categories} total={total} days={plan.totalDays} />
            </div>
            {/* Orta sütun: harita üstte, altında uçuş + konaklama (bütçe kartıyla boy dengesi) */}
            <div className="min-w-0 space-y-4 print:hidden">
              <section className="card overflow-hidden rounded-3xl">
                <div className="px-5 pt-5">
                  <SectionTitle
                    icon={MapPin}
                    aside={!isPro && <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><Lock size={11} /> {t("g.linesPro")}</span>}
                  >
                    {t("g.mapTitle")}
                  </SectionTitle>
                </div>
                <WorldMap mode="hotel" className="h-[360px] w-full sm:h-[420px] lg:h-80" />
              </section>
              <div className="space-y-4 pt-2">
                <FlightSummary flight={selectedFlight} />
                <HotelsSummary plan={plan} />
              </div>
            </div>
            <div className="print-appendix min-w-0 space-y-4">
              <PhraseCards plan={plan} langCode={profile.language} country={countryName(destination, t.locale)} />
            </div>
          </div>

          <p className="pb-2 text-center text-[10px] text-ink/35">
            {t("g.footer")}
          </p>
        </div>
      </div>

      <GuideActionBar />
    </motion.div>
  );
}
