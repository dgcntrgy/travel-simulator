"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Download, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { authApi } from "@/lib/authClient";
import { cn } from "@/lib/cn";
import { SPRING_IN } from "@/lib/motion";
import { csvCell, sanitizeSearch } from "@/lib/security";
import { useTripStore } from "@/store/useTripStore";
import type { AdminUserRow } from "@/types/trip";

const COLUMNS: { key: keyof AdminUserRow; label: string; className?: string }[] = [
  { key: "id", label: "ID", className: "font-mono text-[11px]" },
  { key: "name", label: "Ad Soyad", className: "font-semibold" },
  { key: "email", label: "E-posta" },
  { key: "phone", label: "Telefon", className: "font-mono" },
  { key: "lastRoute", label: "Seçtiği Son Rota" },
  { key: "isPro", label: "Pro Durumu" },
  { key: "createdAt", label: "Kayıt Tarihi", className: "font-mono" },
  { key: "hashInfo", label: "Şifre Hash Koruması", className: "font-mono text-[11px]" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function cellText(row: AdminUserRow, key: keyof AdminUserRow): string {
  if (key === "isPro") return row.isPro ? "Pro" : "Ücretsiz";
  if (key === "createdAt") return formatDate(row.createdAt);
  return String(row[key] || "—");
}

/** Türkçe karakterler Excel'de bozulmasın: UTF-8 BOM + noktalı virgül ayraç + CRLF; formül enjeksiyonu `csvCell` ile kapalı */
function downloadCsv(rows: AdminUserRow[]) {
  const lines = [
    COLUMNS.map((c) => csvCell(c.label)).join(";"),
    ...rows.map((r) => COLUMNS.map((c) => csvCell(cellText(r, c.key))).join(";")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `traveller-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 🛡️ Yönetici / Excel Tablosu: şifre korumalı kullanıcı listesi + .CSV dışa aktarma */
export default function AdminPanel() {
  const open = useTripStore((s) => s.isAdminOpen);
  return <AnimatePresence>{open && <AdminDialog key="admin-panel" />}</AnimatePresence>;
}

function AdminDialog() {
  const close = useTripStore((s) => s.closeAdmin);
  // Şifre yalnız bu bileşenin belleğinde durur (yenileme için); panel kapanınca silinir
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const load = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    const res = await authApi.adminUsers(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setRows(null);
      return;
    }
    setRows(res.data.users);
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.phone, r.lastRoute].some((v) => v.toLocaleLowerCase("tr").includes(q)),
    );
  }, [rows, query]);

  const proCount = rows?.filter((r) => r.isPro).length ?? 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 backdrop-blur-xl sm:p-4 print:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Yönetici paneli"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={SPRING_IN}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full overflow-hidden rounded-[2rem] border border-white/40 bg-white/85 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl dark:border-white/15 dark:bg-slate-900/80",
          rows ? "max-w-6xl" : "max-w-md",
        )}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Kapat"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full glass-secondary text-ink/70"
        >
          <X size={16} />
        </button>

        <div className="p-5 md:p-7">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={13} /> Yönetici Paneli
          </p>

          {!rows ? (
            <form
              className="mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
            >
              <h2 className="pr-10 text-2xl font-bold">Excel Kullanıcı Tablosu</h2>
              <p className="mt-1 text-sm text-ink/60">Kayıtlı kullanıcıları görmek için yönetici şifresini gir.</p>
              <label className="relative mt-5 block">
                <KeyRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  type="password"
                  autoComplete="off"
                  autoFocus
                  maxLength={128}
                  placeholder="Yönetici şifresi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-blue-500/60"
                />
              </label>
              {error && (
                <p role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || !password}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl glass-primary px-5 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {busy && <Loader2 size={16} className="animate-spin" />} Paneli Aç
              </button>
            </form>
          ) : (
            <>
              <div className="mt-1 flex flex-col gap-3 pr-10 md:flex-row md:items-end md:justify-between md:pr-12">
                <div>
                  <h2 className="text-2xl font-bold">Kayıtlı Kullanıcılar</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    {rows.length} kullanıcı · <Crown size={12} className="inline text-amber-500" /> {proCount} Pro · kaynak:{" "}
                    <code className="font-mono text-xs">data/users.json</code>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl glass-secondary px-3 py-2.5 text-sm font-medium text-ink/80"
                  >
                    <RefreshCw size={14} className={cn(busy && "animate-spin")} /> Yenile
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCsv(filtered)}
                    disabled={filtered.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Download size={15} /> 📥 Excel (.CSV) Olarak İndir
                  </button>
                </div>
              </div>

              <label className="relative mt-4 block max-w-sm">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  value={query}
                  onChange={(e) => setQuery(sanitizeSearch(e.target.value))}
                  placeholder="Ad, e-posta, telefon veya rota ara"
                  className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] py-2 pl-10 pr-3.5 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-blue-500/60"
                />
              </label>

              {/* Excel görünümü: sabit başlık satırı, satır numarası sütunu, ızgara çizgileri; dar ekranda yatay kaydırma */}
              <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-ink/15 bg-surface scrollbar-thin">
                <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-emerald-700 text-white">
                      <th className="w-10 border border-emerald-800 px-2 py-2 text-center font-mono font-medium">#</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key} className="whitespace-nowrap border border-emerald-800 px-3 py-2 font-semibold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className="odd:bg-ink/[0.02] hover:bg-emerald-500/[0.07]">
                        <td className="border border-ink/10 bg-ink/[0.04] px-2 py-1.5 text-center font-mono text-ink/50">{i + 1}</td>
                        {COLUMNS.map((c) => (
                          <td key={c.key} className={cn("border border-ink/10 px-3 py-1.5 align-top text-ink/85", c.className)}>
                            {c.key === "isPro" ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  r.isPro ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-ink/[0.06] text-ink/60",
                                )}
                              >
                                {r.isPro && <Crown size={10} />} {cellText(r, c.key)}
                              </span>
                            ) : c.key === "id" ? (
                              <span title={r.id}>{r.id.slice(0, 8)}…</span>
                            ) : (
                              cellText(r, c.key)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-sm text-ink/50">
                          {rows.length === 0 ? "Henüz kayıtlı kullanıcı yok." : "Aramaya uyan kullanıcı yok."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-ink/45">
                Şifreler scrypt (N=16384, 16 bayt rastgele salt, 64 bayt anahtar) ile hash&apos;lenmiştir; tabloda yalnız
                algoritma özeti ve parmak izi görünür, hash veya şifre asla dışa aktarılmaz.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
