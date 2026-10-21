import { centerOfMass, distance, featureCollection, point } from "@turf/turf";
import { getHotelsForRegion } from "@/data/mockHotels";
import { CITY_LINES } from "@/data/transitLines";
import { HOURS_PER_DAY } from "@/data/mockPlaces";
import { generateHotels, getDestinationProfile } from "@/lib/globalDiscovery";
import { formatDurationLocale, translate, type Locale } from "@/lib/i18n";
import type {
  Airport,
  Hotel,
  IntercityTransfer,
  LngLat,
  Place,
  TransitLeg,
  TransitMode,
  TransitRoute,
  TransitStation,
} from "@/types/trip";

/** Her mekan için şehir içi ulaşım/ara verme payı (saat) — gün hesabına eklenir */
const TRAVEL_OVERHEAD_HOURS = 0.75;
/** Kuş uçuşu mesafeyi gerçek sokak/hat mesafesine çeviren katsayı */
const ROUTE_FACTOR = 1.3;
const WALK_SPEED_KMH = 4.8;

export const TRANSIT_MODE_META: Record<TransitMode, { label: string; color: string; emoji: string }> = {
  walk: { label: "Yürüyüş", color: "#22c55e", emoji: "🚶" },
  metro: { label: "Metro", color: "#8b5cf6", emoji: "🚇" },
  bus: { label: "Otobüs", color: "#f97316", emoji: "🚌" },
  tram: { label: "Tramvay", color: "#06b6d4", emoji: "🚋" },
  train: { label: "Tren", color: "#ef4444", emoji: "🚆" },
};

interface TransitOption {
  mode: Exclude<TransitMode, "walk">;
  line: string;
  /** Sabit bilet (USD) */
  fare: number;
  /** Mesafeye bağlı ek ücret (USD / km) */
  perKm: number;
  speedKmh: number;
}

interface CityTransitProfile {
  /** Bu mesafeye kadar (kuş uçuşu km) yürünür */
  walkMaxKm: number;
  primary: TransitOption;
  /** Uzak mekanlar için banliyö treni / hat otobüsü */
  long?: TransitOption & { minKm: number };
}

const DEFAULT_PROFILE: CityTransitProfile = {
  walkMaxKm: 1.3,
  primary: { mode: "metro", line: "City Metro", fare: 2, perKm: 0, speedKmh: 25 },
};

/** Şehir içi ulaşım simülasyonu: gerçekçi hat adları ve tek yön bilet fiyatları (USD) */
const CITY_TRANSIT: Record<string, CityTransitProfile> = {
  Tokyo: { walkMaxKm: 1.3, primary: { mode: "metro", line: "Tokyo Metro / Toei", fare: 1.2, perKm: 0.08, speedKmh: 28 } },
  Kyoto: {
    walkMaxKm: 1.5,
    primary: { mode: "bus", line: "Kyoto City Bus", fare: 1.6, perKm: 0, speedKmh: 15 },
    long: { mode: "train", line: "JR Nara / Sagano Line", fare: 1.3, perKm: 0.12, speedKmh: 34, minKm: 3.5 },
  },
  Roma: { walkMaxKm: 1.4, primary: { mode: "metro", line: "Metro A/B · Tram 8", fare: 1.65, perKm: 0, speedKmh: 20 } },
  Floransa: { walkMaxKm: 1.8, primary: { mode: "tram", line: "T1/T2 Tramvay", fare: 1.85, perKm: 0, speedKmh: 16 } },
  Paris: { walkMaxKm: 1.3, primary: { mode: "metro", line: "Paris Métro", fare: 2.3, perKm: 0, speedKmh: 24 } },
  Nice: {
    walkMaxKm: 1.5,
    primary: { mode: "tram", line: "Tram L1/L2", fare: 1.9, perKm: 0, speedKmh: 17 },
    long: { mode: "bus", line: "Lignes d'Azur 82", fare: 1.9, perKm: 0, speedKmh: 24, minKm: 5 },
  },
  "New York": { walkMaxKm: 1.2, primary: { mode: "metro", line: "NYC Subway", fare: 2.9, perKm: 0, speedKmh: 26 } },
  "Washington D.C.": {
    walkMaxKm: 1.4,
    primary: { mode: "metro", line: "Metrorail", fare: 2.25, perKm: 0.12, speedKmh: 30 },
  },
  Seul: { walkMaxKm: 1.2, primary: { mode: "metro", line: "Seoul Metro", fare: 1.05, perKm: 0.05, speedKmh: 30 } },
  Busan: {
    walkMaxKm: 1.2,
    primary: { mode: "metro", line: "Busan Metro", fare: 1.1, perKm: 0.05, speedKmh: 30 },
  },
  // Küresel havuz (profili olmayan şehirler DEFAULT_PROFILE kullanır)
  Londra: { walkMaxKm: 1.3, primary: { mode: "metro", line: "London Underground", fare: 3.5, perKm: 0, speedKmh: 27 } },
  Barselona: { walkMaxKm: 1.4, primary: { mode: "metro", line: "Metro de Barcelona", fare: 2.6, perKm: 0, speedKmh: 24 } },
  Madrid: { walkMaxKm: 1.4, primary: { mode: "metro", line: "Metro de Madrid", fare: 1.9, perKm: 0, speedKmh: 26 } },
  Berlin: { walkMaxKm: 1.3, primary: { mode: "metro", line: "U-Bahn / S-Bahn", fare: 3.8, perKm: 0, speedKmh: 28 } },
  Münih: { walkMaxKm: 1.3, primary: { mode: "metro", line: "MVG U-Bahn", fare: 4, perKm: 0, speedKmh: 28 } },
  Amsterdam: { walkMaxKm: 1.5, primary: { mode: "tram", line: "GVB Tramvay", fare: 3.6, perKm: 0, speedKmh: 16 } },
  Atina: { walkMaxKm: 1.4, primary: { mode: "metro", line: "Athens Metro", fare: 1.3, perKm: 0, speedKmh: 26 } },
  Lizbon: { walkMaxKm: 1.2, primary: { mode: "tram", line: "Carris Tram 28 / Metro", fare: 2, perKm: 0, speedKmh: 15 } },
  Prag: { walkMaxKm: 1.5, primary: { mode: "tram", line: "DPP Tramvay", fare: 1.4, perKm: 0, speedKmh: 18 } },
  Viyana: { walkMaxKm: 1.4, primary: { mode: "metro", line: "Wiener Linien U-Bahn", fare: 2.6, perKm: 0, speedKmh: 27 } },
  Budapeşte: { walkMaxKm: 1.4, primary: { mode: "metro", line: "BKV Metro / Tram 2", fare: 1.1, perKm: 0, speedKmh: 24 } },
  Zürih: { walkMaxKm: 1.5, primary: { mode: "tram", line: "VBZ Tram", fare: 3.2, perKm: 0, speedKmh: 18 } },
  Bangkok: { walkMaxKm: 1, primary: { mode: "metro", line: "BTS Skytrain / MRT", fare: 0.9, perKm: 0.08, speedKmh: 28 } },
  Singapur: { walkMaxKm: 1.2, primary: { mode: "metro", line: "SMRT MRT", fare: 1, perKm: 0.06, speedKmh: 32 } },
  Pekin: { walkMaxKm: 1.2, primary: { mode: "metro", line: "Beijing Subway", fare: 0.5, perKm: 0.03, speedKmh: 32 } },
  Şanghay: { walkMaxKm: 1.2, primary: { mode: "metro", line: "Shanghai Metro", fare: 0.5, perKm: 0.03, speedKmh: 32 } },
  Hanoi: { walkMaxKm: 1.2, primary: { mode: "bus", line: "Hanoi Bus / Grab", fare: 0.4, perKm: 0.25, speedKmh: 14 } },
  "Yeni Delhi": { walkMaxKm: 1, primary: { mode: "metro", line: "Delhi Metro", fare: 0.4, perKm: 0.02, speedKmh: 32 } },
  Kahire: { walkMaxKm: 1, primary: { mode: "metro", line: "Cairo Metro", fare: 0.2, perKm: 0, speedKmh: 28 } },
  Dubai: { walkMaxKm: 1, primary: { mode: "metro", line: "Dubai Metro (Red/Green)", fare: 1.4, perKm: 0.08, speedKmh: 40 } },
  Meksiko: { walkMaxKm: 1.2, primary: { mode: "metro", line: "Metro CDMX", fare: 0.3, perKm: 0, speedKmh: 26 } },
  Toronto: { walkMaxKm: 1.3, primary: { mode: "metro", line: "TTC Subway", fare: 2.4, perKm: 0, speedKmh: 26 } },
  Montreal: { walkMaxKm: 1.3, primary: { mode: "metro", line: "STM Métro", fare: 2.6, perKm: 0, speedKmh: 26 } },
  "Buenos Aires": { walkMaxKm: 1.3, primary: { mode: "metro", line: "Subte", fare: 0.5, perKm: 0, speedKmh: 24 } },
  "Rio de Janeiro": { walkMaxKm: 1.2, primary: { mode: "metro", line: "MetrôRio", fare: 1.4, perKm: 0, speedKmh: 30 } },
  Sidney: { walkMaxKm: 1.3, primary: { mode: "train", line: "Sydney Trains / Metro", fare: 3.2, perKm: 0.05, speedKmh: 32 } },
  Melbourne: { walkMaxKm: 1.5, primary: { mode: "tram", line: "Yarra Trams", fare: 3.3, perKm: 0, speedKmh: 16 } },
};

/** Şehirler arası geçişler (çift yönlü, kişi başı USD) */
const INTERCITY: { a: string; b: string; mode: IntercityTransfer["mode"]; name: string; minutes: number; cost: number }[] = [
  { a: "Tokyo", b: "Kyoto", mode: "train", name: "Shinkansen", minutes: 135, cost: 95 },
  { a: "Roma", b: "Floransa", mode: "train", name: "Frecciarossa", minutes: 95, cost: 45 },
  { a: "Paris", b: "Nice", mode: "train", name: "TGV INOUI", minutes: 345, cost: 85 },
  { a: "New York", b: "Washington D.C.", mode: "train", name: "Amtrak Acela", minutes: 175, cost: 120 },
  { a: "Seul", b: "Busan", mode: "train", name: "KTX", minutes: 155, cost: 45 },
  // Küresel havuz
  { a: "Barselona", b: "Madrid", mode: "train", name: "AVE", minutes: 150, cost: 60 },
  { a: "Londra", b: "Edinburgh", mode: "train", name: "LNER Azuma", minutes: 270, cost: 75 },
  { a: "Berlin", b: "Münih", mode: "train", name: "ICE Sprinter", minutes: 240, cost: 70 },
  { a: "Amsterdam", b: "Rotterdam", mode: "train", name: "NS Intercity Direct", minutes: 40, cost: 17 },
  { a: "Atina", b: "Santorini", mode: "flight", name: "Aegean Airlines", minutes: 50, cost: 75 },
  { a: "Lizbon", b: "Porto", mode: "train", name: "Alfa Pendular", minutes: 175, cost: 35 },
  { a: "Prag", b: "Český Krumlov", mode: "bus", name: "RegioJet Bus", minutes: 180, cost: 10 },
  { a: "Viyana", b: "Salzburg", mode: "train", name: "ÖBB Railjet", minutes: 150, cost: 40 },
  { a: "Zürih", b: "Luzern", mode: "train", name: "SBB InterRegio", minutes: 45, cost: 30 },
  { a: "Dubrovnik", b: "Split", mode: "bus", name: "FlixBus Coastal", minutes: 270, cost: 25 },
  { a: "Tiflis", b: "Batum", mode: "train", name: "Stadler Express", minutes: 330, cost: 15 },
  { a: "Bangkok", b: "Phuket", mode: "flight", name: "Thai AirAsia", minutes: 85, cost: 55 },
  { a: "Ubud", b: "Seminyak", mode: "bus", name: "Kura-Kura Shuttle / Private Driver", minutes: 75, cost: 12 },
  { a: "Hanoi", b: "Ho Chi Minh", mode: "flight", name: "Vietnam Airlines", minutes: 130, cost: 65 },
  { a: "Pekin", b: "Şanghay", mode: "train", name: "Fuxing Hao", minutes: 270, cost: 90 },
  { a: "Yeni Delhi", b: "Agra", mode: "train", name: "Gatimaan Express", minutes: 100, cost: 12 },
  { a: "Agra", b: "Jaipur", mode: "train", name: "Ajmer Shatabdi Express", minutes: 240, cost: 10 },
  { a: "Yeni Delhi", b: "Jaipur", mode: "train", name: "Vande Bharat Express", minutes: 270, cost: 14 },
  { a: "Sidney", b: "Melbourne", mode: "flight", name: "Qantas", minutes: 95, cost: 85 },
  { a: "Dubai", b: "Abu Dabi", mode: "bus", name: "RTA E101 Bus", minutes: 120, cost: 7 },
  { a: "Amman", b: "Petra", mode: "bus", name: "JETT Bus", minutes: 210, cost: 15 },
  { a: "Kahire", b: "Luksor", mode: "flight", name: "EgyptAir", minutes: 70, cost: 75 },
  { a: "Marakeş", b: "Fes", mode: "train", name: "ONCF Express", minutes: 420, cost: 35 },
  { a: "Rio de Janeiro", b: "São Paulo", mode: "flight", name: "Ponte Aérea (LATAM)", minutes: 60, cost: 70 },
  { a: "Meksiko", b: "Cancún", mode: "flight", name: "Aeroméxico", minutes: 135, cost: 80 },
  { a: "Toronto", b: "Montreal", mode: "train", name: "VIA Rail Corridor", minutes: 300, cost: 70 },
  { a: "Lima", b: "Cusco", mode: "flight", name: "LATAM", minutes: 85, cost: 95 },
];

/** Bu mesafenin (km) üzerindeki bilinmeyen şehir çiftleri iç hat uçuşuyla bağlanır */
const DOMESTIC_FLIGHT_KM = 650;

export interface HotelEvaluation {
  /** `nights` plan tarafından atanmış otel */
  hotel: Hotel;
  /** 0–99 "Merkezilik Puanı (%XX Rotana Uygun)" */
  score: number;
  /** Seçili mekanlara ortalama kuş uçuşu mesafe (km) */
  avgDistanceKm: number;
  /** İdeal otel bölgesine (ağırlık merkezi) uzaklık (km) */
  centerDistanceKm: number;
  legs: TransitLeg[];
  /** Kişi başı şehir içi ulaşım: her mekana gidiş-dönüş (USD) */
  transitCost: number;
}

export interface CityPlan {
  city: string;
  places: Place[];
  /** Σ recommendedDuration (saat) */
  visitHours: number;
  days: number;
  nights: number;
  /** Gün aralığı (1 tabanlı, dahil) */
  dayStart: number;
  dayEnd: number;
  /** Akıllı otel bölgesi: seçili mekanların ağırlık merkezi */
  center: LngLat;
  /** Merkezden mekanlara ortalama mesafe — merkezilik puanının referansı */
  idealAvgKm: number;
  /** Puana göre sıralı (en uygun önce) */
  hotels: HotelEvaluation[];
}

export interface TripPlan {
  cities: CityPlan[];
  /** Ardışık şehir geçişleri (+ gerekiyorsa uçuş için dönüş) */
  transfers: IntercityTransfer[];
  totalDays: number;
  totalPlaces: number;
}

const km = (a: LngLat, b: LngLat) => distance(point(a), point(b), { units: "kilometers" });
const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

type RideMode = Exclude<TransitMode, "walk">;

/** İstasyona en fazla bu kadar (kuş uçuşu km) yürünür; aşılırsa sentetik istasyon üretilir */
const STATION_MAX_WALK_KM = 1.2;
/** Durak başına ortalama sürüş (dk) */
const STOP_MINUTES: Record<RideMode, number> = { metro: 2, tram: 2.5, bus: 3, train: 3 };
/** Sentetik hatlarda duraklar arası mesafe (km) */
const SYNTHETIC_STOP_KM: Record<RideMode, number> = { metro: 1.1, tram: 0.6, bus: 0.5, train: 2.5 };
const SYNTHETIC_HEADWAY: Record<RideMode, number> = { metro: 5, tram: 8, bus: 10, train: 12 };
const SYNTHETIC_COLORS: [string, string][] = [
  ["Kırmızı Hat", "#ef4444"],
  ["Mavi Hat", "#3b82f6"],
  ["Yeşil Hat", "#22c55e"],
  ["Turuncu Hat", "#f97316"],
  ["Mor Hat", "#a855f7"],
  ["Sarı Hat", "#eab308"],
  ["Pembe Hat", "#ec4899"],
  ["Turkuaz Hat", "#14b8a6"],
];

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const walkMinutes = (distKm: number) => Math.max(1, Math.round(((distKm * ROUTE_FACTOR) / WALK_SPEED_KMH) * 60));
const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

type RouteCore = Omit<TransitRoute, "waitMinutes" | "walkToMinutes" | "walkFromMinutes">;

/** Otel ve mekana en yakın istasyonları AYNI hat üzerinde arar (gerçek hat verisi olan şehirler) */
function realLineRoute(hotel: Hotel, place: Place, directKm: number, mode: RideMode): RouteCore | null {
  const lines = CITY_LINES[place.cityRegion];
  if (!lines) return null;

  let best: { core: RouteCore; score: number } | null = null;
  for (const line of lines) {
    const stations: TransitStation[] = line.stations.map(([name, lng, lat]) => ({ name, coordinates: [lng, lat] }));
    const nearest = (p: LngLat) =>
      stations.reduce(
        (b, s, i) => {
          const d = km(p, s.coordinates);
          return d < b.d ? { i, d } : b;
        },
        { i: -1, d: Infinity },
      );
    const a = nearest(hotel.coordinates);
    const b = nearest(place.coordinates);
    if (a.i === b.i || a.d > STATION_MAX_WALK_KM || b.d > STATION_MAX_WALK_KM) continue;
    // İstasyonlara yürümek, mekana doğrudan yürümekten belirgin şekilde kısa olmalı
    if (a.d + b.d >= directKm * 0.9) continue;

    const n = stations.length;
    const forward = (((b.i - a.i) % n) + n) % n;
    const goForward = line.loop ? forward <= n - forward : b.i > a.i;
    const stops = line.loop ? Math.min(forward, n - forward) : Math.abs(b.i - a.i);
    const path: LngLat[] = [];
    for (let k = 0, i = a.i; k <= stops; k++, i = (i + (goForward ? 1 : -1) + n) % n) path.push(stations[i].coordinates);
    const pathKm = path.slice(1).reduce((s, c, i) => s + km(path[i], c), 0);
    const rideMinutes = Math.round(Math.max(stops * STOP_MINUTES[mode], (pathKm / 30) * 60));

    const score = a.d + b.d + stops * 0.15;
    if (!best || score < best.score) {
      best = {
        score,
        core: {
          line: line.name,
          colorName: line.colorName,
          color: line.color,
          direction: goForward ? line.termini[1] : line.termini[0],
          from: stations[a.i],
          to: stations[b.i],
          stops,
          headwayMinutes: line.headway,
          firstDeparture: line.firstDeparture,
          rideMinutes,
          path,
        },
      };
    }
  }
  return best?.core ?? null;
}

/** Hat verisi olmayan şehir / uzak mekan: otel semtinde ve mekan yakınında simüle istasyonlar */
function syntheticRoute(hotel: Hotel, place: Place, option: TransitOption, directKm: number): RouteCore {
  const seed = hashOf(`${place.cityRegion}|${hotel.id}|${place.id}`);
  const [colorName, color] = SYNTHETIC_COLORS[seed % SYNTHETIC_COLORS.length];
  const t = Math.min(0.3, 0.35 / Math.max(directKm, 0.01));
  const fromCoords = lerp(hotel.coordinates, place.coordinates, t);
  const toCoords = lerp(place.coordinates, hotel.coordinates, t);
  const rideKm = km(fromCoords, toCoords) * ROUTE_FACTOR;
  const stops = Math.max(1, Math.round(rideKm / SYNTHETIC_STOP_KM[option.mode]));
  const area = hotel.area.replace(/\s+(çevresi|merkez)$/i, "").split(/[,·/]/)[0].trim() || hotel.cityRegion;
  const to = place.name.split(/[(,]/)[0].trim();
  const line = option.mode === "bus" ? `${option.line} ${100 + (seed % 280)}` : option.line;
  return {
    line,
    colorName,
    color,
    direction: to,
    from: { name: area, coordinates: fromCoords },
    to: { name: to, coordinates: toCoords },
    stops,
    headwayMinutes: SYNTHETIC_HEADWAY[option.mode],
    firstDeparture: option.mode === "bus" ? "05:45" : "05:30",
    rideMinutes: Math.max(2, Math.round((rideKm / option.speedKmh) * 60)),
    path: [fromCoords, toCoords],
  };
}

function finishRoute(core: RouteCore, hotel: Hotel, place: Place): TransitRoute {
  return {
    ...core,
    walkToMinutes: walkMinutes(km(hotel.coordinates, core.from.coordinates)),
    waitMinutes: Math.ceil(core.headwayMinutes / 2),
    walkFromMinutes: walkMinutes(km(core.to.coordinates, place.coordinates)),
  };
}

/** Otelden mekana en mantıklı taşıt: yakınsa yürüyüş, uzaksa banliyö hattı, diğerleri şehir hattı (+ istasyon bazlı tarif) */
export function planLeg(hotel: Hotel, place: Place): TransitLeg {
  const profile = CITY_TRANSIT[place.cityRegion] ?? DEFAULT_PROFILE;
  const d = km(hotel.coordinates, place.coordinates);
  const routeKm = d * ROUTE_FACTOR;

  if (d <= profile.walkMaxKm) {
    return {
      placeId: place.id,
      mode: "walk",
      line: "Yürüyüş",
      distanceKm: round2(d),
      minutes: Math.max(3, Math.round((routeKm / WALK_SPEED_KMH) * 60)),
      cost: 0,
    };
  }

  const option = profile.long && d >= profile.long.minKm ? profile.long : profile.primary;
  // Gerçek hat verisi sadece şehrin ana raylı sisteminde kullanılır (otobüs / banliyö hattı sentetik)
  const real = option === profile.primary && option.mode !== "bus" ? realLineRoute(hotel, place, d, option.mode) : null;
  const route = finishRoute(real ?? syntheticRoute(hotel, place, option, d), hotel, place);
  return {
    placeId: place.id,
    mode: option.mode,
    line: route.line,
    distanceKm: round2(d),
    minutes: route.walkToMinutes + route.waitMinutes + route.rideMinutes + route.walkFromMinutes,
    cost: round2(option.fare + option.perKm * routeKm),
    route,
  };
}

/** "Shibuya İstasyonu" / "Shibuya Station" / "渋谷駅" (otobüste durak) */
export function stationLabel(locale: Locale, mode: TransitMode, name: string): string {
  return translate(locale, mode === "bus" ? "st.stop" : "st.station", { name });
}

/** "Her 4 dk'da bir • İlk sefer 05:30" (seçili dilde) */
export function formatFrequency(route: TransitRoute, locale: Locale): string {
  const first = /^\d/.test(route.firstDeparture)
    ? translate(locale, "unit.firstDeparture", { time: route.firstDeparture })
    : route.firstDeparture;
  return `${translate(locale, "unit.every", { n: route.headwayMinutes })} • ${first}`;
}

/** Yürüyüş ayağı dahil her ayak için adım adım tarif (seçili dilde) */
export function legSteps(leg: TransitLeg, place: Place, locale: Locale): string[] {
  const route = leg.route;
  const min = (m: number) => formatDurationLocale(locale, m);
  if (!route) return [translate(locale, "rs.walkTo", { min: min(leg.minutes), to: place.name })];
  const from = stationLabel(locale, leg.mode, route.from.name);
  const to = stationLabel(locale, leg.mode, route.to.name);
  return [
    translate(locale, "rs.walkTo", { min: min(route.walkToMinutes), to: from }),
    translate(locale, "rs.board", { station: from, line: route.line, dir: route.direction }),
    translate(locale, "rs.alight", { n: route.stops, station: to }),
    translate(locale, "rs.walkFrom", { min: min(route.walkFromMinutes), to: place.name }),
  ];
}

/** Google Maps gerçek yol tarifi (ücretsiz URL şeması, API anahtarı yok) */
export function directionsUrl(from: LngLat, to: LngLat, mode: TransitMode): string {
  const ll = ([lng, lat]: LngLat) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const travelmode = mode === "walk" ? "walking" : "transit";
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(from)}&destination=${ll(to)}&travelmode=${travelmode}`;
}

function evaluateHotel(hotel: Hotel, city: Pick<CityPlan, "places" | "center" | "idealAvgKm" | "nights">): HotelEvaluation {
  const avgDistanceKm = mean(city.places.map((p) => km(hotel.coordinates, p.coordinates)));
  const centerDistanceKm = km(hotel.coordinates, city.center);
  // Ağırlık merkezindeki varsayımsal otel ~99; uzaklaştıkça hem ortalama mesafe farkı hem merkezden sapma cezalandırılır
  const penalty = Math.max(0, avgDistanceKm - city.idealAvgKm) * 8 + centerDistanceKm * 3;
  const score = Math.round(Math.min(99, Math.max(35, 100 - penalty)));
  const legs = city.places.map((p) => planLeg(hotel, p));

  return {
    hotel: { ...hotel, nights: city.nights },
    score,
    avgDistanceKm: round2(avgDistanceKm),
    centerDistanceKm: round2(centerDistanceKm),
    legs,
    transitCost: round2(legs.reduce((s, l) => s + l.cost * 2, 0)),
  };
}

function transferBetween(from: CityPlan, to: CityPlan, isReturn = false): IntercityTransfer {
  const known = INTERCITY.find((t) => (t.a === from.city && t.b === to.city) || (t.a === to.city && t.b === from.city));
  if (known) return { from: from.city, to: to.city, mode: known.mode, name: known.name, minutes: known.minutes, cost: known.cost, isReturn };

  // Tabloda yoksa: uzak şehirler iç hat uçuşu, yakınlar mesafeye göre bölgesel tren tahmini
  const d = km(from.center, to.center);
  if (d > DOMESTIC_FLIGHT_KM) {
    return {
      from: from.city,
      to: to.city,
      mode: "flight",
      name: "İç Hat Uçuşu",
      minutes: Math.round(100 + (d / 750) * 60),
      cost: Math.round(45 + d * 0.06),
      isReturn,
    };
  }
  return {
    from: from.city,
    to: to.city,
    mode: "train",
    name: "Bölgesel Tren",
    minutes: Math.round(30 + (d / 110) * 60),
    cost: Math.round(10 + d * 0.12),
    isReturn,
  };
}

/**
 * Akıllı şehir bölüştürme + otel merkezi:
 * 1. Mekanları `cityRegion`'a göre gruplar; varış havalimanına en yakın şehir ilk sırada.
 * 2. Gün = ceil((Σ süre + mekan başı ulaşım payı) / HOURS_PER_DAY); ilk şehre +1 varış/jet-lag günü.
 * 3. İdeal otel bölgesi = `turf.centerOfMass` (seçili mekanlar); her otel `turf.distance` ile puanlanır.
 * 4. Birden çok şehir varsa geçiş treni ve (uçuş varış şehrinden döndüğü için) dönüş eklenir.
 */
export function buildTripPlan(places: Place[], arrival: Airport): TripPlan {
  const groups = new Map<string, Place[]>();
  for (const p of places) groups.set(p.cityRegion, [...(groups.get(p.cityRegion) ?? []), p]);

  const drafts = [...groups.entries()].map(([city, cityPlaces]) => {
    const center = centerOfMass(featureCollection(cityPlaces.map((p) => point(p.coordinates)))).geometry
      .coordinates as LngLat;
    return {
      city,
      places: cityPlaces,
      center,
      visitHours: cityPlaces.reduce((s, p) => s + p.recommendedDuration, 0),
      idealAvgKm: mean(cityPlaces.map((p) => km(center, p.coordinates))),
    };
  });
  drafts.sort((a, b) => km(arrival.coordinates, a.center) - km(arrival.coordinates, b.center));

  let dayCursor = 1;
  const cities: CityPlan[] = drafts.map((draft, i) => {
    const workHours = draft.visitHours + draft.places.length * TRAVEL_OVERHEAD_HOURS;
    const days = Math.max(1, Math.ceil(workHours / HOURS_PER_DAY)) + (i === 0 ? 1 : 0);
    const base = { ...draft, days, nights: days, dayStart: dayCursor, dayEnd: dayCursor + days - 1 };
    dayCursor += days;
    // Kürasyonlu otel yoksa: ağırlık merkezi etrafında maliyet endeksine göre üretilen 3 otel
    const curatedHotels = getHotelsForRegion(draft.city);
    const hotelPool = curatedHotels.length
      ? curatedHotels
      : generateHotels(draft.city, draft.center, draft.places, getDestinationProfile(arrival).costIndex);
    const hotels = hotelPool
      .map((h) => evaluateHotel(h, base))
      .sort((a, b) => b.score - a.score);
    return { ...base, hotels };
  });

  const transfers: IntercityTransfer[] = [];
  for (let i = 1; i < cities.length; i++) transfers.push(transferBetween(cities[i - 1], cities[i]));
  if (cities.length > 1) transfers.push(transferBetween(cities[cities.length - 1], cities[0], true));

  return { cities, transfers, totalDays: dayCursor - 1, totalPlaces: places.length };
}

/** Şehrin varsayılan oteli: en yüksek merkezilik puanı (eşitlikte F/P Merkez) */
export function defaultHotel(city: CityPlan): HotelEvaluation | undefined {
  return [...city.hotels].sort(
    (a, b) => b.score - a.score || Number(b.hotel.tier === "central") - Number(a.hotel.tier === "central"),
  )[0];
}

/** Şehirde seçili otelin değerlendirmesi (yoksa varsayılan) */
export function chosenEvaluation(city: CityPlan, chosen: Hotel[]): HotelEvaluation | undefined {
  const pick = chosen.find((h) => h.cityRegion === city.city);
  return city.hotels.find((e) => e.hotel.id === pick?.id) ?? defaultHotel(city);
}

/** Kişi başı toplam ulaşım (USD, tam sayı): seçili otellerden şehir içi gidiş-dönüşler + şehirler arası geçişler */
export function computeTransitCost(plan: TripPlan, chosen: Hotel[]): number {
  const local = plan.cities.reduce((s, c) => s + (chosenEvaluation(c, chosen)?.transitCost ?? 0), 0);
  const intercity = plan.transfers.reduce((s, t) => s + t.cost, 0);
  return Math.round(local + intercity);
}

export function formatMinutes(min: number, locale: Locale): string {
  return formatDurationLocale(locale, min);
}
