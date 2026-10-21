"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  Crown,
  FileText,
  Languages,
  Loader2,
  Lock,
  Route,
  ShieldCheck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SPRING_IN } from "@/lib/motion";
import type { TranslationKey } from "@/lib/i18n";
import { sanitizeInput } from "@/lib/security";
import { useT } from "@/lib/useI18n";
import { useTripStore } from "@/store/useTripStore";

type PlanId = "trip" | "yearly";
type View = "pricing" | "checkout" | "success";

const PLANS: Record<
  PlanId,
  {
    title: TranslationKey;
    price: string;
    period: TranslationKey;
    note: TranslationKey;
    popular?: boolean;
  }
> = {
  trip: {
    title: "proModal.tripTitle",
    price: "$4.99",
    period: "proModal.tripPeriod",
    note: "proModal.tripNote",
  },
  yearly: {
    title: "proModal.yearlyTitle",
    price: "$19.99",
    period: "proModal.yearlyPeriod",
    note: "proModal.yearlyNote",
    popular: true,
  },
};

const PERKS: { icon: LucideIcon; title: TranslationKey; text: TranslationKey }[] = [
  { icon: Route, title: "proModal.perk1Title", text: "proModal.perk1Text" },
  { icon: Wallet, title: "proModal.perk2Title", text: "proModal.perk2Text" },
  { icon: FileText, title: "proModal.perk3Title", text: "proModal.perk3Text" },
  { icon: Languages, title: "proModal.perk4Title", text: "proModal.perk4Text" },
];

const VIEW_MOTION = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
} as const;

/** "4242424242424242" → "4242 4242 4242 4242" */
const formatCardNumber = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/** "1228" → "12/28" */
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const INPUT =
  "w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-blue-500/60 focus:bg-ink/[0.05]";

/** Pro tanıtım (paket seçimi) ➔ güvenli ödeme ➔ onay. Simülasyon: gerçek ödeme alınmaz. */
export default function ProUpgradeModal() {
  const open = useTripStore((s) => s.isUpgradeModalOpen);
  // İç bileşen her açılışta yeniden bağlanır → görünüm/form durumu kendiliğinden sıfırlanır
  return <AnimatePresence>{open && <UpgradeDialog key="pro-modal" />}</AnimatePresence>;
}

function UpgradeDialog() {
  const t = useT();
  const close = useTripStore((s) => s.closeUpgradeModal);
  const isPro = useTripStore((s) => s.isPro);
  const setPro = useTripStore((s) => s.setPro);

  const [view, setView] = useState<View>("pricing");
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [processing, setProcessing] = useState(false);
  const [card, setCard] = useState({
    name: "",
    number: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !processing && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [processing, close]);

  const cardValid =
    card.name.trim().length > 2 &&
    card.number.replace(/\D/g, "").length === 16 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry) &&
    card.cvc.length >= 3;

  const pay = () => {
    if (!cardValid || processing) return;
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setView("success");
      setPro(true);
      window.setTimeout(close, 1400);
    }, 1000);
  };

  const selected = PLANS[plan];

  return (
    <motion.div
      className="fixed inset-0 z-[2000] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xl print:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !processing && close()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t("proModal.aria")}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={SPRING_IN}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/40 bg-white/80 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl dark:border-white/15 dark:bg-slate-900/70"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

        {!processing && view !== "success" && (
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="absolute right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-full glass-secondary text-ink/70"
          >
            <X size={16} />
          </button>
        )}

        {/* Kaydırma iç kutuda → kapatma butonu sabit kalır */}
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 md:p-8">
          <AnimatePresence mode="wait" initial={false}>
            {isPro && view !== "success" ? (
              <ProStatusView key="status" onDowngrade={() => setPro(false)} onClose={close} />
            ) : view === "pricing" ? (
              <motion.div key="pricing" {...VIEW_MOTION}>
                <Header
                  eyebrow="Travel Simulator Pro"
                  title={t("proModal.title")}
                  text={t("proModal.text")}
                />

                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {PERKS.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-md">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{t(title)}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink/60">{t(text)}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div role="radiogroup" aria-label={t("proModal.package")} className="mt-6 grid gap-3 sm:grid-cols-2">
                  {(Object.keys(PLANS) as PlanId[]).map((id) => {
                    const p = PLANS[id];
                    const active = plan === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPlan(id)}
                        className={cn(
                          "relative rounded-2xl border-2 p-4 text-left transition-colors",
                          active
                            ? "border-blue-600 bg-blue-500/10 dark:border-blue-400"
                            : "border-ink/10 bg-ink/[0.02] hover:border-ink/25",
                        )}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            {t("proModal.popular")}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{t(p.title)}</p>
                          <span
                            className={cn(
                              "grid h-5 w-5 place-items-center rounded-full border-2",
                              active
                                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500"
                                : "border-ink/25",
                            )}
                          >
                            {active && <Check size={11} strokeWidth={3} />}
                          </span>
                        </div>
                        <p className="mt-2">
                          <span className="font-mono text-2xl font-bold tabular-nums">{p.price}</span>
                          <span className="ml-1 text-xs text-ink/55">{t(p.period)}</span>
                        </p>
                        <p className="mt-1 text-xs text-ink/55">{t(p.note)}</p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setView("checkout")}
                  className="mt-6 w-full rounded-2xl glass-primary px-5 py-3.5 text-sm font-semibold"
                >
                  {t("proModal.toCheckout")}
                </button>
                <p className="mt-2 text-center text-[11px] text-ink/45">{t("proModal.cancelNote")}</p>
              </motion.div>
            ) : view === "checkout" ? (
              <motion.div key="checkout" {...VIEW_MOTION}>
                <button
                  type="button"
                  onClick={() => !processing && setView("pricing")}
                  className="mb-3 flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-ink"
                >
                  <ArrowLeft size={13} /> {t("proModal.packages")}
                </button>
                <Header
                  eyebrow={t("proModal.secure")}
                  title={t("proModal.payTitle")}
                  text={t("proModal.payText")}
                />

                <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/[0.07] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-white">
                      <Crown size={16} />
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">{t(selected.title)}</p>
                      <p className="text-[11px] text-ink/55">{t(selected.note)}</p>
                    </div>
                  </div>
                  <p className="text-right font-mono text-lg font-bold tabular-nums">
                    {selected.price}
                    <span className="block text-[10px] font-normal text-ink/50">{t(selected.period)}</span>
                  </p>
                </div>

                <form
                  className="mt-5 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    pay();
                  }}
                >
                  <Field label={t("proModal.cardName")}>
                    <input
                      className={INPUT}
                      autoComplete="cc-name"
                      placeholder={t("proModal.cardNamePh")}
                      value={card.name}
                      maxLength={60}
                      onChange={(e) => setCard((c) => ({ ...c, name: sanitizeInput(e.target.value, 60, { live: true }) }))}
                    />
                  </Field>
                  <Field label={t("proModal.cardNumber")}>
                    <div className="relative">
                      <input
                        className={cn(INPUT, "pr-10 font-mono tracking-wider")}
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="0000 0000 0000 0000"
                        value={card.number}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            number: formatCardNumber(e.target.value),
                          }))
                        }
                      />
                      <CreditCard size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("proModal.expiry")}>
                      <input
                        className={cn(INPUT, "font-mono")}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="12/28"
                        value={card.expiry}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            expiry: formatExpiry(e.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="CVC">
                      <input
                        className={cn(INPUT, "font-mono")}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        value={card.cvc}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            cvc: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] font-medium text-ink/55">
                    <span className="flex items-center gap-1 rounded-full border border-ink/10 px-2.5 py-1">
                      <ShieldCheck size={12} className="text-emerald-500" /> 256-bit SSL
                    </span>
                    <span className="rounded-full border border-ink/10 px-2.5 py-1 font-semibold text-[#635bff]">
                      stripe
                    </span>
                    <span className="rounded-full border border-ink/10 px-2.5 py-1 font-semibold text-[#1e64ff]">
                      iyzico
                    </span>
                    <span className="flex items-center gap-1 rounded-full border border-ink/10 px-2.5 py-1">
                      <BadgeCheck size={12} className="text-blue-500" /> 3D Secure
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!cardValid || processing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(245,158,11,0.8)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> {t("proModal.processing")}
                      </>
                    ) : (
                      t("proModal.pay")
                    )}
                  </button>
                  <p className="text-center text-[10px] text-ink/40">{t("proModal.simNote")}</p>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING_IN}
                className="py-10 text-center"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 14,
                    delay: 0.1,
                  }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-[0_15px_40px_-10px_rgba(245,158,11,0.8)]"
                >
                  <Crown size={36} />
                </motion.span>
                <h2 className="mt-5 text-2xl font-bold">{t("proModal.successTitle")}</h2>
                <p className="mt-1.5 text-sm text-ink/65">{t("proModal.successText")}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Header({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="pr-10">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
        <Crown size={13} /> {eyebrow}
      </p>
      <h2 className="mt-1.5 text-2xl font-bold md:text-3xl">{title}</h2>
      <p className="mt-1 text-sm text-ink/60">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-ink/50">{label}</span>
      {children}
    </label>
  );
}

function ProStatusView({ onDowngrade, onClose }: { onDowngrade: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <motion.div key="status" {...VIEW_MOTION} className="py-4 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-lg">
        <Crown size={28} />
      </span>
      <h2 className="mt-4 text-2xl font-bold">{t("proModal.activeTitle")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("proModal.activeText")}</p>
      <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left">
        {PERKS.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-2.5 text-sm">
            <Icon size={15} className="shrink-0 text-amber-500" /> {t(title)}
            <Check size={14} className="ml-auto shrink-0 text-emerald-500" />
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={onClose} className="rounded-xl glass-primary px-5 py-2.5 text-sm font-semibold">
          {t("proModal.continue")}
        </button>
        <button
          type="button"
          onClick={onDowngrade}
          className="flex items-center justify-center gap-1.5 rounded-xl glass-secondary px-5 py-2.5 text-sm font-medium text-ink/70"
        >
          <Lock size={13} /> {t("proModal.downgrade")}
        </button>
      </div>
    </motion.div>
  );
}
