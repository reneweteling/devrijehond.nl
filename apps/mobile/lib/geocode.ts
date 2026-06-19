/**
 * Forward geocoding for the search box: turn a typed place ("Hilversum",
 * "Vondelpark Amsterdam") into coordinates so the map can fly there, even when
 * there's no matching spot. Uses expo-location's built-in geocoder (Apple on
 * iOS, Google Play services on Android); no API key. Fails soft to null.
 */

import * as Location from 'expo-location';

export type GeoResult = { label: string; lat: number; lng: number };

export async function geocodePlace(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    const results = await Location.geocodeAsync(q);
    const first = results[0];
    if (!first) return null;
    return { label: q, lat: first.latitude, lng: first.longitude };
  } catch {
    return null;
  }
}
