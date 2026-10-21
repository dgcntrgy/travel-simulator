"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Clock,
  ExternalLink,
  ImageOff,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  Radio,
  RotateCw,
  Search,
  Sparkles,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import PlaceLocationMap from "@/components/map/PlaceLocationMap";
import WorldMap from "@/components/map/WorldMap";
import { CATEGORY_META, estimateTripDays, getRegions } from "@/data/mockPlaces";
import { useDestinationPlaces } from "@/lib/globalDiscovery";
import { fetchWikiImage } from "@/lib/wikipedia";
import { useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Place, PlaceCategory, TripRoute } from "@/types/trip";
import { CARD_HOVER, GLASS_CARD, PHOTO_ZOOM, riseIn, SLIDE_FROM_LEFT, SLIDE_FROM_RIGHT, STEP_TRANSITION } from "@/lib/motion";

const MIN_PLACES = 2;

type CategoryFilter = "all" | PlaceCategory;
type SourceFilter = "all" | "curated" | "live";

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "sight", label: CATEGORY_META.sight.label },
  { id: "food", label: CATEGORY_META.food.label },
  { id: "culture", label: CATEGORY_META.culture.label },
];

const CATEGORY_ICON: Record<PlaceCategory, LucideIcon> = {
  sight: Camera,
  food: UtensilsCrossed,
  culture: Sparkles,
};

/** Fotoğraf üstündeki rozetler: her iki temada da okunsun diye beyaz zemin üzerinde renkli metin */
const CATEGORY_BADGE: Record<PlaceCategory, string> = {
  sight: "text-blue-700",
  food: "text-orange-700",
  culture: "text-indigo-700",
};

function formatCost(cost: number) {
  return cost === 0 ? "Ücretsiz" : `~$${cost}`;
}

function formatHours(hours: number) {
  return `${hours.toLocaleString("tr-TR")} Saat`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-blue-500/60 bg-blue-500/15 text-ink backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "glass-secondary text-ink/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

type ImageState = { src: string | null; failed: boolean };

/** Önce Wikipedia'dan canlı fotoğraf; yanıt yoksa veya görsel yüklenemezse Unsplash fallback */
function PlaceImage({ place }: { place: Place }) {
  // Canlı keşif kartları GeoSearch'ten gelen Wikimedia küçük resmini zaten taşır: ek istek yok
  const isLive = place.source === "live";
  const [state, setState] = useState<ImageState>({ src: isLive ? place.fallbackImage : null, failed: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isLive) return;
    let active = true;
    fetchWikiImage(place.wikiTitle).then((wiki) => {
      if (active) setState({ src: wiki ?? place.fallbackImage, failed: false });
    });
    return () => {
      active = false;
    };
  }, [isLive, place.wikiTitle, place.fallbackImage]);

  const handleError = () => {
    setLoaded(false);
    setState((s) =>
      s.src !== place.fallbackImage ? { src: place.fallbackImage, failed: false } : { src: null, failed: true },
    );
  };

  const Icon = CATEGORY_ICON[place.category];

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-200 dark:bg-[#1a2238]">
      {!loaded && !state.failed && <div className="absolute inset-0 animate-pulse bg-ink/[0.05]" />}
      {state.failed && (
        <div className="absolute inset-0 grid place-items-center text-ink/25">
          <span className="flex flex-col items-center gap-1 text-[10px]">
            <Icon size={28} />
            <ImageOff size={12} />
          </span>
        </div>
      )}
      {state.src && (
        // Harici kaynaklar (Wikimedia/Unsplash) için remotePatterns gerektirmeyen düz <img>
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.src}
          alt={place.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={cn(
            "h-full w-full object-cover",
            PHOTO_ZOOM,
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}

function RouteToggleButton({
  selected,
  onToggle,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all",
        selected
          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-700 dark:text-emerald-200 dark:hover:text-rose-200"
          : "glass-primary",
        className,
      )}
    >
      {selected ? (
        <>
          <Check size={15} /> Rotadan Çıkar
        </>
      ) : (
        <>
          <Plus size={15} /> Rotama Ekle
        </>
      )}
    </motion.button>
  );
}

/** Kompakt kart: fotoğraf, ad, şehir/kategori, maliyet/süre ve iki aksiyon. Hikaye detay penceresinde. */
function PlaceCard({
  place,
  selected,
  highlighted,
  onToggle,
  onOpen,
  onHover,
  index,
}: {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onHover: (hovering: boolean) => void;
  /** Liste sırası: kartlar dalga halinde sırayla gelir */
  index: number;
}) {
  const Icon = CATEGORY_ICON[place.category];

  return (
    <motion.article
      layout
      data-place-id={place.id}
      {...riseIn(index)}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      whileHover={{ y: CARD_HOVER.whileHover.y, transition: CARD_HOVER.transition }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onOpen}
      className={cn(
        "card group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl backdrop-blur-xl transition-[border-color,box-shadow] duration-300",
        !selected && !highlighted && GLASS_CARD,
        selected && "border-amber-500/70! ring-2 ring-amber-400/30",
        highlighted && !selected && "border-blue-500/60! ring-2 ring-blue-500/25",
      )}
    >
      {/* Fotoğraf */}
      <div className="relative h-44">
        <PlaceImage place={place} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-90" />

        <span
          className={cn(
            "absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur",
            CATEGORY_BADGE[place.category],
          )}
        >
          <Icon size={12} /> {CATEGORY_META[place.category].short}
        </span>
        {place.source === "live" && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <Radio size={10} /> Canlı Wikipedia
          </span>
        )}

        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.7)]"
            >
              <Check size={16} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Başlık + özet bilgiler */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug text-ink">{place.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink/55">
            <MapPin size={12} /> {place.cityRegion} · {CATEGORY_META[place.category].label}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-lg px-2 py-1 font-mono font-semibold",
              place.estimatedCost === 0
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-ink/[0.05] text-ink/80",
            )}
          >
            {formatCost(place.estimatedCost)}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-ink/[0.05] px-2 py-1 text-ink/70">
            <Clock size={12} /> {formatHours(place.recommendedDuration)}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl glass-secondary py-2.5 text-sm font-medium text-ink/75 hover:border-blue-500/40! hover:bg-blue-500/[0.07] hover:text-ink"
          >
            <Search size={14} /> Detay & Hikaye
          </button>
          <RouteToggleButton selected={selected} onToggle={onToggle} className="py-2.5" />
        </div>
      </div>
    </motion.article>
  );
}

/** Geniş detay penceresi: büyük fotoğraf, hikaye, lokal ipucu, süre/maliyet ve mini konum haritası */
function PlaceDetailModal({
  place,
  selected,
  onToggle,
  onClose,
}: {
  place: Place;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const Icon = CATEGORY_ICON[place.category];
  const [lng, lat] = place.coordinates;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="card flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Büyük fotoğraf */}
          <div className="relative h-60 shrink-0 sm:h-80">
            <PlaceImage place={place} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Kapat"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
            >
              <X size={18} />
            </button>

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm",
                  CATEGORY_BADGE[place.category],
                )}
              >
                <Icon size={12} /> {CATEGORY_META[place.category].label}
              </span>
              <h2 id="place-detail-title" className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {place.name}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
                <MapPin size={14} /> {place.cityRegion}
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1.45fr_1fr]">
            {/* Hikaye + ipucu */}
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
                  <BookOpen size={13} /> Hikaye & Tarihçe
                </h3>
                <p className="text-[15px] leading-relaxed text-ink/80">{place.story}</p>
              </section>

              <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
                  <Lightbulb size={13} />{" "}
                  {place.category === "food" ? "Ne Yenir? / Lokal İpucu" : "Burada Ne Yapılır? / Lokal İpucu"}
                </h3>
                <p className="text-sm leading-relaxed text-ink/80">{place.mustDo}</p>
              </section>

              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(place.wikiTitle)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-ink/50 underline-offset-2 hover:text-ink hover:underline"
              >
                Wikipedia&apos;da devamını oku <ExternalLink size={11} />
              </a>
            </div>

            {/* Süre / maliyet + konum */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Ort. Maliyet</p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-lg font-semibold",
                      place.estimatedCost === 0 ? "text-emerald-600 dark:text-emerald-300" : "text-ink",
                    )}
                  >
                    {formatCost(place.estimatedCost)}
                  </p>
                  <p className="text-[10px] text-ink/40">kişi başı</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Tahmini Süre</p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-ink">
                    <Clock size={16} className="text-blue-600 dark:text-blue-300" />
                    {formatHours(place.recommendedDuration)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> Haritadaki Konumu
                  </span>
                  <span className="font-mono normal-case tracking-normal text-ink/40">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </p>
                <PlaceLocationMap place={place} className="h-52 rounded-2xl border border-ink/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Alt aksiyonlar */}
        <div className="flex items-center gap-3 border-t border-ink/10 bg-surface/80 px-5 py-3 backdrop-blur sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl glass-secondary px-4 py-3 text-sm text-ink/70 hover:text-ink"
          >
            Kapat
          </button>
          <RouteToggleButton selected={selected} onToggle={onToggle} className="flex-1 py-3" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function DiscoveryActionBar() {
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const prevStep = useTripStore((s) => s.prevStep);
  const nextStep = useTripStore((s) => s.nextStep);

  const count = selectedPlaces.length;
  const days = estimateTripDays(selectedPlaces);
  const ready = count >= MIN_PLACES;

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur lg:static lg:bg-surface/80 md:px-8">
      <button
        type="button"
        onClick={prevStep}
        className="flex shrink-0 items-center gap-1.5 rounded-xl glass-secondary px-3 py-3 text-sm text-ink/70 hover:text-ink"
      >
        <ArrowLeft size={15} />
        <span className="hidden sm:inline">Uçuş Seçimi</span>
      </button>

      <div className="min-w-0 flex-1 px-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={ready ? "ready" : `need-${count}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="truncate text-xs text-ink/60 sm:text-sm"
          >
            {ready ? (
              <>
                <b className="text-ink">{count} mekan</b> · ~{days} gün
              </>
            ) : (
              <>
                En az {MIN_PLACES} mekan seç{" "}
                <span className="font-mono text-ink/80">
                  ({count}/{MIN_PLACES})
                </span>
              </>
            )}
          </motion.p>
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
        <span className="hidden md:inline">Akıllı Otel & Taşıt Planla</span>
        <span className="md:hidden">Devam</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

/** Adım 2: sol/orta geniş kart ızgarası, sağda yapışkan şehir haritası */
export default function PlaceDiscoveryStep({ destination }: TripRoute) {
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const togglePlace = useTripStore((s) => s.togglePlace);
  const hoveredPlaceId = useTripStore((s) => s.hoveredPlaceId);
  const hoverSource = useTripStore((s) => s.hoverSource);
  const setHoveredPlace = useTripStore((s) => s.setHoveredPlace);

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [region, setRegion] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<SourceFilter>("all");
  const { places, curatedCount, liveCount, liveStatus, retry } = useDestinationPlaces(destination);
  const regions = useMemo(() => getRegions(places), [places]);
  const selectedIds = useMemo(() => new Set(selectedPlaces.map((p) => p.id)), [selectedPlaces]);
  // Pencere sadece seçilen hedefin mekanları arasından açılır (hedef değişirse kendiliğinden kapanır)
  const detailPlace = places.find((p) => p.id === detailId) ?? null;
  const closeDetail = useCallback(() => setDetailId(null), []);

  const visible = places.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (region === "all" || p.cityRegion === region) &&
      (source === "all" || (p.source ?? "curated") === source),
  );

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of selectedPlaces) counts.set(p.cityRegion, (counts.get(p.cityRegion) ?? 0) + 1);
    return counts;
  }, [selectedPlaces]);

  const totalCost = selectedPlaces.reduce((sum, p) => sum + p.estimatedCost, 0);
  const days = estimateTripDays(selectedPlaces);

  // Haritada bir pine tıklanınca/üzerine gelinince ilgili kartı görünür alana kaydır
  useEffect(() => {
    if (!hoveredPlaceId || hoverSource !== "map") return;
    const card = listRef.current?.querySelector<HTMLElement>(`[data-place-id="${hoveredPlaceId}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hoveredPlaceId, hoverSource]);

  // Haritadan seçilen mekan filtre yüzünden gizliyse filtreleri sıfırla
  const hoveredHidden = hoverSource === "map" && hoveredPlaceId !== null && !visible.some((p) => p.id === hoveredPlaceId);
  if (hoveredHidden) {
    setCategory("all");
    setRegion("all");
    setSource("all");
  }

  return (
    <motion.div
      {...STEP_TRANSITION}
      className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden lg:grid lg:grid-cols-[63fr_37fr] lg:overflow-hidden"
    >
      {/* Sol/orta: filtreler + kart ızgarası */}
      <motion.section {...SLIDE_FROM_LEFT} className="flex flex-col lg:min-h-0 lg:flex-1">
        <div ref={listRef} className="lg:flex-1 lg:overflow-y-auto">
          <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                  Adım 2 · Gezilecek Yerler & Lezzet Keşfi
                </p>
                <h1 className="mt-1 text-2xl font-bold text-ink md:text-3xl">
                  {destination.flag} {destination.country}&apos;da neler var?
                </h1>
                <p className="mt-1.5 text-sm text-ink/60">
                  Hikayeleri oku, beğendiğin yerleri rotana ekle; seçtiklerin haritada parlar.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="card flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink" title="Seçilen mekan">
                  <MapPin size={14} className="text-amber-500" />
                  <span className="font-mono tabular-nums">{selectedPlaces.length}</span>
                  <span className="text-ink/50">mekan</span>
                </span>
                <span className="card flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink" title="Tahmini gezi günü">
                  <CalendarDays size={14} className="text-blue-600 dark:text-blue-300" />
                  <span className="font-mono tabular-nums">{days}</span>
                  <span className="text-ink/50">gün</span>
                </span>
                <span
                  className="card rounded-xl px-3 py-2 font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-300"
                  title="Giriş & yemek toplamı (kişi başı)"
                >
                  ${totalCost}
                </span>
              </div>
            </header>

            {/* Filtreler */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0">
                {CATEGORY_FILTERS.map((f) => {
                  const Icon = f.id === "all" ? null : CATEGORY_ICON[f.id];
                  return (
                    <Chip key={f.id} active={category === f.id} onClick={() => setCategory(f.id)}>
                      {Icon && <Icon size={12} style={{ color: CATEGORY_META[f.id as PlaceCategory].color }} />}
                      {f.label}
                    </Chip>
                  );
                })}
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0">
                <Chip active={region === "all"} onClick={() => setRegion("all")}>
                  Tüm şehirler
                </Chip>
                {regions.map((r) => (
                  <Chip key={r} active={region === r} onClick={() => setRegion(r)}>
                    {r}
                    {regionCounts.get(r) ? (
                      <span className="rounded-full bg-amber-500/20 px-1.5 font-mono text-[10px] text-amber-700 dark:text-amber-200">
                        {regionCounts.get(r)}
                      </span>
                    ) : null}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Canlı Wikipedia keşfi durumu + kaynak filtresi */}
            <div className="flex flex-col gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-ink/70">
                {liveStatus === "loading" ? (
                  <>
                    <Loader2 size={14} className="shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                    Wikipedia GeoSearch ile {regions.length ? regions.join(", ") : destination.city} çevresindeki tarihi &
                    turistik noktalar canlı keşfediliyor…
                  </>
                ) : liveStatus === "error" ? (
                  <>
                    <Radio size={14} className="shrink-0 text-rose-500" />
                    Canlı keşfe şu an ulaşılamadı{curatedCount ? "; seçki kartları gösteriliyor." : "."}
                    <button
                      type="button"
                      onClick={retry}
                      className="ml-1 flex items-center gap-1 rounded-lg glass-secondary px-2 py-0.5 font-medium text-ink"
                    >
                      <RotateCw size={11} /> Tekrar dene
                    </button>
                  </>
                ) : (
                  <>
                    <Radio size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>
                      {curatedCount > 0 && (
                        <>
                          <b className="text-ink">{curatedCount}</b> seçki kartı +{" "}
                        </>
                      )}
                      <b className="text-ink">{liveCount}</b> canlı Wikipedia keşfi (gerçek fotoğraf & özet)
                    </span>
                  </>
                )}
              </p>
              {curatedCount > 0 && liveCount > 0 && (
                <div className="flex gap-1.5">
                  {(
                    [
                      ["all", "Tümü"],
                      ["curated", "★ Seçki"],
                      ["live", "Canlı"],
                    ] as const
                  ).map(([id, label]) => (
                    <Chip key={id} active={source === id} onClick={() => setSource(id)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {/* Kartlar */}
            <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {visible.map((place, i) => (
                  <PlaceCard
                    key={place.id}
                    index={i}
                    place={place}
                    selected={selectedIds.has(place.id)}
                    highlighted={hoveredPlaceId === place.id}
                    onToggle={() => togglePlace(place)}
                    onOpen={() => setDetailId(place.id)}
                    onHover={(hovering) => {
                      if (hovering) setHoveredPlace(place.id, "card");
                      else if (useTripStore.getState().hoveredPlaceId === place.id) setHoveredPlace(null);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>

            {liveStatus === "loading" && places.length === 0 && (
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="card h-72 animate-pulse rounded-3xl" />
                ))}
              </div>
            )}

            {visible.length === 0 && !(liveStatus === "loading" && places.length === 0) && (
              <p className="rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
                {places.length === 0 ? "Bu ülke için henüz mekan bulunamadı." : "Bu filtreye uygun mekan yok."}
              </p>
            )}

            <p className="pb-1 text-center text-[10px] text-ink/35">Fotoğraf & özetler: Wikipedia (CC BY-SA) · Unsplash</p>
          </div>
        </div>

        <DiscoveryActionBar />
      </motion.section>

      {/* Sağ: yapışkan şehir haritası */}
      <motion.section {...SLIDE_FROM_RIGHT} className="order-first h-[360px] w-full shrink-0 px-3 pt-3 sm:h-[420px] sm:px-4 sm:pt-4 lg:order-none lg:h-auto lg:p-4 lg:pl-0">
        <div className="relative h-full">
          <WorldMap mode="places" places={places} className="card h-full w-full rounded-2xl lg:rounded-3xl" />
          <div className="glass pointer-events-none absolute left-3 top-3 rounded-xl px-3 py-1.5 text-xs font-medium text-ink/80">
            {regions.length ? regions.join(" · ") : destination.city} · {selectedPlaces.length} seçili
          </div>
        </div>
      </motion.section>

      {/* Detay penceresi: transform'lu adım kapsayıcısından ve TopBar'dan bağımsız olsun diye body'ye portal */}
      {createPortal(
        <AnimatePresence>
          {detailPlace && (
            <PlaceDetailModal
              key={detailPlace.id}
              place={detailPlace}
              selected={selectedIds.has(detailPlace.id)}
              onToggle={() => togglePlace(detailPlace)}
              onClose={closeDetail}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}
