/**
 * Deterministic, content-rich seed for De Vrije Hond.
 *
 * Ensures the PostGIS extension, then seeds taxonomy (categories + amenities),
 * an admin, a handful of community users, and a realistic set of Dutch dog
 * spots: off-leash areas + swim beaches as polygons, and horeca / wash / shop /
 * drinking-point POIs spread across NL. Spots carry amenities, photos uploaded
 * to S3, community votes (so some reach VERIFIED), and reviews.
 *
 * Images are downloaded from stable Unsplash CDN URLs, resized to max 1600px
 * via sharp, and uploaded to S3 once per unique source URL (cached). The
 * resulting SpotPhoto.url always points at S3_PUBLIC_BASE_URL, never an
 * external hotlink or local path.
 *
 * Re-runnable: wipes spots + community users first, then rebuilds. Uses the raw
 * `db` client (policies bypassed), seeding is a system action.
 */

// Remap S3_* env vars to AWS SDK defaults before any import touches the SDK.
if (process.env.S3_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
}
if (process.env.S3_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
}
if (process.env.S3_REGION) {
  process.env.AWS_REGION = process.env.S3_REGION;
}

import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Pool } from 'pg';
import sharp from 'sharp';
import { uploadObject } from '@devrijehond/s3';
import { db } from './src/client';
import { tallyVotesLike } from './seed-helpers';

const ADMIN_EMAIL = 'rene@weteling.com';

// ---------------------------------------------------------------------------
// Imported dog off-leash areas. Scraped from public directories (doggydating
// + others) into packages/db/data/losloopgebieden.json. Each record keeps its
// sourceUrl so the spot's rawData can be re-checked / refreshed later.
// ---------------------------------------------------------------------------
type RawLosloop = {
  source: string;
  sourceUrl: string;
  name: string;
  town: string | null;
  province: string | null;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  offLeash: boolean | null;
  water: boolean | null;
  parking: boolean | null;
  fenced: boolean | null;
  osmId?: string;
  osmTags?: Record<string, string>;
  geometry?: number[][]; // real [lng,lat] polygon ring (OSM); else circle from centroid
};
const LOSLOOP: RawLosloop[] = JSON.parse(
  readFileSync(new URL('./data/losloopgebieden.json', import.meta.url), 'utf8'),
);

// ---------------------------------------------------------------------------
// Scraped POI categories (OSM via scrape/osm.ts). Each file is optional; a
// missing one just means that category isn't seeded yet. Shape mirrors RawPoi
// in scrape/osm.ts.
// ---------------------------------------------------------------------------
type RawPoi = {
  source: string;
  sourceUrl: string;
  name: string;
  town: string | null;
  province: string | null;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  osmId?: string;
  osmTags?: Record<string, string>;
  geometry?: number[][]; // POIs have none; present for union compatibility
};

function loadPoiFile(file: string): RawPoi[] {
  const url = new URL(`./data/${file}`, import.meta.url);
  if (!existsSync(url)) return [];
  return JSON.parse(readFileSync(url, 'utf8')) as RawPoi[];
}

// category slug -> scraped data file. Add entries as scrapers land.
const POI_SOURCES: { category: string; file: string; descFallback: string }[] = [
  {
    category: 'drinking-point',
    file: 'drinkpunten.json',
    descFallback: 'Drinkwaterpunt waar je hond kan drinken.',
  },
];

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    slug: 'off-leash',
    label: 'Losloopgebied',
    type: 'REGION',
    icon: 'pawprint.fill',
    color: '#6E7B33',
  },
  {
    slug: 'swim-beach',
    label: 'Zwemstrand',
    type: 'REGION',
    icon: 'beach.umbrella.fill',
    color: '#C9A24B',
  },
  {
    slug: 'horeca',
    label: 'Hondvriendelijke horeca',
    type: 'POI',
    icon: 'cup.and.saucer.fill',
    color: '#C2762E',
  },
  { slug: 'wash', label: 'Was- / spoelplek', type: 'POI', icon: 'drop.fill', color: '#4F7A86' },
  { slug: 'shop', label: 'Winkel', type: 'POI', icon: 'bag.fill', color: '#8A6BA0' },
  {
    slug: 'drinking-point',
    label: 'Drinkpunt',
    type: 'POI',
    icon: 'spigot.fill',
    color: '#6E7A82',
  },
] as const;

const AMENITIES = [
  { slug: 'water-bowl', label: 'Waterbak', icon: 'bowl.fill' },
  { slug: 'treats', label: 'Snoepjes', icon: 'pawprint.fill' },
  { slug: 'indoor-ok', label: 'Binnen ok', icon: 'house.fill' },
  { slug: 'terrace', label: 'Terras', icon: 'sun.umbrella.fill' },
  { slug: 'fenced', label: 'Omheind', icon: 'square.dashed' },
  { slug: 'parking', label: 'Parkeren', icon: 'parkingsign' },
  { slug: 'shade', label: 'Schaduw', icon: 'tree.fill' },
  { slug: 'free', label: 'Gratis', icon: 'eurosign.circle' },
] as const;

// Which amenities make sense per category (drives the category-scoped form).
const AMENITIES_BY_CATEGORY: Record<string, string[]> = {
  'off-leash': ['fenced', 'shade', 'water-bowl', 'parking', 'free'],
  'swim-beach': ['shade', 'parking', 'free', 'water-bowl'],
  horeca: ['water-bowl', 'treats', 'indoor-ok', 'terrace'],
  wash: ['parking', 'free'],
  shop: ['treats', 'indoor-ok', 'parking'],
  'drinking-point': ['water-bowl', 'free', 'shade'],
};

// ---------------------------------------------------------------------------
// Category → source image pool (all curl-verified HTTP 200 + image/jpeg).
// 2-3 per category. Each unique URL is uploaded to S3 once and reused.
// ---------------------------------------------------------------------------

const CATEGORY_IMAGES: Record<string, string[]> = {
  'off-leash': [
    // Dog running free on a green meadow / park field
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1600&q=80&fm=jpg',
    // Dog in a forest / wooded path
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80&fm=jpg',
    // Wide open heathland / nature area
    'https://images.unsplash.com/photo-1444465693019-aa0b6392460d?w=1600&q=80&fm=jpg',
  ],
  'swim-beach': [
    // Sandy beach with clear water
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80&fm=jpg',
    // Coastal dunes and sea
    'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1600&q=80&fm=jpg',
    // Beach with waves
    'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1600&q=80&fm=jpg',
  ],
  horeca: [
    // Dog-friendly cafe interior
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&q=80&fm=jpg',
    // Cafe exterior / terrace
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80&fm=jpg',
    // Sunny outdoor terrace
    'https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=1600&q=80&fm=jpg',
  ],
  wash: [
    // Dog being bathed / groomed
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1600&q=80&fm=jpg',
    // Dog wash station
    'https://images.unsplash.com/photo-1523867574998-1a336b6ded04?w=1600&q=80&fm=jpg',
  ],
  shop: [
    // Pet shop / animal store
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1600&q=80&fm=jpg',
    // Dog with shopping / store
    'https://images.unsplash.com/photo-1582798358481-d199fb7347bb?w=1600&q=80&fm=jpg',
  ],
  'drinking-point': [
    // Dog drinking water
    'https://images.unsplash.com/photo-1504006833117-8886a355efbf?w=1600&q=80&fm=jpg',
    // Dog at water bowl / fountain
    'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=1600&q=80&fm=jpg',
  ],
};

// ---------------------------------------------------------------------------
// Image upload helpers
// ---------------------------------------------------------------------------

/** Map from source URL → already-uploaded S3 public URL. */
const uploadedCache = new Map<string, string>();

/**
 * Download a source image, sharp-process it (max 1600px, JPEG Q80), and
 * upload it to S3. Returns the public URL. Throws on network/S3 error so
 * callers can decide whether to skip or abort.
 */
async function fetchAndUpload(sourceUrl: string): Promise<string> {
  const cached = uploadedCache.get(sourceUrl);
  if (cached) return cached;

  // Download
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${sourceUrl}`);
  const raw = Buffer.from(await res.arrayBuffer());

  // Resize + encode
  const processed = await sharp(raw)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const key = `spots/seed/${randomUUID()}.jpg`;
  const { publicUrl } = await uploadObject(key, processed, 'image/jpeg');

  uploadedCache.set(sourceUrl, publicUrl);
  return publicUrl;
}

/**
 * Attempt to upload a category-appropriate photo for a spot.
 * Returns the S3 public URL, or null if the upload fails (non-fatal).
 * Cycles through the category's source images using the spot index so
 * each consecutive spot in the same category uses a different source image.
 */
async function photoUrlForSpot(category: string, spotIndex: number): Promise<string | null> {
  const pool = CATEGORY_IMAGES[category];
  if (!pool || pool.length === 0) return null;
  const sourceUrl = pool[spotIndex % pool.length]!;
  try {
    return await fetchAndUpload(sourceUrl);
  } catch (err) {
    console.warn(`[seed] photo upload skipped for category=${category}: ${String(err)}`);
    return null;
  }
}

const MAPS_KEY = process.env.GOOGLE_STATIC_MAPS_API_KEY;
let warnedNoStreetviewKey = false;

/** Initial compass bearing from one coordinate to another, in degrees. */
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Fallback photo for a spot that has no real photo: a Google Street View ground
 * photo at its coordinates, uploaded to our own S3 bucket so the spot ends up
 * with a normal `photoUrl` we host. We first hit the (free) Street View metadata
 * endpoint to check there's actually a panorama nearby; if not, we return null
 * (no blank tile, no map). The camera is aimed from the nearest panorama toward
 * the spot. Google is only called here at seed time, never at runtime.
 */
async function streetViewPhotoForSpot(
  spotId: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!MAPS_KEY) {
    if (!warnedNoStreetviewKey) {
      console.warn('[seed] GOOGLE_STATIC_MAPS_API_KEY not set — skipping Street View fallbacks');
      warnedNoStreetviewKey = true;
    }
    return null;
  }
  try {
    // 1. Coverage check (free, doesn't count against quota).
    const metaUrl = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
    metaUrl.searchParams.set('location', `${lat},${lng}`);
    metaUrl.searchParams.set('key', MAPS_KEY);
    const metaRes = await fetch(metaUrl.toString(), { signal: AbortSignal.timeout(30_000) });
    const meta = (await metaRes.json()) as {
      status: string;
      location?: { lat: number; lng: number };
    };
    if (meta.status !== 'OK' || !meta.location) return null; // no panorama here

    // 2. Aim the camera from the panorama toward the spot, then fetch the image.
    const heading = bearing(meta.location, { lat, lng });
    const imgUrl = new URL('https://maps.googleapis.com/maps/api/streetview');
    imgUrl.searchParams.set('size', '640x400');
    imgUrl.searchParams.set('location', `${lat},${lng}`);
    imgUrl.searchParams.set('heading', heading.toFixed(0));
    imgUrl.searchParams.set('fov', '80');
    imgUrl.searchParams.set('pitch', '0');
    imgUrl.searchParams.set('return_error_code', 'true');
    imgUrl.searchParams.set('key', MAPS_KEY);
    const res = await fetch(imgUrl.toString(), { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = Buffer.from(await res.arrayBuffer());
    const processed = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const key = `spots/seed/streetview-${spotId}.jpg`;
    const { publicUrl } = await uploadObject(key, processed, 'image/jpeg');
    return publicUrl;
  } catch (err) {
    console.warn(`[seed] Street View fallback skipped for ${spotId}: ${String(err)}`);
    return null;
  }
}

/**
 * Second-choice fallback when a spot has no Street View coverage: a Google
 * Static Maps image at its coordinates, uploaded to our bucket. Satellite/hybrid
 * map types are blocked for EEA accounts, so this is a roadmap view, a moss
 * marker for POIs and the geofence outline for REGIONs.
 */
async function staticMapForSpot(
  spotId: string,
  lat: number,
  lng: number,
  type: 'POI' | 'REGION',
  geometry?: number[][],
): Promise<string | null> {
  if (!MAPS_KEY) return null;
  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const u = new URL('https://maps.googleapis.com/maps/api/staticmap');
  u.searchParams.set('center', center);
  u.searchParams.set('zoom', String(type === 'REGION' ? 15 : 16));
  u.searchParams.set('size', '640x400');
  u.searchParams.set('scale', '2');
  if (type === 'REGION' && geometry && geometry.length >= 4) {
    // geometry is GeoJSON [lng,lat]; Google's path wants lat,lng.
    const path = geometry
      .map((c) => `${(c[1] as number).toFixed(6)},${(c[0] as number).toFixed(6)}`)
      .join('|');
    u.searchParams.set('path', `color:0x6E7B33ff|weight:3|fillcolor:0x6E7B3333|${path}`);
  } else {
    u.searchParams.set('markers', `color:0x6E7B33|${center}`);
  }
  u.searchParams.set('key', MAPS_KEY);
  try {
    const res = await fetch(u.toString(), { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    const processed = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const key = `spots/seed/staticmap-${spotId}.jpg`;
    const { publicUrl } = await uploadObject(key, processed, 'image/jpeg');
    return publicUrl;
  } catch (err) {
    console.warn(`[seed] static map fallback skipped for ${spotId}: ${String(err)}`);
    return null;
  }
}

// Coordinate fallbacks (Street View / static map) are an API cost, so we only
// generate them for up to FALLBACK_IMAGE_LIMIT spots inside the Amsterdam area.
const AMS_BBOX = { minLat: 52.25, maxLat: 52.45, minLng: 4.7, maxLng: 5.05 };
const FALLBACK_IMAGE_LIMIT = 100;
function inAmsterdam(lat: number, lng: number): boolean {
  return (
    lat >= AMS_BBOX.minLat &&
    lat <= AMS_BBOX.maxLat &&
    lng >= AMS_BBOX.minLng &&
    lng <= AMS_BBOX.maxLng
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const USERS = [
  {
    email: 'seed-anna@devrijehond.nl',
    name: 'Anna de Vries',
    handle: 'annahond',
    reputation: 42,
    voteWeight: 1.3,
  },
  {
    email: 'seed-bram@devrijehond.nl',
    name: 'Bram Jansen',
    handle: 'bramwandelt',
    reputation: 28,
    voteWeight: 1.1,
  },
  {
    email: 'seed-chris@devrijehond.nl',
    name: 'Chris Bakker',
    handle: 'chrisb',
    reputation: 15,
    voteWeight: 1,
  },
  {
    email: 'seed-daan@devrijehond.nl',
    name: 'Daan Visser',
    handle: 'daanv',
    reputation: 60,
    voteWeight: 1.5,
  },
  {
    email: 'seed-eva@devrijehond.nl',
    name: 'Eva Smit',
    handle: 'evasmit',
    reputation: 9,
    voteWeight: 0.8,
  },
  {
    email: 'seed-femke@devrijehond.nl',
    name: 'Femke Mulder',
    handle: 'femkem',
    reputation: 33,
    voteWeight: 1.2,
  },
  {
    email: 'seed-gijs@devrijehond.nl',
    name: 'Gijs Koster',
    handle: 'gijsk',
    reputation: 21,
    voteWeight: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// Spots
// ---------------------------------------------------------------------------

type VoteSpec = { user: number; value: 'CONFIRM' | 'DENY' };
type ReviewSpec = { user: number; stars: number; body: string };

interface SpotSeed {
  slug: string;
  category: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  status?: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN';
  submitter?: number; // index into USERS, else admin
  amenities?: string[]; // override AMENITIES_BY_CATEGORY subset
  photos?: number; // how many photos to upload
  votes?: VoteSpec[];
  reviews?: ReviewSpec[];
  address?: string;
  website?: string;
  regionRadiusM?: number; // for REGION polygon size
  geometry?: number[][]; // real [lng,lat] polygon ring; falls back to a circle
  rawData?: unknown; // imported source payload (incl. sourceUrl) -> Spot.rawData
}

// Imported losloopgebieden -> the RESEARCH shape buildSpots consumes. Amenities
// are mapped from the scraped flags; the full source record is carried as `raw`
// so it lands in Spot.rawData (incl. sourceUrl) for later refresh.
const RESEARCH: {
  name: string;
  category: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
  radiusM?: number;
  amenities?: string[];
  raw: RawLosloop | RawPoi;
}[] = [
  ...LOSLOOP.map((r) => {
    const amenities: string[] = ['free'];
    if (r.fenced) amenities.push('fenced');
    if (r.parking) amenities.push('parking');
    return {
      name: r.name,
      category: 'off-leash',
      city: r.town ?? r.province ?? 'Nederland',
      lat: r.lat,
      lng: r.lng,
      description: r.description ?? 'Hondenlosloopgebied.',
      radiusM: r.source === 'osm' ? 130 : 400,
      amenities,
      raw: r,
    };
  }),
  // Scraped POIs (drinking points, etc.) -> POI spots, no geometry.
  ...POI_SOURCES.flatMap(({ category, file, descFallback }) =>
    loadPoiFile(file).map((r) => ({
      name: r.name,
      category,
      city: r.town ?? r.province ?? 'Nederland',
      lat: r.lat,
      lng: r.lng,
      description: r.description ?? descFallback,
      amenities: AMENITIES_BY_CATEGORY[category],
      raw: r,
    })),
  ),
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build the seed spots from the researched dataset. Deterministic: every third
// spot reaches VERIFIED with a handful of weighted confirms; the rest stay
// UNVERIFIED with a few or no votes.
function buildSpots(): SpotSeed[] {
  const N = USERS.length;
  const seen = new Map<string, number>();
  return RESEARCH.map((r, i): SpotSeed => {
    const isRegion = r.category === 'off-leash' || r.category === 'swim-beach';
    const submitter = i % N;
    // Curated directory imports (doggydating) start VERIFIED with weighted
    // confirms; OSM auto-data lands UNVERIFIED for the community to confirm.
    const isDoggy = r.raw.source === 'doggydating';
    const status: 'VERIFIED' | 'UNVERIFIED' = isDoggy ? 'VERIFIED' : 'UNVERIFIED';
    const pool = Array.from({ length: N }, (_, u) => u).filter((u) => u !== submitter);
    const votes: VoteSpec[] = isDoggy
      ? pool.slice(0, 5).map((u) => ({ user: u, value: 'CONFIRM' as const }))
      : [];
    // Slugs must be unique; many OSM areas share "Hondenlosloopgebied <town>".
    let slug = `${slugify(r.name)}-${slugify(r.city)}`;
    const seq = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, seq);
    if (seq > 1) slug = `${slug}-${seq}`;
    return {
      slug,
      category: r.category,
      name: r.name,
      description: r.description,
      lat: r.lat,
      lng: r.lng,
      status,
      submitter,
      photos: 0,
      votes,
      reviews: [],
      amenities: r.amenities,
      rawData: r.raw,
      geometry: isRegion ? r.raw.geometry : undefined,
      regionRadiusM: isRegion ? (r.radiusM ?? 400) : undefined,
    };
  });
}

const SPOTS: SpotSeed[] = buildSpots();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

  // --- Reset (re-runnable). Deleting spots + non-admin users cascades. ---
  await db.vote.deleteMany({});
  await db.review.deleteMany({});
  await db.spotPhoto.deleteMany({});
  await db.spotAmenity.deleteMany({});
  await db.spot.deleteMany({});
  await db.featureVote.deleteMany({});
  await db.featureRequest.deleteMany({});
  await db.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } });

  // --- Admin + taxonomy ---
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      name: 'René',
      handle: 'rene',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const catId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label, icon: c.icon, color: c.color, sortOrder: i },
      create: { ...c, sortOrder: i, status: 'ACTIVE', visible: true },
    });
    catId[c.slug] = row.id;
  }

  const amenityId: Record<string, string> = {};
  for (const [i, a] of AMENITIES.entries()) {
    const row = await db.amenity.upsert({
      where: { slug: a.slug },
      update: { label: a.label, icon: a.icon, sortOrder: i },
      create: { ...a, sortOrder: i, status: 'ACTIVE', visible: true },
    });
    amenityId[a.slug] = row.id;
  }

  // Link amenities to the categories that offer them.
  await db.amenityOnCategory.deleteMany({});
  for (const [catSlug, amenitySlugs] of Object.entries(AMENITIES_BY_CATEGORY)) {
    for (const aSlug of amenitySlugs) {
      await db.amenityOnCategory.create({
        data: { categoryId: catId[catSlug]!, amenityId: amenityId[aSlug]! },
      });
    }
  }

  // --- Community users ---
  const userId: string[] = [];
  for (const u of USERS) {
    const row = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        handle: u.handle,
        role: u.email === 'seed-anna@devrijehond.nl' ? 'MODERATOR' : 'USER',
        emailVerified: true,
        reputation: u.reputation,
        voteWeight: u.voteWeight,
      },
    });
    userId.push(row.id);
  }
  const submitterOf = (s: SpotSeed): string =>
    s.submitter == null ? admin.id : (userId[s.submitter] ?? admin.id);

  // --- Spots ---
  // Track how many spots per category for image cycling.
  const categoryPhotoIndex: Record<string, number> = {};
  const regionGeoms: { id: string; coords: number[][] }[] = [];
  let totalPhotos = 0;
  // Coordinate-fallback bookkeeping (capped to FALLBACK_IMAGE_LIMIT around Ams).
  let fallbackImageCount = 0;
  const fallbackImageLog: { name: string; type: string; source: string }[] = [];

  for (const s of SPOTS) {
    const cat = CATEGORIES.find((c) => c.slug === s.category)!;
    const votes = s.votes ?? [];
    const tally = tallyVotesLike(
      votes.map((v) => ({ value: v.value, weight: USERS[v.user]?.voteWeight ?? 1 })),
    );
    const reviews = s.reviews ?? [];
    const ratingCount = reviews.length;
    const ratingAvg = ratingCount
      ? +(reviews.reduce((sum, r) => sum + r.stars, 0) / ratingCount).toFixed(2)
      : 0;
    const status = s.status ?? 'UNVERIFIED';

    const spot = await db.spot.create({
      data: {
        slug: s.slug,
        type: cat.type,
        categoryId: catId[s.category]!,
        name: s.name,
        description: s.description,
        status,
        lat: s.lat,
        lng: s.lng,
        address: s.address ?? null,
        website: s.website ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawData: (s.rawData ?? undefined) as any,
        confirmScore: tally.confirmScore,
        denyScore: tally.denyScore,
        netScore: tally.netScore,
        confirmCount: tally.confirmCount,
        denyCount: tally.denyCount,
        ratingAvg,
        ratingCount,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        hiddenAt: status === 'HIDDEN' ? new Date() : null,
        submittedById: submitterOf(s),
      },
      select: { id: true },
    });

    // Amenities (category defaults unless overridden).
    const amSlugs = s.amenities ?? AMENITIES_BY_CATEGORY[s.category] ?? [];
    if (amSlugs.length) {
      await db.spotAmenity.createMany({
        data: amSlugs.map((a) => ({ spotId: spot.id, amenityId: amenityId[a]! })),
      });
    }

    // Photos: upload to S3, one at a time, cycling through category sources.
    const photoN = s.photos ?? 0;
    let photosCreated = 0;
    if (photoN > 0) {
      const baseIdx = categoryPhotoIndex[s.category] ?? 0;
      categoryPhotoIndex[s.category] = baseIdx + photoN;

      for (let n = 0; n < photoN; n++) {
        const url = await photoUrlForSpot(s.category, baseIdx + n);
        if (!url) continue; // upload failed, skip this photo non-fatally
        await db.spotPhoto.create({
          data: {
            spotId: spot.id,
            url,
            uploadedById: submitterOf(s),
            status: 'ACTIVE',
            sortOrder: n,
          },
        });
        totalPhotos++;
        photosCreated++;
      }
    }

    // No real photo for this spot: try a Street View ground photo at its
    // coordinates: Street View where there's panorama coverage, else a static
    // map. Capped to FALLBACK_IMAGE_LIMIT spots around Amsterdam to bound the
    // Google API spend while we evaluate it.
    if (
      photosCreated === 0 &&
      s.lat != null &&
      s.lng != null &&
      inAmsterdam(s.lat, s.lng) &&
      fallbackImageCount < FALLBACK_IMAGE_LIMIT
    ) {
      let url = await streetViewPhotoForSpot(spot.id, s.lat, s.lng);
      let source = 'streetview';
      if (!url) {
        url = await staticMapForSpot(spot.id, s.lat, s.lng, cat.type, s.geometry);
        source = 'static-map';
      }
      if (url) {
        await db.spotPhoto.create({
          data: {
            spotId: spot.id,
            url,
            uploadedById: submitterOf(s),
            status: 'ACTIVE',
            sortOrder: 0,
          },
        });
        totalPhotos++;
        fallbackImageCount++;
        fallbackImageLog.push({ name: s.name, type: cat.type, source });
      }
    }

    // Votes (one per distinct user).
    if (votes.length) {
      await db.vote.createMany({
        data: votes.map((v) => ({
          spotId: spot.id,
          userId: userId[v.user]!,
          value: v.value,
          weight: USERS[v.user]?.voteWeight ?? 1,
          proximityVerified: v.value === 'CONFIRM',
        })),
      });
    }

    // Reviews.
    for (const r of reviews) {
      await db.review.create({
        data: {
          spotId: spot.id,
          userId: userId[r.user]!,
          stars: r.stars,
          body: r.body,
          status: 'ACTIVE',
        },
      });
    }

    // Only draw a polygon when we have a real boundary (OSM geometry). Without
    // one we don't invent a circle: the spot keeps a point geom (set below) and
    // renders as a marker, which is honest about not knowing the exact area.
    if (cat.type === 'REGION' && s.geometry && s.geometry.length >= 4) {
      regionGeoms.push({ id: spot.id, coords: s.geometry });
    }
  }

  // --- Feature requests (community product input) ---
  const FEATURE_REQUESTS: {
    title: string;
    body: string;
    component: string;
    status: 'CONSIDERING' | 'PLANNED' | 'DONE' | 'DECLINED';
    by: number;
    voters: number[];
  }[] = [
    {
      title: 'Hondentrimsalons op de kaart',
      body: 'Zou mooi zijn als trimsalons een eigen categorie krijgen.',
      component: 'Kaart',
      status: 'CONSIDERING',
      by: 0,
      voters: [1, 2, 3, 5, 6],
    },
    {
      title: 'Route naar een losloopgebied',
      body: 'Een knop "breng me ernaartoe" die de navigatie opent.',
      component: 'Kaart',
      status: 'CONSIDERING',
      by: 1,
      voters: [0, 2, 3, 4, 5, 6],
    },
    {
      title: 'Offline kaart voor onderweg',
      body: 'Handig op plekken zonder bereik.',
      component: 'Kaart',
      status: 'PLANNED',
      by: 3,
      voters: [0, 4, 5],
    },
    {
      title: 'Filteren op "omheind"',
      body: 'Snel alleen omheinde gebieden zien.',
      component: 'Kaart',
      status: 'DONE',
      by: 5,
      voters: [1, 2],
    },
    {
      title: 'Melding bij een nieuwe plek in de buurt',
      body: 'Push als er iets nieuws vlakbij wordt toegevoegd.',
      component: 'Anders',
      status: 'CONSIDERING',
      by: 2,
      voters: [0, 4],
    },
    {
      title: 'Hondenweer-waarschuwing',
      body: 'Waarschuwing bij te warm asfalt.',
      component: 'Anders',
      status: 'DECLINED',
      by: 4,
      voters: [],
    },
  ];
  for (const fr of FEATURE_REQUESTS) {
    const created = await db.featureRequest.create({
      data: {
        title: fr.title,
        body: fr.body,
        component: fr.component,
        status: fr.status,
        upvoteCount: fr.voters.length,
        createdById: userId[fr.by]!,
      },
      select: { id: true },
    });
    if (fr.voters.length) {
      await db.featureVote.createMany({
        data: fr.voters.map((u) => ({ requestId: created.id, userId: userId[u]! })),
      });
    }
  }

  // --- Geometry: points for POIs, polygons for REGIONs ---
  await pool.query(
    `UPDATE "Spot" SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
       WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;`,
  );
  for (const r of regionGeoms) {
    const geojson = JSON.stringify({ type: 'Polygon', coordinates: [r.coords] });
    await pool.query(
      `UPDATE "Spot" SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2;`,
      [geojson, r.id],
    );
  }

  await pool.end();

  const verified = SPOTS.filter((s) => s.status === 'VERIFIED').length;
  const s3Host = new URL(process.env.S3_PUBLIC_BASE_URL ?? 'https://unknown').host;
  console.log(
    `Seeded: admin=${admin.email}, users=${USERS.length}, categories=${CATEGORIES.length}, ` +
      `amenities=${AMENITIES.length}, spots=${SPOTS.length} (verified=${verified}), ` +
      `photos=${totalPhotos} (S3 host: ${s3Host}), ` +
      `unique S3 uploads=${uploadedCache.size}, ` +
      `reviews=${SPOTS.reduce((n, s) => n + (s.reviews?.length ?? 0), 0)}, ` +
      `votes=${SPOTS.reduce((n, s) => n + (s.votes?.length ?? 0), 0)}, ` +
      `featureRequests=${FEATURE_REQUESTS.length}`,
  );

  // Coordinate-fallback breakdown: which Amsterdam spots got which image source.
  if (fallbackImageLog.length > 0) {
    const sv = fallbackImageLog.filter((f) => f.source === 'streetview').length;
    const sm = fallbackImageLog.length - sv;
    console.log(
      `\nCoordinate fallbacks (Amsterdam, cap ${FALLBACK_IMAGE_LIMIT}): ` +
        `${fallbackImageLog.length} total — ${sv} Street View, ${sm} static-map:`,
    );
    for (const f of fallbackImageLog) {
      console.log(`  ${f.source.padEnd(11)} ${f.type.padEnd(6)} ${f.name}`);
    }
  }

  // Print a sample of S3 URLs for verification.
  if (uploadedCache.size > 0) {
    console.log('Sample S3 URLs (first 3 unique uploads):');
    let shown = 0;
    for (const url of uploadedCache.values()) {
      console.log(`  ${url}`);
      if (++shown >= 3) break;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
