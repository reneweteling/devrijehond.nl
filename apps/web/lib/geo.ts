import type { SubmitSpotRequestDto } from '@devrijehond/types';

/**
 * Geometry helpers — normalise the several submit-geometry forms into a single
 * GeoJSON geometry (WGS84, [lng, lat] order) plus a centroid the API mirrors
 * into the `lat`/`lng` columns for cheap list rendering.
 *
 * The submit DTO accepts EITHER:
 *   - `geometry`: a GeoJSON Point / Polygon, OR
 *   - `point` ({lat,lng}) for a POI, OR
 *   - `polygon` ([{lat,lng}, …]) for a REGION (the API closes the ring).
 *
 * The PostGIS insert uses `ST_SetSRID(ST_GeomFromGeoJSON($geojson), 4326)`.
 */

export interface GeoJsonGeometry {
  type: 'Point' | 'Polygon';
  coordinates: unknown;
}

export interface NormalisedGeometry {
  geojson: GeoJsonGeometry;
  lat: number;
  lng: number;
}

type LatLng = { lat: number; lng: number };

/** Average a ring of [lng,lat] points into a rough centroid. */
function ringCentroid(coords: Array<[number, number]>): { lat: number; lng: number } {
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  const n = coords.length || 1;
  return { lng: sumLng / n, lat: sumLat / n };
}

/**
 * Normalise a submit/update body's geometry into GeoJSON + centroid.
 * Returns `null` when no geometry was supplied (used on PATCH where geometry
 * is optional). Throws on a structurally invalid geometry.
 */
export function normaliseGeometry(
  body: Pick<SubmitSpotRequestDto, 'geometry' | 'point' | 'polygon'>,
): NormalisedGeometry | null {
  // 1. Raw GeoJSON form.
  if (body.geometry) {
    const g = body.geometry as GeoJsonGeometry;
    if (g.type === 'Point') {
      const c = g.coordinates as [number, number];
      if (!Array.isArray(c) || c.length < 2) throw new Error('Invalid Point coordinates.');
      return { geojson: g, lat: c[1], lng: c[0] };
    }
    if (g.type === 'Polygon') {
      const rings = g.coordinates as Array<Array<[number, number]>>;
      const outer = rings?.[0];
      if (!Array.isArray(outer) || outer.length < 3) throw new Error('Invalid Polygon ring.');
      const c = ringCentroid(outer);
      return { geojson: g, lat: c.lat, lng: c.lng };
    }
    throw new Error('Unsupported geometry type.');
  }

  // 2. Friendly POI point.
  if (body.point) {
    const p = body.point as LatLng;
    return {
      geojson: { type: 'Point', coordinates: [p.lng, p.lat] },
      lat: p.lat,
      lng: p.lng,
    };
  }

  // 3. Friendly REGION polygon (lat/lng ring) — close the ring if open.
  if (body.polygon && body.polygon.length >= 3) {
    const pts = body.polygon as LatLng[];
    const ring: Array<[number, number]> = pts.map((p) => [p.lng, p.lat]);
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
    const c = ringCentroid(ring);
    return {
      geojson: { type: 'Polygon', coordinates: [ring] },
      lat: c.lat,
      lng: c.lng,
    };
  }

  return null;
}

/** Metres between two WGS84 points (haversine) — used by the proximity gate. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Proximity gate radius (metres). A voter within this range is `proximityVerified`. */
export const PROXIMITY_RADIUS_M = 500;
