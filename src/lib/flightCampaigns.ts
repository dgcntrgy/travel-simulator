import type { Flight, FlightCampaign, FlightPriceSource } from "@/types/trip";

/** Canlı fiyat, piyasa ortalamasının en az bu oranda altındaysa "fırsat" sayılır */
export const DEAL_THRESHOLD = 0.15;

/**
 * Gerçek fırsat doğrulaması (yapay kampanya YOK):
 * canlı en düşük fiyat ile aynı rota + ayın piyasa ortalaması karşılaştırılır; fark ≥ %15 ise
 * ya da sağlayıcı açıkça `is_deal` döndürdüyse fırsat kabul edilir. Simülasyon kaynağı asla fırsat üretmez.
 */
export function detectDeal(
  livePrice: number | null,
  marketAverage: number | null,
  source: FlightPriceSource,
  providerFlag = false,
): FlightCampaign | null {
  if (source === "simulation" || !livePrice || !marketAverage || marketAverage <= livePrice) return null;
  const discount = 1 - livePrice / marketAverage;
  if (discount < DEAL_THRESHOLD && !providerFlag) return null;
  return { originalPrice: Math.round(marketAverage), discountPercent: Math.round(discount * 100), verifiedBy: source };
}

/**
 * Doğrulanmış fırsatı listede tek bir uçuşa işler: sağlayıcının bildirdiği havayolu varsa o, yoksa en ucuz uçuş.
 * O uçuşun fiyatı canlı fırsat fiyatına eşitlenir; diğer uçuşlara dokunulmaz.
 */
export function applyVerifiedDeal(
  flights: Flight[],
  deal: FlightCampaign | null,
  livePrice: number | null,
  airlineCode?: string,
): Flight[] {
  if (!deal || !livePrice || flights.length === 0) return flights;
  const target =
    flights.find((f) => airlineCode && f.airlineCode === airlineCode) ??
    flights.reduce((min, f) => (f.price < min.price ? f : min));
  return flights.map((f) => (f.id === target.id ? { ...f, price: Math.round(livePrice), campaign: deal } : f));
}

/** "2026-11-20" → "261120" (Skyscanner yol biçimi) */
const yymmdd = (iso: string) => iso.slice(2).replaceAll("-", "");

/** Seçilen rota için Google Flights / Skyscanner canlı arama sayfaları (yeni sekmede açılır) */
export function verificationLinks(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number,
  hl = "tr",
) {
  const q = `Flights from ${origin} to ${destination} on ${departureDate} for ${passengers} adult${passengers > 1 ? "s" : ""}`;
  return {
    google: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=USD&hl=${hl}`,
    skyscanner:
      `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/` +
      `${yymmdd(departureDate)}/?adultsv2=${passengers}&cabinclass=economy&currency=USD`,
  };
}
