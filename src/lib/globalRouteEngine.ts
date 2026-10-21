import { ALL_AIRPORTS, findAirport } from "@/data/airports";
import { COUNTRIES, COUNTRY_ISO_BY_NAME, type CountryInfo } from "@/data/worldAirports";
import type { DestinationProfile } from "@/lib/globalDiscovery";
import type { Airport, LngLat } from "@/types/trip";

/**
 * Küresel rota motoru — dünyadaki herhangi iki havalimanı için:
 * 1. Haversine mesafe, tahmini uçuş süresi ve saat dilimi farkı (`routeInfo`).
 * 2. Gerçek havayolları + gerçek aktarma merkezleriyle uçuş şablonları (`generateFlightTemplates`);
 *    direkt uçuş olasılığı havalimanı kademesine (hub / büyük / bölgesel) ve mesafeye göre belirlenir,
 *    hiçbir rota boş dönmez.
 * 3. Kürasyonlu profili olmayan hedefler için şehir merkezli keşif profili (`profileForAirport`):
 *    canlı mekan keşfi + otel jeneratörü şehir merkezini, dil kartları ülkenin dilini kullanır.
 * 4. Koordinata en yakın havalimanı (`nearestAirport`) — otomatik kalkış seçimi için.
 */

const EARTH_RADIUS_KM = 6371;
const CRUISE_SPEED_KMH = 830;
const GROUND_BUFFER_MIN = 35;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Büyük daire (Haversine) mesafesi, km — koordinatlar [lng, lat] */
export function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const estimateFlightMinutes = (km: number) => Math.round((km / CRUISE_SPEED_KMH) * 60 + GROUND_BUFFER_MIN);

export interface RouteInfo {
  distanceKm: number;
  /** Kesintisiz uçuşun tahmini süresi (dakika) */
  directMinutes: number;
  /** Varış yerel saati − kalkış yerel saati (saat; 5.5 gibi kesirli olabilir) */
  timeDiffHours: number;
}

export function routeInfo(origin: Airport, destination: Airport): RouteInfo {
  const distanceKm = Math.round(haversineKm(origin.coordinates, destination.coordinates));
  return {
    distanceKm,
    directMinutes: estimateFlightMinutes(distanceKm),
    timeDiffHours: destination.utcOffset - origin.utcOffset,
  };
}

/** Havalimanının ülke bilgisi (ISO kodu yoksa Türkçe ülke adından) */
export function countryOf(airport: Airport): CountryInfo | undefined {
  const iso = airport.countryCode ?? COUNTRY_ISO_BY_NAME[airport.country];
  return iso ? COUNTRIES[iso] : undefined;
}

/** Kürasyonlu profili olmayan hedef: tek şehir (şehir merkezi), ülkenin maliyet endeksi ve dili */
export function profileForAirport(airport: Airport): DestinationProfile {
  const country = countryOf(airport);
  return {
    continent: country?.continent ?? "Avrupa",
    cities: [{ name: airport.city, coordinates: airport.cityCenter ?? airport.coordinates }],
    costIndex: country?.costIndex ?? 1,
    language: country?.language ?? "en",
  };
}

/** Kademe cezası (km): şehir merkezine biraz daha uzak ama büyük havalimanı tercih edilir (Roma → FCO, CIA değil) */
const TIER_PENALTY_KM = 25;

/** [lng, lat] koordinatına en yakın havalimanı (kademe ağırlıklı) */
export function nearestAirport(coordinates: LngLat): { airport: Airport; distanceKm: number } {
  let best = ALL_AIRPORTS[0];
  let bestScore = Infinity;
  let bestKm = Infinity;
  for (const a of ALL_AIRPORTS) {
    const km = haversineKm(coordinates, a.coordinates);
    const score = km + ((a.tier ?? 2) - 1) * TIER_PENALTY_KM;
    if (score < bestScore) {
      best = a;
      bestScore = score;
      bestKm = km;
    }
  }
  return { airport: best, distanceKm: Math.round(bestKm) };
}

// ------------------------------------------------------------------ Uçuş şablonları

export interface FlightTemplate {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  /** Tanımlıysa aktarmalı uçuş (IATA kodu) */
  hub?: string;
  layoverMinutes?: number;
  /** Kişi başı gidiş-dönüş baz fiyat (USD). Kürasyonlu şablonlarda İstanbul (IST) çıkışlı, jeneratörde gerçek kalkışa göre. */
  basePrice: number;
  /** Yerel kalkış saati, "HH:MM" */
  departure: string;
  cabinBaggageKg: number;
  checkedBaggageKg: number;
  tags: string[];
}

/** Gerçek küresel aktarma merkezleri ve ana taşıyıcıları (aynı havayolunun ikinci hub'ı elenir) */
const HUB_CARRIERS: { hub: string; airline: string; code: string; checkedKg: number; tag: string }[] = [
  { hub: "IST", airline: "Türk Hava Yolları", code: "TK", checkedKg: 30, tag: "İstanbul aktarmalı" },
  { hub: "DOH", airline: "Qatar Airways", code: "QR", checkedKg: 30, tag: "Ödüllü servis" },
  { hub: "DXB", airline: "Emirates", code: "EK", checkedKg: 35, tag: "Geniş gövde" },
  { hub: "AUH", airline: "Etihad Airways", code: "EY", checkedKg: 30, tag: "Geniş gövde" },
  { hub: "FRA", airline: "Lufthansa", code: "LH", checkedKg: 23, tag: "Star Alliance" },
  { hub: "MUC", airline: "Lufthansa", code: "LH", checkedKg: 23, tag: "Star Alliance" },
  { hub: "VIE", airline: "Austrian Airlines", code: "OS", checkedKg: 23, tag: "Kısa aktarma" },
  { hub: "AMS", airline: "KLM", code: "KL", checkedKg: 23, tag: "SkyTeam" },
  { hub: "CDG", airline: "Air France", code: "AF", checkedKg: 23, tag: "SkyTeam" },
  { hub: "LHR", airline: "British Airways", code: "BA", checkedKg: 23, tag: "oneworld" },
  { hub: "MAD", airline: "Iberia", code: "IB", checkedKg: 23, tag: "oneworld" },
  { hub: "HEL", airline: "Finnair", code: "AY", checkedKg: 23, tag: "Kısa aktarma" },
  { hub: "SIN", airline: "Singapore Airlines", code: "SQ", checkedKg: 30, tag: "Ödüllü servis" },
  { hub: "HKG", airline: "Cathay Pacific", code: "CX", checkedKg: 23, tag: "oneworld" },
  { hub: "ICN", airline: "Korean Air", code: "KE", checkedKg: 23, tag: "SkyTeam" },
  { hub: "HND", airline: "ANA", code: "NH", checkedKg: 23, tag: "Star Alliance" },
  { hub: "PEK", airline: "Air China", code: "CA", checkedKg: 23, tag: "Star Alliance" },
  { hub: "DEL", airline: "Air India", code: "AI", checkedKg: 25, tag: "Star Alliance" },
  { hub: "KUL", airline: "Malaysia Airlines", code: "MH", checkedKg: 30, tag: "oneworld" },
  { hub: "BKK", airline: "Thai Airways", code: "TG", checkedKg: 30, tag: "Star Alliance" },
  { hub: "JFK", airline: "Delta Air Lines", code: "DL", checkedKg: 23, tag: "SkyTeam" },
  { hub: "ORD", airline: "United Airlines", code: "UA", checkedKg: 23, tag: "Star Alliance" },
  { hub: "SFO", airline: "United Airlines", code: "UA", checkedKg: 23, tag: "Star Alliance" },
  { hub: "MIA", airline: "American Airlines", code: "AA", checkedKg: 23, tag: "oneworld" },
  { hub: "YYZ", airline: "Air Canada", code: "AC", checkedKg: 23, tag: "Star Alliance" },
  { hub: "PTY", airline: "Copa Airlines", code: "CM", checkedKg: 23, tag: "Star Alliance" },
  { hub: "BOG", airline: "Avianca", code: "AV", checkedKg: 23, tag: "Star Alliance" },
  { hub: "GRU", airline: "LATAM", code: "LA", checkedKg: 23, tag: "Güney Amerika ağı" },
  { hub: "ADD", airline: "Ethiopian Airlines", code: "ET", checkedKg: 23, tag: "Star Alliance" },
  { hub: "SYD", airline: "Qantas", code: "QF", checkedKg: 23, tag: "oneworld" },
];

const DEPARTURES = ["01:35", "06:20", "08:45", "10:15", "13:40", "16:55", "19:30", "22:10"];

/** Bayrak taşıyıcının bu mesafeye (km) kadar direkt uçuşu olabilir */
const DIRECT_MAX_KM = 12_500;
/** Düşük maliyetli direkt seçenek bu mesafeye kadar */
const LOW_COST_MAX_KM = 3_800;
/** Aktarma rotası, direkt mesafenin en fazla bu katı olabilir */
const MAX_DETOUR = 1.55;
/** Sunulan en fazla aktarmalı seçenek */
const MAX_LAYOVER_OPTIONS = 3;

/** Gidiş-dönüş ekonomi fiyatı (kürasyonlu şablonlara kalibre: IST-HND ≈ $1.170, IST-FCO ≈ $275) */
const roundTripPrice = (routeKm: number) => 110 + routeKm * 0.118;

/** Basit string hash (her render'da aynı sonuç) */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * İki havalimanı arasında direkt uçuş gerçekçi mi?
 * İç hat (6.000 km'ye kadar) hep var; uluslararasında kademe toplamı küçüldükçe menzil uzar:
 * hub↔hub / hub↔büyük 12.500 km, büyük↔büyük / hub↔bölgesel 7.000 km, büyük↔bölgesel 3.500 km.
 */
function directPlausible(origin: Airport, destination: Airport, km: number): boolean {
  if (km > DIRECT_MAX_KM) return false;
  if (origin.country === destination.country) return km <= 6000;
  const tiers = (origin.tier ?? 2) + (destination.tier ?? 2);
  return tiers <= 3 || (tiers <= 4 && km <= 7000) || (tiers <= 5 && km <= 3500);
}

/**
 * Herhangi iki havalimanı için gerçekçi uçuş seçenekleri:
 * - Direkt uygunsa kalkış ülkesinin bayrak taşıyıcısı (yoksa varış ülkesininki); kısa mesafede ek düşük maliyetli.
 * - Sapma oranı en düşük en fazla 3 farklı havayolunun gerçek aktarma merkezi (Doha, Dubai, İstanbul, Frankfurt,
 *   Londra, Singapur, New York…).
 * - Hiçbir seçenek çıkmazsa en az sapan hub, o da yoksa bölgesel direkt uçuş sunulur (boş liste dönmez).
 * Fiyatlar gerçek kalkış noktasına göre hesaplanır; süreler `mockFlights.getFlights` ortak motorundan gelir.
 */
export function generateFlightTemplates(origin: Airport, destination: Airport): FlightTemplate[] {
  const directKm = haversineKm(origin.coordinates, destination.coordinates);
  const seed = (s: string) => hash(`${origin.code}-${destination.code}:${s}`);
  const templates: FlightTemplate[] = [];

  const home = countryOf(origin);
  const away = countryOf(destination);
  const directCarrier = home?.carrier ?? away?.carrier;
  const canFlyDirect = directPlausible(origin, destination, directKm);
  if (directCarrier && canFlyDirect) {
    templates.push({
      airline: directCarrier.airline,
      airlineCode: directCarrier.code,
      flightNumber: `${directCarrier.code}${(seed("direct") % 1800) + 10}`,
      basePrice: Math.round(roundTripPrice(directKm)),
      departure: DEPARTURES[seed("direct-dep") % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: directKm > 5000 ? 46 : 23,
      tags: ["En hızlı", "Kesintisiz"],
    });
  }
  // Uluslararası direkt hatta karşı ülkenin bayrak taşıyıcısı da uçar (JFK→LHR: United + British Airways)
  const awayCarrier = away?.carrier;
  if (canFlyDirect && home?.carrier && awayCarrier && awayCarrier.code !== home.carrier.code) {
    templates.push({
      airline: awayCarrier.airline,
      airlineCode: awayCarrier.code,
      flightNumber: `${awayCarrier.code}${(seed("away") % 1800) + 10}`,
      basePrice: Math.round(roundTripPrice(directKm) * 1.04),
      departure: DEPARTURES[(seed("away-dep") + 5) % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: directKm > 5000 ? 46 : 23,
      tags: ["Kesintisiz"],
    });
  }
  const lowCost = home?.lowCost ?? (origin.country === destination.country ? undefined : away?.lowCost);
  if (lowCost && canFlyDirect && directKm <= LOW_COST_MAX_KM && !templates.some((t) => t.airlineCode === lowCost.code)) {
    templates.push({
      airline: lowCost.airline,
      airlineCode: lowCost.code,
      flightNumber: `${lowCost.code}${(seed("lc") % 900) + 100}`,
      basePrice: Math.round(roundTripPrice(directKm) * 0.62),
      departure: DEPARTURES[(seed("lc-dep") + 3) % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: 0,
      tags: ["Düşük maliyetli", "Bagaj ekstra"],
    });
  }

  const ranked = HUB_CARRIERS.flatMap((carrier) => {
    const hub = findAirport(carrier.hub);
    if (!hub) return [];
    const toHub = haversineKm(origin.coordinates, hub.coordinates);
    const fromHub = haversineKm(hub.coordinates, destination.coordinates);
    return [{ carrier, toHub, fromHub, detour: (toHub + fromHub) / Math.max(1, directKm) }];
  })
    .filter((h) => h.toHub > 300 && h.fromHub > 450)
    .sort((a, b) => a.detour - b.detour);
  // Hiç seçenek kalmazsa (çok uzun / alışılmadık rota) en az sapan merkez yine de sunulur
  const viable = ranked.filter((h) => h.detour <= MAX_DETOUR);
  const hubs = viable.length || templates.length ? viable : ranked.slice(0, 1);

  const usedAirlines = new Set<string>(canFlyDirect ? templates.map((t) => t.airlineCode) : []);
  let layovers = 0;
  for (const { carrier, toHub, fromHub, detour } of hubs) {
    if (usedAirlines.has(carrier.code) || layovers >= MAX_LAYOVER_OPTIONS) continue;
    usedAirlines.add(carrier.code);
    layovers++;
    const n = seed(carrier.code);
    templates.push({
      airline: carrier.airline,
      airlineCode: carrier.code,
      flightNumber: `${carrier.code}${(n % 800) + 100} · ${carrier.code}${((n >> 3) % 800) + 100}`,
      hub: carrier.hub,
      layoverMinutes: 70 + (n % 12) * 15,
      basePrice: Math.round(roundTripPrice(Math.max(toHub + fromHub, directKm)) * 0.8),
      departure: DEPARTURES[(n >> 5) % DEPARTURES.length],
      cabinBaggageKg: carrier.code === "BA" ? 23 : 7,
      checkedBaggageKg: carrier.checkedKg,
      tags: [detour < 1.08 ? "Az sapma" : carrier.tag],
    });
  }

  // Son güvence: hiçbir hub uymadıysa (ör. iki hub arası kısa bölgesel hat) bölgesel direkt uçuş
  if (templates.length === 0) {
    const regional = directCarrier ?? { airline: "Regional Air", code: "RG" };
    templates.push({
      airline: regional.airline,
      airlineCode: regional.code,
      flightNumber: `${regional.code}${(seed("regional") % 900) + 100}`,
      basePrice: Math.round(roundTripPrice(directKm) * 1.1),
      departure: DEPARTURES[seed("regional-dep") % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: 20,
      tags: ["Bölgesel hat", "Kesintisiz"],
    });
  }

  return templates;
}
