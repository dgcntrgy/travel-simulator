"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, X, type LucideIcon } from "lucide-react";
import { searchKey } from "@/lib/globalDiscovery";
import { cn } from "@/lib/cn";
import { sanitizeSearch } from "@/lib/security";
import type { Airport } from "@/types/trip";

const defaultMatches = (a: Airport, q: string) =>
  [a.city, a.country, a.code, a.airportName].some((h) => searchKey(h).includes(q));

/**
 * Yerel <select> yerine cam temalı şehir/havalimanı açılır listesi:
 * tetikleyici etiket + Framer Motion popover (sabit arama, bayrak · şehir & ülke · IATA rozeti, ✓ seçili).
 * Dışarı tıklama / Escape kapatır; ↑ ↓ Enter ile klavyeden seçilebilir.
 */
export default function CitySelectDropdown({
  label,
  icon: Icon,
  value,
  options,
  onChange,
  isDisabled,
  disabledHint = "Kalkışınla aynı şehir",
  getSubtitle,
  matches,
  placeholder = "Şehir seç",
  className,
}: {
  label: string;
  icon: LucideIcon;
  value: Airport | null;
  options: Airport[];
  onChange: (a: Airport) => void;
  /** Seçilemez satırlar (örn. kalkışla aynı şehir) */
  isDisabled?: (a: Airport) => boolean;
  disabledHint?: string;
  /** Satırın ikinci satırı; varsayılan ülke */
  getSubtitle?: (a: Airport) => string;
  /** Özel arama eşleşmesi (q önceden searchKey'den geçmiş metin) */
  matches?: (a: Airport, q: string) => boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const q = searchKey(query.trim());
  const visible = useMemo(
    () => (q ? options.filter((o) => (matches ?? defaultMatches)(o, q)) : options),
    [options, q, matches],
  );

  // Dışarı tıklama ile kapat
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Açılışta aramayı sıfırla, seçili satırı vurgula ve görünür yap
  const toggle = () => {
    if (open) return setOpen(false);
    setQuery("");
    const idx = value ? options.findIndex((o) => o.code === value.code) : 0;
    setActive(Math.max(0, idx));
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
    });
  };

  const pick = (a: Airport) => {
    if (isDisabled?.(a)) return;
    onChange(a);
    setOpen(false);
  };

  const moveActive = (dir: 1 | -1) => {
    if (!visible.length) return;
    const next = (active + dir + visible.length) % visible.length;
    setActive(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = visible[active];
      if (a) pick(a);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", open && "z-50", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-ink/[0.04]",
          open && "bg-ink/[0.04]",
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/45">{label}</span>
          <span className={cn("block truncate text-[15px] font-semibold", value ? "text-ink" : "text-ink/40")}>
            {value ? (
              <>
                {value.flag} {value.city} <span className="font-mono text-xs font-medium text-ink/45">{value.code}</span>
              </>
            ) : (
              placeholder
            )}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-ink/40 transition-transform duration-200 group-hover:text-ink/70",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 right-0 top-full z-[999] mt-2 overflow-hidden sm:min-w-[18rem] rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-[#0B1224]/95 dark:text-white"
          >
            {/* Sabit arama */}
            <div className="border-b border-slate-200 p-2 dark:border-white/10">
              <label className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 ring-1 ring-transparent focus-within:ring-blue-500/50 dark:bg-white/[0.06]">
                <Search size={15} className="shrink-0 text-slate-400 dark:text-white/45" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-label={`${label} ara`}
                  value={query}
                  onChange={(e) => {
                    setQuery(sanitizeSearch(e.target.value));
                    setActive(0);
                    listRef.current?.scrollTo({ top: 0 });
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Şehir, ülke veya havalimanı kodu ara..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-white/40"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className="text-slate-400 hover:text-slate-700 dark:text-white/45 dark:hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>

            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-[min(18rem,55dvh)] overflow-y-auto overscroll-contain p-1.5 scrollbar-thin">
              {visible.map((a, i) => {
                const selected = value?.code === a.code;
                const disabled = isDisabled?.(a) ?? false;
                return (
                  <li
                    key={a.code}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={disabled}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(a)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-40"
                        : i === active
                          ? "bg-blue-500/20"
                          : "hover:bg-blue-500/20",
                      selected && !disabled && i !== active && "bg-blue-500/10",
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-lg leading-none dark:border-white/10 dark:bg-white/[0.06]">
                      {a.flag}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-semibold">{a.city}</span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-white/55">
                        {disabled ? disabledHint : (getSubtitle?.(a) ?? a.country)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                      {a.code}
                    </span>
                    <Check
                      size={15}
                      strokeWidth={3}
                      className={cn("shrink-0 text-blue-600 dark:text-blue-400", !selected && "invisible")}
                    />
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-white/50">
                  &ldquo;{query}&rdquo; için sonuç bulunamadı.
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
