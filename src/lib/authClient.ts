"use client";

import { useEffect } from "react";
import type { AdminUserRow, PublicUser } from "@/types/trip";
import { useTripStore } from "@/store/useTripStore";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `İstek başarısız (${res.status}).` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Sunucuya ulaşılamadı. Bağlantını kontrol et." };
  }
}

export const authApi = {
  register: (input: { name: string; email: string; phone: string; password: string; lastRoute: string; isPro: boolean }) =>
    post<{ user: PublicUser }>("/api/auth", { action: "register", ...input }),
  login: (email: string, password: string) => post<{ user: PublicUser }>("/api/auth", { action: "login", email, password }),
  sync: (lastRoute: string, isPro: boolean) => post<{ user: PublicUser }>("/api/auth", { action: "sync", lastRoute, isPro }),
  logout: () => post<{ ok: true }>("/api/auth", { action: "logout" }),
  adminUsers: (password: string) => post<{ users: AdminUserRow[] }>("/api/admin/users", { password }),
};

/** Store'daki seçimden kayda yazılacak tek satırlık rota özeti */
export function currentRouteSummary(): string {
  const s = useTripStore.getState();
  if (!s.origin || !s.destination) return "";
  const parts = [`${s.origin.city} (${s.origin.code}) ➔ ${s.destination.city} (${s.destination.code})`];
  if (s.selectedFlight) parts.push(`${s.selectedFlight.airline} ${s.selectedFlight.flightNumber}`);
  if (s.selectedPlaces.length) parts.push(`${s.selectedPlaces.length} mekan`);
  return parts.join(" · ");
}

/**
 * Simulator'da bir kez çağrılır: açılışta httpOnly çerezdeki oturumu geri yükler, oturum açıkken
 * rota / Pro değişikliklerini 1.5 sn gecikmeyle sunucuya yazar (rate limit'e takılmasın diye seyrek).
 */
export function useAuthSync() {
  const setUser = useTripStore((s) => s.setUser);
  const userId = useTripStore((s) => s.user?.id);
  const isPro = useTripStore((s) => s.isPro);
  const routeKey = useTripStore(
    (s) => `${s.origin?.code}|${s.destination?.code}|${s.selectedFlight?.id}|${s.selectedPlaces.length}`,
  );

  useEffect(() => {
    let alive = true;
    fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: PublicUser | null } | null) => alive && d?.user && setUser(d.user))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [setUser]);

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(async () => {
      const summary = currentRouteSummary();
      const { user } = useTripStore.getState();
      if (!user || (summary === "" && !isPro) || (summary === user.lastRoute && isPro === user.isPro)) return;
      const res = await authApi.sync(summary, isPro);
      if (res.ok) useTripStore.setState({ user: res.data.user });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [userId, routeKey, isPro]);
}
