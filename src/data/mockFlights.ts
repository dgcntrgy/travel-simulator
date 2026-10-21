import { distance } from "@turf/turf";
import type { Airport, Flight } from "@/types/trip";
import { generateFlightTemplates, type FlightTemplate } from "@/lib/globalDiscovery";
import { AIRPORTS, isTurkishAirport, type FeaturedCode } from "./airports";

/**
 * Uçuş simülasyon motoru.
 *
 * Kürasyonlu hedefler için gerçekçi şablonlar tutulur (diğerleri `globalDiscovery` jeneratöründen gelir) (havayolu, aktarma merkezi, bekleme süresi,
 * İstanbul çıkışlı baz fiyat). Süreler büyük daire mesafesinden hesaplanır; Türkiye çıkışlı fiyatlar
 * bölgesel piyasa bantlarına (`MARKET_BANDS`) + tarife kurallarına (`fareFactor`) göre belirlenir. Çıktı şekli, ileride
 * Travelpayouts affiliate API yanıtına eşlenebilecek düz bir `Flight[]` dizisidir.
 */

/** Kürasyonlu hedefler; diğer ülkeler `generateFlightTemplates` ile mesafeden üretilir */
const FLIGHT_TEMPLATES: Record<FeaturedCode, FlightTemplate[]> = {
  HND: [
    {
      airline: "Türk Hava Yolları",
      airlineCode: "TK",
      flightNumber: "TK198",
      basePrice: 1185,
      departure: "01:50",
      cabinBaggageKg: 8,
      checkedBaggageKg: 46,
      tags: ["En hızlı", "Kesintisiz"],
    },
    {
      airline: "Qatar Airways",
      airlineCode: "QR",
      flightNumber: "QR240 · QR806",
      hub: "DOH",
      layoverMinutes: 165,
      basePrice: 895,
      departure: "19:05",
      cabinBaggageKg: 7,
      checkedBaggageKg: 30,
      tags: ["En uygun", "Ödüllü servis"],
    },
    {
      airline: "Emirates",
      airlineCode: "EK",
      flightNumber: "EK124 · EK312",
      hub: "DXB",
      layoverMinutes: 215,
      basePrice: 950,
      departure: "16:40",
      cabinBaggageKg: 7,
      checkedBaggageKg: 35,
      tags: ["A380 deneyimi"],
    },
  ],
  ICN: [
    {
      airline: "Türk Hava Yolları",
      airlineCode: "TK",
      flightNumber: "TK90",
      basePrice: 1040,
      departure: "17:15",
      cabinBaggageKg: 8,
      checkedBaggageKg: 46,
      tags: ["En hızlı", "Kesintisiz"],
    },
    {
      airline: "Qatar Airways",
      airlineCode: "QR",
      flightNumber: "QR244 · QR858",
      hub: "DOH",
      layoverMinutes: 190,
      basePrice: 845,
      departure: "20:30",
      cabinBaggageKg: 7,
      checkedBaggageKg: 30,
      tags: ["En uygun"],
    },
    {
      airline: "Emirates",
      airlineCode: "EK",
      flightNumber: "EK122 · EK322",
      hub: "DXB",
      layoverMinutes: 155,
      basePrice: 880,
      departure: "11:25",
      cabinBaggageKg: 7,
      checkedBaggageKg: 35,
      tags: ["Kısa aktarma"],
    },
  ],
  JFK: [
    {
      airline: "Türk Hava Yolları",
      airlineCode: "TK",
      flightNumber: "TK1",
      basePrice: 985,
      departure: "13:35",
      cabinBaggageKg: 8,
      checkedBaggageKg: 46,
      tags: ["En hızlı", "Kesintisiz"],
    },
    {
      airline: "Lufthansa",
      airlineCode: "LH",
      flightNumber: "LH1301 · LH400",
      hub: "FRA",
      layoverMinutes: 125,
      basePrice: 765,
      departure: "06:50",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["Sabah çıkışı"],
    },
    {
      airline: "British Airways",
      airlineCode: "BA",
      flightNumber: "BA679 · BA117",
      hub: "LHR",
      layoverMinutes: 175,
      basePrice: 725,
      departure: "08:10",
      cabinBaggageKg: 23,
      checkedBaggageKg: 23,
      tags: ["En uygun"],
    },
  ],
  FCO: [
    {
      airline: "Türk Hava Yolları",
      airlineCode: "TK",
      flightNumber: "TK1861",
      basePrice: 285,
      departure: "07:40",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["En hızlı", "Kesintisiz"],
    },
    {
      airline: "Austrian Airlines",
      airlineCode: "OS",
      flightNumber: "OS838 · OS501",
      hub: "VIE",
      layoverMinutes: 95,
      basePrice: 215,
      departure: "06:15",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["En uygun"],
    },
    {
      airline: "Lufthansa",
      airlineCode: "LH",
      flightNumber: "LH1775 · LH1846",
      hub: "MUC",
      layoverMinutes: 80,
      basePrice: 240,
      departure: "11:55",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["Kısa aktarma"],
    },
  ],
  CDG: [
    {
      airline: "Türk Hava Yolları",
      airlineCode: "TK",
      flightNumber: "TK1827",
      basePrice: 310,
      departure: "08:25",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["En hızlı", "Kesintisiz"],
    },
    {
      airline: "KLM",
      airlineCode: "KL",
      flightNumber: "KL1956 · KL1227",
      hub: "AMS",
      layoverMinutes: 110,
      basePrice: 235,
      departure: "06:00",
      cabinBaggageKg: 12,
      checkedBaggageKg: 23,
      tags: ["En uygun"],
    },
    {
      airline: "Lufthansa",
      airlineCode: "LH",
      flightNumber: "LH1299 · LH1028",
      hub: "FRA",
      layoverMinutes: 90,
      basePrice: 255,
      departure: "14:20",
      cabinBaggageKg: 8,
      checkedBaggageKg: 23,
      tags: ["Öğleden sonra"],
    },
  ],
};

const CRUISE_SPEED_KMH = 830;
/** Kalkış/iniş, taksi ve tırmanış payı (dakika) */
const GROUND_BUFFER_MIN = 35;

function legMinutes(from: Airport, to: Airport): number {
  const km = distance(from.coordinates, to.coordinates, { units: "kilometers" });
  return Math.round((km / CRUISE_SPEED_KMH) * 60 + GROUND_BUFFER_MIN);
}

function routeKm(from: Airport, to: Airport, hub?: Airport): number {
  if (!hub) return distance(from.coordinates, to.coordinates, { units: "kilometers" });
  return (
    distance(from.coordinates, hub.coordinates, { units: "kilometers" }) +
    distance(hub.coordinates, to.coordinates, { units: "kilometers" })
  );
}

/** id + tarih için ±4% aralığında sabit dalgalanma (her render'da aynı fiyat) */
function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 1 + ((Math.abs(h) % 81) - 40) / 1000;
}

/** Gerçek tarife mantığı: son dakika (<14 gün) +%20, erken rezervasyon (>60 gün) -%12, Cuma–Pazar +%10 */
const LAST_MINUTE_DAYS = 14;
const EARLY_BOOKING_DAYS = 60;
const LAST_MINUTE = 1.2;
const EARLY_BOOKING = 0.88;
const WEEKEND = 1.1;
const MAX_FARE_FACTOR = LAST_MINUTE * WEEKEND;
const MIN_FARE_FACTOR = EARLY_BOOKING;

function fareFactor(departureDate: string): number {
  const date = new Date(`${departureDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 1;

  let factor = 1;
  const day = date.getDay();
  if (day === 5 || day === 6 || day === 0) factor *= WEEKEND;

  const daysAhead = (date.getTime() - Date.now()) / 86_400_000;
  if (daysAhead < LAST_MINUTE_DAYS) factor *= LAST_MINUTE;
  else if (daysAhead > EARLY_BOOKING_DAYS) factor *= EARLY_BOOKING;

  return factor;
}

/**
 * Türkiye çıkışlı gidiş-dönüş ekonomi piyasa bantları (Skyscanner / Google Flights 2026 ortalamaları, USD).
 * kmMin–kmMax: bölge içinde mesafeye göre bantta konumlanma.
 */
const MARKET_BANDS = {
  europe: { min: 180, max: 420, kmMin: 500, kmMax: 3300 },
  middleEast: { min: 210, max: 460, kmMin: 800, kmMax: 3600 },
  eastAsia: { min: 680, max: 1150, kmMin: 6000, kmMax: 9800 },
  americas: { min: 750, max: 1280, kmMin: 7500, kmMax: 12500 },
} as const;
type MarketRegion = keyof typeof MARKET_BANDS;

const COUNTRY_REGION: Record<string, MarketRegion> = {
  "Birleşik Krallık": "europe", "Fransa": "europe", "Almanya": "europe", "Hollanda": "europe",
  "İtalya": "europe", "İspanya": "europe", "Avusturya": "europe", "İsviçre": "europe",
  "Yunanistan": "europe", "Portekiz": "europe", "Çekya": "europe", "Macaristan": "europe",
  "Hırvatistan": "europe", "Gürcistan": "europe",
  "BAE": "middleEast", "Katar": "middleEast", "Ürdün": "middleEast", "Mısır": "middleEast", "Fas": "middleEast",
  "Japonya": "eastAsia", "Güney Kore": "eastAsia", "Tayland": "eastAsia", "Singapur": "eastAsia",
  "Hong Kong": "eastAsia", "Çin": "eastAsia", "Vietnam": "eastAsia", "Endonezya": "eastAsia",
  "ABD": "americas", "Kanada": "americas", "Meksika": "americas", "Brezilya": "americas",
  "Arjantin": "americas", "Peru": "americas",
};

/** Bant içi ürün konumu: düşük maliyetli < aktarmalı < direkt bayrak taşıyıcı */
function productTier(t: FlightTemplate): number {
  if (t.checkedBaggageKg === 0) return 0;
  return t.hub ? 0.35 : 0.85;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Bantlı rotada fiyat: taban fiyat bandın "tarife payı bırakılmış" iç aralığına yerleşir, böylece
 * son dakika/hafta sonu/erken rezervasyon çarpanları uygulandığında bile sonuç piyasa bandında kalır.
 */
function marketPrice(region: MarketRegion, directKm: number, t: FlightTemplate, seed: string, fare: number): number {
  const band = MARKET_BANDS[region];
  const lo = band.min / MIN_FARE_FACTOR;
  const hi = band.max / MAX_FARE_FACTOR;
  const distancePos = clamp01((directKm - band.kmMin) / (band.kmMax - band.kmMin));
  const pos = clamp01(0.55 * distancePos + 0.45 * productTier(t) + (jitter(seed) - 1));
  const price = (lo + pos * (hi - lo)) * fare;
  return Math.round(Math.min(band.max, Math.max(band.min, price)));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function getFlights(origin: Airport, destination: Airport, departureDate: string): Flight[] {
  // Aynı şehir / havalimanı (örn. Londra → Londra) için uçuş yok
  if (distance(origin.coordinates, destination.coordinates, { units: "kilometers" }) < 150) return [];

  // Kürasyonlu şablonlar İstanbul çıkışlı; sadece Türkiye kalkışlarında ölçeklenerek kullanılır
  const curated = isTurkishAirport(origin) ? FLIGHT_TEMPLATES[destination.code as FeaturedCode] : undefined;
  const templates = curated ?? generateFlightTemplates(origin, destination);
  const istKm = routeKm(AIRPORTS.IST, destination);
  const fare = fareFactor(departureDate);
  const directKm = routeKm(origin, destination);
  const region = isTurkishAirport(origin) ? COUNTRY_REGION[destination.country] : undefined;

  return templates.map((t) => {
    const hub = t.hub ? AIRPORTS[t.hub] : undefined;
    const layoverMinutes = hub ? (t.layoverMinutes ?? 120) : 0;

    const flyingMinutes = hub
      ? legMinutes(origin, hub) + legMinutes(hub, destination)
      : legMinutes(origin, destination);
    const totalDurationMinutes = flyingMinutes + layoverMinutes;

    // Kürasyonlu IST baz fiyatı, farklı kalkış şehrinde rota uzunluğuna göre ölçeklenir
    // (jeneratör fiyatları zaten gerçek kalkışa göre).
    const distanceRatio = curated
      ? routeKm(origin, destination, hub) / (hub ? routeKm(AIRPORTS.IST, destination, hub) : istKm)
      : 1;
    const id = `${origin.code}-${destination.code}-${t.airlineCode}${hub ? `-${hub.code}` : ""}`;
    const seed = `${id}:${departureDate}`;
    const price = region
      ? marketPrice(region, directKm, t, seed, fare)
      : Math.round(t.basePrice * distanceRatio * fare * jitter(seed));

    const depLocal = toMinutes(t.departure);
    const arrLocal = depLocal + totalDurationMinutes + (destination.utcOffset - origin.utcOffset) * 60;

    return {
      id,
      airline: t.airline,
      airlineCode: t.airlineCode,
      flightNumber: t.flightNumber,
      type: hub ? "layover" : "direct",
      origin,
      destination,
      layover: hub ? { airport: hub, durationMinutes: layoverMinutes } : undefined,
      price,
      totalDurationMinutes,
      departureTime: t.departure,
      arrivalTime: formatClock(arrLocal),
      arrivalDayOffset: Math.floor(arrLocal / 1440),
      cabinBaggageKg: t.cabinBaggageKg,
      checkedBaggageKg: t.checkedBaggageKg,
      tags: t.tags,
    } satisfies Flight;
  });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  return m === 0 ? `${h}s` : `${h}s ${m}dk`;
}
