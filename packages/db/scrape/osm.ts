/**
 * OpenStreetMap scrapers for De Vrije Hond spot categories.
 *
 * Queries the public Overpass API (keyless) for dog-relevant POIs across a
 * country and writes one JSON data file per category into ../data, in the same
 * `RawPoi` shape the seeder consumes (mirrors data/losloopgebieden.json).
 *
 * Country is selected with `--country <cc>` (ISO 3166-1 alpha-2, default `nl`).
 * Non-NL output is written with a country prefix (`be-drinkpunten.json`), so the
 * curated NL files stay put.
 *
 * Run a single category:   pnpm --filter @devrijehond/db scrape:osm drinking-point
 * Run all configured:      pnpm --filter @devrijehond/db scrape:osm
 * Belgium, all categories:  pnpm --filter @devrijehond/db scrape:osm --country be
 *
 * Output records keep the OSM id + tags + a sourceUrl so a spot's rawData can be
 * re-checked / refreshed later. Coordinates are decimal degrees (lat/lng).
 */
import { writeFileSync } from 'node:fs';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// Identify ourselves; several mirrors (Cloudflare-fronted) reject the default
// Node fetch User-Agent with 403/406.
const UA = 'DeVrijeHond-scraper/1.0 (+https://devrijehond.nl; rene@weteling.com)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RawPoi = {
  source: 'osm';
  sourceUrl: string;
  name: string;
  town: string | null;
  province: string | null;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  phone: string | null;
  website: string | null;
  osmId: string;
  osmTags: Record<string, string>;
  // Off-leash areas (dog_park) carry a polygon ring + the flags the seeder reads
  // off RawLosloop; POI categories leave these undefined.
  offLeash?: boolean;
  fenced?: boolean | null;
  geometry?: number[][]; // real [lng,lat] ring, from `out geom` on ways
};

type CategoryConfig = {
  /** output file under ../data (country-prefixed for non-NL) */
  file: string;
  /** Overpass selector body (uses `area.region`); include node/way/relation as needed */
  selector: string;
  /** fallback display name when the OSM element has no name tag */
  defaultName: string;
  /** emit polygon geometry (`out geom`) instead of centroids (`out center`) */
  geom?: boolean;
  /** mark records as off-leash areas (adds offLeash/fenced for the seeder) */
  offLeash?: boolean;
};

// Tag selections per category. dog=yes/leashed/outside marks dog-friendly horeca.
const CONFIGS: Record<string, CategoryConfig> = {
  'drinking-point': {
    file: 'drinkpunten.json',
    defaultName: 'Drinkwaterpunt',
    selector: `
      node["amenity"="drinking_water"](area.region);
      way["amenity"="drinking_water"](area.region);
    `,
  },
  shop: {
    file: 'winkels.json',
    defaultName: 'Dierenwinkel',
    selector: `
      node["shop"="pet"](area.region);
      way["shop"="pet"](area.region);
    `,
  },
  horeca: {
    file: 'horeca.json',
    defaultName: 'Hondvriendelijke horeca',
    selector: `
      node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|biergarten)$"]["dog"~"^(yes|leashed|outside)$"](area.region);
      way["amenity"~"^(cafe|restaurant|bar|pub|fast_food|biergarten)$"]["dog"~"^(yes|leashed|outside)$"](area.region);
    `,
  },
  'swim-beach': {
    file: 'zwemstranden.json',
    defaultName: 'Hondenstrand',
    selector: `
      node["natural"="beach"]["dog"~"^(yes|leashed)$"](area.region);
      way["natural"="beach"]["dog"~"^(yes|leashed)$"](area.region);
      node["leisure"="beach_resort"]["dog"~"^(yes|leashed)$"](area.region);
    `,
  },
  vet: {
    file: 'dierenartsen.json',
    defaultName: 'Dierenarts',
    selector: `
      node["amenity"="veterinary"](area.region);
      way["amenity"="veterinary"](area.region);
    `,
  },
  'off-leash': {
    // Its own filename, never the curated `losloopgebieden.json` (doggydating),
    // so an all-categories run can't overwrite hand-curated off-leash data.
    file: 'osm-dogparks.json',
    defaultName: 'Hondenlosloopzone',
    geom: true,
    offLeash: true,
    selector: `
      node["leisure"="dog_park"](area.region);
      way["leisure"="dog_park"](area.region);
      relation["leisure"="dog_park"](area.region);
      way["dog"="unleashed"](area.region);
      relation["dog"="unleashed"](area.region);
    `,
  },
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};

async function runOverpass(query: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  // A few rounds across the mirrors; back off on 429/5xx (rate limit / busy).
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA,
            Accept: 'application/json',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(240_000),
        });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`Overpass ${res.status} (busy) at ${endpoint}`);
        }
        if (!res.ok) throw new Error(`Overpass ${res.status} at ${endpoint}`);
        const json = (await res.json()) as { elements: OverpassElement[] };
        return json.elements ?? [];
      } catch (e) {
        lastErr = e;
        console.warn(`  endpoint failed (${endpoint}):`, (e as Error).message);
      }
    }
    const wait = 5_000 * (attempt + 1);
    console.warn(`  all mirrors failed, backing off ${wait / 1000}s…`);
    await sleep(wait);
  }
  throw lastErr;
}

// A closed way from `out geom` yields a ring [{lat,lon}...]; turn it into the
// [lng,lat] ring the seeder stores as a PostGIS polygon, plus its centroid so
// lat/lng still mirror the shape. Returns null for anything that can't be a
// polygon ring: an open way (dog=unleashed paths are lines, not areas) or a
// degenerate ring. Self-intersecting-but-closed rings still pass here; the
// seeder repairs those with ST_MakeValid.
function ringFromGeometry(
  geometry: { lat: number; lon: number }[],
): { ring: number[][]; lat: number; lng: number } | null {
  if (!geometry || geometry.length < 3) return null;
  const ring = geometry.map((p) => [p.lon, p.lat]);
  // A GeoJSON polygon ring must be closed. Only close a ring that is nearly
  // closed already (a real area whose first/last node coincide in OSM but got
  // dropped); an open line (start far from end) is not an area -> reject it.
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return null;
  const x0 = first[0];
  const y0 = first[1];
  const xn = last[0];
  const yn = last[1];
  if (x0 === undefined || y0 === undefined || xn === undefined || yn === undefined) return null;
  if (x0 !== xn || y0 !== yn) {
    const closed = Math.abs(x0 - xn) < 1e-7 && Math.abs(y0 - yn) < 1e-7;
    if (!closed) return null;
    ring.push([x0, y0]);
  }
  // Need >= 4 positions for a closed ring (triangle = A,B,C,A).
  if (ring.length < 4) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const p of geometry) {
    sumLat += p.lat;
    sumLng += p.lon;
  }
  return { ring, lat: sumLat / geometry.length, lng: sumLng / geometry.length };
}

function normalise(el: OverpassElement, cfg: CategoryConfig): RawPoi | null {
  let lat = el.lat ?? el.center?.lat;
  let lng = el.lon ?? el.center?.lon;
  let geometry: number[][] | undefined;

  if (cfg.geom) {
    // Ways carry a `geometry` ring; relations only a bounds box -> use its
    // centre and let the seeder draw a fallback circle (no ring).
    const g = el.geometry ? ringFromGeometry(el.geometry) : null;
    if (g) {
      geometry = g.ring;
      lat = g.lat;
      lng = g.lng;
    } else if (el.bounds) {
      lat = (el.bounds.minlat + el.bounds.maxlat) / 2;
      lng = (el.bounds.minlon + el.bounds.maxlon) / 2;
    }
  }

  if (lat == null || lng == null) return null;
  const tags = el.tags ?? {};
  const name = tags.name ?? tags['name:nl'] ?? cfg.defaultName;
  const addrParts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean);
  const address = addrParts.length ? addrParts.join(' ') : null;
  const rec: RawPoi = {
    source: 'osm',
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    name,
    town: tags['addr:city'] ?? null,
    province: null,
    address,
    lat,
    lng,
    description: tags.description ?? null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    osmId: `${el.type}/${el.id}`,
    osmTags: tags,
  };
  if (cfg.offLeash) {
    rec.offLeash = true;
    // `barrier=fence` or `fence=yes`/`fenced=yes` on the area marks it enclosed.
    rec.fenced =
      tags.barrier === 'fence' || tags.fence === 'yes' || tags.fenced === 'yes' ? true : null;
    if (geometry) rec.geometry = geometry;
  }
  return rec;
}

async function scrape(category: string, country: string): Promise<void> {
  const cfg = CONFIGS[category];
  if (!cfg) {
    throw new Error(`Unknown category "${category}". Known: ${Object.keys(CONFIGS).join(', ')}`);
  }
  const cc = country.toUpperCase();
  const query = `[out:json][timeout:240];
area["ISO3166-1"="${cc}"][admin_level=2]->.region;
(${cfg.selector});
out ${cfg.geom ? 'geom' : 'center'} tags;`;

  console.log(`▸ ${category} (${cc}): querying Overpass…`);
  const elements = await runOverpass(query);
  const records = elements.map((e) => normalise(e, cfg)).filter((r): r is RawPoi => r !== null);

  // De-dup by OSM id (a node + its way can rarely coincide).
  const byId = new Map<string, RawPoi>();
  for (const r of records) byId.set(r.osmId, r);
  const out = [...byId.values()];

  // NL keeps the bare filename; other countries get a `<cc>-` prefix so curated
  // NL data files are never clobbered by a cross-border run.
  const outFile = country === 'nl' ? cfg.file : `${country}-${cfg.file}`;
  const path = new URL(`../data/${outFile}`, import.meta.url);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`  ${out.length} records -> data/${outFile}`);
}

// Parse `--country <cc>` out of argv; the remaining positional is the category.
function parseArgs(argv: string[]): { category?: string; country: string } {
  let country = 'nl';
  let category: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--country') {
      country = (argv[++i] ?? 'nl').toLowerCase();
    } else if (!category) {
      category = argv[i];
    }
  }
  return { category, country };
}

async function main() {
  const { category, country } = parseArgs(process.argv.slice(2));
  const categories = category ? [category] : Object.keys(CONFIGS);
  for (const c of categories) {
    await scrape(c, country);
  }
  console.log('✓ done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
