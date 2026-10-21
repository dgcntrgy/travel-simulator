"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { locateAndSetOrigin } from "@/lib/geoClient";
import { cityName } from "@/lib/i18n";
import { PREF, readConsent, writePref } from "@/lib/prefs";
import { SPRING_IN } from "@/lib/motion";
import { useT } from "@/lib/useI18n";

type Status = "ask" | "locating" | "done" | "failed";

const AUTO_HIDE_MS = 4200;

/**
 * İlk ziyarette alt kısımda iPhone cam tasarımlı çerez & konum izin barı.
 * "Kabul Et & Konumumu Kullan" → onay çereze yazılır, GPS (yoksa IP) konumuna en yakın havalimanı kalkış seçilir.
 * "Sadece Zorunlu Çerezler" → yalnız onay kaydı tutulur, konum kullanılmaz.
 */
export default function CookieLocationBanner() {
  const t = useT();
  const [open, setOpen] = useState(() => readConsent() === null);
  const [status, setStatus] = useState<Status>("ask");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "done" && status !== "failed") return;
    const id = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  const accept = async () => {
    writePref(PREF.consent, "all");
    setStatus("locating");
    const result = await locateAndSetOrigin();
    if (result) {
      setMessage(
        t("cookie.detected", {
          place: result.place,
          airport: `${result.airport.flag} ${cityName(result.airport, t.locale)}`,
          code: result.airport.code,
        }),
      );
      setStatus("done");
    } else {
      setMessage(t("cookie.failed"));
      setStatus("failed");
    }
  };

  const essentialOnly = () => {
    writePref(PREF.consent, "essential");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-live="polite"
          aria-label={t("cookie.title")}
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={SPRING_IN}
          className="fixed inset-x-3 bottom-3 z-[1500] mx-auto max-w-3xl sm:inset-x-6 sm:bottom-6 print:hidden"
        >
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/65 p-4 text-ink shadow-[0_24px_60px_-18px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150 sm:p-5 dark:border-white/15 dark:bg-slate-900/55 dark:shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/60 bg-white/70 text-amber-500 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-amber-300">
                  {status === "locating" ? (
                    <Loader2 size={20} className="animate-spin text-blue-600 dark:text-blue-400" />
                  ) : status === "done" ? (
                    <MapPin size={20} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Cookie size={20} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("cookie.title")}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink/65">
                    {status === "ask" ? t("cookie.text") : status === "locating" ? t("cookie.locating") : message}
                  </p>
                </div>
              </div>

              {status === "ask" && (
                <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
                  <button
                    type="button"
                    onClick={() => void accept()}
                    className="flex items-center justify-center gap-2 rounded-2xl glass-primary px-4 py-2.5 text-sm font-semibold"
                  >
                    <MapPin size={15} /> {t("cookie.accept")}
                  </button>
                  <button
                    type="button"
                    onClick={essentialOnly}
                    className="flex items-center justify-center gap-2 rounded-2xl glass-secondary px-4 py-2.5 text-sm font-medium text-ink/75 hover:text-ink"
                  >
                    <ShieldCheck size={15} /> {t("cookie.essential")}
                  </button>
                </div>
              )}
              {(status === "done" || status === "failed") && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-2xl glass-secondary px-4 py-2 text-sm font-medium text-ink/75 hover:text-ink"
                >
                  {t("common.close")}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
