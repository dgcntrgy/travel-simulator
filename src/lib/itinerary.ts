import { distance, point } from "@turf/turf";
import { HOURS_PER_DAY } from "@/data/mockPlaces";
import { chosenEvaluation, type TripPlan } from "@/lib/routeOptimizer";
import type { Flight, Hotel, IntercityTransfer, LngLat, Place, TransitLeg } from "@/types/trip";

/** Serbest zaman önerisi: metin seçili dilde `itin.noteExplore` / `itin.noteArrival` ile üretilir */
export type FreeNote = "explore" | "arrival";

/** Gün içi dilim: haftalık ders programı ızgarasının satırları (Sabah / Öğle / İkindi / Akşam) */
export type DaySlot = "morning" | "noon" | "afternoon" | "evening";

export const DAY_SLOTS: DaySlot[] = ["morning", "noon", "afternoon", "evening"];

export const SLOT_META: Record<DaySlot, { label: string; emoji: string; range: string }> = {
  morning: { label: "Sabah & Kahvaltı", emoji: "🌅", range: "09:00 - 12:00" },
  noon: { label: "Öğle & Lezzet", emoji: "☀️", range: "12:00 - 15:00" },
  afternoon: { label: "İkindi Keşfi", emoji: "🏛️", range: "15:00 - 18:30" },
  evening: { label: "Akşam & Gece", emoji: "🌙", range: "19:00 - 22:30" },
};

type Timed = { time: string; slot: DaySlot };

export type ItineraryItem = Timed &
  (
    | { kind: "arrival"; flight: Flight | null }
    | { kind: "checkin"; hotel: Hotel }
    | { kind: "transfer"; transfer: IntercityTransfer }
    | { kind: "place"; place: Place; leg?: TransitLeg }
    | { kind: "free"; note: FreeNote; city: string }
    | { kind: "departure"; flight: Flight | null }
  );

export interface ItineraryDay {
  /** 1 tabanlı */
  day: number;
  /** Yerel tarih (varış günü = kalkış tarihi + arrivalDayOffset) */
  date: Date | null;
  city: string;
  hotel?: Hotel;
  items: ItineraryItem[];
}

/** Gün başlangıcı ve öğle/akşam yemeği saatleri (dakika) */
const DAY_START = 9 * 60;
const LUNCH = 12 * 60 + 30;
const DINNER = 19 * 60;
/** Mekanlar arası mola/fotoğraf payı (dakika) */
const BUFFER_MIN = 15;
/** Her mekanın günlük kapasiteye eklenen ulaşım payı (saat) — routeOptimizer ile aynı */
const TRAVEL_OVERHEAD_HOURS = 0.75;

const km = (a: LngLat, b: LngLat) => distance(point(a), point(b), { units: "kilometers" });

function clock(minutes: number): string {
  const m = Math.max(0, Math.round(minutes)) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 09:00 öncesi sabaha, 18:30 sonrası akşama yazılır */
function slotOf(minutes: number): DaySlot {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 15 * 60) return "noon";
  if (minutes < 18 * 60 + 30) return "afternoon";
  return "evening";
}

/** En yakın komşu sıralaması: otelden başlayıp her seferinde en yakın mekana geç */
function nearestNeighbor(start: LngLat, places: Place[]): Place[] {
  const rest = [...places];
  const ordered: Place[] = [];
  let cursor = start;
  while (rest.length) {
    let best = 0;
    for (let i = 1; i < rest.length; i++) {
      if (km(cursor, rest[i].coordinates) < km(cursor, rest[best].coordinates)) best = i;
    }
    const [next] = rest.splice(best, 1);
    ordered.push(next);
    cursor = next.coordinates;
  }
  return ordered;
}

/** Lezzet durakları öğle ve akşam yemeğine denk gelsin: ilki günün ortasına, diğerleri sona */
function arrangeMeals(places: Place[]): { place: Place; meal?: "lunch" | "dinner" }[] {
  const sights = places.filter((p) => p.category !== "food");
  const foods = places.filter((p) => p.category === "food");
  const result: { place: Place; meal?: "lunch" | "dinner" }[] = sights.map((place) => ({ place }));
  if (foods.length === 0) return result;
  const mid = Math.ceil(sights.length / 2);
  result.splice(mid, 0, { place: foods[0], meal: "lunch" });
  for (const food of foods.slice(1)) result.push({ place: food, meal: "dinner" });
  return result;
}

function addDays(iso: string, days: number): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Gün gün rehber: Adım 3 planındaki şehir/gün aralıklarını ve seçili otelleri kullanır.
 * - 1. gün: varış + check-in (plan bu günü zaten "varış/jet-lag günü" olarak ekler).
 * - Yeni şehrin ilk günü: sabah şehirler arası geçiş, kalan kapasitede mekanlar.
 * - Mekanlar otelden en yakın komşu sırasıyla günlere (7 saat kapasite) dağıtılır; lezzet durakları öğle/akşama.
 * - Son gün: (çok şehirliyse) varış şehrine dönüş + havalimanı / dönüş uçuşu.
 */
export function buildItinerary(
  plan: TripPlan,
  chosenHotels: Hotel[],
  flight: Flight | null,
  departureDate: string,
): ItineraryDay[] {
  if (plan.cities.length === 0) return [];
  const firstDate = addDays(departureDate, flight?.arrivalDayOffset ?? 0);
  const forward = plan.transfers.filter((t) => !t.isReturn);
  const returnTransfer = plan.transfers.find((t) => t.isReturn);

  const days: ItineraryDay[] = [];
  /** Gün başına sıralanmış mekanlar + günün başlangıç dakikası */
  const buckets = new Map<number, { places: Place[]; start: number; legs: Map<string, TransitLeg> }>();

  plan.cities.forEach((city, ci) => {
    const evaluation = chosenEvaluation(city, chosenHotels);
    const hotel = evaluation?.hotel;
    const legs = new Map((evaluation?.legs ?? []).map((l) => [l.placeId, l]));

    for (let d = city.dayStart; d <= city.dayEnd; d++) {
      const date = firstDate ? new Date(firstDate.getTime() + (d - 1) * 86_400_000) : null;
      days.push({ day: d, date, city: city.city, hotel, items: [] });
      buckets.set(d, { places: [], start: DAY_START, legs });
    }
    const firstDay = days[city.dayStart - 1];

    // Şehre giriş: varış uçuşu ya da şehirler arası geçiş
    let firstActivityDay = city.dayStart;
    let used = 0;
    if (ci === 0) {
      const arrival = flight ? toMinutes(flight.arrivalTime) : 14 * 60;
      firstDay.items.push({ kind: "arrival", flight, time: clock(arrival), slot: slotOf(arrival) });
      if (hotel) {
        const checkin = Math.max(arrival + 90, 15 * 60);
        firstDay.items.push({ kind: "checkin", hotel, time: clock(checkin), slot: slotOf(checkin) });
      }
      // Varış günü dinlenme günü; geziler ertesi gün başlar (tek günlük planda aynı gün)
      if (city.dayEnd > city.dayStart) firstActivityDay = city.dayStart + 1;
    } else {
      const transfer = forward[ci - 1];
      if (transfer) {
        firstDay.items.push({ kind: "transfer", transfer, time: clock(DAY_START), slot: "morning" });
        const arrive = DAY_START + transfer.minutes + 45;
        if (hotel) firstDay.items.push({ kind: "checkin", hotel, time: clock(arrive), slot: slotOf(arrive) });
        buckets.get(city.dayStart)!.start = arrive + 30;
        used = (arrive + 30 - DAY_START) / 60;
      }
    }

    // Mekanları günlere dağıt (sıralı, kapasite dolunca ertesi gün)
    let day = firstActivityDay;
    if (day !== city.dayStart) used = 0;
    for (const place of nearestNeighbor(hotel?.coordinates ?? city.center, city.places)) {
      const need = place.recommendedDuration + TRAVEL_OVERHEAD_HOURS;
      if (used > 0 && used + need > HOURS_PER_DAY + 0.5 && day < city.dayEnd) {
        day++;
        used = 0;
      }
      buckets.get(day)!.places.push(place);
      used += need;
    }
  });

  // Saatler + öğün yerleşimi
  for (const d of days) {
    const bucket = buckets.get(d.day)!;
    let t = bucket.start;
    for (const { place, meal } of arrangeMeals(bucket.places)) {
      const leg = bucket.legs.get(place.id);
      t += leg?.minutes ?? 20;
      if (meal === "lunch") t = Math.max(t, LUNCH);
      if (meal === "dinner") t = Math.max(t, DINNER);
      d.items.push({ kind: "place", place, leg, time: clock(t), slot: slotOf(t) });
      t += place.recommendedDuration * 60 + BUFFER_MIN;
    }
    bucket.start = t;

    const onlyArrival = d.items.every((i) => i.kind === "arrival" || i.kind === "checkin");
    if (d.items.length === 0 || (onlyArrival && d.day !== 1)) {
      d.items.push({
        kind: "free",
        note: "explore",
        city: d.city,
        time: clock(10 * 60),
        slot: "morning",
      });
      bucket.start = 13 * 60;
    } else if (d.day === 1 && onlyArrival) {
      const evening = Math.max(19 * 60, toMinutes(d.items.at(-1)!.time) + 60);
      // Geç varışta (21:30 sonrası) akşam önerisi yok: sadece yerleş ve dinlen
      if (evening > 21 * 60 + 30) continue;
      d.items.push({
        kind: "free",
        note: "arrival",
        city: d.city,
        time: clock(evening),
        slot: slotOf(evening),
      });
    }
  }

  // Son gün: dönüş
  const last = days.at(-1)!;
  let t = Math.max(buckets.get(last.day)!.start, 16 * 60);
  if (returnTransfer) {
    last.items.push({ kind: "transfer", transfer: returnTransfer, time: clock(t), slot: slotOf(t) });
    t += returnTransfer.minutes + 30;
  }
  t = Math.max(t, 18 * 60);
  last.items.push({ kind: "departure", flight, time: clock(t), slot: slotOf(t) });

  return days;
}
