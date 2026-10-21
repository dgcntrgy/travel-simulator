/**
 * Tarayıcı tercihleri: her değer hem çereze (`document.cookie`, 1 yıl, SameSite=Lax) hem `localStorage`'a yazılır.
 * Okumada önce çerez, sonra localStorage; gizli pencere / engelli depolama sessizce yok sayılır.
 */

export const PREF = {
  locale: "ts_lang",
  consent: "ts_consent",
  origin: "ts_origin",
} as const;

export type Consent = "all" | "essential";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function readPref(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  if (match) return decodeURIComponent(match.slice(name.length + 1));
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

export function writePref(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax${secure}`;
  try {
    window.localStorage.setItem(name, value);
  } catch {
    // depolama kapalı: çerez yeterli
  }
}

export function readConsent(): Consent | null {
  const v = readPref(PREF.consent);
  return v === "all" || v === "essential" ? v : null;
}
