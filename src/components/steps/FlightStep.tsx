"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  Check,
  Clock,
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
import { DESTINATIONS, SEARCHABLE_ORIGINS } from "@/data/airports";
import { formatDuration, getFlights } from "@/data/mockFlights";
import CitySelectDropdown from "@/components/ui/CitySelectDropdown";
import { getDestinationProfile, matchesDestination } from "@/lib/globalDiscovery";
import { useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Airport, Flight, FlightType } from "@/types/trip";
import { riseIn, SLIDE_FROM_LEFT, SLIDE_FROM_RIGHT, SPRING_IN, STEP_TRANSITION } from "@/lib/motion";

type Filter = "all" | FlightType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "direct", label: "Direkt" },
  { id: "layover", label: "Aktarmalı" },
];

/** Direkt = camgöbeği, aktarmalı = amber; iki temada okunur tonlar */
const TYPE_BADGE: Record<FlightType, string> = {
  direct: "bg-blue-500/12 text-blue-700 dark:text-blue-200",
  layover: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">{children}</p>;
}

/** Uçuş süresi barı: uçak ikonu ortada, aktarma noktası bar üzerinde işaretli */
function DurationBar({ flight, selected }: { flight: Flight; selected: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1">
      <span className="flex items-center gap-1 font-mono text-[10px] text-ink/50">
        <Clock size={10} /> {formatDuration(flight.totalDurationMinutes)}
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
          ? `${flight.layover.airport.code} · ${formatDuration(flight.layover.durationMinutes)} aktarma`
          : "Direkt"}
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
  selected,
  cheapest,
  onSelect,
  index,
}: {
  flight: Flight;
  selected: boolean;
  cheapest: boolean;
  onSelect: () => void;
  /** Liste sırası: kartlar dalga halinde sırayla gelir */
  index: number;
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onSelect}
      {...riseIn(index)}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
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
                Biniş Kartı · {flight.flightNumber}
              </p>
            </div>
          </div>
          {cheapest && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
              En uygun
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="leading-tight">
            <p className="font-mono text-2xl font-black tracking-tight text-ink sm:text-3xl">{flight.origin.code}</p>
            <p className="max-w-[6.5rem] truncate text-[11px] text-ink/50">{flight.origin.city}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-ink/80">{flight.departureTime}</p>
          </div>
          <DurationBar flight={flight} selected={selected} />
          <div className="text-right leading-tight">
            <p className="font-mono text-2xl font-black tracking-tight text-ink sm:text-3xl">{flight.destination.code}</p>
            <p className="ml-auto max-w-[6.5rem] truncate text-[11px] text-ink/50">{flight.destination.city}</p>
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
            .filter((t) => t !== "En uygun" && t !== "Kesintisiz")
            .map((t) => (
              <span key={t} className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] text-ink/60">
                {t}
              </span>
            ))}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-ink/45">
            <Luggage size={11} /> {flight.checkedBaggageKg}kg
          </span>
        </div>
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
            <Check size={10} strokeWidth={3} /> Seçildi
          </span>
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/40">Ekonomi</span>
        )}
        <div className="leading-tight">
          <p className="font-mono text-xl font-bold tabular-nums text-ink">${flight.price.toLocaleString("en-US")}</p>
          <p className="text-[9px] text-ink/45">kişi başı · G/D</p>
        </div>
        <Barcode seed={flight.id} />
      </div>
    </motion.button>
  );
}

/** Alt CTA: seçili uçuş özeti + "Adım 2'ye Geç" */
function FlightActionBar() {
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const prevStep = useTripStore((s) => s.prevStep);
  const nextStep = useTripStore((s) => s.nextStep);
  const ready = selectedFlight !== null;

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur lg:static lg:bg-surface/80 md:px-8">
      <button
        type="button"
        onClick={prevStep}
        aria-label="Ana sayfaya dön"
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
                  {selectedFlight.type === "direct" ? "Direkt" : `${selectedFlight.layover?.airport.code} aktarmalı`}
                  {" · "}
                  {formatDuration(selectedFlight.totalDurationMinutes)}
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
              Devam etmek için bir uçuş seç.
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
        <span className="hidden sm:inline">Gezilecek Yerleri Keşfet</span>
        <span className="sm:hidden">Devam</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

/** Kalkış/varış aynı şehirde mi? (IST↔SAW, LHR↔LHR) — bu çiftte uçuş yok */
const sameCity = (a: Airport | null, b: Airport) => !!a && (a.code === b.code || a.city === b.city);

/** Varış satırlarının alt metni: ülke · öne çıkan şehirler */
const destinationSubtitle = (d: Airport) =>
  [d.country, ...getDestinationProfile(d).cities.map((c) => c.name).filter((n) => n !== d.city)].join(" · ");

/** Numaralı seçim bölümü başlığı ("1 · Nereden kalkıyorsun?") */
function PickerHeading({ index, icon: Icon, title, hint, tone }: {
  index: number;
  icon: typeof PlaneTakeoff;
  title: string;
  hint: string;
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
      <div className="leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Adım 1.{index}</p>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      <p className="ml-auto hidden text-right text-[11px] text-ink/45 sm:block">{hint}</p>
    </div>
  );
}

/** Adım 1: Sol %45 kalkış + varış + uçuş seçimi, sağ %55 düz 2D dünya haritası */
export default function FlightStep() {
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

  const flights = useMemo(
    () =>
      origin && destination
        ? getFlights(origin, destination, departureDate).sort((a, b) => a.price - b.price)
        : [],
    [origin, destination, departureDate],
  );
  const visible = filter === "all" ? flights : flights.filter((f) => f.type === filter);
  const cheapestId = flights[0]?.id;
  const directCount = flights.filter((f) => f.type === "direct").length;

  // Ters yön sadece kalkış noktası da bir hedef ülkeyse anlamlı (örn. Londra ⇄ Paris)
  const canSwap = !!origin && !!destination && DESTINATIONS.some((d) => d.code === origin.code);
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                Adım 1 · Rota & Uçuş
              </p>
              <h1 className="mt-1 text-2xl font-bold text-ink md:text-3xl">Yolculuğun nereden nereye?</h1>
              <p className="mt-1.5 text-sm text-ink/60">
                Önce kalkış noktanı, sonra hedef ülkeni seç; direkt ve aktarmalı uçuşlar sağdaki haritada kavisli
                rotalar olarak çizilir.
              </p>
            </header>

            {/* 1.1 Kalkış */}
            <div>
              <PickerHeading
                index={1}
                icon={PlaneTakeoff}
                title="Nereden kalkıyorsun?"
                hint="Türkiye · Avrupa · Amerika · Asya"
                tone="violet"
              />
              <div className="card rounded-2xl p-1">
                <CitySelectDropdown
                  label="Kalkış noktası"
                  icon={PlaneTakeoff}
                  value={origin}
                  options={SEARCHABLE_ORIGINS}
                  isDisabled={(a) => sameCity(destination, a)}
                  disabledHint="Varış noktanla aynı şehir"
                  getSubtitle={(a) => `${a.airportName} · ${a.country}`}
                  onChange={setOrigin}
                />
              </div>
            </div>

            {/* 1.2 Varış */}
            <div className={cn(!origin && "opacity-90")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <PickerHeading
                    index={2}
                    icon={PlaneLanding}
                    title="Nereye gidiyorsun?"
                    hint={`${DESTINATIONS.length} ülke · haritadan da seçebilirsin`}
                    tone="cyan"
                  />
                </div>
                {canSwap && (
                  <button
                    type="button"
                    onClick={swap}
                    title="Kalkış ve varışı değiştir"
                    aria-label="Kalkış ve varışı değiştir"
                    className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl glass-secondary text-ink/60 hover:text-ink"
                  >
                    <ArrowRightLeft size={15} />
                  </button>
                )}
              </div>
              <div className="card rounded-2xl p-1">
                <CitySelectDropdown
                  label="Varış noktası"
                  icon={PlaneLanding}
                  value={destination}
                  options={DESTINATIONS}
                  isDisabled={(a) => sameCity(origin, a)}
                  getSubtitle={destinationSubtitle}
                  matches={matchesDestination}
                  onChange={setDestination}
                />
              </div>
            </div>

            {/* Tarih, yolcu */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <SectionLabel>Gidiş Tarihi</SectionLabel>
                <label className={inputBox}>
                  <CalendarDays size={16} className="shrink-0 text-blue-600 dark:text-blue-300" />
                  <input
                    type="date"
                    value={departureDate}
                    min={todayIso()}
                    onChange={(e) => e.target.value && setDepartureDate(e.target.value)}
                    className="w-full bg-transparent text-sm text-ink outline-none"
                  />
                </label>
              </div>
              <div>
                <SectionLabel>Yolcu</SectionLabel>
                <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-surface px-1.5 py-1.5">
                  <button
                    type="button"
                    aria-label="Yolcu azalt"
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
                    aria-label="Yolcu artır"
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
                      {flights.length} uçuş · {directCount} direkt · {flights.length - directCount} aktarmalı
                    </span>
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
                        {f.label}
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
                        selected={selectedFlight?.id === f.id}
                        cheapest={f.id === cheapestId}
                        onSelect={() => selectFlight(f)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {visible.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
                    {flights.length === 0
                      ? "Bu iki nokta arasında uçuş bulunamadı — farklı bir kalkış veya hedef dene."
                      : `Bu rotada ${filter === "direct" ? "direkt" : "mantıklı aktarmalı"} uçuş yok — diğer filtreye göz at.`}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/15 p-5 text-sm text-ink/55">
                <MapPin size={18} className="shrink-0 text-blue-600 dark:text-blue-300" />
                {!origin
                  ? "Uçuşları görmek için önce kalkış noktanı seç."
                  : "Şimdi hedef ülkeni seç — direkt ve aktarmalı uçuşlar burada listelenecek."}
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
