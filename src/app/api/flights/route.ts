import { NextResponse, type NextRequest } from "next/server";
import { findAirport, getLiveFlights } from "@/lib/server/liveFlights";

const IATA = /^[A-Za-z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function json(body: unknown, status = 200, cache = "no-store") {
  return NextResponse.json(body, { status, headers: { "Cache-Control": cache } });
}

/**
 * GET /api/flights?origin=SAW&destination=HND&date=2026-11-20&passengers=2
 * → { flights, source, liveMinPrice, marketAverage, fetchedAt, passengers, campaigns: [{ id, label }] }
 * Fiyatlar kişi başı gidiş-dönüş USD. `campaigns` yalnızca canlı veriyle doğrulanmış fırsatları içerir
 * (piyasa ortalamasının ≥%15 altı); simülasyon kaynağında her zaman boştur.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin") ?? "";
  const destination = params.get("destination") ?? "";
  const date = params.get("date") ?? "";
  const passengers = Math.min(9, Math.max(1, Math.floor(Number(params.get("passengers") ?? 1)) || 1));

  if (!IATA.test(origin) || !IATA.test(destination)) return json({ error: "Geçersiz havalimanı kodu" }, 400);
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date))) return json({ error: "Geçersiz tarih" }, 400);
  if (!findAirport(origin) || !findAirport(destination)) return json({ error: "Desteklenmeyen havalimanı" }, 404);

  const result = await getLiveFlights(origin.toUpperCase(), destination.toUpperCase(), date);
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const campaigns = result.flights
    .filter((f) => f.campaign)
    .map((f) => ({
      id: f.id,
      label:
        `Piyasa ort. ${usd(f.campaign!.originalPrice * passengers)} ➔ ${usd(f.price * passengers)}` +
        ` • %${f.campaign!.discountPercent} altında • Doğrulayan: ${f.campaign!.verifiedBy}`,
    }));

  return json({ ...result, passengers, campaigns }, 200, "public, s-maxage=3600, stale-while-revalidate=600");
}
