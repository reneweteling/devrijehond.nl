/**
 * Forward geocoding for the search box: turn a typed place, street or address
 * ("Utrecht", "Kerkstraat Hilversum") into coordinates so the map can fly there.
 *
 * Calls our own /api/v1/geocode proxy (a keyless OSM geocoder server-side) so
 * results match Google-style place search, instead of the device geocoder which
 * returned poor matches for plain city names. Fails soft to [].
 */

import { API_URL } from './config';

export type GeoResult = { label: string; lat: number; lng: number };

export async function geocodePlace(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`${API_URL}/api/v1/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: GeoResult[] };
    return body.items ?? [];
  } catch {
    return [];
  }
}
