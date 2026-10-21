/**
 * Sunucu tarafı kullanıcı deposu: `data/users.json` (yalnız API route'larından içe aktarılır).
 * Şifreler `crypto.scryptSync` + 16 baytlık rastgele salt ile hash'lenir; düz metin hiçbir yerde tutulmaz.
 * Oturum: rastgele 32 baytlık token httpOnly çerezde, kayıtta yalnız SHA-256 özeti.
 */
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AdminUserRow, PublicUser } from "@/types/trip";

export const SESSION_COOKIE = "ts_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 gün (saniye)

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64, saltLen: 16 } as const;

interface StoredUser extends PublicUser {
  /** "scrypt$N$r$p$saltHex$hashHex" */
  passwordHash: string;
  /** Aktif oturum token'larının SHA-256 özetleri (en fazla 5 cihaz) */
  sessions: { hash: string; expiresAt: number }[];
}

// ---------- Şifre ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT.saltLen);
  const hash = scryptSync(password, salt, SCRYPT.keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("hex"), hash.toString("hex")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, n, r, p, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Kullanıcı bulunamadığında da aynı süre harcansın (e-posta var/yok zamanlama sızıntısı olmasın) */
const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));
export function burnPasswordCheck(password: string) {
  verifyPassword(password, DUMMY_HASH);
}

/** Sabit zamanlı metin karşılaştırma (yönetici şifresi) */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---------- Dosya ----------

// Eşzamanlı yazmalar dosyayı bozmasın: tüm okuma-değiştirme-yazma işlemleri tek kuyrukta
let queue: Promise<unknown> = Promise.resolve();

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeUsers(users: StoredUser[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(tmp, USERS_FILE); // atomik değiştirme
}

function withUsers<T>(fn: (users: StoredUser[]) => T | Promise<T>, write: boolean): Promise<T> {
  const run = queue.then(async () => {
    const users = await readUsers();
    const result = await fn(users);
    if (write) await writeUsers(users);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

// ---------- Dönüşümler ----------

export function toPublic(u: StoredUser): PublicUser {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, lastRoute: u.lastRoute, isPro: u.isPro, createdAt: u.createdAt };
}

function toAdminRow(u: StoredUser): AdminUserRow {
  const [algo, n, , , saltHex, hashHex] = u.passwordHash.split("$");
  const fingerprint = createHash("sha256").update(u.passwordHash).digest("hex").slice(0, 10);
  return {
    ...toPublic(u),
    hashInfo: `${algo} · N=${n} · salt ${saltHex.length / 2}B · ${hashHex.length / 2}B ✓ · #${fingerprint}`,
  };
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function issueSession(user: StoredUser): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  user.sessions = [
    ...user.sessions.filter((s) => s.expiresAt > now).slice(-4),
    { hash: tokenHash(token), expiresAt: now + SESSION_MAX_AGE * 1000 },
  ];
  return token;
}

function findBySession(users: StoredUser[], token: string | undefined): StoredUser | undefined {
  if (!token) return undefined;
  const h = tokenHash(token);
  const now = Date.now();
  return users.find((u) => u.sessions.some((s) => s.hash === h && s.expiresAt > now));
}

// ---------- İşlemler ----------

export type RegisterInput = { name: string; email: string; phone: string; password: string; lastRoute: string; isPro: boolean };

export function registerUser(input: RegisterInput) {
  return withUsers((users) => {
    if (users.some((u) => u.email === input.email)) return { error: "Bu e-posta ile zaten bir hesap var." as const };
    const user: StoredUser = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      lastRoute: input.lastRoute,
      isPro: input.isPro,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(input.password),
      sessions: [],
    };
    const token = issueSession(user);
    users.push(user);
    return { user: toPublic(user), token };
  }, true);
}

export function loginUser(email: string, password: string) {
  return withUsers((users) => {
    const user = users.find((u) => u.email === email);
    if (!user) {
      burnPasswordCheck(password);
      return null;
    }
    if (!verifyPassword(password, user.passwordHash)) return null;
    const token = issueSession(user);
    return { user: toPublic(user), token };
  }, true);
}

export function getSessionUser(token: string | undefined) {
  return withUsers((users) => {
    const u = findBySession(users, token);
    return u ? toPublic(u) : null;
  }, false);
}

export function syncUser(token: string | undefined, patch: { lastRoute?: string; isPro?: boolean }) {
  return withUsers((users) => {
    const u = findBySession(users, token);
    if (!u) return null;
    if (patch.lastRoute) u.lastRoute = patch.lastRoute;
    // Pro kaydı tek yönlü: istemcideki "Ücretsiz Moda Dön (Test)" kayıttaki Pro durumunu silmez
    if (patch.isPro) u.isPro = true;
    return toPublic(u);
  }, true);
}

export function logoutUser(token: string | undefined) {
  return withUsers((users) => {
    if (!token) return;
    const h = tokenHash(token);
    for (const u of users) u.sessions = u.sessions.filter((s) => s.hash !== h);
  }, true);
}

export function listUsersForAdmin(): Promise<AdminUserRow[]> {
  return withUsers((users) => users.map(toAdminRow).reverse(), false);
}
