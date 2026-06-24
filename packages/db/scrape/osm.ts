/**
 * OpenStreetMap scrapers for De Vrije Hond spot categories.
 *
 * Queries the public Overpass API (keyless) for dog-relevant POIs across the
 * Netherlands and writes one JSON data file per category into ../data, in the
 * same `RawPoi` shape the seeder consumes (mirrors data/losloopgebieden.json).
 *
 * Run a single category:   pnpm --filter @devrijehond/db scrape:osm drinking-point
 * Run all configured:      pnpm --filter @devrijehond/db scrape:osm
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
  osmId: string;
  osmTags: Record<string, string>;
};

type CategoryConfig = {
  /** output file under ../data */
  file: string;
  /** Overpass selector body (uses `area.nl`); include node/way/relation as needed */
  selector: string;
  /** fallback display name when the OSM element has no name tag */
  defaultName: string;
};

// Tag selections per category. dog=yes/leashed/outside marks dog-friendly horeca.
const CONFIGS: Record<string, CategoryConfig> = {
  'drinking-point': {
    file: 'drinkpunten.json',
    defaultName: 'Drinkwaterpunt',
    selector: `
      node["amenity"="drinking_water"](area.nl);
      way["amenity"="drinking_water"](area.nl);
    `,
  },
  shop: {
    file: 'winkels.json',
    defaultName: 'Dierenwinkel',
    selector: `
      node["shop"="pet"](area.nl);
      way["shop"="pet"](area.nl);
    `,
  },
  horeca: {
    file: 'horeca.json',
    defaultName: 'Hondvriendelijke horeca',
    selector: `
      node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|biergarten)$"]["dog"~"^(yes|leashed|outside)$"](area.nl);
      way["amenity"~"^(cafe|restaurant|bar|pub|fast_food|biergarten)$"]["dog"~"^(yes|leashed|outside)$"](area.nl);
    `,
  },
  'swim-beach': {
    file: 'zwemstranden.json',
    defaultName: 'Hondenstrand',
    selector: `
      node["natural"="beach"]["dog"~"^(yes|leashed)$"](area.nl);
      way["natural"="beach"]["dog"~"^(yes|leashed)$"](area.nl);
      node["leisure"="beach_resort"]["dog"~"^(yes|leashed)$"](area.nl);
    `,
  },
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
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

function normalise(el: OverpassElement, cfg: CategoryConfig): RawPoi | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const tags = el.tags ?? {};
  const name = tags.name ?? tags['name:nl'] ?? cfg.defaultName;
  const addrParts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean);
  const address = addrParts.length ? addrParts.join(' ') : null;
  return {
    source: 'osm',
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    name,
    town: tags['addr:city'] ?? null,
    province: null,
    address,
    lat,
    lng,
    description: tags.description ?? null,
    osmId: `${el.type}/${el.id}`,
    osmTags: tags,
  };
}

async function scrape(category: string): Promise<void> {
  const cfg = CONFIGS[category];
  if (!cfg) {
    throw new Error(`Unknown category "${category}". Known: ${Object.keys(CONFIGS).join(', ')}`);
  }
  const query = `[out:json][timeout:240];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
(${cfg.selector});
out center tags;`;

  console.log(`▸ ${category}: querying Overpass…`);
  const elements = await runOverpass(query);
  const records = elements.map((e) => normalise(e, cfg)).filter((r): r is RawPoi => r !== null);

  // De-dup by OSM id (a node + its way can rarely coincide).
  const byId = new Map<string, RawPoi>();
  for (const r of records) byId.set(r.osmId, r);
  const out = [...byId.values()];

  const path = new URL(`../data/${cfg.file}`, import.meta.url);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`  ${out.length} records -> data/${cfg.file}`);
}

async function main() {
  const arg = process.argv[2];
  const categories = arg ? [arg] : Object.keys(CONFIGS);
  for (const c of categories) {
    await scrape(c);
  }
  console.log('✓ done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
