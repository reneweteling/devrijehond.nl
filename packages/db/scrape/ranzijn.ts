/**
 * Ranzijn store-locator scraper.
 *
 * Ranzijn (pet/garden chain) exposes two clean JSON endpoints used by their
 * store-locator: stores and in-store veterinarians, each with coordinates +
 * address. We map stores -> `shop` and veterinarians -> `vet`, in the same
 * `RawPoi` shape the seeder consumes.
 *
 *   pnpm --filter @devrijehond/db scrape:ranzijn
 */
import { writeFileSync } from 'node:fs';

const UA = 'DeVrijeHond-scraper/1.0 (+https://devrijehond.nl; rene@weteling.com)';

type RawPoi = {
  source: 'ranzijn';
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
};

type Retailer = {
  retailer_id: number | string;
  url_key: string;
  location_type: string;
  street: string | null;
  zipcode: string | null;
  city: string | null;
  display_name: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
};

async function fetchJson(path: string): Promise<Retailer[]> {
  const res = await fetch(`https://www.ranzijn.nl${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ranzijn ${res.status} at ${path}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? []);
}

function toPoi(r: Retailer, urlSegment: string): RawPoi | null {
  if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
  const addr = [r.street].filter(Boolean).join(' ') || null;
  // The Ranzijn store page is the closest thing to a per-location website.
  const storeUrl = `https://www.ranzijn.nl/winkels/${r.url_key}`;
  return {
    source: 'ranzijn',
    sourceUrl: `https://www.ranzijn.nl/${urlSegment}/${r.url_key}`,
    name: r.display_name,
    town: r.city ?? null,
    province: null,
    address: addr,
    lat: r.latitude,
    lng: r.longitude,
    description: null,
    phone: r.phone ?? null,
    website: storeUrl,
  };
}

async function main() {
  const [stores, vets] = await Promise.all([
    fetchJson('/api/retailers'),
    fetchJson('/api/veterinarians'),
  ]);

  const shops = stores.map((r) => toPoi(r, 'winkels')).filter((r): r is RawPoi => r !== null);
  const dierenartsen = vets
    .map((r) => toPoi(r, 'dierenarts'))
    .filter((r): r is RawPoi => r !== null);
  // Every Ranzijn location with a vet also has a dog wash, so the wash POIs are
  // the same locations under the wash category.
  const wasstraten = vets
    .map((r) => toPoi(r, 'dierenarts'))
    .filter((r): r is RawPoi => r !== null)
    .map((p) => ({ ...p, description: 'Hondenwasstraat bij Ranzijn.' }));

  writeFileSync(
    new URL('../data/ranzijn-winkels.json', import.meta.url),
    JSON.stringify(shops, null, 2),
  );
  writeFileSync(
    new URL('../data/ranzijn-dierenartsen.json', import.meta.url),
    JSON.stringify(dierenartsen, null, 2),
  );
  writeFileSync(
    new URL('../data/ranzijn-wasstraat.json', import.meta.url),
    JSON.stringify(wasstraten, null, 2),
  );
  console.log(`✓ ranzijn: ${shops.length} winkels -> ranzijn-winkels.json`);
  console.log(`✓ ranzijn: ${dierenartsen.length} dierenartsen -> ranzijn-dierenartsen.json`);
  console.log(`✓ ranzijn: ${wasstraten.length} wasstraten -> ranzijn-wasstraat.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
