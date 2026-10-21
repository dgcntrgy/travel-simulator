import { cacheLife } from "next/cache";
import { findAirport } from "@/data/airports";
import { getFlights } from "@/data/mockFlights";
import { applyVerifiedDeal, detectDeal } from "@/lib/flightCampaigns";
import type { Flight, FlightPriceSource } from "@/types/trip";

export { findAirport };

export interface LiveFlightResult {
  flights: Flight[];
  source: FlightPriceSource;
  /** Gerçek API'nin o tarih için bulduğu en düşük kişi başı gidiş-dönüş fiyatı (simülasyonda null) */
  liveMinPrice: number | null;
  /** Aynı rota + ay için canlı piyasa ortalaması / medyanı (yoksa null) */
  marketAverage: number | null;
  fetchedAt: string;
}

const TIMEOUT_MS = 6000;

interface LiveQuote {
  /** Seçilen gündeki en düşük fiyat */
  min: number | null;
  /** Rota + ayın ortalama (Travelpayouts) ya da medyan (Amadeus) fiyatı */
  average: number | null;
  /** En ucuz biletin havayolu IATA kodu */
  airline?: string;
  /** Sağlayıcı açıkça fırsat işaretlediyse */
  isDeal: boolean;
}

type TravelpayoutsTicket = { price?: number; airline?: string; is_deal?: boolean };

async function travelpayoutsQuery(token: string, origin: string, destination: string, departureAt: string, limit: number) {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.search = new URLSearchParams({
    origin,
    destination,
    departure_at: departureAt,
    one_way: "false",
    currency: "usd",
    sorting: "price",
    limit: String(limit),
    token,
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  const body = (await res.json()) as { success?: boolean; data?: TravelpayoutsTicket[] };
  return (body.data ?? []).filter((d) => typeof d.price === "number" && d.price > 0);
}

/**
 * Travelpayouts (Aviasales Data API v3 `prices_for_dates`): seçilen gün (YYYY-MM-DD) + aynı ayın tüm
 * biletleri (YYYY-MM) paralel sorgulanır → günün en ucuzu ve ayın piyasa ortalaması.
 */
async function travelpayoutsQuote(token: string, origin: string, destination: string, date: string): Promise<LiveQuote> {
  const [day, month] = await Promise.all([
    travelpayoutsQuery(token, origin, destination, date, 30),
    travelpayoutsQuery(token, origin, destination, date.slice(0, 7), 100),
  ]);
  const cheapest = day[0];
  const monthPrices = month.map((t) => t.price!);
  return {
    min: cheapest?.price ?? null,
    average: monthPrices.length >= 3 ? monthPrices.reduce((s, p) => s + p, 0) / monthPrices.length : null,
    airline: cheapest?.airline,
    isDeal: cheapest?.is_deal === true,
  };
}

/**
 * Amadeus: Flight Offers Search (7 gece gidiş-dönüş, en ucuz teklif) + Flight Price Analysis
 * (`itinerary-price-metrics`: aynı rota/tarih için tarihsel fiyat çeyrekleri → MEDIUM = piyasa medyanı).
 */
async function amadeusQuote(key: string, secret: string, origin: string, destination: string, date: string): Promise<LiveQuote | null> {
  const host = process.env.AMADEUS_HOST ?? "https://test.api.amadeus.com";
  const auth = await fetch(`${host}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: key, client_secret: secret }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!auth.ok) return null;
  const { access_token } = (await auth.json()) as { access_token?: string };
  if (!access_token) return null;
  const headers = { Authorization: `Bearer ${access_token}` };

  const ret = new Date(`${date}T00:00:00Z`);
  ret.setUTCDate(ret.getUTCDate() + 7);
  const offersUrl = new URL(`${host}/v2/shopping/flight-offers`);
  offersUrl.search = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: date,
    returnDate: ret.toISOString().slice(0, 10),
    adults: "1",
    currencyCode: "USD",
    max: "10",
  }).toString();
  const metricsUrl = new URL(`${host}/v1/analytics/itinerary-price-metrics`);
  metricsUrl.search = new URLSearchParams({
    originIataCode: origin,
    destinationIataCode: destination,
    departureDate: date,
    currencyCode: "USD",
    oneWay: "false",
  }).toString();

  const [offersRes, metricsRes] = await Promise.all([
    fetch(offersUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }),
    fetch(metricsUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null),
  ]);
  if (!offersRes.ok) return null;
  const offers = (await offersRes.json()) as {
    data?: { price?: { grandTotal?: string }; validatingAirlineCodes?: string[] }[];
  };
  const sorted = (offers.data ?? [])
    .map((o) => ({ price: Number(o.price?.grandTotal), airline: o.validatingAirlineCodes?.[0] }))
    .filter((o) => o.price > 0)
    .sort((a, b) => a.price - b.price);

  let average: number | null = null;
  if (metricsRes?.ok) {
    const metrics = (await metricsRes.json()) as { data?: { priceMetrics?: { amount?: string; quartileRanking?: string }[] }[] };
    const medium = metrics.data?.[0]?.priceMetrics?.find((m) => m.quartileRanking === "MEDIUM");
    average = medium?.amount ? Number(medium.amount) : null;
  }
  return { min: sorted[0] ? Math.round(sorted[0].price) : null, average, airline: sorted[0]?.airline, isDeal: false };
}

/**
 * Rota + tarih için uçuş listesi; 1 saat önbellekte kalır (cacheLife "hours" = revalidate 3600).
 * Anahtar varsa gerçek API'nin en düşük fiyatı simülasyonun en ucuz uçuşuna oturtulur ve tüm liste
 * aynı oranla ölçeklenir (oran 0.6–1.8). Kampanya rozeti YALNIZCA canlı fiyat aynı rota/ayın piyasa
 * ortalamasının ≥%15 altındaysa (veya sağlayıcı `is_deal` dediyse) eklenir; simülasyonda hiç rozet yoktur.
 */
export async function getLiveFlights(originCode: string, destinationCode: string, date: string): Promise<LiveFlightResult> {
  "use cache";
  cacheLife("hours");

  const origin = findAirport(originCode)!;
  const destination = findAirport(destinationCode)!;
  const base = getFlights(origin, destination, date);

  let source: FlightPriceSource = "simulation";
  let quote: LiveQuote | null = null;
  try {
    const tp = process.env.TRAVELPAYOUTS_TOKEN;
    const amKey = process.env.AMADEUS_API_KEY;
    const amSecret = process.env.AMADEUS_API_SECRET;
    if (tp) {
      quote = await travelpayoutsQuote(tp, origin.code, destination.code, date);
      if (quote.min) source = "travelpayouts";
    }
    if (!quote?.min && amKey && amSecret) {
      quote = await amadeusQuote(amKey, amSecret, origin.code, destination.code, date);
      if (quote?.min) source = "amadeus";
    }
  } catch {
    quote = null;
    source = "simulation";
  }

  const liveMinPrice = source === "simulation" ? null : (quote?.min ?? null);
  let flights = base;
  if (liveMinPrice && base.length) {
    const simMin = Math.min(...base.map((f) => f.price));
    const ratio = Math.min(1.8, Math.max(0.6, liveMinPrice / simMin));
    flights = base.map((f) => ({ ...f, price: Math.round(f.price * ratio) }));
  }

  const marketAverage = source === "simulation" ? null : (quote?.average ?? null);
  const deal = detectDeal(liveMinPrice, marketAverage, source, quote?.isDeal);

  return {
    flights: applyVerifiedDeal(flights, deal, liveMinPrice, quote?.airline),
    source,
    liveMinPrice,
    marketAverage: marketAverage ? Math.round(marketAverage) : null,
    fetchedAt: new Date().toISOString(),
  };
}
