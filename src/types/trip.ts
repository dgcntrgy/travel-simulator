/** [longitude, latitude] — GeoJSON / Turf sırası (Leaflet için [lat, lng]e çevrilir) */
export type LngLat = [number, number];

/** 0 = Karşılama (Landing), 1–4 = simülasyon adımları */
export type StepId = 0 | 1 | 2 | 3 | 4;

export type Theme = "light" | "dark";

/** Adım 2–4'e `Simulator` tarafından geçirilen kesinleşmiş rota (store'da ikisi de null olabilir) */
export interface TripRoute {
  origin: Airport;
  destination: Airport;
}

export interface Airport {
  /** IATA kodu, örn: "IST" */
  code: string;
  city: string;
  country: string;
  airportName: string;
  coordinates: LngLat;
  /** Bayrak emojisi (UI rozetleri için) */
  flag: string;
  /** Yerel saat farkı (UTC'ye göre, saat) */
  utcOffset: number;
}

export type FlightType = "direct" | "layover";

export interface Layover {
  airport: Airport;
  /** Aktarma noktasındaki bekleme süresi (dakika) */
  durationMinutes: number;
}

export interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  type: FlightType;
  origin: Airport;
  destination: Airport;
  /** Sadece `type === "layover"` olduğunda dolu */
  layover?: Layover;
  /** Kişi başı gidiş-dönüş ekonomi fiyatı (USD) */
  price: number;
  /** Toplam yolculuk süresi (aktarma beklemesi dahil, dakika) */
  totalDurationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  /** Varış, kalkış gününe göre kaç gün sonra (0 = aynı gün) */
  arrivalDayOffset: number;
  cabinBaggageKg: number;
  checkedBaggageKg: number;
  tags: string[];
  /** Anlık kampanya yakalandıysa dolu; `price` zaten indirimli fiyattır */
  campaign?: FlightCampaign;
}

/** "🔥 Fiyat Düştü": rota + tarih + gün tohumuyla bir uçuşta yakalanan indirim */
export interface FlightCampaign {
  /** Kişi başı indirimsiz gidiş-dönüş fiyatı (USD) */
  originalPrice: number;
  /** Yüzde indirim (12–22) */
  discountPercent: number;
  /** Bu fiyattan kalan koltuk (2–7) */
  seatsLeft: number;
}

/** Uçuş fiyatlarının kaynağı: gerçek API ya da piyasa bandı simülasyonu */
export type FlightPriceSource = "travelpayouts" | "amadeus" | "simulation";

/** sight = Gezilecek Yer · food = Yerel Lezzet · culture = Deneyim */
export type PlaceCategory = "sight" | "food" | "culture";

export interface Place {
  id: string;
  name: string;
  /** Wikimedia REST API başlığı (örn: "Fushimi_Inari-taisha") — canlı görsel & özet için */
  wikiTitle: string;
  /** Adım 3 kümelemesi için şehir/bölge (örn: "Tokyo", "Kyoto") */
  cityRegion: string;
  category: PlaceCategory;
  coordinates: LngLat;
  story: string;
  /** "Burada ne yapılır / ne yenir?" + lokal ipucu */
  mustDo: string;
  /** Kişi başı ortalama giriş veya yemek maliyeti (USD, ücretsizse 0) */
  estimatedCost: number;
  /** Ortalama gezi süresi (saat) */
  recommendedDuration: number;
  /** Wikipedia yanıt vermezse kullanılacak Unsplash görseli */
  fallbackImage: string;
  /** "curated" = elle hazırlanmış veri (varsayılan) · "live" = Wikimedia GeoSearch ile canlı keşfedildi */
  source?: "curated" | "live";
}

/** budget = Bütçe Dostu · central = Fiyat/Performans Merkez · luxury = Lüks */
export type HotelTier = "budget" | "central" | "luxury";

export interface Hotel {
  id: string;
  name: string;
  /** Semt / mahalle adı (örn: "Shinjuku") */
  area: string;
  /** Adım 3 şehir eşleşmesi — `Place.cityRegion` ile aynı değer */
  cityRegion: string;
  tier: HotelTier;
  coordinates: LngLat;
  /** Oda başı gecelik fiyat (USD) */
  pricePerNight: number;
  /** Plan tarafından atanır (mock veride 0) */
  nights: number;
  /** 10 üzerinden kullanıcı puanı */
  rating: number;
  reviewCount: number;
  image: string;
  highlights: string[];
}

export type TransitMode = "walk" | "metro" | "bus" | "tram" | "train";

/** Otelden bir mekana tek yön ulaşım ayağı */
export interface TransitLeg {
  placeId: string;
  mode: TransitMode;
  /** Hat / servis adı (örn: "Tokyo Metro", "JR Sagano Hattı") */
  line: string;
  distanceKm: number;
  minutes: number;
  /** Kişi başı tek yön bilet (USD) */
  cost: number;
  /** Yürüyüş dışındaki ayaklarda istasyon → istasyon detaylı yol tarifi */
  route?: TransitRoute;
}

export interface TransitStation {
  name: string;
  coordinates: LngLat;
}

/** Otelden mekana hat bazlı yol tarifi (binilecek/inilecek istasyon, sefer sıklığı, adımlar) */
export interface TransitRoute {
  /** Hat adı (örn: "Ginza Hattı (G)", "Metro Linea A", "RER B") */
  line: string;
  /** Renk adı (örn: "Turuncu Hat") */
  colorName: string;
  /** Hat rengi (hex) */
  color: string;
  /** Binilecek yön (hat son durağı) */
  direction: string;
  from: TransitStation;
  to: TransitStation;
  stops: number;
  /** Sefer aralığı (dk) */
  headwayMinutes: number;
  /** İlk sefer "HH:MM" */
  firstDeparture: string;
  walkToMinutes: number;
  waitMinutes: number;
  rideMinutes: number;
  walkFromMinutes: number;
  /** "İstasyonu" (raylı) | "Durağı" (otobüs) */
  stationWord: string;
  /** Biniş → iniş arası istasyon koordinatları (haritada hat bu yoldan çizilir) */
  path: LngLat[];
  /** "Otelden 4 dk yürü ➔ …" adım adım tarif */
  steps: string[];
}

/** İki şehir arası geçiş (örn: Tokyo ➔ Kyoto Shinkansen) */
export interface IntercityTransfer {
  from: string;
  to: string;
  mode: "train" | "bus" | "flight";
  name: string;
  minutes: number;
  /** Kişi başı (USD) */
  cost: number;
  /** Son şehirden varış havalimanı şehrine dönüş (uçuş gidiş-dönüş olduğu için) */
  isReturn?: boolean;
}

export interface BudgetBreakdown {
  flight: number;
  hotel: number;
  transit: number;
  foodAndEntries: number;
  total: number;
}

/** Oturum açmış kullanıcının istemciye dönen hali (şifre hash'i ASLA istemciye gitmez) */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** "İstanbul (IST) ➔ Tokyo (HND) · 6 mekan" — boşsa henüz rota yok */
  lastRoute: string;
  isPro: boolean;
  /** ISO tarih */
  createdAt: string;
}

/** Yönetici Excel tablosu satırı: hash'in kendisi değil, maskelenmiş özeti gelir */
export interface AdminUserRow extends PublicUser {
  /** "scrypt · N=16384 · salt 16B · 64B ✓" + kısaltılmış parmak izi */
  hashInfo: string;
}
