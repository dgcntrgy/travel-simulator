"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { greatCircle } from "@turf/turf";
import { DESTINATIONS } from "@/data/airports";
import { formatDuration, getFlights } from "@/data/mockFlights";
import { CATEGORY_META, getPlacesForDestination } from "@/data/mockPlaces";
import {
  TRANSIT_MODE_META,
  buildTripPlan,
  chosenEvaluation,
  directionsUrl,
  formatFrequency,
  formatMinutes,
} from "@/lib/routeOptimizer";
import { useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Airport, Flight, Hotel, LngLat, Place, PlaceCategory, Theme, TransitLeg, TransitRoute } from "@/types/trip";

/**
 * Resmi OpenStreetMap raster karoları: API anahtarı, üyelik veya ücret yok.
 * Tek katman iki temada da kullanılır; karanlık temada `.leaflet-tile-pane` elemanına doğrudan
 * `DARK_TILE_FILTER` uygulanır (ayrı sunucu yok, pinler/çizgiler filtrelenmez).
 * Leaflet Web Worker kullanmaz → Turbopack'te "Worker failed to load" sorunu yok.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları';

/** Gece laciverti: derin lacivert su + koyu mavi kara parçaları */
const DARK_TILE_FILTER = "invert(100%) hue-rotate(200deg) saturate(170%) brightness(88%) contrast(105%)";

/** Yükleme kaplaması en geç bu süre sonunda kalkar (karolar arka planda yüklenmeye devam eder). */
const OVERLAY_MAX_MS = 1000;

const SEGMENT_DRAW_MS = 1700;
const LAYOVER_PAUSE_MS = 750;

/** Temaya göre çizgi renkleri (açık zeminde daha doygun tonlar) */
const LINE_COLORS: Record<
  Theme,
  { planned: string; direct: string; glow: string; layover: string; preview: string; previewGlow: string }
> = {
  light: {
    planned: "#6366f1",
    direct: "#2563eb",
    glow: "#3b82f6",
    layover: "#ea580c",
    preview: "#d97706",
    previewGlow: "#f59e0b",
  },
  dark: {
    planned: "#94a3ff",
    direct: "#60a5fa",
    glow: "#93c5fd",
    layover: "#fb923c",
    preview: "#fde68a",
    previewGlow: "#fbbf24",
  },
};

/**
 * Büyük daire yayını tek bir sürekli koordinat dizisine çevirir.
 * Antimeridyeni (±180°) geçen rotalarda turf MultiLineString döndürür; boylamları
 * "açarak" (unwrap) kesintisiz bir çizgi elde ederiz (Leaflet ±180 dışını sorunsuz çizer).
 */
function arcCoordinates(from: LngLat, to: LngLat, npoints = 180): LngLat[] {
  const arc = greatCircle(from, to, { npoints });
  const raw: LngLat[] =
    arc.geometry.type === "LineString"
      ? (arc.geometry.coordinates as LngLat[])
      : (arc.geometry.coordinates.flat() as LngLat[]);

  const out: LngLat[] = [];
  let offset = 0;
  for (let i = 0; i < raw.length; i++) {
    const [lng, lat] = raw[i];
    if (i > 0) {
      const prev = raw[i - 1][0];
      if (lng - prev > 180) offset -= 360;
      else if (lng - prev < -180) offset += 360;
    }
    out.push([lng + offset, lat]);
  }
  return out;
}

/** Turf `[lng, lat]` → Leaflet `[lat, lng]` */
const toLatLng = ([lng, lat]: LngLat): L.LatLngTuple => [lat, lng];

function routeSegments(flight: Flight | null, origin: Airport, destination: Airport): L.LatLngTuple[][] {
  if (flight?.type === "layover" && flight.layover) {
    const hub = flight.layover.airport.coordinates;
    return [arcCoordinates(origin.coordinates, hub), arcCoordinates(hub, destination.coordinates)].map((seg) =>
      seg.map(toLatLng),
    );
  }
  return [arcCoordinates(origin.coordinates, destination.coordinates).map(toLatLng)];
}

function el(className: string, html: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  div.innerHTML = html;
  return div;
}

/** HTML elemanını ortalanmış bir Leaflet divIcon'a sarar (Leaflet'in beyaz kutu stili olmadan) */
function htmlIcon(element: HTMLElement, size: number): L.DivIcon {
  return L.divIcon({ html: element, className: "map-divicon", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/** Pinin altında sürekli yayılan çift halkalı radar dalgası */
const RADAR_RINGS = '<span class="radar-ring"></span><span class="radar-ring radar-ring--late"></span>';

function airportPin(airport: Airport, role: "origin" | "destination"): HTMLDivElement {
  return el(
    `airport-pin airport-pin--${role}`,
    `<span class="airport-pin__dot">${RADAR_RINGS}</span>
     <span class="airport-pin__label"><b>${airport.code}</b> ${airport.city}</span>`,
  );
}

function layoverBadge(flight: Flight): HTMLDivElement {
  const lay = flight.layover!;
  return el(
    "layover-badge",
    `<span class="layover-badge__ring"></span>
     <span class="layover-badge__dot"></span>
     <span class="layover-badge__card">
       <span class="layover-badge__title">Aktarma · ${lay.airport.code}</span>
       <span class="layover-badge__meta">${lay.airport.city} · ${formatDuration(lay.durationMinutes)} bekleme</span>
     </span>`,
  );
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const CATEGORY_ICON: Record<PlaceCategory, string> = {
  sight: svg(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  ),
  food: svg(
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  ),
  culture: svg('<path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18.5l-1.9-5.9L4 10.7l6.1-1.9z"/>'),
};
const CHECK_ICON = svg('<path d="M20 6 9 17l-5-5"/>');

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function placePin(place: Place): HTMLDivElement {
  const pin = el(
    `place-pin place-pin--${place.category}`,
    `${RADAR_RINGS}
     <span class="place-pin__pulse"></span>
     <span class="place-pin__body">${CATEGORY_ICON[place.category]}</span>
     <span class="place-pin__check">${CHECK_ICON}</span>
     <span class="place-pin__label">${escapeHtml(place.name)}<small>${escapeHtml(place.cityRegion)}</small></span>`,
  );
  pin.style.setProperty("--pin-color", CATEGORY_META[place.category].color);
  pin.setAttribute("role", "button");
  pin.setAttribute("aria-label", place.name);
  return pin;
}

const BED_ICON = svg(
  '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
);

function hotelPin(hotel: Hotel, state: "focused" | "chosen" | "option"): HTMLDivElement {
  const pin = el(
    `hotel-pin hotel-pin--${hotel.tier} is-${state}`,
    `${RADAR_RINGS}
     <span class="hotel-pin__halo"></span>
     <span class="hotel-pin__body">${BED_ICON}</span>
     <span class="hotel-pin__label">${escapeHtml(hotel.name)}<small>$${hotel.pricePerNight} / gece</small></span>`,
  );
  pin.setAttribute("role", "button");
  pin.setAttribute("aria-label", hotel.name);
  return pin;
}

function transitLabel(leg: TransitLeg, color?: string): HTMLDivElement {
  const meta = TRANSIT_MODE_META[leg.mode];
  const label = el(
    "transit-label",
    `<span>${meta.emoji}</span><b>${formatMinutes(leg.minutes)}</b><span>${leg.cost ? `$${leg.cost.toFixed(2)}` : "Ücretsiz"}</span>`,
  );
  label.style.setProperty("--leg-color", color ?? meta.color);
  return label;
}

/** Pro: hattın biniş/iniş noktasındaki parlayan istasyon pini */
function stationPin(name: string, role: "Biniş" | "İniş", leg: TransitLeg, color: string): HTMLDivElement {
  const pin = el(
    "station-pin",
    `<span class="station-pin__dot">${TRANSIT_MODE_META[leg.mode].emoji}</span>
     <span class="station-pin__label">${role} · ${escapeHtml(name)}</span>`,
  );
  pin.style.setProperty("--line-color", color);
  pin.setAttribute("role", "button");
  pin.setAttribute("aria-label", `${role} istasyonu: ${name}`);
  return pin;
}

/** İstasyon pinine / hatta tıklayınca açılan yol tarifi kartı */
function routePopupHtml(leg: TransitLeg, route: TransitRoute, hotel: Hotel, place: Place): string {
  const emoji = TRANSIT_MODE_META[leg.mode].emoji;
  const facts: [string, string][] = [
    ["Biniş", `${route.from.name} ${route.stationWord}`],
    ["İniş", `${route.to.name} ${route.stationWord}`],
    ["Sefer", formatFrequency(route)],
    ["Bilet", leg.cost ? `$${leg.cost.toFixed(2)} / kişi` : "Ücretsiz"],
    ["Süre", `${formatMinutes(leg.minutes)} · ${route.stops} durak`],
  ];
  return `<div style="--line-color:${route.color}">
    <div class="metro-popup__head">
      <span class="metro-popup__badge">${emoji}</span>
      <div><b>${escapeHtml(route.line)}</b><small>${escapeHtml(route.colorName)} · ${escapeHtml(route.direction)} yönü</small></div>
    </div>
    <dl class="metro-popup__facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>
    <ol class="metro-popup__steps">${route.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
    <a class="metro-popup__link" href="${directionsUrl(hotel.coordinates, place.coordinates, leg.mode)}" target="_blank" rel="noopener noreferrer">📍 Haritada Yol Tarifi Al</a>
  </div>`;
}

const PLANE_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <path fill="currentColor" d="M12 2c.8 0 1.4.7 1.4 1.6v5.6l7.6 4.5v2l-7.6-2.3v4.4l2.2 1.7V21L12 20l-3.6 1v-1.5l2.2-1.7v-4.4L3 15.7v-2l7.6-4.5V3.6C10.6 2.7 11.2 2 12 2z"/>
</svg>`;

/** Hiçbir nokta seçilmemişken Adım 1'in temiz dünya görünümü */
const WORLD_VIEW = { center: [25, 35] as L.LatLngTuple, zoom: 3.5 };

/** Dünya sınırları: harita bunun dışına (karo olmayan beyaz boşluğa) sürüklenemez */
const WORLD_BOUNDS = L.latLngBounds([-82, -180], [82, 180]);
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

/** Harita kendi kutusunda; sadece kenarlardan nefes payı bırak */
function cameraPadding(map: L.Map): Pick<L.FitBoundsOptions, "paddingTopLeft" | "paddingBottomRight"> {
  const { x: w, y: h } = map.getSize();
  const pad = Math.round(Math.min(w, h) * 0.12);
  return { paddingTopLeft: [pad, pad + 20], paddingBottomRight: [pad, pad] };
}

/** İki nokta arasındaki ekran açısı (derece, kuzey = 0) — Mercator'da uçak burnunu çizgiye hizalar */
function screenAngle(map: L.Map, from: L.LatLngTuple, to: L.LatLngTuple): number {
  const a = map.latLngToLayerPoint(from);
  const b = map.latLngToLayerPoint(to);
  return (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
}

/**
 * Düz 2D Leaflet haritası (OpenStreetMap raster karoları; karanlık tema CSS filtresiyle).
 * - `flight` (Adım 1): kalkış/varış pinleri, hedef adayları, kavisli uçuş yayları + uçak animasyonu
 * - `places` (Adım 2): hedef şehrin mekan pinleri, seçim parıltısı ve keşif önizleme hattı
 * - `hotel` (Adım 3): odaklanan otel pini + otelden mekanlara taşıt hatları (Pro: dakika & bilet etiketleri)
 *
 * Not: Leaflet `window`'a eriştiği için bu bileşen yalnızca client'ta render edilir
 * (`SimulatorClient` → `next/dynamic({ ssr: false })`).
 */
export default function WorldMap({
  mode,
  className,
  places: placesProp,
}: {
  mode: "flight" | "places" | "hotel";
  className?: string;
  /** Adım 2: kürasyonlu + canlı keşif mekanları (verilmezse sadece kürasyonlu veri) */
  places?: Place[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const theme = useTripStore((s) => s.theme);
  const origin = useTripStore((s) => s.origin);
  const destination = useTripStore((s) => s.destination);
  const selectedFlight = useTripStore((s) => s.selectedFlight);
  const departureDate = useTripStore((s) => s.departureDate);
  const setDestination = useTripStore((s) => s.setDestination);
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const hoveredPlaceId = useTripStore((s) => s.hoveredPlaceId);
  const setHoveredPlace = useTripStore((s) => s.setHoveredPlace);
  const isPro = useTripStore((s) => s.isPro);
  const recommendedHotels = useTripStore((s) => s.recommendedHotels);
  const focusedHotelId = useTripStore((s) => s.focusedHotelId);
  const chooseHotel = useTripStore((s) => s.chooseHotel);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);

  // Adım 3 planı (saf ve ucuz hesap; HotelTransitStep ile aynı girdiler → aynı sonuç)
  const plan = useMemo(
    () => (mode === "hotel" && destination ? buildTripPlan(selectedPlaces, destination) : null),
    [mode, selectedPlaces, destination],
  );
  // Adım 1: kalkış + varış seçilince tüm uçuş seçenekleri (direkt + her aktarma merkezi) soluk yay olarak çizilir
  const flightOptions = useMemo(
    () => (mode === "flight" && origin && destination ? getFlights(origin, destination, departureDate) : []),
    [mode, origin, destination, departureDate],
  );
  /** Kamera sadece odak (şehir/otel) değişince uçsun; tema/Pro değişiminde yerinde kalsın */
  const hotelCameraKeyRef = useRef("");

  /** Adım 2 pinleri: seçim/vurgu değişince yeniden oluşturmak yerine sınıfları güncelleriz */
  const placePinsRef = useRef(new Map<string, { marker: L.Marker; pin: HTMLDivElement }>());

  // 1) Haritayı bir kez oluştur
  useEffect(() => {
    if (!containerRef.current) return;
    const isFlight = mode === "flight";

    const map = L.map(containerRef.current, {
      center: isFlight || !destination ? WORLD_VIEW.center : toLatLng(destination.coordinates),
      zoom: isFlight || !destination ? WORLD_VIEW.zoom : 11,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: WORLD_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomSnap: 0.25,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

    const tiles = L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
      noWrap: true,
      bounds: WORLD_BOUNDS,
      detectRetina: false,
      // Zoom sırasında eski karolar silinmez; yeniler arkada yüklenince yerine geçer (beyaz boşluk/parlama yok)
      keepBuffer: 8,
      updateWhenZooming: false,
      updateWhenIdle: false,
    }).addTo(map);
    tiles.once("load", () => setOverlayVisible(false));

    mapRef.current = map;
    setMapReady(true);

    // Adım düzenleri (grid / mobil yükseklik) değişince Leaflet'e boyutu bildir
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(containerRef.current);

    const overlayTimer = window.setTimeout(() => setOverlayVisible(false), OVERLAY_MAX_MS);

    return () => {
      window.clearTimeout(overlayTimer);
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Harita sadece mount'ta kurulur; hedef değişimleri (tema: CSS filtresi) aşağıdaki effect'lerde işlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Karanlık tema: sadece karo panosu ters çevrilir (pinler, çizgiler, rozetler orijinal renginde kalır)
  useEffect(() => {
    const tilePane = containerRef.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (!tilePane) return;
    tilePane.style.filter = theme === "dark" ? DARK_TILE_FILTER : "none";
  }, [theme, mapReady]);

  // 2) Adım 1: rota, pinler ve kamera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mode !== "flight") return;

    const c = LINE_COLORS[theme];
    const layers: L.Layer[] = [];
    const add = <T extends L.Layer>(layer: T): T => {
      layer.addTo(map);
      layers.push(layer);
      return layer;
    };
    let raf = 0;
    let cancelled = false;

    // Diğer hedef adayları: haritadan tıklayarak seçilebilir (kalkış seçilince belirir → harita ilk açılışta temiz)
    if (origin) {
      for (const d of DESTINATIONS) {
        if (d.code === destination?.code || d.code === origin.code || d.city === origin.city) continue;
        const pin = el(
          "candidate-pin",
          `<span class="candidate-pin__dot"></span><span class="candidate-pin__label">${d.flag} ${d.city}</span>`,
        );
        const marker = add(L.marker(toLatLng(d.coordinates), { icon: htmlIcon(pin, 9), title: d.city }));
        marker.on("click", () => setDestination(d));
      }
    }

    // Henüz rota yok: boş dünya, ya da sadece seçilen tek noktanın pini
    if (!origin || !destination) {
      const only = origin ?? destination;
      if (only) {
        const role = origin ? "origin" : "destination";
        add(L.marker(toLatLng(only.coordinates), { icon: htmlIcon(airportPin(only, role), 14), interactive: false, keyboard: false }));
        map.flyTo(toLatLng(only.coordinates), 3, { duration: 1.4 });
      } else {
        map.flyTo(WORLD_VIEW.center, WORLD_VIEW.zoom, { duration: 1.2 });
      }
      return () => layers.forEach((l) => l.remove());
    }

    const segments = routeSegments(selectedFlight, origin, destination);
    const isLayover = segments.length > 1;
    const start = segments[0][0];
    const end = segments[segments.length - 1].at(-1)!;

    // Tüm uçuş seçenekleri: direkt = tek yay, aktarmalı = merkezde kırılan iki yay (seçili olan aşağıda canlandırılır)
    const optionKeys = new Set<string>();
    const optionBounds: L.LatLngTuple[] = [];
    for (const option of flightOptions) {
      const key = option.layover?.airport.code ?? "direct";
      const isSelected = selectedFlight && (selectedFlight.layover?.airport.code ?? "direct") === key;
      if (optionKeys.has(key) || isSelected) continue;
      optionKeys.add(key);
      const optionSegments = routeSegments(option, origin, destination);
      optionBounds.push(...optionSegments.flat());
      for (const seg of optionSegments) {
        add(
          L.polyline(seg, {
            color: option.layover ? c.layover : c.direct,
            weight: selectedFlight ? 1.2 : 2,
            opacity: selectedFlight ? 0.3 : 0.6,
            dashArray: option.layover ? "4, 7" : undefined,
            interactive: false,
          }),
        );
      }
      if (option.layover && !selectedFlight) {
        const hubPin = el(
          "candidate-pin candidate-pin--hub",
          `<span class="candidate-pin__dot"></span><span class="candidate-pin__label">${option.layover.airport.code} aktarma</span>`,
        );
        add(L.marker(optionSegments[0].at(-1)!, { icon: htmlIcon(hubPin, 9), interactive: false, keyboard: false }));
      }
    }

    // Planlanan rota: soluk kesikli çizgi
    for (const seg of segments) {
      add(L.polyline(seg, { color: c.planned, weight: 1.5, opacity: 0.5, dashArray: "3, 6", interactive: false }));
    }

    // Uçulan rota katmanları (animasyonla dolar). 1. yay: parlak mavi/yeşil; aktarmalıda 2. yay kesikli turuncu.
    const flown = segments.map((_, i) => {
      const secondLeg = isLayover && i === 1;
      const color = secondLeg ? c.layover : c.direct;
      const glow = add(
        L.polyline([], {
          color: secondLeg ? c.layover : c.glow,
          weight: 10,
          opacity: theme === "dark" ? 0.3 : 0.2,
          lineCap: "round",
          interactive: false,
          className: "route-glow",
        }),
      );
      const core = add(
        L.polyline([], {
          color,
          weight: 3,
          opacity: 1,
          lineCap: secondLeg ? "butt" : "round",
          dashArray: secondLeg ? "8, 8" : undefined,
          interactive: false,
          className: secondLeg ? "route-core route-core--layover" : "route-core",
        }),
      );
      // Kalkıştan varışa akan kesikli ışık (stroke-dashoffset animasyonu, globals.css `.route-flow`)
      const flow = add(
        L.polyline([], {
          color: "#ffffff",
          weight: 2,
          opacity: 0.9,
          lineCap: "round",
          dashArray: "2, 14",
          interactive: false,
          className: "route-flow",
        }),
      );
      return { glow, core, flow };
    });

    // Kalkış & varış pinleri (yay uçlarına; antimeridyen açılımıyla tutarlı)
    add(L.marker(start, { icon: htmlIcon(airportPin(origin, "origin"), 14), interactive: false, keyboard: false }));
    add(
      L.marker(end, {
        icon: htmlIcon(airportPin(destination, "destination"), 14),
        interactive: false,
        keyboard: false,
      }),
    );

    // Aktarma rozeti: şehir + bekleme süresi (ilk yay çizilince belirir)
    let badgeEl: HTMLDivElement | null = null;
    if (isLayover && selectedFlight?.layover) {
      badgeEl = layoverBadge(selectedFlight);
      badgeEl.classList.add("is-hidden");
      add(
        L.marker(segments[0].at(-1)!, {
          icon: htmlIcon(badgeEl, 16),
          interactive: false,
          keyboard: false,
          zIndexOffset: 500,
        }),
      );
    }

    // Kamera: tüm rotayı (seçenekler ve aktarma dahil) kutuya sığdır
    map.flyToBounds(L.latLngBounds([...segments.flat(), ...optionBounds]), {
      ...cameraPadding(map),
      maxZoom: 5,
      duration: 1.6,
    });

    // Uçuş animasyonu: yay yay çiz, aktarmada duraklat
    if (selectedFlight) {
      const planeEl = el("plane-marker", PLANE_SVG);
      const plane = add(
        L.marker(start, { icon: htmlIcon(planeEl, 22), interactive: false, keyboard: false, zIndexOffset: 1000 }),
      );

      const phases: ({ kind: "draw"; seg: number } | { kind: "pause" })[] = [];
      segments.forEach((_, i) => {
        if (i > 0) phases.push({ kind: "pause" });
        phases.push({ kind: "draw", seg: i });
      });

      let phase = 0;
      let phaseStart = 0;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

      const tick = (now: number) => {
        if (cancelled) return;
        if (!phaseStart) phaseStart = now;
        const current = phases[phase];
        const elapsed = now - phaseStart;

        if (current.kind === "draw") {
          const coords = segments[current.seg];
          const t = ease(Math.min(1, elapsed / SEGMENT_DRAW_MS));
          const n = Math.max(2, Math.floor(t * (coords.length - 1)) + 1);
          const drawn = coords.slice(0, n);
          flown[current.seg].glow.setLatLngs(drawn);
          flown[current.seg].core.setLatLngs(drawn);
          flown[current.seg].flow.setLatLngs(drawn);

          const head = coords[n - 1];
          const prev = coords[Math.max(0, n - 2)];
          plane.setLatLng(head);
          if (head !== prev) planeEl.style.transform = `rotate(${screenAngle(map, prev, head)}deg)`;

          if (t >= 1) {
            if (current.seg === 0) badgeEl?.classList.remove("is-hidden");
            phase++;
            phaseStart = now;
          }
        } else if (elapsed >= LAYOVER_PAUSE_MS) {
          phase++;
          phaseStart = now;
        }

        if (phase < phases.length) {
          raf = requestAnimationFrame(tick);
        } else {
          planeEl.classList.add("is-landed");
        }
      };

      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      layers.forEach((l) => l.remove());
    };
  }, [mapReady, mode, theme, origin, destination, selectedFlight, flightOptions, setDestination]);

  // 3) Adım 2: şehre yakınlaş + kategori pinleri
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mode !== "places" || !destination) return;

    const places = placesProp ?? getPlacesForDestination(destination.code);
    if (places.length === 0) {
      // Canlı keşif sürerken hedef şehre yakınlaş
      map.flyTo(toLatLng(destination.coordinates), 10, { duration: 1.4 });
      return;
    }

    const pins = placePinsRef.current;

    for (const place of places) {
      const pin = placePin(place);
      const marker = L.marker(toLatLng(place.coordinates), { icon: htmlIcon(pin, 30), title: place.name }).addTo(map);
      marker.on("mouseover", () => setHoveredPlace(place.id, "map"));
      marker.on("mouseout", () => {
        if (useTripStore.getState().hoveredPlaceId === place.id) setHoveredPlace(null);
      });
      marker.on("click", () => setHoveredPlace(place.id, "map"));
      pins.set(place.id, { marker, pin });
    }

    // Boş alana tıklayınca vurguyu kaldır (marker tıklamaları haritaya kabarcıklanmaz)
    const clearHover = () => setHoveredPlace(null);
    map.on("click", clearHover);

    map.flyToBounds(L.latLngBounds(places.map((p) => toLatLng(p.coordinates))), {
      ...cameraPadding(map),
      maxZoom: 13,
      duration: 1.4,
    });

    return () => {
      map.off("click", clearHover);
      pins.forEach(({ marker }) => marker.remove());
      pins.clear();
      setHoveredPlace(null);
    };
  }, [mapReady, mode, destination, placesProp, setHoveredPlace]);

  // 4) Seçilen mekanlar: pin parıltısı + ince kesikli keşif rotası (ekleme sırasıyla)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mode !== "places") return;

    const selectedIds = new Set(selectedPlaces.map((p) => p.id));
    placePinsRef.current.forEach(({ pin }, id) => pin.classList.toggle("is-selected", selectedIds.has(id)));

    if (selectedPlaces.length < 2) return;
    const c = LINE_COLORS[theme];
    const path = selectedPlaces.map((p) => toLatLng(p.coordinates));
    const glow = L.polyline(path, { color: c.previewGlow, weight: 6, opacity: 0.25, interactive: false }).addTo(map);
    const line = L.polyline(path, {
      color: c.preview,
      weight: 1.8,
      opacity: 0.95,
      dashArray: "6, 10",
      lineCap: "round",
      interactive: false,
      className: "route-flow route-flow--soft",
    }).addTo(map);

    return () => {
      glow.remove();
      line.remove();
    };
  }, [mapReady, mode, theme, destination, placesProp, selectedPlaces]);

  // 5) Kart hover / pin tıklaması: haritada vurgula ve öne al
  useEffect(() => {
    placePinsRef.current.forEach(({ marker, pin }, id) => {
      const active = id === hoveredPlaceId;
      pin.classList.toggle("is-hovered", active);
      marker.setZIndexOffset(active ? 1000 : 0);
    });
  }, [mapReady, hoveredPlaceId, destination]);

  // 6) Adım 3: otel pinleri + otel → mekan taşıt hatları
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mode !== "hotel" || !plan || plan.cities.length === 0) return;

    const layers: L.Layer[] = [];
    const add = <T extends L.Layer>(layer: T): T => {
      layer.addTo(map);
      layers.push(layer);
      return layer;
    };

    const activeCity =
      plan.cities.find((c) => c.hotels.some((e) => e.hotel.id === focusedHotelId)) ?? plan.cities[0];
    const active = chosenEvaluation(activeCity, recommendedHotels);

    // Şehirler arası geçiş: ağırlık merkezleri arasında kesikli tren hattı
    for (const t of plan.transfers) {
      if (t.isReturn) continue;
      const from = plan.cities.find((c) => c.city === t.from)!;
      const to = plan.cities.find((c) => c.city === t.to)!;
      add(
        L.polyline([toLatLng(from.center), toLatLng(to.center)], {
          color: TRANSIT_MODE_META.train.color,
          weight: 2.5,
          opacity: 0.55,
          dashArray: "4, 12",
          lineCap: "round",
          interactive: false,
          className: "route-flow route-flow--slow",
        }),
      );
    }

    // Otel → mekan hatları (aktif şehir). Pro: neon metro hattı + istasyon pinleri + yol tarifi popup'ı;
    // yürüyüş ayakları taşıt renginde etiketli. Ücretsiz: soluk gri kesikli önizleme, istasyon yok.
    if (active) {
      const hotelLatLng = toLatLng(active.hotel.coordinates);
      for (const leg of active.legs) {
        const place = activeCity.places.find((p) => p.id === leg.placeId)!;
        const route = leg.route;

        if (isPro && route) {
          const popup = routePopupHtml(leg, route, active.hotel, place);
          const popupOptions: L.PopupOptions = { className: "metro-popup", maxWidth: 280, minWidth: 260 };
          const linePath = route.path.map(toLatLng);
          // İstasyonlara yürüyüş bağlantıları (ince noktalı)
          for (const walk of [
            [hotelLatLng, toLatLng(route.from.coordinates)],
            [toLatLng(route.to.coordinates), toLatLng(place.coordinates)],
          ] as L.LatLngTuple[][]) {
            add(
              L.polyline(walk, {
                color: TRANSIT_MODE_META.walk.color,
                weight: 2,
                opacity: 0.85,
                dashArray: "2, 6",
                lineCap: "round",
                interactive: false,
                className: "route-flow route-flow--soft",
              }),
            );
          }
          // Çift katman neon: geniş yarı saydam parıltı + parlak çekirdek (tıklanınca yol tarifi)
          add(
            L.polyline(linePath, {
              color: route.color,
              weight: 10,
              opacity: 0.35,
              lineCap: "round",
              lineJoin: "round",
              className: "route-glow metro-glow",
            }),
          ).bindPopup(popup, popupOptions);
          const core = add(
            L.polyline(linePath, {
              color: route.color,
              weight: 4,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
              className: "metro-core",
            }),
          ).bindPopup(popup, popupOptions);
          const coreEl = core.getElement() as SVGElement | undefined;
          if (coreEl) coreEl.style.filter = `drop-shadow(0 0 3px ${route.color}) drop-shadow(0 0 9px ${route.color})`;
          // Hat üzerinde akan ışık
          add(
            L.polyline(linePath, {
              color: "#ffffff",
              weight: 1.6,
              opacity: 0.9,
              dashArray: "2, 14",
              lineCap: "round",
              interactive: false,
              className: "route-flow",
            }),
          );
          // Biniş & iniş istasyonu pinleri
          for (const [station, role] of [
            [route.from, "Biniş"],
            [route.to, "İniş"],
          ] as const) {
            add(
              L.marker(toLatLng(station.coordinates), {
                icon: htmlIcon(stationPin(station.name, role, leg, route.color), 24),
                title: `${station.name} ${route.stationWord}`,
                zIndexOffset: 700,
              }),
            ).bindPopup(popup, popupOptions);
          }
          const mid = linePath[Math.floor((linePath.length - 1) / 2)];
          const next = linePath[Math.min(linePath.length - 1, Math.floor((linePath.length - 1) / 2) + 1)];
          add(
            L.marker([(mid[0] + next[0]) / 2, (mid[1] + next[1]) / 2], {
              icon: htmlIcon(transitLabel(leg, route.color), 0),
              interactive: false,
              keyboard: false,
              zIndexOffset: 400,
            }),
          );
          continue;
        }

        const path: L.LatLngTuple[] = [hotelLatLng, toLatLng(place.coordinates)];
        const color = isPro ? TRANSIT_MODE_META[leg.mode].color : theme === "dark" ? "#94a3b8" : "#64748b";
        if (isPro) {
          add(L.polyline(path, { color, weight: 9, opacity: theme === "dark" ? 0.25 : 0.18, interactive: false }));
        }
        add(
          L.polyline(path, {
            color,
            weight: isPro ? 3.5 : 1.8,
            opacity: isPro ? 0.95 : 0.6,
            dashArray: leg.mode === "walk" || !isPro ? "2, 6" : undefined,
            lineCap: "round",
            interactive: false,
            className: leg.mode === "walk" || !isPro ? "route-flow route-flow--soft" : "route-core",
          }),
        );
        // Pro: dolu hattın üzerinde otelden mekana akan ışık
        if (isPro && leg.mode !== "walk") {
          add(
            L.polyline(path, {
              color: "#ffffff",
              weight: 1.6,
              opacity: 0.85,
              dashArray: "2, 14",
              lineCap: "round",
              interactive: false,
              className: "route-flow",
            }),
          );
        }
        if (isPro) {
          const mid: L.LatLngTuple = [(path[0][0] + path[1][0]) / 2, (path[0][1] + path[1][1]) / 2];
          add(L.marker(mid, { icon: htmlIcon(transitLabel(leg), 0), interactive: false, keyboard: false, zIndexOffset: 400 }));
        }
      }
    }

    // Mekan pinleri: aktif şehir parlak, diğer şehir(ler) soluk
    for (const city of plan.cities) {
      for (const place of city.places) {
        const pin = placePin(place);
        pin.classList.add("is-selected");
        if (city !== activeCity) pin.classList.add("is-muted");
        add(L.marker(toLatLng(place.coordinates), { icon: htmlIcon(pin, 30), title: place.name, keyboard: false }));
      }
    }

    // Otel pinleri: aktif şehrin 3 seçeneği (tıklayınca seçilir), diğer şehirlerde sadece seçili otel
    for (const city of plan.cities) {
      const chosenId = chosenEvaluation(city, recommendedHotels)?.hotel.id;
      for (const evaluation of city.hotels) {
        const { hotel } = evaluation;
        const isChosen = hotel.id === chosenId;
        if (city !== activeCity && !isChosen) continue;
        const state = city === activeCity && isChosen ? "focused" : isChosen ? "chosen" : "option";
        const marker = add(
          L.marker(toLatLng(hotel.coordinates), {
            icon: htmlIcon(hotelPin(hotel, state), state === "focused" ? 40 : 28),
            title: hotel.name,
            zIndexOffset: state === "focused" ? 900 : 600,
          }),
        );
        marker.on("click", () => chooseHotel(evaluation.hotel));
      }
    }

    // Kamera: aktif şehrin mekanları + odaklanan otel
    const cameraKey = `${activeCity.city}|${active?.hotel.id ?? ""}`;
    if (hotelCameraKeyRef.current !== cameraKey) {
      hotelCameraKeyRef.current = cameraKey;
      const points = activeCity.places.map((p) => toLatLng(p.coordinates));
      if (active) points.push(toLatLng(active.hotel.coordinates));
      map.flyToBounds(L.latLngBounds(points), { ...cameraPadding(map), maxZoom: 14, duration: 1.2 });
    }

    return () => layers.forEach((l) => l.remove());
  }, [mapReady, mode, theme, isPro, plan, focusedHotelId, recommendedHotels, chooseHotel]);

  return (
    <div className={cn("relative overflow-hidden bg-[#e2e8f0] dark:bg-[#080C16] print:hidden", className)}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {mode === "hotel" && !isPro && (
        <button
          type="button"
          onClick={openUpgradeModal}
          className="absolute inset-x-0 bottom-9 z-[600] mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-amber-400/50 bg-[#0a0d20]/85 px-4 py-2 text-left text-[11px] font-semibold leading-snug text-amber-100 shadow-[0_10px_30px_-10px_rgba(245,158,11,0.7)] backdrop-blur-xl transition hover:border-amber-300 hover:bg-[#0a0d20]/95 sm:text-xs"
        >
          <span aria-hidden>🔒</span>
          <span>Parlak Metro Hatları, İstasyon Konumları ve Yol Tarifi için Pro&apos;ya Geçin</span>
        </button>
      )}
      {overlayVisible && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="glass flex items-center gap-3 rounded-full px-5 py-2.5 text-sm text-ink/70">
            <span className="h-2 w-2 animate-ping rounded-full bg-blue-500" />
            Harita yükleniyor…
          </div>
        </div>
      )}
    </div>
  );
}
