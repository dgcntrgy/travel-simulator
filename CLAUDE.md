# Travel Simulator & Interactive Route Planner

## TOKEN OPTİMİZASYON KURALI (.memory)
Yeni bir göreve başlarken tüm `src/` dosyalarını tarama! Önce `.memory/progress.md` ve `.memory/state-contracts.md` dosyalarını oku. Sadece üzerinde değişiklik yapacağın spesifik dosyayı aç. Her adımın sonunda `.memory/` altındaki dosyaları güncelle.
(Dosya haritası gerekirse: `.memory/architecture.md`)

## Vizyon ve Temel Kurallar
Bu proje, kullanıcıların adım adım seyahatlerini simüle ettiği, görsel dünya haritası üzerinde direkt/aktarmalı uçuşları gördüğü, hikayeli kartlarla gezilecek yerleri seçtiği ve seçilen yerlerin yoğunluğuna göre otomatik "Otel Bölgesi + Gün Sayısı + Taşıt Rotası" tavsiyesi alan oyunlaştırılmış bir web uygulamasıdır.

**KRİTİK KURAL (SIFIR MALİYET):** 
Projede KESİNLİKLE ücretli veya kredi kartı gerektiren API (Google Maps, Mapbox, paralı Amadeus vb.) KULLANILMAYACAKTIR.
- **Harita Motoru:** `leaflet` (Web Worker yok, Turbopack uyumlu) + Resmi OpenStreetMap raster karoları (`tile.openstreetmap.org`, API anahtarsız; Dark Mode = `.leaflet-tile-pane` CSS invert filtresi).
- **Coğrafi Hesaplamalar:** `@turf/turf` (Kavisli uçuş rotaları için `turf.greatCircle`, akıllı otel merkezi ve şehir kümelemesi için `turf.centerOfMass` ve `turf.clustersKmeans`).
- **Mekan & Hikaye Verileri:** Wikipedia / Wikivoyage REST API + Yerel zenginleştirilmiş JSON önbelleği.
- **Uçuş & Otel Verileri:** İlk aşamada gerçekçi simülasyon motoru (Mock/Affiliate yapısına uygun dinamik JSON), sonrasında Travelpayouts ücretsiz Affiliate API.

## Teknik Yığın (Tech Stack)
- Next.js (App Router, `src/` dizini, TypeScript)
- Tailwind CSS + Framer Motion (Glassmorphism HUD, akıcı geçişler)
- Zustand (`src/store/useTripStore.ts` - Canlı bütçe, seçilen uçuş, mekanlar, gün planı ve Free/Pro üyelik durumu)
- Lucide React (İkonlar)

## 4 Adımlı Simülasyon Akışı
1. **Step 1 (Flight & World Map):** Vektörel dünya haritasında kalkış ve varış seçimi. Direkt uçuşların tek kesintisiz yay, aktarmalı uçuşların (Örn: IST -> DOH -> HND) aktarma noktasında duraklayan iki ayrı yay olarak çizilmesi.
2. **Step 2 (Story Discovery Cards):** Seçilen şehir/ülkedeki noktaların fotoğraf, kısa hikaye, "Neden Görülmeli?" özeti ve ortalama maliyetleriyle kartlar halinde sunulması ve haritaya eklenmesi.
3. **Step 3 (Smart Hotel & Transit Clustering):** Seçilen mekanların koordinatlarına göre kaç gün hangi şehirde kalınacağının ve en ideal otel merkezinin hesaplanması. Otelden mekanlara taşıt/yürüyüş hatlarının ve maliyetlerinin çizilmesi.
4. **Step 4 (Final Guide & Freemium Paywall):** Canlı bütçe dökümü (Uçak + Otel + Metro/Tren + Yemek + Girişler) ve Gün Gün Rehber. (Ücretsiz: Genel özet ve web görünümü / Pro: Tam bütçe kırılımı, nokta atışı otel-taşıt haritası ve Offline/PDF Cep Rehberi).