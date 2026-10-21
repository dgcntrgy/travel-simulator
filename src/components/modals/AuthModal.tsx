"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, User, X, type LucideIcon } from "lucide-react";
import { authApi, currentRouteSummary } from "@/lib/authClient";
import { cn } from "@/lib/cn";
import { SPRING_IN } from "@/lib/motion";
import {
  isValidEmail,
  isValidPhone,
  passwordProblem,
  sanitizeEmail,
  sanitizeInput,
  sanitizePhone,
} from "@/lib/security";
import { useT } from "@/lib/useI18n";
import { useTripStore } from "@/store/useTripStore";

const INPUT =
  "w-full rounded-xl border border-ink/10 bg-ink/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-blue-500/60 focus:bg-ink/[0.05]";

/** 👤 Giriş / Kayıt Ol. Şifre sunucuda scrypt + salt ile hash'lenir; oturum httpOnly çerezde. */
export default function AuthModal() {
  const open = useTripStore((s) => s.isAuthModalOpen);
  return <AnimatePresence>{open && <AuthDialog key="auth-modal" />}</AnimatePresence>;
}

function AuthDialog() {
  const t = useT();
  const close = useTripStore((s) => s.closeAuthModal);
  const initialView = useTripStore((s) => s.authView);
  const setUser = useTripStore((s) => s.setUser);
  const openAdmin = useTripStore((s) => s.openAdmin);

  const [view, setView] = useState(initialView);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, close]);

  const isRegister = view === "register";

  /** İstemci doğrulaması (kullanıcı deneyimi için); asıl kontrol API'de tekrar yapılır */
  const validate = (): string | null => {
    const name = sanitizeInput(form.name, 80);
    const email = sanitizeEmail(form.email);
    if (isRegister && name.length < 2) return t("auth.errName");
    if (!isValidEmail(email)) return t("auth.errEmail");
    if (isRegister && !isValidPhone(sanitizePhone(form.phone))) return t("auth.errPhone");
    if (isRegister) return passwordProblem(form.password) ? t("auth.errPassword") : null;
    return form.password ? null : t("auth.errPasswordMissing");
  };

  const submit = async () => {
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const email = sanitizeEmail(form.email);
    const res = isRegister
      ? await authApi.register({
          name: sanitizeInput(form.name, 80),
          email,
          phone: sanitizePhone(form.phone),
          password: form.password,
          lastRoute: currentRouteSummary(),
          isPro: useTripStore.getState().isPro,
        })
      : await authApi.login(email, form.password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUser(res.data.user);
    close();
  };

  const switchView = (v: typeof view) => {
    setView(v);
    setError(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[2000] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xl print:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && close()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isRegister ? t("auth.register") : t("auth.login")}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={SPRING_IN}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/40 bg-white/80 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl dark:border-white/15 dark:bg-slate-900/70"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

        <button
          type="button"
          onClick={close}
          aria-label={t("common.close")}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full glass-secondary text-ink/70"
        >
          <X size={16} />
        </button>

        <div className="relative p-6 md:p-8">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
            <User size={13} /> {t("auth.account")}
          </p>
          <h2 className="mt-1.5 pr-10 text-2xl font-bold">{isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}</h2>
          <p className="mt-1 text-sm text-ink/60">
            {isRegister ? t("auth.registerText") : t("auth.loginText")}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink/[0.05] p-1 text-sm font-medium">
            {(["login", "register"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => switchView(v)}
                className={cn(
                  "rounded-lg py-2 transition-colors",
                  view === v ? "bg-surface text-ink shadow-sm" : "text-ink/55 hover:text-ink",
                )}
              >
                {v === "login" ? t("auth.login") : t("auth.register")}
              </button>
            ))}
          </div>

          <form
            className="mt-5 space-y-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {isRegister && (
              <Field label={t("auth.name")} icon={User}>
                <input
                  className={INPUT}
                  autoComplete="name"
                  placeholder={t("auth.namePh")}
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: sanitizeInput(e.target.value, 80, { live: true }) }))}
                />
              </Field>
            )}
            <Field label={t("auth.email")} icon={Mail}>
              <input
                className={INPUT}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("auth.emailPh")}
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: sanitizeEmail(e.target.value) }))}
              />
            </Field>
            {isRegister && (
              <Field label={t("auth.phone")} icon={Phone}>
                <input
                  className={INPUT}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+90 5xx xxx xx xx"
                  maxLength={24}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: sanitizePhone(e.target.value, true) }))}
                />
              </Field>
            )}
            <Field label={t("auth.password")} icon={Lock}>
              <div className="relative">
                <input
                  className={cn(INPUT, "pr-10")}
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? t("auth.passwordPh") : "••••••••"}
                  maxLength={128}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink/45 hover:text-ink"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl glass-primary px-5 py-3 text-sm font-semibold disabled:opacity-70"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {isRegister ? t("auth.submitRegister") : t("auth.login")}
            </button>
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink/50">
            <ShieldCheck size={12} className="text-emerald-500" /> {t("auth.hashNote")}
          </p>

          <div className="mt-4 border-t border-ink/10 pt-3 text-center">
            <button
              type="button"
              onClick={openAdmin}
              className="text-xs font-medium text-ink/45 transition-colors hover:text-ink"
            >
              {t("account.admin")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-ink/50">{label}</span>
      <span className="relative block">
        <Icon size={15} className="pointer-events-none absolute left-3.5 top-[0.8rem] z-10 text-ink/35" />
        {children}
      </span>
    </label>
  );
}
