/**
 * Deterministic, content-rich seed for De Vrije Hond.
 *
 * Ensures the PostGIS extension, then seeds taxonomy (categories + amenities),
 * an admin, a handful of community users, and a realistic set of Amsterdam dog
 * spots: off-leash areas + swim beaches as polygons, and horeca / wash / shop /
 * drinking-point POIs. Spots carry amenities, photos, community votes (so some
 * reach VERIFIED), and reviews (so ratings are populated). Geometry is written
 * via raw PostGIS (the ORM models `geom` as Unsupported): a point for POIs, a
 * generated ring for REGIONs.
 *
 * Re-runnable: wipes spots + community users first, then rebuilds. Uses the raw
 * `db` client (policies bypassed) — seeding is a system action.
 */
import { Pool } from 'pg';
import { db } from './src/client';
import { tallyVotesLike } from './seed-helpers';

const ADMIN_EMAIL = 'rene@weteling.com';

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
  photos?: number; // how many stock photos
  votes?: VoteSpec[];
  reviews?: ReviewSpec[];
  address?: string;
  website?: string;
  regionRadiusM?: number; // for REGION polygon size
}

const SPOTS: SpotSeed[] = [
  // ---- Off-leash areas (REGION, polygons) ----
  {
    slug: 'westerpark-losloop',
    category: 'off-leash',
    name: 'Westerpark losloopgebied',
    description: 'Ruim losloopgebied rondom de Westergasfabriek. Veel ruimte, water langs de rand.',
    lat: 52.3872,
    lng: 4.8745,
    status: 'VERIFIED',
    submitter: 0,
    photos: 3,
    regionRadiusM: 320,
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [
      { user: 1, stars: 5, body: 'Onze favoriete plek, altijd andere honden om mee te spelen.' },
      { user: 3, stars: 4, body: 'Lekker ruim. Kan modderig zijn na regen.' },
      { user: 5, stars: 5, body: 'Top, vlakbij koffie.' },
    ],
  },
  {
    slug: 'amsterdamse-bos-losloop',
    category: 'off-leash',
    name: 'Amsterdamse Bos losloopgebied',
    description: 'Groot bosgebied met aangewezen losloopzones en een hondenzwemplek.',
    lat: 52.3205,
    lng: 4.836,
    status: 'VERIFIED',
    submitter: 3,
    photos: 2,
    regionRadiusM: 520,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [
      { user: 0, stars: 5, body: 'Uren wandelen, honden zijn dol op het water.' },
      { user: 6, stars: 4, body: 'Soms druk in het weekend.' },
    ],
  },
  {
    slug: 'vondelpark-losloopzone',
    category: 'off-leash',
    name: 'Vondelpark losloopzone',
    description: 'Aangewezen losloopuren in het Vondelpark. Let op de bordjes voor de tijden.',
    lat: 52.358,
    lng: 4.8686,
    status: 'UNVERIFIED',
    submitter: 2,
    photos: 1,
    regionRadiusM: 260,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
    ],
    reviews: [{ user: 4, stars: 3, body: 'Alleen losloop op bepaalde uren, anders boete.' }],
  },
  {
    slug: 'flevopark-losloop',
    category: 'off-leash',
    name: 'Flevopark losloopgebied',
    description: 'Rustig park in Oost met losloopveld en een natuurzwembad in de buurt.',
    lat: 52.362,
    lng: 4.945,
    status: 'UNVERIFIED',
    submitter: 5,
    photos: 2,
    regionRadiusM: 300,
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
  },
  {
    slug: 'gaasperpark-losloop',
    category: 'off-leash',
    name: 'Gaasperpark losloopgebied',
    description: 'Veel groen rond de Gaasperplas, fijne loslooproutes.',
    lat: 52.3122,
    lng: 4.987,
    status: 'UNVERIFIED',
    submitter: 1,
    photos: 1,
    regionRadiusM: 340,
    votes: [{ user: 0, value: 'CONFIRM' }],
  },
  {
    slug: 'sloterpark-losloop',
    category: 'off-leash',
    name: 'Sloterpark losloopgebied',
    description: 'Langs de Sloterplas, ruime losloopstroken met schaduw.',
    lat: 52.3662,
    lng: 4.8085,
    status: 'VERIFIED',
    submitter: 0,
    photos: 2,
    regionRadiusM: 380,
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
    reviews: [{ user: 2, stars: 4, body: 'Mooie plek aan het water.' }],
  },
  {
    slug: 'rembrandtpark-losloop',
    category: 'off-leash',
    name: 'Rembrandtpark losloopgebied',
    description: 'Losloopveld in West, omheind deel voor kleine honden.',
    lat: 52.366,
    lng: 4.846,
    status: 'UNVERIFIED',
    submitter: 6,
    photos: 1,
    regionRadiusM: 240,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
  },
  {
    slug: 'oeverlanden-losloop',
    category: 'off-leash',
    name: 'De Oeverlanden losloopgebied',
    description: 'Natuurgebied aan de Nieuwe Meer, geliefd bij hondenbezitters.',
    lat: 52.336,
    lng: 4.833,
    status: 'UNVERIFIED',
    submitter: 3,
    photos: 2,
    regionRadiusM: 420,
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'DENY' },
    ],
    reviews: [{ user: 1, stars: 5, body: 'Heerlijk wild en ruig, honden genieten.' }],
  },

  // ---- Swim beaches (REGION) ----
  {
    slug: 'blijburg-hondenstrand',
    category: 'swim-beach',
    name: 'Hondenstrand Blijburg',
    description: 'Stuk strand op IJburg waar honden los mogen en mee het water in kunnen.',
    lat: 52.354,
    lng: 5.012,
    status: 'VERIFIED',
    submitter: 4,
    photos: 3,
    regionRadiusM: 180,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [
      { user: 0, stars: 5, body: 'Beste hondenstrand van de stad!' },
      { user: 3, stars: 5, body: 'Zand, water, ruimte. Perfect op een zomerdag.' },
    ],
  },
  {
    slug: 'gaasperplas-hondenstrand',
    category: 'swim-beach',
    name: 'Gaasperplas hondenstrand',
    description: 'Apart hondenstrandje aan de Gaasperplas, rustig en schoon.',
    lat: 52.31,
    lng: 4.9905,
    status: 'UNVERIFIED',
    submitter: 1,
    photos: 2,
    regionRadiusM: 150,
    votes: [
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [{ user: 6, stars: 4, body: 'Lekker rustig doordeweeks.' }],
  },
  {
    slug: 'nieuwe-meer-hondenstrand',
    category: 'swim-beach',
    name: 'Nieuwe Meer hondenstrand',
    description: 'Zwemplek voor honden aan de zuidkant van de Nieuwe Meer.',
    lat: 52.335,
    lng: 4.836,
    status: 'UNVERIFIED',
    submitter: 0,
    photos: 1,
    regionRadiusM: 160,
    votes: [{ user: 2, value: 'CONFIRM' }],
  },

  // ---- Horeca (POI) ----
  {
    slug: 'cafe-de-waterbak',
    category: 'horeca',
    name: 'Café De Waterbak',
    description: 'Klein bruin café, honden welkom binnen en op het terras. Waterbak bij de deur.',
    lat: 52.3855,
    lng: 4.8881,
    status: 'VERIFIED',
    submitter: 0,
    photos: 2,
    address: 'Haarlemmerdijk 12, Amsterdam',
    website: 'https://example.com/waterbak',
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
    reviews: [
      { user: 1, stars: 5, body: 'Personeel is dol op honden, krijgen altijd een koekje.' },
      { user: 4, stars: 4, body: 'Gezellig, kan krap zijn binnen.' },
    ],
  },
  {
    slug: 'brouwerij-troost-west',
    category: 'horeca',
    name: 'Brouwerij Troost Westergas',
    description: 'Grote brouwerij met terras, honden mogen mee. Veel ruimte.',
    lat: 52.3868,
    lng: 4.8722,
    status: 'VERIFIED',
    submitter: 5,
    photos: 2,
    address: 'Pazzanistraat 25, Amsterdam',
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [{ user: 2, stars: 4, body: 'Leuk na een rondje Westerpark.' }],
  },
  {
    slug: 'hannekes-boom',
    category: 'horeca',
    name: 'Hannekes Boom',
    description: 'Waterkant-café met veel buitenruimte, hondenproof.',
    lat: 52.3712,
    lng: 4.9128,
    status: 'UNVERIFIED',
    submitter: 2,
    photos: 1,
    address: 'Dijksgracht 4, Amsterdam',
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
    reviews: [{ user: 5, stars: 4, body: 'Mooie plek aan het water, druk in de zomer.' }],
  },
  {
    slug: 'cafe-t-smalle',
    category: 'horeca',
    name: "Café 't Smalle",
    description: 'Klassiek grachtencafé, honden welkom. Terras aan het water.',
    lat: 52.376,
    lng: 4.8839,
    status: 'UNVERIFIED',
    submitter: 6,
    photos: 1,
    address: 'Egelantiersgracht 12, Amsterdam',
    votes: [{ user: 1, value: 'CONFIRM' }],
  },
  {
    slug: 'pllek-ndsm',
    category: 'horeca',
    name: 'Pllek (NDSM)',
    description: 'Hip strand-restaurant op de NDSM-werf, honden mogen los op het zand.',
    lat: 52.4012,
    lng: 4.893,
    status: 'UNVERIFIED',
    submitter: 3,
    photos: 2,
    address: 'TT Neveritaweg 59, Amsterdam',
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
    reviews: [{ user: 0, stars: 5, body: 'Honden los op het strandje, top uitzicht over het IJ.' }],
  },

  // ---- Wash / rinse (POI) ----
  {
    slug: 'hondenwas-west',
    category: 'wash',
    name: 'Hondenwasstraat West',
    description: 'Zelfbediening hondenwasstraat, warm water en föhn.',
    lat: 52.378,
    lng: 4.855,
    status: 'UNVERIFIED',
    submitter: 1,
    photos: 1,
    address: 'Jan van Galenstraat 100, Amsterdam',
    votes: [{ user: 3, value: 'CONFIRM' }],
  },
  {
    slug: 'dogwash-oost',
    category: 'wash',
    name: 'Dog Wash Oost',
    description: 'Professionele trim- en wasplek, ook zelf wassen mogelijk.',
    lat: 52.357,
    lng: 4.93,
    status: 'UNVERIFIED',
    submitter: 5,
    photos: 1,
    address: 'Linnaeusstraat 60, Amsterdam',
  },

  // ---- Shops (POI) ----
  {
    slug: 'trouwe-hond-winkel',
    category: 'shop',
    name: 'Dierenwinkel De Trouwe Hond',
    description: 'Buurtdierenwinkel met goed advies, honden mogen mee naar binnen.',
    lat: 52.3665,
    lng: 4.8902,
    status: 'VERIFIED',
    submitter: 0,
    photos: 1,
    address: 'Kinkerstraat 200, Amsterdam',
    votes: [
      { user: 1, value: 'CONFIRM' },
      { user: 2, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
    reviews: [{ user: 3, stars: 5, body: 'Eigenaar weet echt waar hij het over heeft.' }],
  },
  {
    slug: 'pets-place-centrum',
    category: 'shop',
    name: 'Pets Place Centrum',
    description: 'Grote keten-dierenwinkel, ruim assortiment hondenvoer.',
    lat: 52.3702,
    lng: 4.8952,
    status: 'UNVERIFIED',
    submitter: 6,
    photos: 1,
    address: 'Nieuwezijds Voorburgwal 150, Amsterdam',
  },

  // ---- Drinking points (POI) ----
  {
    slug: 'drinkpunt-vondelpark',
    category: 'drinking-point',
    name: 'Drinkpunt Vondelpark',
    description: 'Vaste waterkraan met hondenbak bij de hoofdingang.',
    lat: 52.3575,
    lng: 4.869,
    status: 'VERIFIED',
    submitter: 2,
    photos: 1,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 1, value: 'CONFIRM' },
      { user: 3, value: 'CONFIRM' },
      { user: 4, value: 'CONFIRM' },
      { user: 5, value: 'CONFIRM' },
    ],
  },
  {
    slug: 'drinkpunt-westerpark',
    category: 'drinking-point',
    name: 'Drinkpunt Westerpark',
    description: 'Drinkfontein met hondenbak naast de speeltuin.',
    lat: 52.386,
    lng: 4.877,
    status: 'UNVERIFIED',
    submitter: 4,
    photos: 1,
    votes: [
      { user: 0, value: 'CONFIRM' },
      { user: 6, value: 'CONFIRM' },
    ],
  },
  {
    slug: 'drinkpunt-oosterpark',
    category: 'drinking-point',
    name: 'Drinkpunt Oosterpark',
    description: 'Waterpunt centraal in het Oosterpark.',
    lat: 52.36,
    lng: 4.922,
    status: 'UNVERIFIED',
    submitter: 1,
    photos: 0,
  },

  // ---- One admin-hidden spot (spam example) ----
  {
    slug: 'spam-plek',
    category: 'horeca',
    name: 'Onzin Plek (spam)',
    description: 'Dubbele/spam-inzending — door de community afgewezen.',
    lat: 52.37,
    lng: 4.9,
    status: 'HIDDEN',
    submitter: 6,
    photos: 0,
    votes: [
      { user: 0, value: 'DENY' },
      { user: 1, value: 'DENY' },
      { user: 2, value: 'DENY' },
    ],
  },
];

/** A rough N-point ring around a centroid (metres → degrees), closed. */
function ring(lat: number, lng: number, radiusM: number): number[][] {
  const pts: number[][] = [];
  const n = 7;
  const latM = 111_320;
  const lngM = 111_320 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    // slight per-vertex jitter so it isn't a perfect circle
    const r = radiusM * (0.82 + 0.18 * Math.abs(Math.sin(a * 2)));
    const dLat = (r * Math.sin(a)) / latM;
    const dLng = (r * Math.cos(a)) / lngM;
    pts.push([+(lng + dLng).toFixed(6), +(lat + dLat).toFixed(6)]);
  }
  pts.push(pts[0]); // close the ring
  return pts;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

  // --- Reset (re-runnable). Deleting spots + non-admin users cascades. ---
  await db.vote.deleteMany({});
  await db.review.deleteMany({});
  await db.spotPhoto.deleteMany({});
  await db.spotAmenity.deleteMany({});
  await db.spot.deleteMany({});
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
        data: { categoryId: catId[catSlug], amenityId: amenityId[aSlug] },
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
        role: 'USER',
        emailVerified: true,
        reputation: u.reputation,
        voteWeight: u.voteWeight,
      },
    });
    userId.push(row.id);
  }
  const submitterOf = (s: SpotSeed) => (s.submitter == null ? admin.id : userId[s.submitter]);

  // --- Spots ---
  const regionGeoms: { id: string; coords: number[][] }[] = [];
  for (const s of SPOTS) {
    const cat = CATEGORIES.find((c) => c.slug === s.category)!;
    const votes = s.votes ?? [];
    const tally = tallyVotesLike(
      votes.map((v) => ({ value: v.value, weight: USERS[v.user].voteWeight })),
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
        categoryId: catId[s.category],
        name: s.name,
        description: s.description,
        status,
        lat: s.lat,
        lng: s.lng,
        address: s.address ?? null,
        website: s.website ?? null,
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
        data: amSlugs.map((a) => ({ spotId: spot.id, amenityId: amenityId[a] })),
      });
    }

    // Photos (deterministic stock images).
    const photoN = s.photos ?? 0;
    if (photoN > 0) {
      await db.spotPhoto.createMany({
        data: Array.from({ length: photoN }, (_, n) => ({
          spotId: spot.id,
          url: `https://picsum.photos/seed/${s.slug}-${n}/900/675`,
          uploadedById: submitterOf(s),
          status: 'ACTIVE' as const,
          sortOrder: n,
        })),
      });
    }

    // Votes (one per distinct user).
    if (votes.length) {
      await db.vote.createMany({
        data: votes.map((v) => ({
          spotId: spot.id,
          userId: userId[v.user],
          value: v.value,
          weight: USERS[v.user].voteWeight,
          proximityVerified: v.value === 'CONFIRM',
        })),
      });
    }

    // Reviews.
    for (const r of reviews) {
      await db.review.create({
        data: {
          spotId: spot.id,
          userId: userId[r.user],
          stars: r.stars,
          body: r.body,
          status: 'ACTIVE',
        },
      });
    }

    if (cat.type === 'REGION') {
      regionGeoms.push({ id: spot.id, coords: ring(s.lat, s.lng, s.regionRadiusM ?? 280) });
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
  console.log(
    `Seeded: admin=${admin.email}, users=${USERS.length}, categories=${CATEGORIES.length}, ` +
      `amenities=${AMENITIES.length}, spots=${SPOTS.length} (verified=${verified}), ` +
      `reviews=${SPOTS.reduce((n, s) => n + (s.reviews?.length ?? 0), 0)}, ` +
      `votes=${SPOTS.reduce((n, s) => n + (s.votes?.length ?? 0), 0)}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
