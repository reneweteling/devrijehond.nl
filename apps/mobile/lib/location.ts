/**
 * User location + distance helpers. Foreground permission is requested lazily
 * the first time a screen needs it (the Nearby list, the vote proximity proof).
 * Everything fails soft: no permission → no location → screens just omit
 * distance instead of breaking.
 */

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type LatLng = { lat: number; lng: number };

/** One-shot current position (or null when unavailable / denied). */
export function useUserLocation(): LatLng | null {
  const [loc, setLoc] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* permission denied / location off, leave null */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return loc;
}

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Human distance: "350 m" under a km, otherwise "1,2 km" (Dutch decimal comma). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
