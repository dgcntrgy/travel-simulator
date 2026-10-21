import { create } from "zustand";
import { DEFAULT_LOCALE, isLocale, localeFromLanguages, type Locale, type TranslationKey } from "@/lib/i18n";
import { PREF, readPref, writePref } from "@/lib/prefs";
import type { Airport, BudgetBreakdown, Flight, Hotel, Place, PublicUser, StepId, Theme } from "@/types/trip";

/** İlerleme çubuğundaki simülasyon adımları (0 = karşılama ekranı listede yok) */
export const STEPS: { id: Exclude<StepId, 0>; title: TranslationKey; short: TranslationKey }[] = [
  { id: 1, title: "steps.1.title", short: "steps.1.short" },
  { id: 2, title: "steps.2.title", short: "steps.2.short" },
  { id: 3, title: "steps.3.title", short: "steps.3.short" },
  { id: 4, title: "steps.4.title", short: "steps.4.short" },
];

/** Açılış dili: kayıtlı tercih (çerez / localStorage) → tarayıcı dili → İngilizce. Ülkeye göre düzeltme `useGeoBootstrap`'ta. */
function initialLocale(): Locale {
  const saved = readPref(PREF.locale);
  if (isLocale(saved)) return saved;
  if (typeof navigator !== "undefined") return localeFromLanguages(navigator.languages) ?? DEFAULT_LOCALE;
  return DEFAULT_LOCALE;
}

function isoDateFromToday(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TripState {
  currentStep: StepId;
  isPro: boolean;
  /** Pro tanıtım / satın alma modalı (TopBar + kilitli Pro kutuları açar) */
  isUpgradeModalOpen: boolean;
  theme: Theme;
  /** Arayüz dili (6 dil); reset() sıfırlamaz */
  locale: Locale;
  /** Oturum açmış kullanıcı (sunucudaki `data/users.json` kaydının açık alanları); reset() sıfırlamaz */
  user: PublicUser | null;
  /** Giriş / Kayıt modalı; `authView` hangi sekmeyle açılacağı */
  isAuthModalOpen: boolean;
  authView: "login" | "register";
  /** 🛡️ Yönetici / Excel tablosu paneli */
  isAdminOpen: boolean;

  /** Kullanıcı seçene kadar `null` (Adım 1'de boş harita + "Nereden / Nereye" seçimi) */
  origin: Airport | null;
  destination: Airport | null;
  /** "YYYY-MM-DD" */
  departureDate: string;
  travelers: number;

  selectedFlight: Flight | null;
  selectedPlaces: Place[];
  /** Kart üzerine gelindiğinde / pine tıklandığında haritada vurgulanan mekan */
  hoveredPlaceId: string | null;
  /** Vurgu nereden geldi: haritadan gelirse kart listesi o karta kaydırılır */
  hoverSource: "card" | "map";
  /** Adım 3: şehir başına seçilen otel (`nights` dolu) — bütçenin otel kalemi */
  recommendedHotels: Hotel[];
  /** Adım 3: haritada parlayan ve hatları çizilen otel (aktif şehir sekmesi) */
  focusedHotelId: string | null;
  /** Adım 3: kişi başı şehir içi + şehirler arası ulaşım (USD) */
  transitCost: number;

  setStep: (step: StepId) => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePro: () => void;
  setPro: (isPro: boolean) => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  toggleTheme: () => void;
  /** `persist` (varsayılan true) → tercih çereze + localStorage'a yazılır (otomatik algılamada false) */
  setLocale: (locale: Locale, persist?: boolean) => void;
  setUser: (user: PublicUser | null) => void;
  openAuthModal: (view?: "login" | "register") => void;
  closeAuthModal: () => void;
  openAdmin: () => void;
  closeAdmin: () => void;

  setOrigin: (origin: Airport) => void;
  setDestination: (destination: Airport) => void;
  setDepartureDate: (date: string) => void;
  setTravelers: (count: number) => void;
  selectFlight: (flight: Flight | null) => void;

  togglePlace: (place: Place) => void;
  setHoveredPlace: (id: string | null, source?: "card" | "map") => void;
  setRecommendedHotels: (hotels: Hotel[]) => void;
  /** Aynı şehirdeki önceki otelin yerine geçer ve haritada odaklar */
  chooseHotel: (hotel: Hotel) => void;
  setFocusedHotel: (id: string | null) => void;
  setTransitCost: (cost: number) => void;

  /** Canlı bütçe: Uçuş + Otel + Ulaşım + Yemek/Giriş */
  getBudget: () => BudgetBreakdown;
  reset: () => void;
}

type TripData = Pick<
  TripState,
  | "currentStep"
  | "origin"
  | "destination"
  | "departureDate"
  | "travelers"
  | "selectedFlight"
  | "selectedPlaces"
  | "hoveredPlaceId"
  | "hoverSource"
  | "recommendedHotels"
  | "focusedHotelId"
  | "transitCost"
>;

const initialData = (): TripData => ({
  currentStep: 0,
  origin: null,
  destination: null,
  departureDate: isoDateFromToday(30),
  travelers: 1,
  selectedFlight: null,
  selectedPlaces: [],
  hoveredPlaceId: null,
  hoverSource: "card",
  recommendedHotels: [],
  focusedHotelId: null,
  transitCost: 0,
});

/** Bileşenlerde `useTripStore(useShallow(computeBudget))` ile reaktif okunabilir. */
export function computeBudget(
  state: Pick<TripState, "selectedFlight" | "recommendedHotels" | "selectedPlaces" | "transitCost" | "travelers">,
): BudgetBreakdown {
  const flight = (state.selectedFlight?.price ?? 0) * state.travelers;
  const hotel = state.recommendedHotels.reduce((sum, h) => sum + h.pricePerNight * h.nights, 0);
  const transit = state.transitCost * state.travelers;
  const foodAndEntries = state.selectedPlaces.reduce((sum, p) => sum + p.estimatedCost, 0) * state.travelers;

  return { flight, hotel, transit, foodAndEntries, total: flight + hotel + transit + foodAndEntries };
}

export const useTripStore = create<TripState>()((set, get) => ({
  ...initialData(),
  isPro: false,
  isUpgradeModalOpen: false,
  theme: "light",
  locale: initialLocale(),
  user: null,
  isAuthModalOpen: false,
  authView: "login",
  isAdminOpen: false,

  setStep: (currentStep) => set({ currentStep }),
  nextStep: () => set((s) => ({ currentStep: Math.min(4, s.currentStep + 1) as StepId })),
  prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) as StepId })),
  togglePro: () => set((s) => ({ isPro: !s.isPro })),
  setPro: (isPro) => set({ isPro }),
  openUpgradeModal: () => set({ isUpgradeModalOpen: true }),
  closeUpgradeModal: () => set({ isUpgradeModalOpen: false }),
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  setLocale: (locale, persist = true) => {
    if (persist) writePref(PREF.locale, locale);
    set({ locale });
  },
  // Kayıtta Pro olan kullanıcı giriş yapınca bu cihazda da Pro açılır
  setUser: (user) => set((s) => ({ user, isPro: s.isPro || Boolean(user?.isPro) })),
  openAuthModal: (authView = "login") => set({ isAuthModalOpen: true, authView }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  openAdmin: () => set({ isAdminOpen: true, isAuthModalOpen: false }),
  closeAdmin: () => set({ isAdminOpen: false }),

  // Rota değişince eski uçuş ve ona bağlı plan geçersiz olur.
  setOrigin: (origin) =>
    set((s) => (s.origin?.code === origin.code ? {} : { origin, selectedFlight: null })),
  setDestination: (destination) =>
    set((s) =>
      s.destination?.code === destination.code
        ? {}
        : {
            destination,
            selectedFlight: null,
            selectedPlaces: [],
            hoveredPlaceId: null,
            recommendedHotels: [],
            focusedHotelId: null,
            transitCost: 0,
          },
    ),
  setDepartureDate: (departureDate) => set({ departureDate, selectedFlight: null }),
  setTravelers: (travelers) => set({ travelers: Math.max(1, Math.min(9, travelers)) }),
  selectFlight: (selectedFlight) => set({ selectedFlight }),

  togglePlace: (place) =>
    set((s) => ({
      selectedPlaces: s.selectedPlaces.some((p) => p.id === place.id)
        ? s.selectedPlaces.filter((p) => p.id !== place.id)
        : [...s.selectedPlaces, place],
    })),
  setHoveredPlace: (hoveredPlaceId, hoverSource = "card") => set({ hoveredPlaceId, hoverSource }),
  setRecommendedHotels: (recommendedHotels) => set({ recommendedHotels }),
  chooseHotel: (hotel) =>
    set((s) => ({
      recommendedHotels: [...s.recommendedHotels.filter((h) => h.cityRegion !== hotel.cityRegion), hotel],
      focusedHotelId: hotel.id,
    })),
  setFocusedHotel: (focusedHotelId) => set({ focusedHotelId }),
  setTransitCost: (transitCost) => set({ transitCost }),

  getBudget: () => computeBudget(get()),
  reset: () => set(initialData()),
}));

