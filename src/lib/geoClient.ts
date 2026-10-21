"use client";

import { useEffect } from "react";
import type { GeoResponse } from "@/app/api/geo/route";
import { findAirport } from "@/data/airports";
import { nearestAirport } from "@/lib/globalRouteEngine";
import { isLocale } from "@/lib/i18n";
import { PREF, readConsent, readPref, writePref } from "@/lib/prefs";
import { useTripStore } from "@/store/useTripStore";
import type { Airport } from "@/types/trip";

let geoPromise: Promise<GeoResponse | null> | null = null;

/** /api/geo yanıtı (oturum başına tek istek) */
export function fetchGeo(): Promise<GeoResponse | null> {
  geoPromise ??= fetch("/api/geo")
    .then((r) => (r.ok ? (r.json() as Promise<GeoResponse>) : null))
    .catch(() => null);
  return geoPromise;
}

const GPS_TIMEOUT_MS = 8000;

/** Tarayıcı konumu (izin istenir); reddedilir / zaman aşımına uğrarsa null */
function browserPosition(): Promise<[number, number] | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.longitude, p.coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );
  });
}

/**
 * Kullanıcının konumuna en yakın havalimanını bulur (önce GPS, olmazsa IP konumu) ve "Nereden" olarak seçer.
 * Seçim çerez + localStorage'a (`ts_origin`) yazılır. Konum hiç bulunamazsa null.
 */
export async function locateAndSetOrigin(): Promise<{ airport: Airport; place: string } | null> {
  const [gps, geo] = await Promise.all([browserPosition(), fetchGeo()]);
  const coords: [number, number] | null = gps ?? (geo?.lat != null && geo?.lng != null ? [geo.lng, geo.lat] : null);
  if (!coords) return null;
  const { airport } = nearestAirport(coords);
  const { destination, setOrigin } = useTripStore.getState();
  // Varış zaten aynı şehirse kalkışı ezme
  if (!destination || destination.city !== airport.city) setOrigin(airport);
  writePref(PREF.origin, airport.code);
  return { airport, place: (gps ? null : geo?.city) ?? airport.city };
}

/**
 * Açılışta (Simulator): 1) kayıtlı dil yoksa IP ülkesine göre dili seç (kaydetmeden),
 * 2) çerez onayı "all" ise kaydedilmiş kalkış havalimanını geri yükle.
 */
export function useGeoBootstrap(): void {
  useEffect(() => {
    if (readConsent() === "all") {
      const saved = readPref(PREF.origin);
      const airport = saved ? findAirport(saved) : undefined;
      const s = useTripStore.getState();
      if (airport && !s.origin) s.setOrigin(airport);
    }
    if (isLocale(readPref(PREF.locale))) return;
    let cancelled = false;
    void fetchGeo().then((geo) => {
      if (!cancelled && geo?.country && !isLocale(readPref(PREF.locale))) {
        useTripStore.getState().setLocale(geo.locale, false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
