import type { Flight } from "@/types/trip";

/** FNV-1a tabanlı deterministik 32 bit hash */
function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "🔥 Anlık Kampanya / Fiyat Düştü" algoritması: rota + uçuş tarihi + BUGÜN tohumuyla listedeki
 * bir uçuşta %12–22 indirim yakalar (kampanya her gün döner, gün içinde sabit kalır).
 * En ucuz uçuş hariç tutulur ki "Normalde" fiyatı piyasanın üstünde kalsın; tek uçuşlu listede o uçuş seçilir.
 * Dönen listede kampanyalı uçuşun `price` alanı indirimli fiyattır, eski fiyat `campaign.originalPrice`.
 */
export function applyCampaigns(flights: Flight[], departureDate: string, today = localIso(new Date())): Flight[] {
  if (flights.length === 0) return flights;
  const sorted = [...flights].sort((a, b) => a.price - b.price);
  const pool = sorted.length > 1 ? sorted.slice(1) : sorted;
  const h = hash(`${flights[0].origin.code}-${flights[0].destination.code}:${departureDate}:${today}`);
  const target = pool[h % pool.length];
  const discountPercent = 12 + ((h >>> 8) % 11);
  const seatsLeft = 2 + ((h >>> 16) % 6);

  return flights.map((f) =>
    f.id === target.id
      ? {
          ...f,
          price: Math.round(f.price * (1 - discountPercent / 100)),
          campaign: { originalPrice: f.price, discountPercent, seatsLeft },
        }
      : f,
  );
}

/** "2026-11-20" → "261120" (Skyscanner yol biçimi) */
const yymmdd = (iso: string) => iso.slice(2).replaceAll("-", "");

/** Seçilen rota için Google Flights / Skyscanner canlı arama sayfaları (yeni sekmede açılır) */
export function verificationLinks(origin: string, destination: string, departureDate: string, passengers: number) {
  const q = `Flights from ${origin} to ${destination} on ${departureDate} for ${passengers} adult${passengers > 1 ? "s" : ""}`;
  return {
    google: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=USD&hl=tr`,
    skyscanner:
      `https://www.skyscanner.com.tr/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/` +
      `${yymmdd(departureDate)}/?adultsv2=${passengers}&cabinclass=economy&currency=USD`,
  };
}
