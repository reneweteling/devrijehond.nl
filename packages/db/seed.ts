/**
 * Deterministic seed for De Vrije Hond.
 *
 * Ensures the PostGIS extension, then seeds taxonomy (categories + amenities),
 * an admin user, and a couple of sample spots (Amsterdam). Geometry is filled
 * from lat/lng via a raw PostGIS update (the ORM models `geom` as Unsupported).
 *
 * Uses the raw `db` client (policies bypassed) — seeding is a system action.
 */
import { Pool } from 'pg';
import { db } from './src/client';

const CATEGORIES = [
  { slug: 'off-leash', label: 'Losloopgebied', type: 'REGION', icon: 'pawprint.fill', color: '#6E7B33' },
  { slug: 'swim-beach', label: 'Zwemstrand', type: 'REGION', icon: 'beach.umbrella.fill', color: '#C9A24B' },
  { slug: 'horeca', label: 'Hondvriendelijke horeca', type: 'POI', icon: 'cup.and.saucer.fill', color: '#C2762E' },
  { slug: 'wash', label: 'Was- / spoelplek', type: 'POI', icon: 'drop.fill', color: '#4F7A86' },
  { slug: 'shop', label: 'Winkel', type: 'POI', icon: 'bag.fill', color: '#8A6BA0' },
  { slug: 'drinking-point', label: 'Drinkpunt', type: 'POI', icon: 'spigot.fill', color: '#6E7A82' },
] as const;

const AMENITIES = [
  { slug: 'water-bowl', label: 'Waterbak', icon: 'bowl.fill' },
  { slug: 'treats', label: 'Snoepjes', icon: 'pawprint.fill' },
  { slug: 'indoor-ok', label: 'Binnen ok', icon: 'house.fill' },
  { slug: 'terrace', label: 'Terras', icon: 'sun.umbrella.fill' },
  { slug: 'fenced', label: 'Omheind', icon: 'fence' },
  { slug: 'parking', label: 'Parkeren', icon: 'parkingsign' },
  { slug: 'shade', label: 'Schaduw', icon: 'tree.fill' },
  { slug: 'free', label: 'Gratis', icon: 'eurosign.circle' },
] as const;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

  const admin = await db.user.upsert({
    where: { email: 'rene@weteling.com' },
    update: { role: 'ADMIN' },
    create: { email: 'rene@weteling.com', name: 'René', handle: 'rene', role: 'ADMIN', emailVerified: true },
  });

  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label, icon: c.icon, color: c.color },
      create: { ...c, sortOrder: i, status: 'ACTIVE', visible: true },
    });
  }
  for (const [i, a] of AMENITIES.entries()) {
    await db.amenity.upsert({
      where: { slug: a.slug },
      update: { label: a.label, icon: a.icon },
      create: { ...a, sortOrder: i, status: 'ACTIVE', visible: true },
    });
  }

  const horeca = await db.category.findUniqueOrThrow({ where: { slug: 'horeca' } });
  const sample = await db.spot.upsert({
    where: { slug: 'cafe-de-waterbak' },
    update: {},
    create: {
      slug: 'cafe-de-waterbak',
      type: 'POI',
      categoryId: horeca.id,
      name: 'Café De Waterbak',
      description: 'Klein café, honden welkom. Waterbak bij de deur.',
      status: 'UNVERIFIED',
      lat: 52.3855,
      lng: 4.8881,
      address: 'Haarlemmerdijk 12, Amsterdam',
      submittedById: admin.id,
    },
  });

  // Backfill geometry from lat/lng for any POI missing it.
  await pool.query(
    `UPDATE "Spot" SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
     WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;`,
  );

  await pool.end();
  console.log(`Seeded: admin=${admin.email}, categories=${CATEGORIES.length}, amenities=${AMENITIES.length}, sample spot=${sample.slug}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
