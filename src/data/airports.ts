import type { Airport } from "@/types/trip";
import { WORLD_AIRPORTS } from "./worldAirports";

/** Elle düzenlenmiş kayıtlar (kürasyonlu şehir adı / koordinat); dünya verisinin üzerine yazılır */
const CURATED_AIRPORTS = {
  // Türkiye çıkışları
  IST: {
    code: "IST",
    city: "İstanbul",
    country: "Türkiye",
    airportName: "İstanbul Havalimanı",
    coordinates: [28.9784, 41.0082],
    flag: "🇹🇷",
    utcOffset: 3,
  },
  SAW: {
    code: "SAW",
    city: "İstanbul",
    country: "Türkiye",
    airportName: "Sabiha Gökçen",
    coordinates: [29.3092, 40.8986],
    flag: "🇹🇷",
    utcOffset: 3,
  },
  ESB: {
    code: "ESB",
    city: "Ankara",
    country: "Türkiye",
    airportName: "Esenboğa",
    coordinates: [32.9951, 40.1281],
    flag: "🇹🇷",
    utcOffset: 3,
  },
  ADB: {
    code: "ADB",
    city: "İzmir",
    country: "Türkiye",
    airportName: "Adnan Menderes",
    coordinates: [27.1569, 38.2924],
    flag: "🇹🇷",
    utcOffset: 3,
  },

  // Popüler hedefler
  HND: {
    code: "HND",
    city: "Tokyo",
    country: "Japonya",
    airportName: "Haneda",
    coordinates: [139.7798, 35.5494],
    flag: "🇯🇵",
    utcOffset: 9,
  },
  FCO: {
    code: "FCO",
    city: "Roma",
    country: "İtalya",
    airportName: "Fiumicino",
    coordinates: [12.2508, 41.8003],
    flag: "🇮🇹",
    utcOffset: 1,
  },
  CDG: {
    code: "CDG",
    city: "Paris",
    country: "Fransa",
    airportName: "Charles de Gaulle",
    coordinates: [2.5479, 49.0097],
    flag: "🇫🇷",
    utcOffset: 1,
  },
  JFK: {
    code: "JFK",
    city: "New York",
    country: "ABD",
    airportName: "John F. Kennedy",
    coordinates: [-73.7781, 40.6413],
    flag: "🇺🇸",
    utcOffset: -5,
  },
  ICN: {
    code: "ICN",
    city: "Seul",
    country: "Güney Kore",
    airportName: "Incheon",
    coordinates: [126.4407, 37.4602],
    flag: "🇰🇷",
    utcOffset: 9,
  },

  // Küresel ülke havuzu (canlı Wikipedia keşfi + dinamik uçuş/otel simülatörü)
  BCN: {
    code: "BCN",
    city: "Barselona",
    country: "İspanya",
    airportName: "El Prat",
    coordinates: [2.0785, 41.2974],
    flag: "🇪🇸",
    utcOffset: 1,
  },
  BKK: {
    code: "BKK",
    city: "Bangkok",
    country: "Tayland",
    airportName: "Suvarnabhumi",
    coordinates: [100.7501, 13.69],
    flag: "🇹🇭",
    utcOffset: 7,
  },
  CAI: {
    code: "CAI",
    city: "Kahire",
    country: "Mısır",
    airportName: "Kahire Uluslararası",
    coordinates: [31.4056, 30.1219],
    flag: "🇪🇬",
    utcOffset: 2,
  },
  BER: {
    code: "BER",
    city: "Berlin",
    country: "Almanya",
    airportName: "Berlin Brandenburg",
    coordinates: [13.5033, 52.3667],
    flag: "🇩🇪",
    utcOffset: 1,
  },
  GIG: {
    code: "GIG",
    city: "Rio de Janeiro",
    country: "Brezilya",
    airportName: "Galeão",
    coordinates: [-43.2436, -22.81],
    flag: "🇧🇷",
    utcOffset: -3,
  },
  ATH: {
    code: "ATH",
    city: "Atina",
    country: "Yunanistan",
    airportName: "Eleftherios Venizelos",
    coordinates: [23.9445, 37.9364],
    flag: "🇬🇷",
    utcOffset: 2,
  },
  LIS: {
    code: "LIS",
    city: "Lizbon",
    country: "Portekiz",
    airportName: "Humberto Delgado",
    coordinates: [-9.1342, 38.7742],
    flag: "🇵🇹",
    utcOffset: 0,
  },
  PRG: {
    code: "PRG",
    city: "Prag",
    country: "Çekya",
    airportName: "Václav Havel",
    coordinates: [14.26, 50.1008],
    flag: "🇨🇿",
    utcOffset: 1,
  },
  BUD: {
    code: "BUD",
    city: "Budapeşte",
    country: "Macaristan",
    airportName: "Ferenc Liszt",
    coordinates: [19.2556, 47.4298],
    flag: "🇭🇺",
    utcOffset: 1,
  },
  ZRH: {
    code: "ZRH",
    city: "Zürih",
    country: "İsviçre",
    airportName: "Zürih Havalimanı",
    coordinates: [8.5492, 47.4582],
    flag: "🇨🇭",
    utcOffset: 1,
  },
  DBV: {
    code: "DBV",
    city: "Dubrovnik",
    country: "Hırvatistan",
    airportName: "Dubrovnik Havalimanı",
    coordinates: [18.2682, 42.5614],
    flag: "🇭🇷",
    utcOffset: 1,
  },
  RAK: {
    code: "RAK",
    city: "Marakeş",
    country: "Fas",
    airportName: "Menara",
    coordinates: [-8.0363, 31.6069],
    flag: "🇲🇦",
    utcOffset: 1,
  },
  DPS: {
    code: "DPS",
    city: "Bali",
    country: "Endonezya",
    airportName: "Ngurah Rai",
    coordinates: [115.1672, -8.7482],
    flag: "🇮🇩",
    utcOffset: 8,
  },
  SIN: {
    code: "SIN",
    city: "Singapur",
    country: "Singapur",
    airportName: "Changi",
    coordinates: [103.9915, 1.3644],
    flag: "🇸🇬",
    utcOffset: 8,
  },
  HAN: {
    code: "HAN",
    city: "Hanoi",
    country: "Vietnam",
    airportName: "Nội Bài",
    coordinates: [105.8067, 21.2212],
    flag: "🇻🇳",
    utcOffset: 7,
  },
  PEK: {
    code: "PEK",
    city: "Pekin",
    country: "Çin",
    airportName: "Pekin Başkent",
    coordinates: [116.5975, 40.0801],
    flag: "🇨🇳",
    utcOffset: 8,
  },
  DEL: {
    code: "DEL",
    city: "Yeni Delhi",
    country: "Hindistan",
    airportName: "Indira Gandhi",
    coordinates: [77.1, 28.5562],
    flag: "🇮🇳",
    utcOffset: 5.5,
  },
  MEX: {
    code: "MEX",
    city: "Meksiko",
    country: "Meksika",
    airportName: "Benito Juárez",
    coordinates: [-99.0721, 19.4363],
    flag: "🇲🇽",
    utcOffset: -6,
  },
  YYZ: {
    code: "YYZ",
    city: "Toronto",
    country: "Kanada",
    airportName: "Pearson",
    coordinates: [-79.6248, 43.6777],
    flag: "🇨🇦",
    utcOffset: -5,
  },
  EZE: {
    code: "EZE",
    city: "Buenos Aires",
    country: "Arjantin",
    airportName: "Ezeiza",
    coordinates: [-58.5358, -34.8222],
    flag: "🇦🇷",
    utcOffset: -3,
  },
  LIM: {
    code: "LIM",
    city: "Lima",
    country: "Peru",
    airportName: "Jorge Chávez",
    coordinates: [-77.1143, -12.0219],
    flag: "🇵🇪",
    utcOffset: -5,
  },
  CPT: {
    code: "CPT",
    city: "Cape Town",
    country: "Güney Afrika",
    airportName: "Cape Town Uluslararası",
    coordinates: [18.6021, -33.9715],
    flag: "🇿🇦",
    utcOffset: 2,
  },
  NBO: {
    code: "NBO",
    city: "Nairobi",
    country: "Kenya",
    airportName: "Jomo Kenyatta",
    coordinates: [36.9278, -1.3192],
    flag: "🇰🇪",
    utcOffset: 3,
  },
  SYD: {
    code: "SYD",
    city: "Sidney",
    country: "Avustralya",
    airportName: "Kingsford Smith",
    coordinates: [151.1772, -33.9399],
    flag: "🇦🇺",
    utcOffset: 10,
  },
  AMM: {
    code: "AMM",
    city: "Amman",
    country: "Ürdün",
    airportName: "Kraliçe Alia",
    coordinates: [35.9932, 31.7226],
    flag: "🇯🇴",
    utcOffset: 3,
  },
  TBS: {
    code: "TBS",
    city: "Tiflis",
    country: "Gürcistan",
    airportName: "Tiflis Uluslararası",
    coordinates: [44.9547, 41.6692],
    flag: "🇬🇪",
    utcOffset: 4,
  },

  // Aktarma merkezleri (hub) — DXB, DOH, AMS, VIE, LHR aynı zamanda hedef
  DOH: {
    code: "DOH",
    city: "Doha",
    country: "Katar",
    airportName: "Hamad International",
    coordinates: [51.6081, 25.2731],
    flag: "🇶🇦",
    utcOffset: 3,
  },
  DXB: {
    code: "DXB",
    city: "Dubai",
    country: "BAE",
    airportName: "Dubai International",
    coordinates: [55.3657, 25.2532],
    flag: "🇦🇪",
    utcOffset: 4,
  },
  FRA: {
    code: "FRA",
    city: "Frankfurt",
    country: "Almanya",
    airportName: "Frankfurt am Main",
    coordinates: [8.5622, 50.0379],
    flag: "🇩🇪",
    utcOffset: 1,
  },
  MUC: {
    code: "MUC",
    city: "Münih",
    country: "Almanya",
    airportName: "Franz Josef Strauss",
    coordinates: [11.7861, 48.3538],
    flag: "🇩🇪",
    utcOffset: 1,
  },
  VIE: {
    code: "VIE",
    city: "Viyana",
    country: "Avusturya",
    airportName: "Wien-Schwechat",
    coordinates: [16.5697, 48.1103],
    flag: "🇦🇹",
    utcOffset: 1,
  },
  AMS: {
    code: "AMS",
    city: "Amsterdam",
    country: "Hollanda",
    airportName: "Schiphol",
    coordinates: [4.7634, 52.3105],
    flag: "🇳🇱",
    utcOffset: 1,
  },
  LHR: {
    code: "LHR",
    city: "Londra",
    country: "Birleşik Krallık",
    airportName: "Heathrow",
    coordinates: [-0.4543, 51.47],
    flag: "🇬🇧",
    utcOffset: 0,
  },

  // Ek kalkış noktaları (sadece "Nereden kalkıyorsun?" listesinde)
  AYT: {
    code: "AYT",
    city: "Antalya",
    country: "Türkiye",
    airportName: "Antalya Havalimanı",
    coordinates: [30.8005, 36.8987],
    flag: "🇹🇷",
    utcOffset: 3,
  },
  LAX: {
    code: "LAX",
    city: "Los Angeles",
    country: "ABD",
    airportName: "Los Angeles International",
    coordinates: [-118.4085, 33.9416],
    flag: "🇺🇸",
    utcOffset: -8,
  },
  ORD: {
    code: "ORD",
    city: "Chicago",
    country: "ABD",
    airportName: "O'Hare",
    coordinates: [-87.9073, 41.9742],
    flag: "🇺🇸",
    utcOffset: -6,
  },
  HKG: {
    code: "HKG",
    city: "Hong Kong",
    country: "Hong Kong",
    airportName: "Hong Kong International",
    coordinates: [113.9185, 22.308],
    flag: "🇭🇰",
    utcOffset: 8,
  },
} satisfies Record<string, Airport>;

export type AirportCode = keyof typeof CURATED_AIRPORTS;

const WORLD_BY_CODE = new Map(WORLD_AIRPORTS.map((a) => [a.code, a]));

/** Kürasyonlu kayıtlar + dünya verisinin ISO ülke kodu, şehir merkezi ve kademesi */
export const AIRPORTS = Object.fromEntries(
  Object.entries(CURATED_AIRPORTS).map(([code, a]) => [code, { ...WORLD_BY_CODE.get(code), ...a } as Airport]),
) as Record<AirportCode, Airport>;

/** "Nereden kalkıyorsun?" listesindeki popüler kalkış noktaları, bölgelere göre */
export const ORIGIN_GROUPS = [
  { label: "Türkiye", codes: ["IST", "SAW", "ESB", "ADB", "AYT"] },
  { label: "Avrupa", codes: ["LHR", "CDG", "FRA", "AMS", "MUC", "FCO", "BCN", "BER", "VIE", "ZRH"] },
  { label: "Amerika", codes: ["JFK", "LAX", "ORD", "YYZ", "MEX", "GIG"] },
  { label: "Asya & Orta Doğu", codes: ["DXB", "DOH", "HND", "ICN", "SIN", "BKK", "HKG", "DEL"] },
] as const satisfies readonly { label: string; codes: readonly AirportCode[] }[];

export type OriginRegion = (typeof ORIGIN_GROUPS)[number]["label"];
export const ORIGIN_CODES = ORIGIN_GROUPS.flatMap((g) => g.codes);

/** Kürasyonlu veri seti (statik mekan/uçuş/otel) olan "popüler" hedefler — Landing'de öne çıkar */
export const FEATURED_CODES = ["HND", "FCO", "CDG", "JFK", "ICN"] as const satisfies readonly AirportCode[];

/** Tüm hedef ülkeler (kürasyonlu + küresel havuz). Ülke başına tek varış havalimanı. */
export const DESTINATION_CODES = [
  ...FEATURED_CODES,
  // Avrupa
  "BCN", "LHR", "BER", "AMS", "ATH", "LIS", "PRG", "VIE", "BUD", "ZRH", "DBV", "TBS",
  // Asya & Okyanusya
  "BKK", "DPS", "SIN", "HAN", "PEK", "DEL", "SYD",
  // Orta Doğu
  "DXB", "DOH", "AMM",
  // Afrika
  "CAI", "RAK", "CPT", "NBO",
  // Amerika
  "GIG", "MEX", "YYZ", "EZE", "LIM",
] as const satisfies readonly AirportCode[];

export type FeaturedCode = (typeof FEATURED_CODES)[number];
export type DestinationCode = (typeof DESTINATION_CODES)[number];

export const ORIGINS: Airport[] = ORIGIN_CODES.map((c) => AIRPORTS[c]);
/** Kalkış aramasında listelenen tüm havalimanları (popüler kalkışlar + tüm hedefler, tekrarsız) */
export const SEARCHABLE_ORIGINS: Airport[] = [
  ...ORIGINS,
  ...DESTINATION_CODES.filter((c) => !(ORIGIN_CODES as readonly string[]).includes(c)).map((c) => AIRPORTS[c]),
];
export const isTurkishAirport = (a: Airport) => a.country === "Türkiye";
export const FEATURED_DESTINATIONS: Airport[] = FEATURED_CODES.map((c) => AIRPORTS[c]);
export const DESTINATIONS: Airport[] = DESTINATION_CODES.map((c) => AIRPORTS[c]);

const POPULAR_CODES = new Set(SEARCHABLE_ORIGINS.map((a) => a.code));

/**
 * Dünyadaki tüm havalimanları (~390): önce popüler kalkış/varış noktaları, sonra kademe (hub → bölgesel)
 * ve şehir adına göre. Arama listeleri (`CitySelectDropdown`) ve en yakın havalimanı hesabı bunu kullanır.
 */
export const ALL_AIRPORTS: Airport[] = [
  ...SEARCHABLE_ORIGINS,
  ...WORLD_AIRPORTS.filter((a) => !POPULAR_CODES.has(a.code))
    .map((a) => (a.code in AIRPORTS ? AIRPORTS[a.code as AirportCode] : a))
    .sort((a, b) => (a.tier ?? 2) - (b.tier ?? 2) || a.city.localeCompare(b.city, "tr")),
];

const INDEX = new Map(ALL_AIRPORTS.map((a) => [a.code, a]));

/** IATA kodundan havalimanı (büyük/küçük harf duyarsız); bilinmiyorsa undefined */
export const findAirport = (code: string): Airport | undefined => INDEX.get(code.toUpperCase());
