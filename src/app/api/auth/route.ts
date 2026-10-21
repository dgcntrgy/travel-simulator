import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getSessionUser,
  loginUser,
  logoutUser,
  registerUser,
  syncUser,
} from "@/lib/server/userStore";
import {
  isValidEmail,
  isValidPhone,
  passwordProblem,
  sanitizeEmail,
  sanitizeInput,
  sanitizePhone,
} from "@/lib/security";

const MAX_BODY_BYTES = 4096;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function withSession(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** Oturumdaki kullanıcı (sayfa yenilenince istemci senkronu) */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  return json({ user });
}

/** { action: "register" | "login" | "sync" | "logout", ... } */
export async function POST(request: NextRequest) {
  // CSRF: yalnız aynı kökenden gelen JSON isteklerini kabul et
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json({ error: "Geçersiz istek kaynağı." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "JSON bekleniyor." }, 415);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "İstek çok büyük." }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Geçersiz JSON." }, 400);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const password = typeof body.password === "string" ? body.password : "";
  const lastRoute = sanitizeInput(body.lastRoute, 160);
  const isPro = body.isPro === true;

  switch (body.action) {
    case "register": {
      const name = sanitizeInput(body.name, 80);
      const email = sanitizeEmail(body.email);
      const phone = sanitizePhone(body.phone);
      if (name.length < 2) return json({ error: "Ad Soyad en az 2 karakter olmalı." }, 400);
      if (!isValidEmail(email)) return json({ error: "Geçerli bir e-posta gir." }, 400);
      if (!isValidPhone(phone)) return json({ error: "Telefon numarası geçersiz." }, 400);
      const problem = passwordProblem(password);
      if (problem) return json({ error: problem }, 400);

      const result = await registerUser({ name, email, phone, password, lastRoute, isPro });
      if ("error" in result) return json({ error: result.error }, 409);
      return withSession(json({ user: result.user }, 201), result.token);
    }
    case "login": {
      const email = sanitizeEmail(body.email);
      if (!isValidEmail(email) || !password || password.length > 128) {
        return json({ error: "E-posta veya şifre hatalı." }, 401);
      }
      const result = await loginUser(email, password);
      if (!result) return json({ error: "E-posta veya şifre hatalı." }, 401);
      return withSession(json({ user: result.user }), result.token);
    }
    case "sync": {
      const user = await syncUser(token, { lastRoute, isPro });
      if (!user) return json({ error: "Oturum bulunamadı." }, 401);
      return json({ user });
    }
    case "logout": {
      await logoutUser(token);
      const res = json({ ok: true });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    default:
      return json({ error: "Bilinmeyen işlem." }, 400);
  }
}
