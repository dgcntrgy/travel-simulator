import { NextResponse, type NextRequest } from "next/server";
import { RATE_LIMIT, SECURITY_HEADERS } from "@/lib/security";

/**
 * Next.js 16'da `middleware.ts` → `proxy.ts` (Node.js runtime; bellek süreç boyunca yaşar).
 * `/api/*` için IP başına kayan pencere: 1 dakikada 20'den fazla istek → 429 (Brute-Force / DDoS koruması).
 * Not: tek sunucu süreci içindir; çok örnekli dağıtımda Redis/Upstash gibi paylaşımlı sayaç gerekir.
 */
const hits = new Map<string, number[]>();
let lastSweep = 0;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Bellek şişmesin: dakikada bir süresi dolmuş IP kayıtlarını temizle */
function sweep(now: number) {
  if (now - lastSweep < RATE_LIMIT.windowMs) return;
  lastSweep = now;
  for (const [ip, times] of hits) {
    if (times[times.length - 1] <= now - RATE_LIMIT.windowMs) hits.delete(ip);
  }
}

export function proxy(request: NextRequest) {
  const now = Date.now();
  sweep(now);

  const ip = clientIp(request);
  const recent = (hits.get(ip) ?? []).filter((t) => t > now - RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);

  const remaining = Math.max(0, RATE_LIMIT.max - recent.length);
  const headers = new Headers(SECURITY_HEADERS.map((h) => [h.key, h.value] as [string, string]));
  headers.set("X-RateLimit-Limit", String(RATE_LIMIT.max));
  headers.set("X-RateLimit-Remaining", String(remaining));

  if (recent.length > RATE_LIMIT.max) {
    const retryAfter = Math.ceil((recent[0] + RATE_LIMIT.windowMs - now) / 1000);
    headers.set("Retry-After", String(Math.max(1, retryAfter)));
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new NextResponse(
      JSON.stringify({ error: "Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin." }),
      { status: 429, headers },
    );
  }

  const res = NextResponse.next();
  headers.forEach((value, key) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
