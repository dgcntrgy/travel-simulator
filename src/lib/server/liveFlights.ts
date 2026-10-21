import { cacheLife } from "next/cache";
import { AIRPORTS, type AirportCode } from "@/data/airports";
import { getFlights } from "@/data/mockFlights";
import { applyCampaigns } from "@/lib/flightCampaigns";
import type { Flight, FlightPriceSource } from "@/types/trip";

export interface LiveFlightResult {
  flights: Flight[];
  source: FlightPriceSource;
  /** Gerçek API'nin bulduğu en düşük kişi başı gidiş-dönüş fiyatı (simülasyonda null) */
  liveMinPrice: number | null;
  fetchedAt: string;
}

const TIMEOUT_MS = 6000;

export const findAirport = (code: string) => AIRPORTS[code.toUpperCase() as AirportCode];

/** Travelpayouts (Aviasales Data API): o tarihteki en ucuz gidiş-dönüş, kişi başı USD */
async function travelpayoutsMin(token: string, origin: string, destination: string, date: string) {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.search = new URLSearchParams({
    origin,
    destination,
    departure_at: date,
    one_way: "false",
    currency: "usd",
    sorting: "price",
    limit: "10",
    token,
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const body = (await res.json()) as { success?: boolean; data?: { price?: number }[] };
  const prices = (body.data ?? []).map((d) => d.price).filter((p): p is number => typeof p === "number" && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** Amadeus Flight Offers Search: 7 gece gidiş-dönüş, 1 yetişkin, en ucuz teklif */
async function amadeusMin(key: string, secret: string, origin: string, destination: string, date: string) {
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

  const ret = new Date(`${date}T00:00:00Z`);
  ret.setUTCDate(ret.getUTCDate() + 7);
  const url = new URL(`${host}/v2/shopping/flight-offers`);
  url.search = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: date,
    returnDate: ret.toISOString().slice(0, 10),
    adults: "1",
    currencyCode: "USD",
    max: "10",
  }).toString();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { price?: { grandTotal?: string } }[] };
  const prices = (body.data ?? []).map((o) => Number(o.price?.grandTotal)).filter((p) => p > 0);
  return prices.length ? Math.round(Math.min(...prices)) : null;
}

/**
 * Rota + tarih için uçuş listesi; 1 saat önbellekte kalır (cacheLife "hours" = revalidate 3600).
 * Anahtar varsa gerçek API'nin en düşük fiyatı simülasyonun en ucuz uçuşuna oturtulur ve tüm liste
 * aynı oranla ölçeklenir (oran 0.6–1.8 ile sınırlı); ardından kampanya algoritması çalışır.
 * API hatası/boş sonuç sessizce simülasyona düşer.
 */
export async function getLiveFlights(originCode: string, destinationCode: string, date: string): Promise<LiveFlightResult> {
  "use cache";
  cacheLife("hours");

  const origin = findAirport(originCode);
  const destination = findAirport(destinationCode);
  const base = getFlights(origin, destination, date);

  let source: FlightPriceSource = "simulation";
  let liveMinPrice: number | null = null;
  try {
    const tp = process.env.TRAVELPAYOUTS_TOKEN;
    const amKey = process.env.AMADEUS_API_KEY;
    const amSecret = process.env.AMADEUS_API_SECRET;
    if (tp) {
      liveMinPrice = await travelpayoutsMin(tp, origin.code, destination.code, date);
      if (liveMinPrice) source = "travelpayouts";
    }
    if (!liveMinPrice && amKey && amSecret) {
      liveMinPrice = await amadeusMin(amKey, amSecret, origin.code, destination.code, date);
      if (liveMinPrice) source = "amadeus";
    }
  } catch {
    liveMinPrice = null;
    source = "simulation";
  }

  let flights = base;
  if (liveMinPrice && base.length) {
    const simMin = Math.min(...base.map((f) => f.price));
    const ratio = Math.min(1.8, Math.max(0.6, liveMinPrice / simMin));
    flights = base.map((f) => ({ ...f, price: Math.round(f.price * ratio) }));
  }

  return {
    flights: applyCampaigns(flights, date),
    source,
    liveMinPrice,
    fetchedAt: new Date().toISOString(),
  };
}
