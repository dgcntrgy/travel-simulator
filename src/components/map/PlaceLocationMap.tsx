"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { CATEGORY_META } from "@/data/mockPlaces";
import { useTripStore } from "@/store/useTripStore";
import { cn } from "@/lib/cn";
import type { Place } from "@/types/trip";

/** WorldMap ile aynı ücretsiz OSM katmanı; karanlık temada karo panosuna doğrudan CSS filtresi uygulanır */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png?v=2";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DARK_TILE_FILTER = "invert(100%) hue-rotate(190deg) saturate(140%) brightness(88%) contrast(85%)";

/**
 * Detay penceresi için tek pinli küçük konum haritası.
 * Sürüklenebilir; tekerlekle yakınlaştırma kapalı (pencere içi kaydırmayı bozmasın).
 */
export default function PlaceLocationMap({ place, className }: { place: Place; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTripStore((s) => s.theme);

  useEffect(() => {
    if (!containerRef.current) return;
    const [lng, lat] = place.coordinates;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      minZoom: 3,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const pin = document.createElement("div");
    pin.className = `place-pin place-pin--${place.category} is-selected`;
    pin.innerHTML = `<span class="place-pin__pulse"></span><span class="place-pin__body"></span>`;
    pin.style.setProperty("--pin-color", CATEGORY_META[place.category].color);
    L.marker([lat, lng], {
      icon: L.divIcon({ html: pin, className: "map-divicon", iconSize: [30, 30], iconAnchor: [15, 15] }),
      keyboard: false,
    }).addTo(map);

    // Pencere açılış animasyonu bitince boyutu yeniden ölç
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(containerRef.current);

    return () => {
      resize.disconnect();
      map.remove();
    };
  }, [place.coordinates, place.category]);

  // Harita yeniden kurulsa da (yeni mekan) tema filtresi karo panosunda kalsın
  useEffect(() => {
    const tilePane = containerRef.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (tilePane) tilePane.style.filter = theme === "dark" ? DARK_TILE_FILTER : "none";
  }, [theme, place.coordinates]);

  return <div ref={containerRef} className={cn("overflow-hidden", className)} />;
}
