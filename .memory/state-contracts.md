# State & Tip Sözleşmeleri

## src/types/trip.ts
```ts
type LngLat = [number, number]; // [lng, lat]
type StepId = 0 | 1 | 2 | 3 | 4;   // 0 = Landing
type Theme = "light" | "dark";
type FlightType = "direct" | "layover";
type PlaceCategory = "sight" | "food" | "culture";

interface TripRoute { origin: Airport; destination: Airport } // Simulator → Adım 2–4 prop'u
interface Airport { code: string; city: string; country: string; airportName: string; coordinates: LngLat; flag: string; utcOffset: number }
interface Layover { airport: Airport; durationMinutes: number }
interface Flight {
  id: string; airline: string; airlineCode: string; flightNumber: string; type: FlightType;
  origin: Airport | null; destination: Airport | null;   // başlangıç null (kullanıcı seçer); reset() → null layover?: Layover; // sadece type==="layover"
  price: number;                // kişi başı gidiş-dönüş USD
  totalDurationMinutes: number; departureTime: string; arrivalTime: string; arrivalDayOffset: number;
  cabinBaggageKg: number; checkedBaggageKg: number; tags: string[];
}
interface Place {
  id: string; name: string; wikiTitle: string;
  cityRegion: string;           // Adım 3 kümeleme anahtarı (örn "Tokyo" / "Kyoto")
  category: PlaceCategory; coordinates: LngLat;
  story: string; mustDo: string;
  estimatedCost: number;        // kişi başı USD, 0 = ücretsiz
  recommendedDuration: number;  // saat
  fallbackImage: string;        // Unsplash URL (canlı keşifte Wikimedia küçük resmi)
  source?: "curated" | "live";  // yoksa curated; "live" = Wikimedia GeoSearch
}
type HotelTier = "budget" | "central" | "luxury";
interface Hotel { id; name; area; cityRegion: string; tier: HotelTier; coordinates: LngLat;
  pricePerNight: number /* oda başı */; nights: number /* plan atar, mock'ta 0 */; rating: number /* /10 */;
  reviewCount: number; image: string; highlights: string[] }
type TransitMode = "walk" | "metro" | "bus" | "tram" | "train";
interface TransitLeg { placeId; mode: TransitMode; line: string /* route varsa route.line */; distanceKm; minutes /* route varsa yürü+bekle+sürüş+yürü */; cost /* kişi başı tek yön */; route?: TransitRoute /* walk'ta yok */ }
interface TransitStation { name; coordinates: LngLat }
interface TransitRoute { line; colorName; color; direction /* son durak */; from: TransitStation; to: TransitStation; stops; headwayMinutes; firstDeparture /* "05:30" | "24 saat" */;
  walkToMinutes; waitMinutes /* ceil(headway/2) */; rideMinutes; walkFromMinutes; stationWord: "İstasyonu"|"Durağı"; path: LngLat[] /* biniş→iniş istasyonları */; steps: string[] /* 4 adım */ }
interface IntercityTransfer { from; to; mode: "train"|"bus"|"flight"; name; minutes; cost /* kişi başı */; isReturn?: boolean }
interface BudgetBreakdown { flight: number; hotel: number; transit: number; foodAndEntries: number; total: number }
interface PublicUser { id; name; email; phone /* "" = yok */; lastRoute /* "" = yok */; isPro: boolean; createdAt /* ISO */ }  // şifre hash'i ASLA istemciye gitmez
interface AdminUserRow extends PublicUser { hashInfo /* "scrypt · N=16384 · salt 16B · 64B ✓ · #parmakizi" */ }
```

## src/store/useTripStore.ts
```ts
export const STEPS: { id: Exclude<StepId, 0>; title: string; short: string }[]; // 1–4: Uçuş, Keşif, Konaklama, Rehber

interface TripState {
  currentStep: StepId;            // başlangıç 0 (Landing)
  isPro: boolean;                 // reset() bunu sıfırlamaz
  isUpgradeModalOpen: boolean;    // ProUpgradeModal görünürlüğü; reset() sıfırlamaz
  user: PublicUser | null;        // oturum (useAuthSync GET /api/auth ile geri yükler); reset() sıfırlamaz
  isAuthModalOpen: boolean; authView: "login" | "register";
  isAdminOpen: boolean;           // AdminPanel
  theme: Theme;                   // varsayılan "light"; reset() sıfırlamaz
  origin: Airport | null; destination: Airport | null;   // başlangıç null (kullanıcı seçer); reset() → null
  departureDate: string;          // "YYYY-MM-DD", varsayılan bugün+30
  travelers: number;              // 1–9
  selectedFlight: Flight | null;
  selectedPlaces: Place[];        // ekleme sırası korunur (önizleme hattı bu sırayla)
  hoveredPlaceId: string | null;
  hoverSource: "card" | "map";    // "map" ise kart listesi o karta kayar
  recommendedHotels: Hotel[];     // Adım 3: şehir başına SEÇİLİ otel (nights dolu), plan sırasıyla
  focusedHotelId: string | null;  // Adım 3: haritada odaklanan otel = aktif şehir sekmesi
  transitCost: number;            // Adım 3, kişi başı USD (şehir içi + şehirler arası)

  setStep(step: StepId): void; nextStep(): void /* max 4 */; prevStep(): void /* min 0 */; togglePro(): void; toggleTheme(): void;
  setPro(v: boolean): void;           // yalnız ProUpgradeModal (ödeme onayı / "Ücretsiz Moda Dön (Test)")
  setUser(u: PublicUser | null): void;  // isPro = isPro || u.isPro (kayıttaki Pro cihazda açılır)
  openAuthModal(view?: "login"|"register"): void; closeAuthModal(): void;
  openAdmin(): void /* auth modalını kapatır */; closeAdmin(): void;
  openUpgradeModal(): void; closeUpgradeModal(): void; // Pro kilitleri ve TopBar bunu çağırır, isPro'yu doğrudan değiştirmez
  setOrigin(a: Airport): void;        // farklıysa selectedFlight=null
  setDestination(a: Airport): void;   // farklıysa uçuş, mekanlar, hover, oteller, focusedHotelId, transit sıfırlanır
  setDepartureDate(d: string): void;  // selectedFlight=null
  setTravelers(n: number): void;      // 1–9 clamp
  selectFlight(f: Flight | null): void;
  togglePlace(p: Place): void;
  setHoveredPlace(id: string | null, source?: "card" | "map"): void; // varsayılan "card"
  setRecommendedHotels(h: Hotel[]): void;
  chooseHotel(h: Hotel): void;        // aynı cityRegion'daki oteli değiştirir + focusedHotelId = h.id
  setFocusedHotel(id: string | null): void;
  setTransitCost(c: number): void;
  getBudget(): BudgetBreakdown;
  reset(): void;
}

// Reaktif okuma: useTripStore(useShallow(computeBudget))
export function computeBudget(s): BudgetBreakdown;
//  flight = selectedFlight.price * travelers
//  hotel = Σ pricePerNight * nights
//  transit = transitCost * travelers
//  foodAndEntries = Σ place.estimatedCost * travelers
```

## Yardımcılar
```ts
// @/data/airports
AIRPORTS (+ AYT, LAX, ORD, HKG sadece kalkış); ORIGIN_GROUPS [{label: "Türkiye"|"Avrupa"|"Amerika"|"Asya & Orta Doğu"; codes}] (29 kod)
ORIGIN_CODES; ORIGINS; SEARCHABLE_ORIGINS (kalkışlar + tüm hedefler, tekrarsız); isTurkishAirport(a); OriginRegion
FEATURED_DESTINATIONS (5 kürasyonlu); DESTINATIONS (36). DEFAULT_ORIGIN/DEFAULT_DESTINATION YOK.
FeaturedCode = "HND"|"FCO"|"CDG"|"JFK"|"ICN"; DestinationCode = 36 kodun birleşimi
// @/data/mockHotels
HOTEL_IMAGES: Record<HotelTier, string[]>   // 2'şer Unsplash görseli (jeneratör de kullanır)
// @/data/mockPlaces
CATEGORY_META: Record<PlaceCategory, { label; short; color }> // sight #38bdf8, food #fb923c, culture #c084fc
HOURS_PER_DAY = 7
estimateTripDays(places): number           // ceil(Σ saat / 7), boşsa 0
getPlacesForDestination(code: string): Place[]   // SADECE kürasyonlu (Record<FeaturedCode>), diğerleri []
getRegions(places): string[]               // ilk görülme sırasıyla
// @/data/mockFlights
getFlights(origin, destination, date): Flight[]   // TR kalkışı + bantlı bölge → MARKET_BANDS içinde fiyat; <150 km → []; kürasyonlu şablon sadece TR kalkışında, aksi halde generateFlightTemplates
formatDuration(min): string
// @/data/mockHotels
HOTEL_TIER_META: Record<HotelTier, { label; short }>   // Bütçe Dostu / Fiyat/Performans Merkez / Lüks
getHotelsForRegion(cityRegion): Hotel[]               // 3 seçenek, nights 0; sadece 10 kürasyonlu bölge (diğerleri [] → generateHotels)
// @/lib/routeOptimizer
TRANSIT_MODE_META: Record<TransitMode, { label; color; emoji }>
buildTripPlan(places, arrival: Airport): TripPlan
//  TripPlan { cities: CityPlan[]; transfers: IntercityTransfer[]; totalDays; totalPlaces }
//  CityPlan { city; places; visitHours; days; nights; dayStart; dayEnd; center: LngLat; idealAvgKm; hotels: HotelEvaluation[] (puana göre) }
//  HotelEvaluation { hotel (nights atanmış); score 35–99; avgDistanceKm; centerDistanceKm; legs: TransitLeg[]; transitCost (gidiş-dönüş, kişi başı) }
planLeg(hotel: Hotel, place): TransitLeg   // ≤walkMaxKm yürüyüş; değilse CITY_LINES'ta otel+mekana ≤1.2 km istasyonu olan AYNI hat (ana profil, otobüs değil; loop iki yön) → yoksa sentetik (otel semti / mekan adı istasyonları, hash'li renk)
formatFrequency(route): string   // "Her 4 dk'da bir • İlk sefer 05:30"
legSteps(leg, place): string[]   // route.steps ya da tek yürüyüş adımı
directionsUrl(from: LngLat, to: LngLat, mode): string   // google.com/maps/dir/?api=1&origin&destination&travelmode=transit|walking
defaultHotel(city): HotelEvaluation | undefined       // en yüksek puan, eşitlikte central
chosenEvaluation(city, chosen: Hotel[]): HotelEvaluation | undefined  // seçili yoksa default
computeTransitCost(plan, chosen: Hotel[]): number     // kişi başı, Math.round
formatMinutes(min): string                            // "2 sa 15 dk"
// @/lib/wikipedia
fetchWikiSummary(title): Promise<{ title; imageUrl: string|null; extract; pageUrl: string|null } | null>
fetchWikiImage(title): Promise<string | null>
fetchLocalTitles(titles: string[], lang: string): Promise<Record<enTitle, yerelBaşlık>>   // en → {}; bellek önbelleği; hata → {}
// @/data/transitLines
CITY_LINES: Record<cityRegion, TransitLineDef[]>   // TransitLineDef { name; colorName; color; termini: [azalanYön, artanYön]; headway; firstDeparture; loop?; stations: [ad, lng, lat][] }
// @/data/languageCards
type PhraseCategory = "address"|"transit"|"restaurant"|"shopping"|"emergency"; PHRASE_CATEGORIES {id; emoji; label}[]
PHRASE_KEYS {key; category; tr}[]  // 12 ifade; Free'de index < 2 açık
PHRASE_BOOKS: Record<LanguageCode, { takeMePron; speechLang; phrases: Record<PhraseKey, [local, pron, trOverride?]> }>
// @/lib/globalDiscovery
type Continent = "Avrupa"|"Asya"|"Orta Doğu"|"Afrika"|"Amerika"|"Okyanusya"; CONTINENTS
interface CityInfo { name /* = cityRegion */; coordinates: LngLat }
interface DestinationProfile { continent; cities: CityInfo[] /* ilki varış şehri */; costIndex /* 1 = B. Avrupa */; language: LanguageCode }
DESTINATION_PROFILES: Record<string, DestinationProfile>   // 36 hedefin hepsi
getDestinationProfile(airport): DestinationProfile          // yoksa varış şehrinden tek şehirli
isCuratedDestination(code): boolean; searchKey(text); matchesDestination(airport, query): boolean
interface LanguagePack { name; hello; thanks; takeMe; bill; howMuch; rtl? }; LANGUAGES: Record<LanguageCode, LanguagePack>
interface FlightTemplate { airline; airlineCode; flightNumber; hub?: AirportCode; layoverMinutes?; basePrice /* kürasyonlu: IST çıkışlı g-d; jeneratör: gerçek kalkış */; departure; cabinBaggageKg; checkedBaggageKg; tags }
generateFlightTemplates(origin, destination): FlightTemplate[]
generateHotels(city, center: LngLat, places, costIndex): Hotel[]   // 3 tier, nights 0
discoverLivePlaces(destination): Promise<Place[]>   // önbellekli, hata fırlatabilir
peekLivePlaces(code): Place[] | null
useDestinationPlaces(destination) → { places; curatedCount; liveCount; liveStatus: "loading"|"ready"|"error"; retry() }
// @/lib/itinerary
type DaySlot = "morning"|"noon"|"afternoon"|"evening"; DAY_SLOTS (sıralı)
SLOT_META: Record<DaySlot, { label; emoji; range }>  // Sabah 09–12 · Öğle & Lezzet 12–15 · İkindi Keşfi 15–18:30 · Akşam & Gece 19–22:30
// slotOf: <12:00 sabah, <15:00 öğle, <18:30 ikindi, sonrası akşam
type ItineraryItem = { time: "HH:MM"; slot } & ({kind:"arrival"; flight|null} | {kind:"checkin"; hotel} | {kind:"transfer"; transfer} | {kind:"place"; place; leg?: TransitLeg} | {kind:"free"; note} | {kind:"departure"; flight|null})
interface ItineraryDay { day /* 1 tabanlı */; date: Date|null; city; hotel?: Hotel; items: ItineraryItem[] }
buildItinerary(plan: TripPlan, chosenHotels: Hotel[], flight: Flight|null, departureDate: string): ItineraryDay[]
```

// @/lib/security
SECURITY_HEADERS {key; value}[]; RATE_LIMIT { windowMs: 60000; max: 20 }
sanitizeInput(v: unknown, max = 200, { live? }): string   // live: sondaki boşluk korunur (onChange'te)
sanitizeSearch(v) /* 80, live */; sanitizeEmail(v) /* küçük harf, boşluksuz */; sanitizePhone(v, live?)
isValidEmail(s); isValidPhone(s) /* boş = geçerli, 7–15 rakam */; passwordProblem(pw): string | null /* ≥8, harf+rakam, ≤128 */
csvCell(v): string   // "…" tırnaklı, "" kaçışlı, =+-@ başlıyorsa ' öneki
// @/lib/authClient  ("use client")
authApi.register({name,email,phone,password,lastRoute,isPro}) | login(email, pw) | sync(lastRoute, isPro) | logout() | adminUsers(pw)
  → Promise<{ok:true; data} | {ok:false; error: string}>
currentRouteSummary(): string; useAuthSync(): void   // yalnız Simulator'da
// API: POST /api/auth {action:"register"|"login"|"sync"|"logout"} → {user} | {error}; GET /api/auth → {user|null}; POST /api/admin/users {password} → {users: AdminUserRow[]}
// 401 hatalı giriş/oturum, 409 e-posta var, 403 yabancı Origin, 415/413, 429 rate limit (proxy)

## Bileşen prop'ları
```ts
<WorldMap mode="flight"|"places"|"hotel" className? places?: Place[] />  // places: adım 2'de kürasyonlu+canlı liste; store origin/destination null olabilir (effect'ler korumalı)
<PlaceDiscoveryStep {...route} /> <HotelTransitStep {...route} /> <FinalGuideStep {...route} />  // route: TripRoute (Simulator)
```
