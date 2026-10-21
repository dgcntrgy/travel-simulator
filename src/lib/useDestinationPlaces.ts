import { useEffect, useMemo, useState } from "react";
import { getPlacesForDestination } from "@/data/mockPlaces";
import { discoverLivePlaces, peekLivePlaces } from "@/lib/globalDiscovery";
import type { Airport, Place } from "@/types/trip";

export type LiveStatus = "loading" | "ready" | "error";

/** Sabit referans: bağımlılık dizilerinde her render'da yeni dizi oluşmasın */
const NO_PLACES: Place[] = [];

interface LiveState {
  /** `${code}:${attempt}` — sonuç hangi isteğe ait */
  key: string;
  places: Place[];
  status: LiveStatus;
}

/**
 * Seçili hedefin mekanları: kürasyonlu kartlar + canlı Wikipedia keşfi (arka planda yüklenir).
 * `retry()` hata sonrası yeniden dener.
 */
export function useDestinationPlaces(destination: Airport) {
  const curated = useMemo(() => getPlacesForDestination(destination.code), [destination.code]);
  const [attempt, setAttempt] = useState(0);
  const key = `${destination.code}:${attempt}`;
  const [live, setLive] = useState<LiveState>(() => {
    const peeked = peekLivePlaces(destination.code);
    return { key, places: peeked ?? [], status: peeked ? "ready" : "loading" };
  });

  useEffect(() => {
    let active = true;
    const requestKey = `${destination.code}:${attempt}`;
    discoverLivePlaces(destination)
      .then((places) => active && setLive({ key: requestKey, places, status: "ready" }))
      .catch(() => active && setLive({ key: requestKey, places: NO_PLACES, status: "error" }));
    return () => {
      active = false;
    };
  }, [destination, attempt]);

  // Hedef değişti / yeniden deneniyor ama yanıt henüz gelmedi: eski sonucu gösterme
  const livePlaces = live.key === key ? live.places : NO_PLACES;
  const liveStatus: LiveStatus = live.key === key ? live.status : "loading";
  const places = useMemo(() => [...curated, ...livePlaces], [curated, livePlaces]);

  return {
    places,
    curatedCount: curated.length,
    liveCount: livePlaces.length,
    liveStatus,
    retry: () => setAttempt((a) => a + 1),
  };
}
