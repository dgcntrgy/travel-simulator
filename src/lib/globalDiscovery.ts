import { destination as offsetPoint, distance, point } from "@turf/turf";
import { AIRPORTS, type AirportCode } from "@/data/airports";
import { HOTEL_IMAGES } from "@/data/mockHotels";
import { getPlacesForDestination } from "@/data/mockPlaces";
import type { Airport, Hotel, HotelTier, LngLat, Place, PlaceCategory } from "@/types/trip";

/**
 * Küresel keşif motoru — kürasyonlu veri seti olmayan ülkeler için her şeyi ücretsiz kaynaklardan üretir:
 * 1. Ülke havuzu: kıta, şehirler (koordinat), maliyet endeksi ve yerel dil kartları.
 * 2. Dinamik uçuş şablonları: `turf.distance` ile mesafe → süre/fiyat + en az sapan bölgesel aktarma merkezi.
 * 3. Dinamik oteller: seçili mekanların `turf.centerOfMass` merkezi etrafında 3 kademe otel.
 * 4. Canlı mekan keşfi: Wikimedia GeoSearch (Action API, CORS `origin=*`) + Türkçe/İngilizce özetler.
 */

// ------------------------------------------------------------------ Ülke havuzu

export type Continent = "Avrupa" | "Asya" | "Orta Doğu" | "Afrika" | "Amerika" | "Okyanusya";

export const CONTINENTS: Continent[] = ["Avrupa", "Asya", "Orta Doğu", "Afrika", "Amerika", "Okyanusya"];

export type LanguageCode =
  | "ja" | "it" | "fr" | "en" | "ko" | "es" | "de" | "nl" | "ar" | "pt" | "th"
  | "el" | "cs" | "hu" | "hr" | "id" | "vi" | "zh" | "hi" | "sw" | "ka";

export interface CityInfo {
  /** `Place.cityRegion` ile aynı değer (örn "Tokyo") */
  name: string;
  coordinates: LngLat;
}

export interface DestinationProfile {
  continent: Continent;
  /** İlki varış havalimanının şehri */
  cities: CityInfo[];
  /** Fiyat seviyesi (1 = Batı Avrupa ortalaması): otel, giriş ve yemek fiyatlarını ölçekler */
  costIndex: number;
  language: LanguageCode;
}

const city = (name: string, lng: number, lat: number): CityInfo => ({ name, coordinates: [lng, lat] });

export const DESTINATION_PROFILES: Record<string, DestinationProfile> = {
  // Kürasyonlu hedefler (şehir adları mockPlaces `cityRegion` ile birebir)
  HND: { continent: "Asya", cities: [city("Tokyo", 139.767, 35.681), city("Kyoto", 135.768, 35.011)], costIndex: 1.1, language: "ja" },
  FCO: { continent: "Avrupa", cities: [city("Roma", 12.4964, 41.9028), city("Floransa", 11.2558, 43.7696)], costIndex: 1.05, language: "it" },
  CDG: { continent: "Avrupa", cities: [city("Paris", 2.3522, 48.8566), city("Nice", 7.262, 43.7102)], costIndex: 1.2, language: "fr" },
  JFK: { continent: "Amerika", cities: [city("New York", -73.9857, 40.7484), city("Washington D.C.", -77.0369, 38.9072)], costIndex: 1.45, language: "en" },
  ICN: { continent: "Asya", cities: [city("Seul", 126.978, 37.5665), city("Busan", 129.0756, 35.1796)], costIndex: 0.9, language: "ko" },

  // Avrupa
  BCN: { continent: "Avrupa", cities: [city("Barselona", 2.1734, 41.3851), city("Madrid", -3.7038, 40.4168)], costIndex: 0.95, language: "es" },
  LHR: { continent: "Avrupa", cities: [city("Londra", -0.1276, 51.5072), city("Edinburgh", -3.1883, 55.9533)], costIndex: 1.4, language: "en" },
  BER: { continent: "Avrupa", cities: [city("Berlin", 13.405, 52.52), city("Münih", 11.582, 48.1351)], costIndex: 1.05, language: "de" },
  AMS: { continent: "Avrupa", cities: [city("Amsterdam", 4.9041, 52.3676), city("Rotterdam", 4.4777, 51.9244)], costIndex: 1.25, language: "nl" },
  ATH: { continent: "Avrupa", cities: [city("Atina", 23.7275, 37.9838), city("Santorini", 25.4315, 36.4165)], costIndex: 0.85, language: "el" },
  LIS: { continent: "Avrupa", cities: [city("Lizbon", -9.1393, 38.7223), city("Porto", -8.6291, 41.1579)], costIndex: 0.85, language: "pt" },
  PRG: { continent: "Avrupa", cities: [city("Prag", 14.4205, 50.0875), city("Český Krumlov", 14.3175, 48.8127)], costIndex: 0.75, language: "cs" },
  VIE: { continent: "Avrupa", cities: [city("Viyana", 16.3738, 48.2082), city("Salzburg", 13.055, 47.8095)], costIndex: 1.1, language: "de" },
  BUD: { continent: "Avrupa", cities: [city("Budapeşte", 19.0402, 47.4979)], costIndex: 0.7, language: "hu" },
  ZRH: { continent: "Avrupa", cities: [city("Zürih", 8.5417, 47.3769), city("Luzern", 8.3093, 47.0502)], costIndex: 1.7, language: "de" },
  DBV: { continent: "Avrupa", cities: [city("Dubrovnik", 18.0944, 42.6507), city("Split", 16.4402, 43.5081)], costIndex: 0.9, language: "hr" },
  TBS: { continent: "Avrupa", cities: [city("Tiflis", 44.8015, 41.6938), city("Batum", 41.6367, 41.6168)], costIndex: 0.5, language: "ka" },

  // Asya & Okyanusya
  BKK: { continent: "Asya", cities: [city("Bangkok", 100.4935, 13.7525), city("Phuket", 98.3923, 7.8804)], costIndex: 0.55, language: "th" },
  DPS: { continent: "Asya", cities: [city("Ubud", 115.2625, -8.5069), city("Seminyak", 115.1611, -8.6913)], costIndex: 0.55, language: "id" },
  SIN: { continent: "Asya", cities: [city("Singapur", 103.8519, 1.2903)], costIndex: 1.3, language: "en" },
  HAN: { continent: "Asya", cities: [city("Hanoi", 105.8522, 21.0285), city("Ho Chi Minh", 106.7009, 10.7769)], costIndex: 0.45, language: "vi" },
  PEK: { continent: "Asya", cities: [city("Pekin", 116.3972, 39.9163), city("Şanghay", 121.4737, 31.2304)], costIndex: 0.8, language: "zh" },
  DEL: {
    continent: "Asya",
    cities: [city("Yeni Delhi", 77.209, 28.6139), city("Agra", 78.0421, 27.1751), city("Jaipur", 75.8267, 26.9239)],
    costIndex: 0.45,
    language: "hi",
  },
  SYD: { continent: "Okyanusya", cities: [city("Sidney", 151.2093, -33.8688), city("Melbourne", 144.9631, -37.8136)], costIndex: 1.3, language: "en" },

  // Orta Doğu
  DXB: { continent: "Orta Doğu", cities: [city("Dubai", 55.2744, 25.1972), city("Abu Dabi", 54.3773, 24.4539)], costIndex: 1.3, language: "ar" },
  DOH: { continent: "Orta Doğu", cities: [city("Doha", 51.531, 25.2854)], costIndex: 1.2, language: "ar" },
  AMM: { continent: "Orta Doğu", cities: [city("Amman", 35.9106, 31.9539), city("Petra", 35.4444, 30.3285)], costIndex: 0.8, language: "ar" },

  // Afrika
  CAI: { continent: "Afrika", cities: [city("Kahire", 31.2357, 30.0444), city("Luksor", 32.6396, 25.6872)], costIndex: 0.45, language: "ar" },
  RAK: { continent: "Afrika", cities: [city("Marakeş", -7.9891, 31.6258), city("Fes", -4.9737, 34.0626)], costIndex: 0.5, language: "ar" },
  CPT: { continent: "Afrika", cities: [city("Cape Town", 18.4241, -33.9249)], costIndex: 0.65, language: "en" },
  NBO: { continent: "Afrika", cities: [city("Nairobi", 36.8219, -1.2921)], costIndex: 0.7, language: "sw" },

  // Amerika
  GIG: { continent: "Amerika", cities: [city("Rio de Janeiro", -43.1729, -22.9068), city("São Paulo", -46.6333, -23.5505)], costIndex: 0.7, language: "pt" },
  MEX: { continent: "Amerika", cities: [city("Meksiko", -99.1332, 19.4326), city("Cancún", -86.8515, 21.1619)], costIndex: 0.65, language: "es" },
  YYZ: { continent: "Amerika", cities: [city("Toronto", -79.3832, 43.6532), city("Montreal", -73.5673, 45.5017)], costIndex: 1.15, language: "en" },
  EZE: { continent: "Amerika", cities: [city("Buenos Aires", -58.3816, -34.6037)], costIndex: 0.6, language: "es" },
  LIM: { continent: "Amerika", cities: [city("Lima", -77.0428, -12.0464), city("Cusco", -71.9675, -13.5319)], costIndex: 0.6, language: "es" },
};

const FALLBACK_PROFILE: DestinationProfile = { continent: "Avrupa", cities: [], costIndex: 1, language: "en" };

/** Profil bulunamazsa varış şehrinden tek şehirli profil üretir */
export function getDestinationProfile(destination: Airport): DestinationProfile {
  const profile = DESTINATION_PROFILES[destination.code];
  if (profile) return profile;
  return { ...FALLBACK_PROFILE, cities: [{ name: destination.city, coordinates: destination.coordinates }] };
}

/** Kürasyonlu (elle hazırlanmış) veri seti var mı? */
export function isCuratedDestination(code: string): boolean {
  return getPlacesForDestination(code).length > 0;
}

/** Türkçe karakter ve büyük/küçük harf duyarsız arama anahtarı */
export function searchKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchesDestination(destination: Airport, query: string): boolean {
  const q = searchKey(query.trim());
  if (!q) return true;
  const profile = getDestinationProfile(destination);
  const haystack = [destination.country, destination.city, destination.code, ...profile.cities.map((c) => c.name)];
  return haystack.some((h) => searchKey(h).includes(q));
}

// ------------------------------------------------------------------ Yerel dil kartları

export interface LanguagePack {
  /** Türkçe dil adı */
  name: string;
  hello: string;
  thanks: string;
  /** "Lütfen beni bu adrese götürün" — şoför kartı */
  takeMe: string;
  /** "Hesap, lütfen" — garson kartı */
  bill: string;
  /** "Bu ne kadar?" */
  howMuch: string;
  /** Sağdan sola yazım */
  rtl?: boolean;
}

export const LANGUAGES: Record<LanguageCode, LanguagePack> = {
  ja: { name: "Japonca", hello: "こんにちは", thanks: "ありがとうございます", takeMe: "この住所までお願いします", bill: "お会計をお願いします", howMuch: "いくらですか？" },
  it: { name: "İtalyanca", hello: "Buongiorno", thanks: "Grazie", takeMe: "Mi porti a questo indirizzo, per favore", bill: "Il conto, per favore", howMuch: "Quanto costa?" },
  fr: { name: "Fransızca", hello: "Bonjour", thanks: "Merci", takeMe: "Emmenez-moi à cette adresse, s'il vous plaît", bill: "L'addition, s'il vous plaît", howMuch: "C'est combien ?" },
  en: { name: "İngilizce", hello: "Hello", thanks: "Thank you", takeMe: "Please take me to this address", bill: "Could we have the bill, please?", howMuch: "How much is it?" },
  ko: { name: "Korece", hello: "안녕하세요", thanks: "감사합니다", takeMe: "이 주소로 가 주세요", bill: "계산서 주세요", howMuch: "얼마예요?" },
  es: { name: "İspanyolca", hello: "Hola", thanks: "Gracias", takeMe: "Lléveme a esta dirección, por favor", bill: "La cuenta, por favor", howMuch: "¿Cuánto cuesta?" },
  de: { name: "Almanca", hello: "Hallo", thanks: "Danke schön", takeMe: "Bitte bringen Sie mich zu dieser Adresse", bill: "Die Rechnung, bitte", howMuch: "Wie viel kostet das?" },
  nl: { name: "Felemenkçe", hello: "Hallo", thanks: "Dank u wel", takeMe: "Breng me alstublieft naar dit adres", bill: "De rekening, alstublieft", howMuch: "Hoeveel kost het?" },
  ar: { name: "Arapça", hello: "مرحبا", thanks: "شكرا", takeMe: "من فضلك خذني إلى هذا العنوان", bill: "الحساب من فضلك", howMuch: "بكم هذا؟", rtl: true },
  pt: { name: "Portekizce", hello: "Olá", thanks: "Obrigado", takeMe: "Por favor, leve-me a este endereço", bill: "A conta, por favor", howMuch: "Quanto custa?" },
  th: { name: "Tayca", hello: "สวัสดีครับ/ค่ะ", thanks: "ขอบคุณครับ/ค่ะ", takeMe: "ช่วยไปส่งที่อยู่นี้หน่อยครับ/ค่ะ", bill: "เช็คบิลด้วยครับ/ค่ะ", howMuch: "เท่าไหร่ครับ/คะ?" },
  el: { name: "Yunanca", hello: "Γεια σας", thanks: "Ευχαριστώ", takeMe: "Πηγαίνετέ με σε αυτή τη διεύθυνση, παρακαλώ", bill: "Τον λογαριασμό, παρακαλώ", howMuch: "Πόσο κάνει;" },
  cs: { name: "Çekçe", hello: "Dobrý den", thanks: "Děkuji", takeMe: "Zavezte mě prosím na tuto adresu", bill: "Zaplatím, prosím", howMuch: "Kolik to stojí?" },
  hu: { name: "Macarca", hello: "Jó napot", thanks: "Köszönöm", takeMe: "Kérem, vigyen el erre a címre", bill: "A számlát, legyen szíves", howMuch: "Mennyibe kerül?" },
  hr: { name: "Hırvatça", hello: "Dobar dan", thanks: "Hvala", takeMe: "Molim vas, odvezite me na ovu adresu", bill: "Račun, molim", howMuch: "Koliko košta?" },
  id: { name: "Endonezce", hello: "Halo", thanks: "Terima kasih", takeMe: "Tolong antar saya ke alamat ini", bill: "Minta bon, ya", howMuch: "Berapa harganya?" },
  vi: { name: "Vietnamca", hello: "Xin chào", thanks: "Cảm ơn", takeMe: "Làm ơn đưa tôi đến địa chỉ này", bill: "Tính tiền giúp tôi", howMuch: "Bao nhiêu tiền?" },
  zh: { name: "Çince (Mandarin)", hello: "你好", thanks: "谢谢", takeMe: "请带我去这个地址", bill: "买单，谢谢", howMuch: "多少钱？" },
  hi: { name: "Hintçe", hello: "नमस्ते", thanks: "धन्यवाद", takeMe: "कृपया मुझे इस पते पर ले चलिए", bill: "बिल दीजिए", howMuch: "यह कितने का है?" },
  sw: { name: "Svahili", hello: "Habari", thanks: "Asante", takeMe: "Tafadhali nipeleke kwenye anwani hii", bill: "Naomba bili", howMuch: "Bei gani?" },
  ka: { name: "Gürcüce", hello: "გამარჯობა", thanks: "მადლობა", takeMe: "გთხოვთ, წამიყვანეთ ამ მისამართზე", bill: "ანგარიში, გთხოვთ", howMuch: "რა ღირს?" },
};

// ------------------------------------------------------------------ Deterministik yardımcılar

/** Basit string hash (her render'da aynı sonuç) */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const km = (a: LngLat, b: LngLat) => distance(point(a), point(b), { units: "kilometers" });

// ------------------------------------------------------------------ Dinamik uçuş şablonları

export interface FlightTemplate {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  /** Tanımlıysa aktarmalı uçuş */
  hub?: AirportCode;
  layoverMinutes?: number;
  /** Kişi başı gidiş-dönüş baz fiyat (USD). Kürasyonlu şablonlarda İstanbul (IST) çıkışlı, jeneratörde gerçek kalkışa göre. */
  basePrice: number;
  /** Yerel kalkış saati, "HH:MM" */
  departure: string;
  cabinBaggageKg: number;
  checkedBaggageKg: number;
  tags: string[];
}

/** Bölgesel aktarma merkezleri ve ana taşıyıcıları */
const HUB_CARRIERS: { hub: AirportCode; airline: string; code: string; checkedKg: number; tag: string }[] = [
  { hub: "DOH", airline: "Qatar Airways", code: "QR", checkedKg: 30, tag: "Ödüllü servis" },
  { hub: "DXB", airline: "Emirates", code: "EK", checkedKg: 35, tag: "Geniş gövde" },
  { hub: "FRA", airline: "Lufthansa", code: "LH", checkedKg: 23, tag: "Star Alliance" },
  { hub: "MUC", airline: "Lufthansa", code: "LH", checkedKg: 23, tag: "Star Alliance" },
  { hub: "VIE", airline: "Austrian Airlines", code: "OS", checkedKg: 23, tag: "Kısa aktarma" },
  { hub: "AMS", airline: "KLM", code: "KL", checkedKg: 23, tag: "SkyTeam" },
  { hub: "LHR", airline: "British Airways", code: "BA", checkedKg: 23, tag: "oneworld" },
  { hub: "CDG", airline: "Air France", code: "AF", checkedKg: 23, tag: "SkyTeam" },
  { hub: "IST", airline: "Türk Hava Yolları", code: "TK", checkedKg: 30, tag: "İstanbul aktarmalı" },
];

const DEPARTURES = ["01:35", "06:20", "08:45", "10:15", "13:40", "16:55", "19:30", "22:10"];

/** Ülke başına bayrak taşıyıcı (direkt uçuş) ve isteğe bağlı düşük maliyetli havayolu */
const COUNTRY_CARRIERS: Record<string, { airline: string; code: string; lowCost?: { airline: string; code: string } }> = {
  "Türkiye": { airline: "Türk Hava Yolları", code: "TK", lowCost: { airline: "Pegasus", code: "PC" } },
  "Birleşik Krallık": { airline: "British Airways", code: "BA", lowCost: { airline: "easyJet", code: "U2" } },
  "Fransa": { airline: "Air France", code: "AF", lowCost: { airline: "Transavia", code: "TO" } },
  "Almanya": { airline: "Lufthansa", code: "LH", lowCost: { airline: "Eurowings", code: "EW" } },
  "Hollanda": { airline: "KLM", code: "KL", lowCost: { airline: "Transavia", code: "HV" } },
  "İtalya": { airline: "ITA Airways", code: "AZ", lowCost: { airline: "Ryanair", code: "FR" } },
  "İspanya": { airline: "Iberia", code: "IB", lowCost: { airline: "Vueling", code: "VY" } },
  "Avusturya": { airline: "Austrian Airlines", code: "OS", lowCost: { airline: "Wizz Air", code: "W6" } },
  "İsviçre": { airline: "Swiss", code: "LX", lowCost: { airline: "easyJet", code: "U2" } },
  "Yunanistan": { airline: "Aegean Airlines", code: "A3" },
  "Portekiz": { airline: "TAP Air Portugal", code: "TP" },
  "Çekya": { airline: "Smartwings", code: "QS" },
  "Macaristan": { airline: "Wizz Air", code: "W6" },
  "Hırvatistan": { airline: "Croatia Airlines", code: "OU" },
  "Gürcistan": { airline: "Georgian Airways", code: "A9" },
  "ABD": { airline: "United Airlines", code: "UA", lowCost: { airline: "JetBlue", code: "B6" } },
  "Kanada": { airline: "Air Canada", code: "AC", lowCost: { airline: "WestJet", code: "WS" } },
  "Meksika": { airline: "Aeroméxico", code: "AM", lowCost: { airline: "Volaris", code: "Y4" } },
  "Brezilya": { airline: "LATAM Brasil", code: "LA", lowCost: { airline: "GOL", code: "G3" } },
  "Arjantin": { airline: "Aerolíneas Argentinas", code: "AR" },
  "Peru": { airline: "LATAM Perú", code: "LA" },
  "BAE": { airline: "Emirates", code: "EK", lowCost: { airline: "flydubai", code: "FZ" } },
  "Katar": { airline: "Qatar Airways", code: "QR" },
  "Ürdün": { airline: "Royal Jordanian", code: "RJ" },
  "Mısır": { airline: "EgyptAir", code: "MS" },
  "Fas": { airline: "Royal Air Maroc", code: "AT" },
  "Güney Afrika": { airline: "Airlink", code: "4Z" },
  "Kenya": { airline: "Kenya Airways", code: "KQ" },
  "Japonya": { airline: "Japan Airlines", code: "JL", lowCost: { airline: "Peach", code: "MM" } },
  "Güney Kore": { airline: "Korean Air", code: "KE", lowCost: { airline: "Jeju Air", code: "7C" } },
  "Singapur": { airline: "Singapore Airlines", code: "SQ", lowCost: { airline: "Scoot", code: "TR" } },
  "Tayland": { airline: "Thai Airways", code: "TG", lowCost: { airline: "AirAsia", code: "FD" } },
  "Hong Kong": { airline: "Cathay Pacific", code: "CX", lowCost: { airline: "HK Express", code: "UO" } },
  "Hindistan": { airline: "Air India", code: "AI", lowCost: { airline: "IndiGo", code: "6E" } },
  "Çin": { airline: "Air China", code: "CA" },
  "Vietnam": { airline: "Vietnam Airlines", code: "VN", lowCost: { airline: "VietJet Air", code: "VJ" } },
  "Endonezya": { airline: "Garuda Indonesia", code: "GA" },
  "Avustralya": { airline: "Qantas", code: "QF", lowCost: { airline: "Jetstar", code: "JQ" } },
};

/** Bu mesafenin (km) altında bayrak taşıyıcının direkt uçuşu var kabul edilir */
const DIRECT_MAX_KM = 12_500;
/** Düşük maliyetli direkt seçenek bu mesafeye kadar */
const LOW_COST_MAX_KM = 3_800;
/** Aktarma rotası, direkt mesafenin en fazla bu katı olabilir */
const MAX_DETOUR = 1.55;

/** Gidiş-dönüş ekonomi fiyatı (kürasyonlu şablonlara kalibre: IST-HND ≈ $1.170, IST-FCO ≈ $275) */
function roundTripPrice(routeKm: number): number {
  return 110 + routeKm * 0.118;
}

/**
 * Kürasyonlu şablonu olmayan rotalar (veya Türkiye dışı kalkışlar) için gerçekçi uçuş seçenekleri üretir:
 * - Mesafe uygunsa kalkış ülkesinin bayrak taşıyıcısıyla direkt (yoksa varış ülkesininki);
 *   kısa mesafede ek olarak düşük maliyetli havayolu (Pegasus, easyJet, AirAsia…).
 * - Sapma oranı en düşük 2 farklı havayolunun aktarma merkezi (Doha, Dubai, Frankfurt, İstanbul…).
 * Fiyatlar gerçek kalkış noktasına göre hesaplanır (`basePrice` ölçeklenmeden kullanılır);
 * süreler `mockFlights.getFlights` içindeki ortak motordan gelir.
 */
export function generateFlightTemplates(origin: Airport, destination: Airport): FlightTemplate[] {
  const directKm = km(origin.coordinates, destination.coordinates);
  const seed = (s: string) => hash(`${origin.code}-${destination.code}:${s}`);
  const templates: FlightTemplate[] = [];

  const home = COUNTRY_CARRIERS[origin.country];
  const directCarrier = home ?? COUNTRY_CARRIERS[destination.country];
  if (directCarrier && directKm <= DIRECT_MAX_KM) {
    templates.push({
      airline: directCarrier.airline,
      airlineCode: directCarrier.code,
      flightNumber: `${directCarrier.code}${(seed("direct") % 1800) + 10}`,
      basePrice: Math.round(roundTripPrice(directKm)),
      departure: DEPARTURES[seed("direct-dep") % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: directKm > 5000 ? 46 : 23,
      tags: ["En hızlı", "Kesintisiz"],
    });
  }
  const lowCost = home?.lowCost;
  if (lowCost && directKm <= LOW_COST_MAX_KM) {
    templates.push({
      airline: lowCost.airline,
      airlineCode: lowCost.code,
      flightNumber: `${lowCost.code}${(seed("lc") % 900) + 100}`,
      basePrice: Math.round(roundTripPrice(directKm) * 0.62),
      departure: DEPARTURES[(seed("lc-dep") + 3) % DEPARTURES.length],
      cabinBaggageKg: 8,
      checkedBaggageKg: 0,
      tags: ["Düşük maliyetli", "Bagaj ekstra"],
    });
  }

  const ranked = HUB_CARRIERS.map((carrier) => {
    const hub = AIRPORTS[carrier.hub];
    const toHub = km(origin.coordinates, hub.coordinates);
    const fromHub = km(hub.coordinates, destination.coordinates);
    const detour = (toHub + fromHub) / Math.max(1, directKm);
    return { carrier, toHub, fromHub, detour };
  })
    .filter((h) => h.toHub > 300 && h.fromHub > 450)
    .sort((a, b) => a.detour - b.detour);
  // Hiç seçenek kalmazsa (çok uzun / alışılmadık rota) en az sapan merkez yine de sunulur
  const viable = ranked.filter((h) => h.detour <= MAX_DETOUR);
  const hubs = viable.length || templates.length ? viable : ranked.slice(0, 1);

  const usedAirlines = new Set<string>(directCarrier ? [directCarrier.code] : []);
  let layovers = 0;
  for (const { carrier, toHub, fromHub, detour } of hubs) {
    if (usedAirlines.has(carrier.code) || layovers >= 2) continue;
    usedAirlines.add(carrier.code);
    layovers++;
    const n = seed(carrier.code);
    templates.push({
      airline: carrier.airline,
      airlineCode: carrier.code,
      flightNumber: `${carrier.code}${(n % 800) + 100} · ${carrier.code}${((n >> 3) % 800) + 100}`,
      hub: carrier.hub,
      layoverMinutes: 70 + (n % 12) * 15,
      basePrice: Math.round(roundTripPrice(Math.max(toHub + fromHub, directKm)) * 0.8),
      departure: DEPARTURES[(n >> 5) % DEPARTURES.length],
      cabinBaggageKg: carrier.code === "BA" ? 23 : 7,
      checkedBaggageKg: carrier.checkedKg,
      tags: [detour < 1.08 ? "Az sapma" : carrier.tag],
    });
  }

  return templates;
}

// ------------------------------------------------------------------ Dinamik otel üretici

const HOTEL_BASE_PRICE: Record<HotelTier, number> = { budget: 42, central: 115, luxury: 330 };
/** Ağırlık merkezinden uzaklık (km): F/P merkezde, lüks yakın, bütçe biraz dışarıda */
const HOTEL_OFFSET_KM: Record<HotelTier, number> = { central: 0.25, luxury: 0.9, budget: 1.8 };
const HOTEL_NAMES: Record<HotelTier, string[]> = {
  budget: ["{city} Backpackers Loft", "Nomad Hostel {city}", "{city} Budget Inn & Pods"],
  central: ["Hotel {city} Central", "{city} Urban Suites", "The {city} Boutique"],
  luxury: ["The Grand {city}", "{city} Palace & Spa", "Royal {city} Residence"],
};
const HOTEL_HIGHLIGHTS: Record<HotelTier, string[]> = {
  budget: ["Ortak mutfak & salon", "Toplu taşımaya yakın"],
  central: ["Kahvaltı dahil", "Rotanın tam merkezinde"],
  luxury: ["Spa & havuz", "Şehir manzaralı teras"],
};

/**
 * Kürasyonlu oteli olmayan şehirler için 3 kademe (Bütçe · F/P Merkez · Lüks) otel üretir.
 * Konumlar, seçili mekanların `turf.centerOfMass` merkezinden `turf.destination` ile kaydırılır;
 * fiyatlar ülkenin maliyet endeksine göre ölçeklenir. `nights` plan tarafından atanır.
 */
export function generateHotels(cityName: string, center: LngLat, places: Place[], costIndex: number): Hotel[] {
  const tiers: HotelTier[] = ["budget", "central", "luxury"];
  return tiers.map((tier, i) => {
    const n = hash(`${cityName}:${tier}`);
    const bearing = (n % 360) + i * 120;
    const coordinates = offsetPoint(point(center), HOTEL_OFFSET_KM[tier], bearing, { units: "kilometers" }).geometry
      .coordinates as LngLat;
    const nearest = [...places].sort((a, b) => km(coordinates, a.coordinates) - km(coordinates, b.coordinates))[0];
    const walkMin = nearest ? Math.max(3, Math.round(((km(coordinates, nearest.coordinates) * 1.3) / 4.8) * 60)) : 0;
    const name = HOTEL_NAMES[tier][n % HOTEL_NAMES[tier].length].replace("{city}", cityName);
    const ratingBase = { budget: 8.0, central: 8.6, luxury: 9.1 }[tier];

    return {
      id: `h-gen-${searchKey(cityName).replace(/[^a-z0-9]+/g, "-")}-${tier}`,
      name,
      area: nearest ? `${nearest.name} çevresi` : `${cityName} merkez`,
      cityRegion: cityName,
      tier,
      coordinates,
      pricePerNight: Math.max(15, Math.round((HOTEL_BASE_PRICE[tier] * costIndex) / 5) * 5),
      nights: 0,
      rating: Math.round((ratingBase + (n % 6) / 10) * 10) / 10,
      reviewCount: 600 + (n % 2000),
      image: HOTEL_IMAGES[tier][n % 2],
      highlights: nearest ? [`${nearest.name} ${walkMin} dk`, HOTEL_HIGHLIGHTS[tier][0]] : HOTEL_HIGHLIGHTS[tier],
    };
  });
}

// ------------------------------------------------------------------ Canlı Wikipedia mekan keşfi

const GEO_RADIUS_M = 10_000; // GeoSearch üst sınırı
/** 1. aşama aday havuzu: GeoSearch mesafeye göre sıralar, uzaktaki ünlü yerleri kaçırmamak için geniş tutulur */
const GEO_LIMIT = 200;
/** 2. aşamaya (görsel + koordinat + özet) giden aday sayısı = TextExtracts `exlimit` üst sınırı */
const DETAIL_LIMIT = 20;
const STORY_MAX_CHARS = 560;
const LIVE_STORAGE_PREFIX = "live-places:v3:";
const REQUEST_TIMEOUT_MS = 12_000;

/** Turistik "yer" olduğunu gösteren anahtar kelimeler (başlık + Wikidata kısa açıklaması) */
const PLACE =
  /\b(museum|temple|church|cathedral|palace|castle|park|square|plaza|market|bazaar|souk|tower|bridge|monument|memorial|gardens?|basilica|mosque|gallery|theat(re|er)|beach|fort|fortress|citadel|ruins|tomb|mausoleum|landmark|shrine|zoo|aquarium|harbou?r|island|lake|hill|mountain|viewpoint|stadium|opera|library|gate|walls?|archaeological|attraction|concert hall|monastery|synagogue|abbey|pagoda|wat|stupa|statue|fountain|cemetery|amphitheat(re|er)|pier|waterfront|promenade|boardwalk|lighthouse|observatory|observation|heritage site|chapel|throne hall|pyramids?|necropolis|colosseum|acropolis|forum|baths|aqueduct|canal|food court|hawker cent(re|er)|building)\b/i;

/** Turistik olmayan sayfaları eler (istasyon, okul, semt, kurum, olay, kişi…) */
const EXCLUDE =
  /\b(station|railway|metro|subway|airport|school|university|college|institute|hospital|clinic|company|corporation|district|neighbou?rhood|ward|borough|municipality|suburb|village|town (in|of)|city (in|of)|capital (city )?of|street|road|avenue|boulevard|highway|motorway|expressway|interchange|junction|hotel|embassy|consulate|bank|office|headquarters|constituency|electoral|club|team|band|politician|businessman|actor|actress|singer|human settlement|census|residential|apartment|condominium|ministry|agency|court|prison|police|power station|factory|warehouse|parking|shopping cent(re|er)|supermarket|department store|television|radio|newspaper|publisher|software|airline|bus|tram|ferry|list of|disambiguation|administrative|province|prefecture|county|region|state of|stock exchange|organi[sz]ation|association|foundation|hostel|skyscraper in|office building|residential building|protests?|demonstration|revolution|battle|siege|war|incident|coup|kingdom|empire|dynasty|archdiocese|diocese|legislature|parliament|government|artifact|artefact|manuscript|painting|election|treaty|attack|bombing|massacre|earthquake|riot|uprising|assassination|parade|festival|event|party|movement)\b/i;

const FOOD = /\b(market|bazaar|souk|food|restaurant|caf[eé]|hawker|brewery|winery|bakery|teahouse|tea house|night market|chinatown)\b/i;
const MUSEUM = /\b(museum|gallery|theat(re|er)|opera|concert hall|library|art cent(re|er))\b/i;
const RELIGIOUS = /\b(temple|shrine|church|cathedral|mosque|basilica|monastery|synagogue|abbey|chapel|pagoda|wat|stupa|minster)\b/i;
const PAID_SIGHT = /\b(palace|castle|fort|fortress|citadel|tower|zoo|aquarium|observation|archaeological|ruins|tomb|pyramid|necropolis|amphitheat(re|er)|colosseum|acropolis|mausoleum)\b/i;
const NATURE = /\b(park|garden|beach|square|plaza|bridge|waterfront|promenade|lake|hill|viewpoint)\b/i;

interface RankPage {
  pageid: number;
  title: string;
  description?: string;
  /** Makale uzunluğu (bayt) — "önem" göstergesi */
  length?: number;
}

interface DetailPage {
  pageid: number;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
  thumbnail?: { source: string };
  langlinks?: { lang: string; title: string }[];
}

interface ExtractPage {
  title: string;
  extract?: string;
  missing?: boolean;
}

interface Candidate {
  page: RankPage;
  coordinates: LngLat;
  image: string;
  enExtract?: string;
  trTitle?: string;
  cityName: string;
}

function apiUrl(lang: "en" | "tr", params: Record<string, string>): string {
  const search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", origin: "*", ...params });
  return `https://${lang}.wikipedia.org/w/api.php?${search}`;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * İki aşamalı şehir taraması (her biri tek istek):
 * 1. GeoSearch: merkezin 10 km çevresindeki 200 sayfa + açıklama + makale uzunluğu → "yer" filtresi, uzunluğa göre sıralama.
 * 2. En önemli 20 aday için fotoğraf, koordinat, Türkçe karşılık başlığı ve İngilizce giriş özeti.
 */
async function geoSearchCity(cityInfo: CityInfo, signal: AbortSignal): Promise<Candidate[]> {
  const [lng, lat] = cityInfo.coordinates;
  const ranking = await getJson<{ query?: { pages?: RankPage[] } }>(
    apiUrl("en", {
      generator: "geosearch",
      ggscoord: `${lat}|${lng}`,
      ggsradius: String(GEO_RADIUS_M),
      ggslimit: String(GEO_LIMIT),
      ggsnamespace: "0",
      prop: "info|description",
    }),
    signal,
  );

  const ranked = (ranking.query?.pages ?? [])
    .filter((p) => {
      const text = `${p.title} ${p.description ?? ""}`;
      // Yıl ile başlayan olay sayfaları ("2011 …") ve katalog kodlu başlıklar ("KV55", "TT1") elenir
      return !/^\d{3,4}\b/.test(p.title) && !/^[A-Z]{1,4}\d+$/.test(p.title) && PLACE.test(text) && !EXCLUDE.test(text);
    })
    .sort((a, b) => (b.length ?? 0) - (a.length ?? 0))
    .slice(0, DETAIL_LIMIT);
  if (ranked.length === 0) return [];

  const details = await getJson<{ query?: { pages?: DetailPage[] } }>(
    apiUrl("en", {
      pageids: ranked.map((p) => p.pageid).join("|"),
      prop: "pageimages|coordinates|langlinks|extracts",
      piprop: "thumbnail",
      pithumbsize: "960",
      pilimit: String(DETAIL_LIMIT),
      colimit: "max",
      lllang: "tr",
      lllimit: "max",
      exintro: "1",
      explaintext: "1",
      exsentences: "4",
      exlimit: String(DETAIL_LIMIT),
    }),
    signal,
  );
  const byId = new Map((details.query?.pages ?? []).map((p) => [p.pageid, p]));

  return ranked.flatMap((page) => {
    const d = byId.get(page.pageid);
    if (!d?.thumbnail || !d.coordinates?.length) return [];
    return [
      {
        page,
        coordinates: [d.coordinates[0].lon, d.coordinates[0].lat] as LngLat,
        image: d.thumbnail.source,
        enExtract: d.extract,
        trTitle: d.langlinks?.find((l) => l.lang === "tr")?.title,
        cityName: cityInfo.name,
      },
    ];
  });
}

/** Türkçe Vikipedi'den giriş özetleri (TextExtracts, başlık başına) */
async function fetchTrExtracts(titles: string[], signal: AbortSignal): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let i = 0; i < titles.length; i += DETAIL_LIMIT) {
    const data = await getJson<{ query?: { pages?: ExtractPage[] } }>(
      apiUrl("tr", {
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        exsentences: "4",
        exlimit: String(DETAIL_LIMIT),
        titles: titles.slice(i, i + DETAIL_LIMIT).join("|"),
      }),
      signal,
    );
    for (const p of data.query?.pages ?? []) {
      if (!p.missing && p.extract) result.set(p.title, p.extract);
    }
  }
  return result;
}

function trimStory(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= STORY_MAX_CHARS) return clean;
  const cut = clean.slice(0, STORY_MAX_CHARS);
  const lastStop = cut.lastIndexOf(". ");
  return lastStop > 200 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

/** "Wat Pho (temple)" → "Wat Pho" */
const displayName = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, "");

function classify(text: string): PlaceCategory {
  if (FOOD.test(text)) return "food";
  if (MUSEUM.test(text) || RELIGIOUS.test(text)) return "culture";
  return "sight";
}

function estimateCostAndDuration(text: string, category: PlaceCategory, costIndex: number) {
  const scaled = (usd: number) => Math.max(1, Math.round(usd * costIndex));
  if (category === "food") return { cost: scaled(18), hours: 1.5 };
  if (MUSEUM.test(text)) return { cost: scaled(15), hours: 2.5 };
  if (RELIGIOUS.test(text)) return { cost: 0, hours: 1 };
  if (PAID_SIGHT.test(text)) return { cost: scaled(12), hours: 2.5 };
  if (NATURE.test(text)) return { cost: 0, hours: 1.5 };
  return { cost: scaled(6), hours: 1.5 };
}

function localTip(text: string, category: PlaceCategory): string {
  if (category === "food")
    return "Yerel halkın kalabalık olduğu tezgâhları seç, küçük banknotlarla nakit taşı ve günün spesiyalini sor — en taze olan odur.";
  if (MUSEUM.test(text))
    return "Biletini online alıp kuyruğu atla; ücretsiz/indirimli gün ve saatleri resmî sitesinden kontrol et, en az 2 saat ayır.";
  if (RELIGIOUS.test(text))
    return "Omuz ve dizleri örten kıyafet giy, ibadet saatlerinde sessiz kal; fotoğraf kurallarını girişteki tabelalardan kontrol et.";
  if (PAID_SIGHT.test(text))
    return "Açılış saatinde gel, kalabalık ve sıcaktan kaçın; sesli rehber ya da yerel rehber hikayeyi canlandırır.";
  return "Fotoğraf için gün doğumu ya da gün batımına yakın saatleri seç; çevresindeki yan sokaklarda yerel kafeleri keşfet.";
}

/** Bu mesafeden (km) yakın canlı sonuç, kürasyonlu ya da önceki canlı mekanın tekrarı sayılır */
const DUPLICATE_KM = 0.15;

/**
 * Hedefin her şehri için Wikimedia GeoSearch ile önemli tarihi/turistik noktaları bulur,
 * Türkçe (yoksa İngilizce) özetleri ve gerçek fotoğraflarıyla `Place` kartlarına dönüştürür.
 */
async function requestLivePlaces(destination: Airport, signal: AbortSignal): Promise<Place[]> {
  const profile = getDestinationProfile(destination);
  const curated = getPlacesForDestination(destination.code);
  const perCityLimit = curated.length ? 4 : profile.cities.length >= 3 ? 7 : 10;
  const curatedTitles = new Set(curated.map((p) => p.wikiTitle.replace(/_/g, " ").toLowerCase()));

  // Şehirler sırayla taranır: Wikimedia anonim API'si eşzamanlı istek patlamasında 429 döndürür
  const perCity: Candidate[][] = [];
  let failures = 0;
  for (const c of profile.cities) {
    try {
      perCity.push(await geoSearchCity(c, signal));
    } catch (err) {
      if (signal.aborted) throw err;
      failures++;
      perCity.push([]);
    }
  }
  if (failures === profile.cities.length) throw new Error("Wikipedia GeoSearch erişilemedi");

  const picked: Candidate[] = [];
  for (const candidates of perCity) {
    let count = 0;
    for (const c of candidates) {
      if (count >= perCityLimit) break;
      if (curatedTitles.has(c.page.title.toLowerCase())) continue;
      // Kürasyonlu kartın ya da başka bir canlı sonucun tekrarı (örn. tapınak + içindeki heykel)
      const nearby = [...curated.map((p) => p.coordinates), ...picked.map((p) => p.coordinates)];
      if (nearby.some((co) => km(co, c.coordinates) < DUPLICATE_KM)) continue;
      picked.push(c);
      count++;
    }
  }

  const trTitles = picked.flatMap((c) => (c.trTitle ? [c.trTitle] : []));
  const trExtracts = await fetchTrExtracts(trTitles, signal).catch(() => new Map<string, string>());

  const { costIndex } = profile;
  return picked.map((c) => {
    const text = `${c.page.title} ${c.page.description ?? ""}`;
    const category = classify(text);
    const { cost, hours } = estimateCostAndDuration(text, category, costIndex);
    const trExtract = c.trTitle ? trExtracts.get(c.trTitle) : undefined;
    const story = trExtract ?? c.enExtract ?? c.page.description ?? "";

    return {
      id: `live-${destination.code}-${c.page.pageid}`,
      name: displayName(c.trTitle ?? c.page.title),
      wikiTitle: c.page.title.replace(/ /g, "_"),
      cityRegion: c.cityName,
      category,
      coordinates: c.coordinates,
      story: trimStory(story),
      mustDo: localTip(text, category),
      estimatedCost: cost,
      recommendedDuration: hours,
      fallbackImage: c.image,
      source: "live",
    } satisfies Place;
  });
}

const liveCache = new Map<string, Promise<Place[]>>();
const liveResolved = new Map<string, Place[]>();

function readLiveStorage(code: string): Place[] | null {
  try {
    const raw = sessionStorage.getItem(LIVE_STORAGE_PREFIX + code);
    return raw ? (JSON.parse(raw) as Place[]) : null;
  } catch {
    return null;
  }
}

function writeLiveStorage(code: string, places: Place[]) {
  try {
    sessionStorage.setItem(LIVE_STORAGE_PREFIX + code, JSON.stringify(places));
  } catch {
    // Gizli sekme / kota dolu: önbelleksiz devam et
  }
}

/** Önbellekte hazır sonuç varsa senkron döner (ilk render'da yükleniyor göstermemek için) */
export function peekLivePlaces(code: string): Place[] | null {
  const resolved = liveResolved.get(code);
  if (resolved) return resolved;
  const stored = readLiveStorage(code);
  if (stored) liveResolved.set(code, stored);
  return stored;
}

/** Canlı mekanları getirir (bellek + sessionStorage önbelleği, eşzamanlı istekler tekilleştirilir) */
export function discoverLivePlaces(destination: Airport): Promise<Place[]> {
  const peeked = peekLivePlaces(destination.code);
  if (peeked) return Promise.resolve(peeked);

  const cached = liveCache.get(destination.code);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const p = requestLivePlaces(destination, controller.signal)
    .then((places) => {
      liveResolved.set(destination.code, places);
      if (places.length) writeLiveStorage(destination.code, places);
      return places;
    })
    .catch((err: unknown) => {
      // Bir sonraki denemede tekrar istek atılabilsin
      liveCache.delete(destination.code);
      throw err;
    })
    .finally(() => clearTimeout(timeout));

  liveCache.set(destination.code, p);
  return p;
}
