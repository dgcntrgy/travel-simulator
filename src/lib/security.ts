/**
 * Güvenlik yardımcıları — hem istemci formlarında hem API'de (sunucu tarafı asıl kontrol) kullanılır.
 * Bu dosya `next.config.ts` ve `src/proxy.ts` tarafından da içe aktarılır: tarayıcı/Node'a özgü API kullanmaz.
 */

/** Tüm yanıtlara eklenen güvenlik başlıkları (Clickjacking, MIME sniffing, Referrer sızıntısı, cihaz izinleri) */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** `/api/*` için IP başına kayan pencere sınırı (src/proxy.ts) */
export const RATE_LIMIT = { windowMs: 60_000, max: 20 } as const;

// Kontrol karakterleri (\t \n \r hariç) ve sıfır genişlikli / yön değiştiren Unicode karakterleri
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;
const SCRIPT_BLOCKS = /<\s*(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi;
const HTML_TAGS = /<\/?[a-z!?][^>]*>?/gi;
const DANGEROUS_PROTOCOLS = /\b(?:java|vb)script\s*:|\bdata\s*:\s*text\/html/gi;
const EVENT_HANDLERS = /\bon[a-z]+\s*=/gi;
const DANGEROUS_CHARS = /[<>"`\\]/g;

/**
 * Kullanıcı metnini temizler: `<script>`/`<style>` blokları, HTML etiketleri, `javascript:` protokolleri,
 * `onerror=` gibi olay öznitelikleri, kontrol karakterleri ve `< > " \` \\` karakterleri atılır;
 * boşluklar sadeleştirilir, uzunluk sınırlanır. Kesme işareti (O'Neil, Türkçe ek) korunur.
 * `live: true` → form alanında yazarken kullanılır: sondaki tek boşluk silinmez ("Ali " → "Ali Veli" yazılabilsin).
 */
export function sanitizeInput(value: unknown, maxLength = 200, { live = false }: { live?: boolean } = {}): string {
  if (typeof value !== "string") return "";
  let out = value.normalize("NFC").replace(CONTROL_CHARS, "");
  // Tekrarlı geçiş: "<scr<script>ipt>" gibi iç içe hileler tek turda temizlenemez
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out
      .replace(SCRIPT_BLOCKS, "")
      .replace(HTML_TAGS, "")
      .replace(DANGEROUS_PROTOCOLS, "")
      .replace(EVENT_HANDLERS, "");
    if (out === before) break;
  }
  out = out.replace(DANGEROUS_CHARS, "").replace(/\s+/g, " ");
  return (live ? out.trimStart() : out.trim()).slice(0, maxLength);
}

/** Arama kutuları (yazarken) */
export function sanitizeSearch(value: unknown): string {
  return sanitizeInput(value, 80, { live: true });
}

export function sanitizeEmail(value: unknown): string {
  return sanitizeInput(value, 254).toLowerCase().replace(/\s/g, "");
}

/** Telefon: yalnız rakam, baştaki +, boşluk, tire ve parantez */
export function sanitizePhone(value: unknown, live = false): string {
  return sanitizeInput(value, 24, { live }).replace(/[^\d+\s()-]/g, "").replace(/(?!^)\+/g, "");
}

const EMAIL_RE = /^[^\s@;,]+@[^\s@;,]+\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // opsiyonel
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** En az 8 karakter, harf + rakam; 128 karakter üst sınır (scrypt'e aşırı yük bindirilmesin) */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (password.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) return "Şifre en az bir harf ve bir rakam içermeli.";
  return null;
}

/**
 * Excel/CSV formül enjeksiyonu (=HYPERLINK(...), +cmd, @SUM) koruması: hücre bu karakterlerle
 * başlıyorsa başına ' eklenir; çift tırnaklar kaçırılır ve hücre tırnak içine alınır.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
