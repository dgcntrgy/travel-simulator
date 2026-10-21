"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Globe2,
  LogOut,
  MapPin,
  Moon,
  Route,
  ShieldCheck,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { estimateTripDays } from "@/data/mockPlaces";
import { authApi } from "@/lib/authClient";
import { buildTripPlan } from "@/lib/routeOptimizer";
import { STEPS, computeBudget, useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import AnimatedNumber from "./AnimatedNumber";

function BudgetCounter() {
  const budget = useTripStore(useShallow(computeBudget));
  const isPro = useTripStore((s) => s.isPro);
  const [open, setOpen] = useState(false);

  // Önceki toplamı state'te tutarak (+/-) değişim rozetini render sırasında hesapla
  const [prevTotal, setPrevTotal] = useState(budget.total);
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(null);
  if (prevTotal !== budget.total) {
    setDelta({ amount: budget.total - prevTotal, key: budget.total });
    setPrevTotal(budget.total);
  }

  const rows = [
    { label: "Uçuş", value: budget.flight },
    { label: "Otel", value: budget.hotel },
    { label: "Ulaşım", value: budget.transit },
    { label: "Yemek & Girişler", value: budget.foodAndEntries },
  ];

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 items-center gap-2.5 overflow-hidden rounded-xl glass-chip px-2.5 text-left sm:h-11 sm:px-3"
        aria-label="Canlı bütçe"
      >
        {/* Her değişimde kısa bir ışık süpürmesi (artış yeşil/altın, azalış gül) */}
        <AnimatePresence>
          {delta && delta.amount !== 0 && (
            <motion.span
              key={`flash-${delta.key}`}
              aria-hidden
              initial={{ opacity: 0, x: "-100%" }}
              animate={{ opacity: [0, 1, 0], x: ["-100%", "0%", "100%"] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-transparent",
                delta.amount > 0 ? "via-emerald-400/25" : "via-rose-400/25",
              )}
            />
          )}
        </AnimatePresence>
        <span className="relative hidden h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 sm:grid dark:text-emerald-300">
          <Wallet size={16} />
        </span>
        <span className="relative flex flex-col leading-tight">
          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-ink/50 sm:text-[10px] sm:tracking-[0.14em]">Canlı Bütçe</span>
          <AnimatedNumber value={budget.total} className="font-mono text-sm font-semibold tabular-nums text-ink sm:text-base" />
        </span>
      </button>

      <AnimatePresence>
        {delta && delta.amount !== 0 && (
          // Sayacın hemen solunda yukarı süzülüp kaybolan "+$720" rozeti
          <motion.span
            key={delta.key}
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, -2, -10, -22], scale: [0.7, 1.12, 1, 0.95] }}
            transition={{ duration: 1.6, times: [0, 0.18, 0.6, 1], ease: "easeOut" }}
            className={cn(
              "pointer-events-none absolute right-0 top-full z-40 mt-1 whitespace-nowrap sm:right-full sm:top-1/2 sm:mr-2 sm:-mt-3 rounded-full px-2 py-0.5 font-mono text-xs font-bold shadow-lg",
              delta.amount > 0
                ? "bg-gradient-to-r from-emerald-400 to-amber-300 text-emerald-950 shadow-emerald-500/30"
                : "bg-rose-500/90 text-white shadow-rose-500/30",
            )}
          >
            {delta.amount > 0 ? "+" : "−"}${Math.abs(delta.amount).toLocaleString("en-US")}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="card absolute right-0 top-full z-[999] mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl p-4"
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Bütçe Dökümü</p>
            <ul className="space-y-2 text-sm">
              {rows.map((r, i) => (
                <li key={r.label} className="flex items-center justify-between">
                  <span className="text-ink/70">{r.label}</span>
                  <span className={cn("font-mono tabular-nums text-ink", !isPro && i > 0 && "select-none blur-[5px]")}>
                    ${r.value.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
              <span className="font-medium text-ink">Toplam</span>
              <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                ${budget.total.toLocaleString("en-US")}
              </span>
            </div>
            {!isPro && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-200/80">
                <Crown size={12} /> Tam kırılım Pro modunda açılır.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Adım 2'den itibaren: seçilen mekan sayısı + gezi günü (Adım 3+ akıllı plandaki gerçek gün sayısı) */
function TripStats({ className }: { className?: string }) {
  const currentStep = useTripStore((s) => s.currentStep);
  const selectedPlaces = useTripStore((s) => s.selectedPlaces);
  const destination = useTripStore((s) => s.destination);
  const days = useMemo(
    () =>
      currentStep >= 3 && selectedPlaces.length > 0 && destination
        ? buildTripPlan(selectedPlaces, destination).totalDays
        : estimateTripDays(selectedPlaces),
    [currentStep, selectedPlaces, destination],
  );

  if (currentStep < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("items-center gap-3 rounded-xl glass-chip px-3 py-1.5", className)}
    >
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink/50">Mekan</span>
        <span className="flex items-center gap-1 font-mono text-base font-semibold tabular-nums text-ink">
          <MapPin size={13} className="text-amber-500 dark:text-amber-300" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={selectedPlaces.length}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {selectedPlaces.length}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      <span className="h-8 w-px bg-ink/10" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink/50">Tahmini</span>
        <span className="flex items-center gap-1 font-mono text-base font-semibold tabular-nums text-ink">
          <CalendarDays size={13} className="text-blue-600 dark:text-blue-300" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={days} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {days}
            </motion.span>
          </AnimatePresence>
          <span className="text-xs font-normal text-ink/50">gün</span>
        </span>
      </span>
    </motion.div>
  );
}

function ThemeToggle() {
  const theme = useTripStore((s) => s.theme);
  const toggleTheme = useTripStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
      title={isDark ? "Aydınlık tema" : "Karanlık tema"}
      className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl glass-chip sm:h-11 sm:w-11 text-ink/80 transition-colors hover:bg-ink/[0.07] hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {isDark ? <Moon size={18} className="text-indigo-300" /> : <Sun size={18} className="text-amber-500" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function ProToggle() {
  const isPro = useTripStore((s) => s.isPro);
  const openUpgradeModal = useTripStore((s) => s.openUpgradeModal);

  // Doğrudan Pro yapmaz: tanıtım + satın alma modalını açar (Pro'daysa durum / test için ücretsize dönüş)
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={openUpgradeModal}
      className="flex h-10 shrink-0 items-center gap-2 rounded-xl glass-chip px-2.5 text-xs font-medium sm:h-11 sm:gap-2.5 sm:px-3"
      title={isPro ? "Pro üyelik durumu" : "Ücretsiz · Pro'ya Yükselt"}
    >
      <span className={cn("hidden transition-colors sm:inline", isPro ? "text-ink/40" : "text-ink")}>Ücretsiz</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          isPro ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-ink/15",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn(
            "absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow",
            isPro ? "right-0.5" : "left-0.5",
          )}
        >
          {isPro && <Crown size={11} className="text-amber-500" />}
        </motion.span>
      </span>
      <span className={cn("transition-colors", isPro ? "text-amber-600 dark:text-amber-200" : "text-ink/40")}>Pro</span>
    </button>
  );
}

/** Adım 1 ➔ Adım 2 ➔ Adım 3 ➔ Adım 4; tamamlanan adımlara tıklayarak geri dönülebilir */
function StepProgress({ className }: { className?: string }) {
  const currentStep = useTripStore((s) => s.currentStep);
  const setStep = useTripStore((s) => s.setStep);

  return (
    <nav aria-label="Simülasyon adımları" className={cn("flex items-center gap-0.5 sm:gap-1", className)}>
      {STEPS.map((s, i) => {
        const done = s.id < currentStep;
        const active = s.id === currentStep;
        return (
          <Fragment key={s.id}>
            {i > 0 && (
              <ChevronRight
                size={14}
                className={cn("shrink-0", s.id <= currentStep ? "text-blue-500" : "text-ink/25")}
              />
            )}
            <button
              type="button"
              disabled={!done}
              onClick={() => setStep(s.id)}
              title={s.title}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[11px] font-medium transition-colors sm:gap-2 sm:pr-3 sm:text-xs",
                active && "bg-blue-500/10 text-ink ring-1 ring-blue-500/40",
                done && "text-ink/70 hover:bg-ink/[0.05] hover:text-ink",
                !active && !done && "cursor-default text-ink/40",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-semibold",
                  active && "glass-primary",
                  done && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                  !active && !done && "bg-ink/[0.06]",
                )}
              >
                {done ? <Check size={12} strokeWidth={3} /> : s.id}
              </span>
              {/* Mobil/tablet: kısa ad ("Uçuş"); masaüstü: "Adım 1", geniş ekranda "Adım 1 · Uçuş" */}
              <span className="whitespace-nowrap">
                <span className="lg:hidden">{s.short}</span>
                <span className="hidden lg:inline">Adım {s.id}</span>
                <span className="hidden 2xl:inline"> · {s.short}</span>
              </span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** 👤 Giriş / Kayıt Ol; oturum açıkken ad + rozet ve kullanıcı menüsü (son rota, yönetici paneli, çıkış) */
function AccountButton() {
  const user = useTripStore((s) => s.user);
  const isPro = useTripStore((s) => s.isPro);
  const openAuthModal = useTripStore((s) => s.openAuthModal);
  const openAdmin = useTripStore((s) => s.openAdmin);
  const setUser = useTripStore((s) => s.setUser);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => openAuthModal("login")}
        title="Giriş / Kayıt Ol"
        aria-label="Giriş / Kayıt Ol"
        className="flex h-10 shrink-0 items-center gap-2 rounded-xl glass-chip px-2.5 text-xs font-semibold text-ink sm:h-11 sm:px-3"
      >
        <span aria-hidden className="text-base leading-none">👤</span>
        <span className="hidden md:inline">Giriş / Kayıt Ol</span>
      </button>
    );
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr"))
    .join("");
  const pro = isPro || user.isPro;

  const logout = async () => {
    setOpen(false);
    await authApi.logout();
    setUser(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={user.name}
        className="flex h-10 shrink-0 items-center gap-2 rounded-xl glass-chip px-1.5 text-left sm:h-11 md:pr-3"
      >
        <span
          className={cn(
            "relative grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold text-white sm:h-8 sm:w-8",
            pro ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-blue-600",
          )}
        >
          {initials || <UserRound size={14} />}
          {pro && <Crown size={11} className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-amber-500 shadow" />}
        </span>
        <span className="hidden max-w-[9rem] flex-col leading-tight md:flex">
          <span className="truncate text-xs font-semibold text-ink">{user.name}</span>
          <span className={cn("text-[10px] font-medium", pro ? "text-amber-600 dark:text-amber-300" : "text-ink/50")}>
            {pro ? "👑 Pro Gezgin" : "Ücretsiz Üye"}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="card absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl p-2"
          >
            <div className="px-3 pb-2 pt-2">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink/55">{user.email}</p>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink/60">
                <Route size={12} className="mt-0.5 shrink-0 text-blue-500" />
                <span>{user.lastRoute || "Henüz kayıtlı rota yok"}</span>
              </p>
            </div>
            <div className="my-1 h-px bg-ink/10" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openAdmin();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/[0.05] hover:text-ink"
            >
              <ShieldCheck size={15} className="text-emerald-500" /> 🛡️ Yönetici / Excel Tablosu
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <LogOut size={15} /> Çıkış Yap
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TopBar() {
  const currentStep = useTripStore((s) => s.currentStep);
  const setStep = useTripStore((s) => s.setStep);

  return (
    <header className="sticky top-0 z-[1000] shrink-0 print:hidden border-b border-ink/10 bg-white/80 backdrop-blur-xl dark:bg-[#080C16]/80">
      {/* Masaüstü: tek satır (logo · adımlar · kontroller). Mobil/tablet: 1. satır logo + kontroller, 2. satır adımlar + istatistik */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-2 sm:gap-x-3 sm:px-4 md:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="flex shrink-0 items-center gap-2.5 rounded-xl text-left"
          aria-label="Ana sayfaya dön"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl glass-primary">
            <Globe2 size={18} />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold text-ink">Traveller</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/50">Seyahat Simülatörü</span>
          </span>
        </button>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <StepProgress />
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <TripStats className="hidden xl:flex" />
          <ThemeToggle />
          <AccountButton />
          <ProToggle />
          <BudgetCounter />
        </div>

        {currentStep > 0 && (
          <div className="flex w-full items-center justify-center gap-2 border-t border-ink/[0.07] pt-2 lg:hidden">
            <div className="min-w-0 overflow-x-auto scrollbar-thin">
              <StepProgress className="mx-auto w-max" />
            </div>
            <TripStats className="hidden shrink-0 sm:flex" />
          </div>
        )}
      </div>
    </header>
  );
}
