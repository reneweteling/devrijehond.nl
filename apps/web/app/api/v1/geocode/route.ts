import type { NextRequest } from 'next/server';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/geocode?q=...  — public, anonymous, CDN-cacheable.
 *
 * Forward geocoding for the app's location search: turn a typed place / street /
 * address into coordinates so the map can fly there. Proxies a keyless OSM
 * geocoder (Photon) server-side and returns a small, ranked list. Biased to the
 * Netherlands. This is the PRIMARY search source; matching spots in our own DB
 * are layered on top client-side as a secondary highlight.
 *
 * Kept server-side so the provider (and any future Google Geocoding key) is a
 * single swap point, and so responses are cacheable at the edge.
 */
export const runtime = 'nodejs';

// Centre of NL — Photon `lat`/`lon` bias the ranking toward local results.
const NL_BIAS = { lat: 52.13, lon: 5.29 };

type PhotonFeature = {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    osm_value?: string;
  };
  geometry: { coordinates: [number, number] }; // [lng, lat]
};

export type GeocodeHit = { label: string; lat: number; lng: number };

function labelOf(p: PhotonFeature['properties']): string {
  const line1 = [p.street ?? p.name, p.housenumber].filter(Boolean).join(' ');
  // Avoid repeating the name when it equals the city (e.g. "Utrecht, Utrecht").
  const parts = [line1, p.postcode, p.city, p.state].filter(
    (x, i, a): x is string => Boolean(x) && a.indexOf(x) === i,
  );
  const label = parts.join(', ');
  return label || (p.name ?? '');
}

export async function GET(request: NextRequest) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return ok({ items: [] as GeocodeHit[] });

  // Photon only supports a few UI languages (de/en/fr/it), not nl — passing
  // lang=nl 400s. Default language is fine; the lat/lon bias keeps NL on top.
  const url =
    `https://photon.komoot.io/api?q=${encodeURIComponent(q)}` +
    `&limit=6&lat=${NL_BIAS.lat}&lon=${NL_BIAS.lon}`;

  let data: { features?: PhotonFeature[] };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DeVrijeHond/1.0 (+https://www.devrijehond.nl)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    data = (await res.json()) as { features?: PhotonFeature[] };
  } catch (e) {
    return error('GEOCODE_FAILED', 'Geocoding is tijdelijk niet beschikbaar.', {
      status: 502,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  const seen = new Set<string>();
  const items: GeocodeHit[] = [];
  for (const f of data.features ?? []) {
    // Prefer NL results but don't hard-drop others (border towns etc.).
    const label = labelOf(f.properties);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const [lng, lat] = f.geometry.coordinates;
    items.push({ label, lat, lng });
    if (items.length >= 5) break;
  }

  return ok({ items });
}
