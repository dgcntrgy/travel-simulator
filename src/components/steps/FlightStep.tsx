"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Luggage,
  MapPin,
  Minus,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Users,
} from "lucide-react";
import WorldMap from "@/components/map/WorldMap";
import { ALL_AIRPORTS } from "@/data/airports";
import { getFlights } from "@/data/mockFlights";
import { verificationLinks } from "@/lib/flightCampaigns";
import CitySelectDropdown from "@/components/ui/CitySelectDropdown";
import { getDestinationProfile, matchesDestination } from "@/lib/globalDiscovery";
import {
  cityName,
  countryName,
  formatDurationLocale,
  translateTag,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import { useT } from "@/lib/useI18n";
import { useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Airport, Flight, FlightPriceSource, FlightType } from "@/types/trip";
import { riseIn, SLIDE_FROM_LEFT, SLIDE_FROM_RIGHT, SPRING_IN, STEP_TRANSITION } from "@/lib/motion";

type Filter = "all" | FlightType;

const FILTERS: { id: Filter; label: TranslationKey }[] = [
  { id: "all", label: "common.all" },
  { id: "direct", label: "flight.filterDirect" },
  { id: "layover", label: "flight.filterLayover" },
];

/** Direkt = camgöbeği, aktarmalı = amber; iki temada okunur tonlar */
const TYPE_BADGE: Record<FlightType, string> = {
  direct: "bg-blue-500/12 text-blue-700 dark:text-blue-200",
  layover: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
};

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIso() {
  return localIso(new Date());
}

/** Havayolları tarifeleri en fazla 1 yıl (365 gün) ileriye açar */
function maxDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 365);
  return localIso(d);
}

/** ISO tarihi [bugün, +365 gün] aralığına sabitler (ISO dizgeleri sözlük sırasıyla karşılaştırılabilir) */
function clampDate(value: string): string {
  const min = todayIso();
  const max = maxDateIso();
  return value < min ? min : value > max ? max : value;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">{children}</p>;
}

/** Uçuş süresi barı: uçak ikonu ortada, aktarma noktası bar üzerinde işaretli */
function DurationBar({ flight, selected }: { flight: Flight; selected: boolean }) {
  const t = useT();
  const dur = (m: number) => formatDurationLocale(t.locale, m);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1">
      <span className="flex items-center gap-1 font-mono text-[10px] text-ink/50">
        <Clock size={10} /> {dur(flight.totalDurationMinutes)}
      </span>
      <span className="relative flex h-5 w-full items-center">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
        <span className="h-px flex-1 border-t border-dashed border-ink/25" />
        <span
          className={cn(
            "mx-1 grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors",
            selected ? "bg-amber-400 text-amber-950" : "bg-blue-500/15 text-blue-600 dark:text-blue-300",
          )}
        >
          <Plane size={13} className="rotate-45" />
        </span>
        <span className="h-px flex-1 border-t border-dashed border-ink/25" />
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
      </span>
      <span
        className={cn(
          "max-w-full truncate rounded-full px-1.5 py-px text-[10px] font-semibold",
          flight.layover ? "border border-amber-500/40 text-amber-700 dark:text-amber-200" : "text-blue-700 dark:text-blue-300",
        )}
      >
        {flight.layover
          ? t("flight.layover", { code: flight.layover.airport.code, dur: dur(flight.layover.durationMinutes) })
          : t("flight.direct")}
      </span>
    </div>
  );
}

/** Tohumdan deterministik çubuk genişlikleri (1–3 px) */
function barcodeWidths(seed: string, count = 26): number[] {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    widths.push(1 + ((h >>> 16) % 3));
  }
  return widths;
}

/** Uçuş kimliğinden türetilen dekoratif barkod */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barcodeWidths(seed), [seed]);
  return (
    <span aria-hidden className="flex h-7 items-stretch gap-[2px] opacity-70">
      {bars.map((w, i) => (
        <span key={i} className="bg-ink" style={{ width: w }} />
      ))}
    </span>
  );
}

/** Bilet çentiği: kartın üst/alt kenarında, koçan birleşim yerinde yarım daire */
function Notch({ side }: { side: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute right-[var(--stub)] z-10 h-5 w-5 translate-x-1/2 rounded-full border border-[var(--card-border)] bg-canvas",
        side === "top" ? "-top-2.5" : "-bottom-2.5",
      )}
    />
  );
}

/** Dijital biniş kartı (boarding pass): sol ana bölüm + kesikli çizgiyle ayrılan fiyat/barkod koçanı */
function FlightCard({
  flight,
  passengers,
  selected,
  cheapest,
  onSelect,
  index,
  departureDate,
}: {
  flight: Flight;
  passengers: number;
  selected: boolean;
  cheapest: boolean;
  onSelect: () => void;
  /** Liste sırası: kartlar dalga halinde sırayla gelir */
  index: number;
  departureDate: string;
}) {
  const t = useT();
  const campaign = flight.campaign;
  return (
    <motion.div layout {...riseIn(index)} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}>
      <motion.button
        type="button"
        onClick={onSelect}
        whileHover={{ y: -3, transition: SPRING_IN }}
        whileTap={{ scale: 0.99 }}
        aria-pressed={selected}
        style={{ "--stub": "7.25rem" } as React.CSSProperties}
        className={cn(
          "card group relative flex w-full overflow-hidden rounded-2xl text-left backdrop-blur-xl transition-[border-color,box-shadow]",
          selected
            ? "border-amber-400/80! shadow-[0_0_32px_-6px_rgba(251,191,36,0.6)]! ring-2 ring-amber-400/70"
            : "hover:border-ink/25!",
        )}
      >
        <Notch side="top" />
        <Notch side="bottom" />

        {/* Ana bölüm */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold",
                  TYPE_BADGE[flight.type],
                )}
              >
                {flight.airlineCode}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-ink">{flight.airline}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                  {t("flight.boardingPass")} · {flight.flightNumber}
                </p>
              </div>
            </div>
            {campaign ? (
              <span className="campaign-badge flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <Flame size={11} /> {t("flight.deal", { n: campaign.discountPercent })}
              </span>
            ) : (
              cheapest && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                  {t("flight.cheapest")}
                </span>
              )
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="leading-tight">
              <p className="font-mono text-2xl font-black tracking-tight text-ink sm:text-3xl">{flight.origin.code}</p>
              <p className="max-w-[6.5rem] truncate text-[11px] text-ink/50">{cityName(flight.origin, t.locale)}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-ink/80">{flight.departureTime}</p>
            </div>
            <DurationBar flight={flight} selected={selected} />
            <div className="text-right leading-tight">
              <p className="font-mono text-2xl font-black tracking-tight text-ink sm:text-3xl">{flight.destination.code}</p>
              <p className="ml-auto max-w-[6.5rem] truncate text-[11px] text-ink/50">{cityName(flight.destination, t.locale)}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-ink/80">
                {flight.arrivalTime}
                {flight.arrivalDayOffset > 0 && (
                  <sup className="ml-0.5 text-[10px] text-amber-600 dark:text-amber-200">+{flight.arrivalDayOffset}</sup>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {flight.tags
              .filter((tag) => tag !== "En uygun" && tag !== "Kesintisiz")
              .map((tag) => (
                <span key={tag} className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] text-ink/60">
                  {translateTag(t.locale, tag)}
                </span>
              ))}
            <span className="ml-auto flex items-center gap-1 text-[10px] text-ink/45">
              <Luggage size={11} /> {flight.checkedBaggageKg}kg
            </span>
          </div>

          {campaign && (
            <p className="mt-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-[11px] font-medium text-orange-800 dark:text-orange-200">
              {t("flight.dealStrip", {
                avg: usd(campaign.originalPrice * passengers),
                price: usd(flight.price * passengers),
                n: campaign.discountPercent,
                source: SOURCE_NAME[campaign.verifiedBy],
              })}
            </p>
          )}
        </div>

        {/* Koçan: kesikli ayırıcı + fiyat + barkod */}
        <div
          className={cn(
            "relative flex w-[var(--stub)] shrink-0 flex-col items-center justify-between gap-2 border-l-2 border-dashed border-ink/15 px-2 py-4 text-center transition-colors",
            selected ? "bg-amber-400/10" : "bg-ink/[0.02]",
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
              <Check size={10} strokeWidth={3} /> {t("flight.selected")}
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/40">{t("flight.economy")}</span>
          )}
          <div className="leading-tight">
            {campaign && (
              <p className="font-mono text-[11px] tabular-nums text-ink/45 line-through">
                {usd(campaign.originalPrice * passengers)}
              </p>
            )}
            <p
              className={cn(
                "font-mono text-xl font-bold tabular-nums",
                campaign ? "text-orange-600 dark:text-orange-300" : "text-ink",
              )}
            >
              {usd(flight.price * passengers)}
            </p>
            <p className="text-[9px] text-ink/45">
              {passengers > 1
                ? t("flight.paxTotal", { n: passengers, price: usd(flight.price) })
                : t("flight.onePax")}
            </p>
          </div>
          <Barcode seed={flight.id} />
        </div>
      </motion.button>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <VerifyBar flight={flight} passengers={passengers} departureDate={departureDate} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const SOURCE_NAME: Record<Exclude<FlightPriceSource, "simulation">, string> = {
  travelpayouts: "Travelpayouts",
  amadeus: "Amadeus",
};

/** Google Flights arayüz dili (hl) */
const GOOGLE_HL: Record<Locale, string> = { tr: "tr", en: "en", de: "de", fr: "fr", ja: "ja", zh: "zh-CN" };

/** Seçili kartın altında açılan bar: rota/tarih/yolcu gömülü Google Flights & Skyscanner aramaları */
function VerifyBar({ flight, passengers, departureDate }: { flight: Flight; passengers: number; departureDate: string }) {
  const t = useT();
  const links = verificationLinks(flight.origin.code, flight.destination.code, departureDate, passengers, GOOGLE_HL[t.locale]);
  const linkClass =
    "flex items-center gap-1.5 rounded-lg glass-secondary px-3 py-1.5 text-xs font-semibold text-ink/80 hover:text-ink";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2.5">
      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-200">
        <Globe size={14} className="shrink-0" /> {t("flight.verify")}
      </p>
      <a href={links.google} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Google Flights <ExternalLink size={12} />
      </a>
      <a href={links.skyscanner} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Skyscanner <ExternalLink size={12} />
      </a>
    </div>
  );
}

const SOURCE_LABEL: Record<FlightPriceSource, TranslationKey> = {
  travelpayouts: "flight.srcTravelpayouts",
  amadeus: "flight.srcAmadeus",
  simulation: "flight.srcSimulation",
};

/** Alt CTA: seçili uçuş özeti + "Adım 2'ye Geç" */
function FlightActionBar() {
  const t = useT();
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const prevStep = useTripStore((s) => s.prevStep);
  const nextStep = useTripStore((s) => s.nextStep);
  const ready = selectedFlight !== null;

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur lg:static lg:bg-surface/80 md:px-8">
      <button
        type="button"
        onClick={prevStep}
        aria-label={t("nav.home")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl glass-secondary text-ink/70 hover:text-ink"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {selectedFlight ? (
            <motion.div
              key={selectedFlight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 truncate text-sm text-ink"
            >
              <Plane size={14} className="shrink-0 text-blue-600 dark:text-blue-300" />
              <span className="truncate">
                <b>{selectedFlight.airline}</b>
                <span className="text-ink/50">
                  {" · "}
                  {selectedFlight.type === "direct"
                    ? t("flight.direct")
                    : t("flight.via", { code: selectedFlight.layover?.airport.code ?? "" })}
                  {" · "}
                  {formatDurationLocale(t.locale, selectedFlight.totalDurationMinutes)}
                </span>
              </span>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="truncate text-sm text-ink/50"
            >
              {t("flight.pickOne")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

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
        <span className="hidden sm:inline">{t("flight.next")}</span>
        <span className="sm:hidden">{t("nav.continue")}</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

/** Kalkış/varış aynı şehirde mi? (IST↔SAW, LHR↔LHR) — bu çiftte uçuş yok */
const sameCity = (a: Airport | null, b: Airport) => !!a && (a.code === b.code || a.city === b.city);

/** Varış satırlarının alt metni: ülke · (kürasyonlu profilde) öne çıkan şehirler */
const destinationSubtitle = (d: Airport, locale: Locale) =>
  [
    countryName(d, locale),
    ...getDestinationProfile(d)
      .cities.map((c) => c.name)
      .filter((n) => n !== d.city),
  ].join(" · ");

/** Numaralı seçim bölümü başlığı ("1 · Nereden kalkıyorsun?") */
function PickerHeading({ icon: Icon, title, tone }: {
  icon: typeof PlaneTakeoff;
  title: string;
  tone: "violet" | "cyan";
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "violet"
            ? "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300"
            : "bg-blue-500/12 text-blue-600 dark:text-blue-300",
        )}
      >
        <Icon size={17} />
      </span>
      <h2 className="text-lg font-bold leading-tight text-ink">{title}</h2>
    </div>
  );
}

/** Adım 1: Sol %45 kalkış + varış + uçuş seçimi, sağ %55 düz 2D dünya haritası */
export default function FlightStep() {
  const t = useT();
  const origin = useTripStore((s) => s.origin);
  const destination = useTripStore((s) => s.destination);
  const departureDate = useTripStore((s) => s.departureDate);
  const travelers = useTripStore((s) => s.travelers);
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const setOrigin = useTripStore((s) => s.setOrigin);
  const setDestination = useTripStore((s) => s.setDestination);
  const setDepartureDate = useTripStore((s) => s.setDepartureDate);
  const setTravelers = useTripStore((s) => s.setTravelers);
  const selectFlight = useTripStore((s) => s.selectFlight);

  const [filter, setFilter] = useState<Filter>("all");
  // Elle yazılan tarih: yıl yazılırken ("0002-…") ara değerler taslakta kalır, tam yılda sabitlenip kaydedilir
  const [dateDraft, setDateDraft] = useState(departureDate);
  // Store tarihi dışarıdan değişince taslağı render sırasında eşitle (effect içinde setState yerine)
  const [draftSource, setDraftSource] = useState(departureDate);
  if (draftSource !== departureDate) {
    setDraftSource(departureDate);
    setDateDraft(departureDate);
  }

  // Kalıcı/eski bir tarih aralık dışındaysa düzelt
  useEffect(() => {
    const clamped = clampDate(departureDate);
    if (clamped !== departureDate) setDepartureDate(clamped);
  }, [departureDate, setDepartureDate]);

  const commitDate = (value: string) => {
    const clamped = clampDate(value);
    setDateDraft(clamped);
    if (clamped !== departureDate) setDepartureDate(clamped);
  };

  // Anında yerel simülasyon (kampanya rozeti YOK), ardından /api/flights canlı sonucu üzerine yazar;
  // rozet yalnızca canlı veride piyasa ortalamasının ≥%15 altında doğrulanmış fırsat varsa gelir
  const routeKey = origin && destination ? `${origin.code}-${destination.code}-${departureDate}` : "";
  const localFlights = useMemo(
    () => (origin && destination ? getFlights(origin, destination, departureDate) : []),
    [origin, destination, departureDate],
  );
  const [live, setLive] = useState<{ key: string; flights: Flight[]; source: FlightPriceSource } | null>(null);
  useEffect(() => {
    if (!origin || !destination) return;
    const key = `${origin.code}-${destination.code}-${departureDate}`;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      date: departureDate,
      passengers: String(travelers),
    });
    fetch(`/api/flights?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { flights: Flight[]; source: FlightPriceSource } | null) => {
        if (d) setLive({ key, flights: d.flights, source: d.source });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [origin, destination, departureDate, travelers]);

  const liveHit = live?.key === routeKey ? live : null;
  const flights = useMemo(
    () => [...(liveHit?.flights ?? localFlights)].sort((a, b) => a.price - b.price),
    [liveHit, localFlights],
  );
  const priceSource: FlightPriceSource = liveHit?.source ?? "simulation";

  // Canlı fiyat geldiğinde seçili uçuşun fiyat/kampanyasını güncel tut (bütçe doğru kalsın)
  useEffect(() => {
    if (!selectedFlight) return;
    const fresh = flights.find((f) => f.id === selectedFlight.id);
    if (fresh && (fresh.price !== selectedFlight.price || !!fresh.campaign !== !!selectedFlight.campaign)) {
      selectFlight(fresh);
    }
  }, [flights, selectedFlight, selectFlight]);
  const visible = filter === "all" ? flights : flights.filter((f) => f.type === filter);
  const cheapestId = flights[0]?.id;
  const directCount = flights.filter((f) => f.type === "direct").length;

  // Dünyadaki her havalimanı hem kalkış hem varış olabilir
  const canSwap = !!origin && !!destination;
  const swap = () => {
    if (!origin || !destination || !canSwap) return;
    const from = origin;
    setOrigin(destination);
    setDestination(from);
  };

  const inputBox =
    "flex items-center gap-2.5 rounded-xl border border-ink/10 bg-surface px-3 py-2.5 focus-within:border-blue-500/60";

  return (
    <motion.div
      {...STEP_TRANSITION}
      className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden lg:grid lg:grid-cols-[45fr_55fr] lg:overflow-hidden"
    >
      {/* Sol: seçim alanı */}
      <motion.section {...SLIDE_FROM_LEFT} className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="lg:flex-1 lg:overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-7 px-4 py-6 md:px-8 md:py-8">
            <header>
              <h1 className="text-2xl font-bold text-ink md:text-3xl">{t("flight.title")}</h1>
            </header>

            {/* 1.1 Kalkış */}
            <div>
              <PickerHeading
                icon={PlaneTakeoff}
                title={t("flight.fromTitle")}
                tone="violet"
              />
              <div className="card rounded-2xl p-1">
                <CitySelectDropdown
                  label={t("flight.fromLabel")}
                  icon={PlaneTakeoff}
                  value={origin}
                  options={ALL_AIRPORTS}
                  isDisabled={(a) => sameCity(destination, a)}
                  disabledHint={t("dd.sameAsDestination")}
                  getSubtitle={(a) => `${a.airportName} · ${countryName(a, t.locale)}`}
                  onChange={setOrigin}
                />
              </div>
            </div>

            {/* 1.2 Varış */}
            <div className={cn(!origin && "opacity-90")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <PickerHeading
                    icon={PlaneLanding}
                    title={t("flight.toTitle")}
                    tone="cyan"
                  />
                </div>
                {canSwap && (
                  <button
                    type="button"
                    onClick={swap}
                    title={t("flight.swap")}
                    aria-label={t("flight.swap")}
                    className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl glass-secondary text-ink/60 hover:text-ink"
                  >
                    <ArrowRightLeft size={15} />
                  </button>
                )}
              </div>
              <div className="card rounded-2xl p-1">
                <CitySelectDropdown
                  label={t("flight.toLabel")}
                  icon={PlaneLanding}
                  value={destination}
                  options={ALL_AIRPORTS}
                  isDisabled={(a) => sameCity(origin, a)}
                  disabledHint={t("dd.sameAsOrigin")}
                  getSubtitle={(a) => destinationSubtitle(a, t.locale)}
                  matches={matchesDestination}
                  onChange={setDestination}
                />
              </div>
            </div>

            {/* Tarih, yolcu */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <SectionLabel>{t("flight.date")}</SectionLabel>
                <label className={inputBox}>
                  <CalendarDays size={16} className="shrink-0 text-blue-600 dark:text-blue-300" />
                  <input
                    type="date"
                    value={dateDraft}
                    min={todayIso()}
                    max={maxDateIso()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateDraft(v);
                      if (v && Number(v.slice(0, 4)) >= 1000) commitDate(v);
                    }}
                    onBlur={(e) => commitDate(e.target.value || departureDate)}
                    className="w-full bg-transparent text-sm text-ink outline-none"
                  />
                </label>
              </div>
              <div>
                <SectionLabel>{t("flight.pax")}</SectionLabel>
                <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-surface px-1.5 py-1.5">
                  <button
                    type="button"
                    aria-label={t("flight.paxDec")}
                    onClick={() => setTravelers(travelers - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink/70 hover:bg-ink/[0.07]"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex w-9 items-center justify-center gap-1 font-mono text-sm text-ink">
                    <Users size={12} className="text-ink/50" />
                    {travelers}
                  </span>
                  <button
                    type="button"
                    aria-label={t("flight.paxInc")}
                    onClick={() => setTravelers(travelers + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink/70 hover:bg-ink/[0.07]"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Uçuşlar: sadece kalkış + varış seçilince */}
            {origin && destination ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {origin.code} → {destination.code}
                    <span className="ml-2 font-normal text-ink/50">
                      {t("flight.count", {
                        total: flights.length,
                        direct: directCount,
                        layover: flights.length - directCount,
                      })}
                    </span>
                    {priceSource !== "simulation" && (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                        {t(SOURCE_LABEL[priceSource])}
                      </span>
                    )}
                  </p>
                  <div className="flex rounded-xl bg-ink/[0.06] p-1">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          filter === f.id ? "bg-surface text-ink shadow-sm" : "text-ink/55 hover:text-ink",
                        )}
                      >
                        {t(f.label)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <AnimatePresence mode="popLayout">
                    {visible.map((f, i) => (
                      <FlightCard
                        key={f.id}
                        index={i}
                        flight={f}
                        passengers={travelers}
                        selected={selectedFlight?.id === f.id}
                        cheapest={f.id === cheapestId}
                        departureDate={departureDate}
                        onSelect={() => selectFlight(f)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {visible.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
                    {flights.length === 0
                      ? t("flight.noFlights")
                      : filter === "direct"
                        ? t("flight.noDirect")
                        : t("flight.noLayover")}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/15 p-5 text-sm text-ink/55">
                <MapPin size={18} className="shrink-0 text-blue-600 dark:text-blue-300" />
                {!origin ? t("flight.needOrigin") : t("flight.needDestination")}
              </div>
            )}
          </div>
        </div>

        <FlightActionBar />
      </motion.section>

      {/* Sağ: düz 2D dünya haritası */}
      <motion.section {...SLIDE_FROM_RIGHT} className="order-first h-[360px] w-full shrink-0 px-3 pt-3 sm:h-[420px] sm:px-4 sm:pt-4 lg:order-none lg:h-auto lg:p-4 lg:pl-0">
        <WorldMap mode="flight" className="card h-full w-full rounded-2xl lg:rounded-3xl" />
      </motion.section>
    </motion.div>
  );
}
