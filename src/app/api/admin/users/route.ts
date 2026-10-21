import { NextResponse, type NextRequest } from "next/server";
import { listUsersForAdmin, safeEqual } from "@/lib/server/userStore";

/** Üretimde `.env.local` → ADMIN_PASSWORD ile değiştirilmeli; varsayılan yalnız demo içindir */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin2026!";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** { password } → tüm kayıtlı kullanıcılar (hash maskeli). Rate limit: src/proxy.ts */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json({ error: "Geçersiz istek kaynağı." }, 403);

  let password = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string") {
      password = (body as { password: string }).password.slice(0, 128);
    }
  } catch {
    return json({ error: "Geçersiz JSON." }, 400);
  }

  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return json({ error: "Yönetici şifresi hatalı." }, 401);
  }
  return json({ users: await listUsersForAdmin() });
}
