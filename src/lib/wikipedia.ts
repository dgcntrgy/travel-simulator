/**
 * Ücretsiz Wikimedia REST API (anahtar gerektirmez, CORS açık).
 * https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 */
const SUMMARY_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/";

/** Kartlar ~400px genişlikte; retina için 960px Wikimedia'nın standart küçük resim adımlarından biri */
const CARD_IMAGE_WIDTH = 960;
const STORAGE_PREFIX = "wiki-summary:v1:";

export interface WikiSummary {
  title: string;
  /** Kart için uygun çözünürlükte görsel (yoksa null) */
  imageUrl: string | null;
  extract: string;
  pageUrl: string | null;
}

interface WikiImage {
  source: string;
  width: number;
  height: number;
}

interface RestSummaryResponse {
  type: string;
  title: string;
  extract?: string;
  thumbnail?: WikiImage;
  originalimage?: WikiImage;
  content_urls?: { desktop?: { page?: string } };
}

/** Aynı başlık için eşzamanlı istekleri tekilleştirir ve oturum boyunca tutar */
const memoryCache = new Map<string, Promise<WikiSummary | null>>();

/**
 * `originalimage` çoğu zaman 5000px+ (MB'larca) olduğundan, küçük resim URL'sindeki
 * genişlik segmentini (`/330px-`) kart boyutuna yükseltiriz.
 */
function pickImage(data: RestSummaryResponse, width: number): string | null {
  const { thumbnail, originalimage } = data;
  if (!thumbnail && !originalimage) return null;
  if (originalimage && originalimage.width <= width) return originalimage.source;
  if (thumbnail && /\/\d+px-/.test(thumbnail.source)) {
    return thumbnail.source.replace(/\/\d+px-/, `/${width}px-`);
  }
  return thumbnail?.source ?? originalimage?.source ?? null;
}

function readStorage(title: string): WikiSummary | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + title);
    return raw ? (JSON.parse(raw) as WikiSummary) : null;
  } catch {
    return null;
  }
}

function writeStorage(title: string, summary: WikiSummary) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + title, JSON.stringify(summary));
  } catch {
    // Gizli sekme / kota dolu: önbelleksiz devam et
  }
}

async function requestSummary(wikiTitle: string, signal?: AbortSignal): Promise<WikiSummary | null> {
  const res = await fetch(SUMMARY_ENDPOINT + encodeURIComponent(wikiTitle), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) return null;

  const data = (await res.json()) as RestSummaryResponse;
  if (data.type === "disambiguation") return null;

  return {
    title: data.title,
    imageUrl: pickImage(data, CARD_IMAGE_WIDTH),
    extract: data.extract ?? "",
    pageUrl: data.content_urls?.desktop?.page ?? null,
  };
}

/**
 * Mekanın Wikipedia özetini ve yüksek çözünürlüklü fotoğrafını getirir.
 * Ağ hatası veya bulunamayan sayfada `null` döner — çağıran taraf `fallbackImage` kullanmalı.
 */
export function fetchWikiSummary(wikiTitle: string): Promise<WikiSummary | null> {
  const cached = memoryCache.get(wikiTitle);
  if (cached) return cached;

  const stored = readStorage(wikiTitle);
  if (stored) {
    const p = Promise.resolve(stored);
    memoryCache.set(wikiTitle, p);
    return p;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const p = requestSummary(wikiTitle, controller.signal)
    .then((summary) => {
      if (summary) writeStorage(wikiTitle, summary);
      else memoryCache.delete(wikiTitle);
      return summary;
    })
    .catch(() => {
      // Bir sonraki denemede tekrar istek atılabilsin
      memoryCache.delete(wikiTitle);
      return null;
    })
    .finally(() => clearTimeout(timeout));

  memoryCache.set(wikiTitle, p);
  return p;
}

/** Sadece görsel gerektiğinde kısa yol */
export async function fetchWikiImage(wikiTitle: string): Promise<string | null> {
  return (await fetchWikiSummary(wikiTitle))?.imageUrl ?? null;
}

/** Başlık → yerel dildeki Wikipedia başlığı (örn "Sensō-ji" → "浅草寺"); dil başına oturum önbelleği */
const localTitleCache = new Map<string, Promise<Record<string, string>>>();

interface LangLinksResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; langlinks?: { lang: string; "*": string }[] }>;
  };
}

/**
 * Mekanların yerel dildeki adları (Adres kartları için). Tek istekte en fazla 50 başlık,
 * ücretsiz MediaWiki API (`prop=langlinks`, CORS `origin=*`). Hata / bulunamayan başlık → sözlükte yok.
 */
export function fetchLocalTitles(titles: string[], lang: string): Promise<Record<string, string>> {
  const unique = [...new Set(titles.filter(Boolean))].slice(0, 50);
  if (lang === "en" || unique.length === 0) return Promise.resolve({});
  const key = `${lang}|${unique.join("|")}`;
  const cached = localTitleCache.get(key);
  if (cached) return cached;

  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=langlinks&lllimit=max" +
    `&lllang=${encodeURIComponent(lang)}&titles=${encodeURIComponent(unique.join("|"))}`;

  const p = fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<LangLinksResponse>) : null))
    .then((data) => {
      const out: Record<string, string> = {};
      const q = data?.query;
      if (!q?.pages) return out;
      const byTitle = new Map<string, string>();
      for (const page of Object.values(q.pages)) {
        const local = page.langlinks?.[0]?.["*"];
        if (local) byTitle.set(page.title, local);
      }
      // İstenen başlık → normalize / yönlendirme zinciri → sayfa başlığı
      const hop = new Map<string, string>();
      for (const n of [...(q.normalized ?? []), ...(q.redirects ?? [])]) hop.set(n.from, n.to);
      for (const t of unique) {
        let cur = t;
        for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
        const local = byTitle.get(cur);
        if (local) out[t] = local;
      }
      return out;
    })
    .catch(() => {
      localTitleCache.delete(key);
      return {};
    });

  localTitleCache.set(key, p);
  return p;
}
