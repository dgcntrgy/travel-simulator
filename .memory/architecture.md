# Mimari İndeksi

Next.js 16 (App Router, Turbopack, `cacheComponents`) · TS strict · Tailwind v4 · Framer Motion · Zustand · Leaflet (+ @types/leaflet) · Turf. Path alias: `@/*` → `src/*`.
Not: `AGENTS.md` uyarısı — bu Next sürümü farklı; API şüphesi olursa `node_modules/next/dist/docs/` bak.

## src/app
- `api/auth/route.ts` — GET (çerezden oturum kullanıcısı) · POST {action: register|login|sync|logout}; sanitize + doğrulama, Origin/415/413 kontrolleri, httpOnly `ts_session` çerezi.
- `api/admin/users/route.ts` — POST {password} (`ADMIN_PASSWORD` env ?? "Admin2026!", `safeEqual`) → `AdminUserRow[]`.
- `api/flights/route.ts` — GET ?origin&destination&date&passengers → `getLiveFlights` (lib/server/liveFlights.ts, use cache 1 sa; Travelpayouts → Amadeus → simülasyon) + kampanya etiketleri.
- `layout.tsx` — Kök layout (Geist fontları). Body arka planı `globals.css` token'larından.
- `page.tsx` — Tek sayfa; `SimulatorClient`'ı render eder.
- `globals.css` — `.route-flow/.route-core/.route-glow` (akan rota ışığı), `.radar-ring` (çift halka radar), `dot-grid` utility (`--dot-color` nokta deseni), `prefers-reduced-motion` kapatması; `dark` custom variant, Gece Laciverti token'ları (`--card-bg/--card-border` dahil), `.dark .leaflet-tile-pane` yedek lacivert filtre, sonda `@page` + `@media print` (Adım 4 PDF: `.print-guide` / `.print-cover` (1. sayfa, break-after) / `.print-cover-row` / `.print-timetable` / `.print-day` (her gün break-before: page) / `.print-slot` / `.print-appendix`, motion opacity sıfırlama, TopBar/buton/harita gizleme), `.leaflet-container` tema zemini + şeffaf `.leaflet-tile`, Adım 3 `.hotel-pin` / `.transit-label` / `.place-pin.is-muted`, Pro metro `.metro-core` / `.metro-glow` / `.station-pin` / `.metro-popup` (Leaflet popup className), `.print-locked` / `.print-lock-note` (Free'de Ctrl+P kilidi), tema token'ları (`--canvas/--surface/--ink`…), `card` / `glass` / `glass-primary` / `glass-secondary` / `glass-chip` utility'leri, `.spotlight-left/right` köşe spotları, Leaflet kontrol stilleri (`.leaflet-bar`, `.leaflet-control-attribution`, `.map-divicon`), harita pin CSS'leri (`.airport-pin`, `.candidate-pin`, `.layover-badge`, `.plane-marker`, `.place-pin` + `is-selected` / `is-hovered`).

## src/proxy.ts
- Next 16 Proxy (eski middleware): `/api/:path*` IP başına 20 istek/dk → 429; güvenlik başlıkları + X-RateLimit-*.

## src/components
- `modals/AuthModal.tsx` — 👤 Giriş / Kayıt modalı (store `isAuthModalOpen`/`authView`), altında 🛡️ admin girişi.
- `modals/AdminPanel.tsx` — 🛡️ şifre korumalı Excel tablosu + `downloadCsv` (BOM, `;`, `csvCell`). Simulator'da mount.
- `SimulatorClient.tsx` — `Simulator`'ı `next/dynamic` ile `ssr:false` yükler (Leaflet `window` ister).
- `Simulator.tsx` — Kök (`DotGridBackdrop` silik nokta deseni + `CornerSpotlights` üst köşe spotları): `<html>`'e tema sınıfı uygular; origin+destination+selectedFlight yoksa Adım 2+ yerine FlightStep; Adım 2–4'e `TripRoute` prop'u geçirir; `flex h-dvh` içinde sabit `TopBar` + `currentStep`'e göre tam ekran adım (0: LandingStep, 1: FlightStep, 2: PlaceDiscoveryStep, 3: HotelTransitStep, 4: FinalGuideStep). Düz mat zemin `#F8FAFC` / `#080C16`; `print:` varyantlarıyla yazdırmada tam yükseklik. Harita artık arka plan değil, adımların içinde.
- `map/WorldMap.tsx` — Düz 2D Leaflet haritası, `mode: "flight" | "places" | "hotel"`; OpenStreetMap raster karoları (dark = tile pane'e inline CSS filtresi). Hotel modu: otel pinleri + otel→mekan taşıt hatları/etiketleri; Pro'da `leg.route.path` boyunca çift katman neon hat + biniş/iniş `stationPin` + `routePopupHtml` yol tarifi popup'ı; Free'de soluk hat + alt ortada "🔒 … Pro'ya Geçin" rozeti (→ `openUpgradeModal`). Pinler `L.divIcon` (HTML eleman), rotalar `L.polyline`.
- `map/PlaceLocationMap.tsx` — `<PlaceLocationMap place className />`: detay penceresindeki tek pinli mini OSM haritası (scrollWheelZoom kapalı, `.place-pin is-selected`).
- `hud/TopBar.tsx` — Sticky üst bar (lg: tek satır h-16; <lg: 2 satır, 2. satırda `StepProgress` kısa adlar + `TripStats`): Logo (→ adım 0), `StepProgress({className})`, `TripStats({className})` (adım ≥2), `ThemeToggle`, `AccountButton` (👤 / avatar + menü), `ProToggle` (→ `openUpgradeModal`), `BudgetCounter`.
- `modals/ProUpgradeModal.tsx` — Pro tanıtım (paket seçimi) ➔ güvenli ödeme (simülasyon) ➔ onay modalı; store `isUpgradeModalOpen`. Simulator'da mount.
- `hud/AnimatedNumber.tsx` — Sayıyı yumuşakça yeni değere sayan span.
- `ui/CitySelectDropdown.tsx` — Cam temalı şehir/havalimanı açılır listesi (yerel `<select>` yerine; arama, IATA rozeti, ✓, klavye, dışarı tıklama). Props: label, icon, value, options, onChange, isDisabled?, disabledHint?, getSubtitle?, matches?.
- `steps/LandingStep.tsx` — Adım 0: hero + `QuickRouteBar` + 2× `CitySelectDropdown` (Nereden ➔ Nereye ➔ Planlamaya Başla), Bento Grid popüler rotalar (`PopularRouteCard large`), nasıl çalışır (3 kart), Pro tanıtımı.
- `steps/FlightStep.tsx` — Adım 1: sol %45 kalkış + varış `CitySelectDropdown` (kart içinde, ⇄ takas), tarih/yolcu, uçuş kartları = biniş kartı (`FlightCard` + `DurationBar`/`Barcode`/`Notch`, iki nokta seçiliyse) + `FlightActionBar`, sağ %55 `WorldMap mode="flight"`.
- `steps/HotelTransitStep.tsx` — Adım 3: sol %56 `PlanSummaryBanner`, şehir sekmeleri, İdeal Otel Bölgesi, `HotelCard` ×3 (`HotelImage` fallback), `TransitBreakdown` (Pro döküm / Free kilit), `HotelActionBar`; sağ %44 `WorldMap mode="hotel"`. Plan→store senkron effect'i burada.
- `steps/FinalGuideStep.tsx` — Adım 4: `GuideHero`, `BookingLinks` (Google Flights/Skyscanner/Kiwi + Booking.com dış linkleri), Free bandı, `TimetableGrid` (gün sütunu × 4 zaman dilimi, `SLOT_THEME` renkleri; `SlotCard` (div + iç button + `TransitStrip cell`), `PlaceThumb`, `ItemDetailModal` portal), `TransitStrip` (🚇 Ulaşım & Yol Tarifi Şeridi: `cell` | `full`), `shiftClock`, sadece çıktıda animasyonsuz `DayCard` (`.print-day` bülten, `dayCost()`)/`ItineraryRow` listesi, `BudgetTable` (+`useBudgetCategories`), `FlightSummary`, `HotelsSummary`, `WorldMap mode="hotel"`, `PhraseCards` (5 sekme + `PhraseCardView` + `FullscreenPhrase` portal + `speak()` Web Speech), `ProLock`, `GuideActionBar`, `printGuide()` (Free'de modal açar).
- `steps/PlaceDiscoveryStep.tsx` — Adım 2 (`useDestinationPlaces` ile kürasyonlu + canlı Wikipedia kartları, durum bandı, kaynak filtresi): sol %63 filtreler + kompakt kart ızgarası (`PlaceCard`, `PlaceImage` Wikipedia→Unsplash→ikon fallback, `RouteToggleButton`) + `PlaceDetailModal` (body portal) + `DiscoveryActionBar`, sağ %37 `WorldMap mode="places"`.

## src/data
- `airports.ts` — `AIRPORTS` kaydı (çıkışlar + 36 hedef + hub'lar + AYT/LAX/ORD/HKG); `ORIGIN_GROUPS` (4 bölge), `ORIGINS`, `SEARCHABLE_ORIGINS`, `isTurkishAirport`, `FEATURED_DESTINATIONS` (5 kürasyonlu), `DESTINATIONS` (36), `FeaturedCode`/`DestinationCode` tipleri. Varsayılan rota yok.
- `mockFlights.ts` — Deterministik uçuş simülatörü: `getFlights(origin, dest, date)` (kürasyonlu şablon yoksa `generateFlightTemplates`), `formatDuration(min)`.
- `mockHotels.ts` — Her şehir bölgesine 3 mock otel (budget/central/luxury, gerçekçi fiyat/puan/yorum/koordinat), `HOTEL_TIER_META`, `getHotelsForRegion()`.
- `transitLines.ts` — `CITY_LINES`: gerçek hat verisi (ad, renk adı/hex, `termini`, sefer aralığı, ilk sefer, `loop`, sıralı `[ad, lng, lat]` istasyonlar) — Tokyo, Roma, Paris (+RER B), New York, Washington D.C., Seul, Busan, Londra, Barselona, Madrid.
- `languageCards.ts` — `PHRASE_CATEGORIES` (5 sekme), `PHRASE_KEYS` (12 ifade, sıra = kart sırası), `PHRASE_BOOKS` (21 dil: `takeMePron`, `speechLang`, `phrases[key] = [yerel, okunuş, trOverride?]`).
- `mockPlaces.ts` — `PLACES_BY_DESTINATION` (her hedef 8–9 mekan, 2 şehir), `CATEGORY_META`, `HOURS_PER_DAY=7`, `estimateTripDays()`, `getPlacesForDestination()`, `getRegions()`.

## src/lib
- `security.ts` — `SECURITY_HEADERS`, `RATE_LIMIT`, `sanitizeInput/Search/Email/Phone`, `isValidEmail/Phone`, `passwordProblem`, `csvCell` (next.config ve proxy de içe aktarır → saf TS, DOM/Node API yok).
- `authClient.ts` — `authApi` (register/login/sync/logout/adminUsers fetch sarmalayıcıları), `currentRouteSummary()`, `useAuthSync()`.
- `server/userStore.ts` — SADECE API route'ları: `data/users.json` deposu, scrypt hash, oturum token'ları, `listUsersForAdmin`.
- `cn.ts` — `clsx` + `tailwind-merge`.
- `motion.ts` — Ortak görsel dil: `EASE_OUT_EXPO`, `STEP_TRANSITION` (adım kök geçişi, sadece opaklık), `SPRING_IN`, `SLIDE_FROM_LEFT`/`SLIDE_FROM_RIGHT` (panel girişleri), `STAGGER_PARENT`/`RISE_ITEM` (variants dalgası), `riseIn(index)` (gecikmeli kart girişi), `CARD_HOVER`, `GLASS_CARD` (boştaki kart cam kenarlığı), `PHOTO_ZOOM`.
- `globalDiscovery.ts` — Ülke profilleri (kıta, şehirler, costIndex, dil), 21 dillik `LANGUAGES`, `COUNTRY_CARRIERS` + kalkıştan bağımsız dinamik uçuş şablonu + otel jeneratörü, canlı Wikimedia GeoSearch mekan keşfi. (Sunucu-güvenli, React yok.)
- `useDestinationPlaces.ts` — Adım 2 hook'u (kürasyonlu + canlı mekanlar). · `flightCampaigns.ts` — `applyCampaigns`, `verificationLinks` (izomorfik). · `server/liveFlights.ts` — canlı fiyat sağlayıcıları.
- `itinerary.ts` — Adım 4 gün gün plan motoru (`buildItinerary`, 4 dilimli `DAY_SLOTS`/`SLOT_META`).
- `routeOptimizer.ts` — Adım 3 motoru (kürasyonlu otel yoksa `generateHotels`; şehirler arası >650 km → iç hat uçuşu): şehir gruplama + gün bölüştürme, `turf.centerOfMass` otel merkezi, `turf.distance` merkezilik puanı, şehir içi taşıt profilleri (`CITY_TRANSIT`), istasyon bazlı yol tarifi (`CITY_LINES` gerçek hat → yoksa sentetik istasyon), şehirler arası `INTERCITY` tablosu, `computeTransitCost`, `formatFrequency`, `legSteps`, `directionsUrl` (Google Maps transit linki).
- `wikipedia.ts` — Wikimedia REST summary: `fetchWikiSummary(title)`, `fetchWikiImage(title)`, `fetchLocalTitles(titles, lang)` (MediaWiki `prop=langlinks`, 50 başlık/istek → yerel dildeki ad); bellek + sessionStorage önbelleği, 6sn timeout, küçük resmi 960px'e yükseltir.

## src/store
- `useTripStore.ts` — Tek Zustand store (bkz. `state-contracts.md`).

## src/types
- `trip.ts` — Tüm domain tipleri (Airport, Flight, Place, Hotel, BudgetBreakdown…).

## Konvansiyonlar
- UI metinleri ve yorumlar Türkçe. Para birimi USD, `$` + `toLocaleString("en-US")`.
- Harita: Leaflet + resmi OpenStreetMap karoları (`tile.openstreetmap.org`), API anahtarı yok; dark tema lacivert CSS `filter` ile.
- Wikimedia Action API (`w/api.php?origin=*`) anahtarsız; istekleri SIRALI at (paralelde 429). CARTO/Mapbox KULLANILMAZ. `maplibre-gl` KULLANILMAZ (Turbopack Worker hatası).
- Sayfa düzeni (wizard): her adım `absolute inset-0`, masaüstünde `lg:grid lg:grid-cols-[..] lg:overflow-hidden` (sol kaydırılabilir içerik + alt CTA bar, sağda `card rounded-3xl` harita); <lg TÜM adım kökü dikey kayar (`overflow-y-auto overflow-x-hidden`), harita üstte `h-[360px] sm:h-[420px] rounded-2xl` tam etkileşimli, CTA bar `sticky bottom-0 lg:static`. KURAL: mobilde içerik/harita gizlenmez.
- Renkler: nötrler `ink` token'ı (`text-ink/60`, `border-ink/10`), tek aksan mavi, çift ton (`text-blue-600 dark:text-blue-400`; CTA `glass-primary`, ikincil/hap/arama `glass-secondary`, TopBar kutucuk `glass-chip`). Bkz. progress.md "Tema sistemi".
- Harici görseller düz `<img>` (eslint-disable `no-img-element`), `next/image` remotePatterns yok.
