import { NextResponse, type NextRequest } from "next/server";
import { localeForCountry, localeFromLanguages, type Locale } from "@/lib/i18n";

export interface GeoResponse {
  /** ISO 3166 ülke kodu ("TR"); tespit edilemezse null */
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  /** Ülkeye (yoksa Accept-Language'e) göre önerilen arayüz dili */
  locale: Locale;
  source: "vercel" | "ipapi" | "none";
}

const IPAPI_TIMEOUT_MS = 3500;

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
};

/** Yerel / özel ağ adresleri ipapi.co'ya IP olarak gönderilmez (sunucu kendi konumunu sorar) */
const isPublicIp = (ip: string) =>
  !!ip && !/^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80|unknown)/i.test(ip);

/**
 * GET /api/geo → { country, city, lat, lng, locale, source }
 * 1. Vercel kenar başlıkları (`x-vercel-ip-country`, `-city`, `-latitude`, `-longitude`) — ücretsiz, anlık.
 * 2. Yoksa ücretsiz ipapi.co (istemci IP'si ile; yerel geliştirmede sunucunun kendi IP'si).
 * Dil önerisi: ülke → dil eşlemesi; ülke bilinmiyorsa `accept-language`. Yanıt kişiye özel, önbelleğe alınmaz.
 */
export async function GET(request: NextRequest) {
  const h = request.headers;
  const acceptLocale = localeFromLanguages(h.get("accept-language"));
  const respond = (geo: Omit<GeoResponse, "locale">) =>
    NextResponse.json(
      { ...geo, locale: geo.country ? localeForCountry(geo.country) : (acceptLocale ?? "en") } satisfies GeoResponse,
      { headers: { "Cache-Control": "private, no-store" } },
    );

  const vercelCountry = h.get("x-vercel-ip-country");
  if (vercelCountry) {
    const city = h.get("x-vercel-ip-city");
    return respond({
      country: vercelCountry.toUpperCase(),
      city: city ? decodeURIComponent(city) : null,
      lat: num(h.get("x-vercel-ip-latitude")),
      lng: num(h.get("x-vercel-ip-longitude")),
      source: "vercel",
    });
  }

  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  try {
    const url = isPublicIp(ip) ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-simulator/1.0" },
      signal: AbortSignal.timeout(IPAPI_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const d = (await res.json()) as {
        error?: boolean;
        country_code?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
      };
      if (!d.error && d.country_code) {
        return respond({
          country: d.country_code.toUpperCase(),
          city: d.city ?? null,
          lat: num(d.latitude),
          lng: num(d.longitude),
          source: "ipapi",
        });
      }
    }
  } catch {
    // ağ hatası / zaman aşımı → yalnızca dil başlığına göre
  }
  return respond({ country: null, city: null, lat: null, lng: null, source: "none" });
}
