/**
 * Forward geocoding for the search box: turn a typed address, street or place
 * ("Kerkstraat Hilversum", "Vondelpark", "Hilversum") into coordinates so the
 * map can fly there, even when no spot matches. Uses expo-location's built-in
 * geocoder (Apple on iOS, Google Play services on Android); no API key. Each hit
 * is reverse-geocoded to a readable "Street, City" label. Fails soft to [].
 */

import * as Location from 'expo-location';

export type GeoResult = { label: string; lat: number; lng: number };

async function labelFor(lat: number, lng: number, fallback: string): Promise<string> {
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!p) return fallback;
    const line1 = [p.street, p.streetNumber].filter(Boolean).join(' ');
    const line2 = p.city ?? p.subregion ?? p.region ?? p.country ?? '';
    const label = [line1, line2].filter(Boolean).join(', ');
    return label || fallback;
  } catch {
    return fallback;
  }
}

/** Up to 3 matches for the query, each with a readable address label. */
export async function geocodePlace(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const results = (await Location.geocodeAsync(q)).slice(0, 3);
    return Promise.all(
      results.map(async (r) => ({
        label: await labelFor(r.latitude, r.longitude, q),
        lat: r.latitude,
        lng: r.longitude,
      })),
    );
  } catch {
    return [];
  }
}
