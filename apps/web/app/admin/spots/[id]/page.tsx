import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffDb } from '@/lib/admin-db';
import { pgQuery } from '@devrijehond/server';
import { EditSpot } from './edit-spot';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  UNVERIFIED: { label: 'Niet geverifieerd', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  VERIFIED: { label: 'Geverifieerd', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  HIDDEN: { label: 'Verborgen', bg: '#eee', fg: '#8a8a76' },
  REMOVED: { label: 'Verwijderd', bg: '#f5e0de', fg: 'var(--rust, #a33b2d)' },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type GeomRow = { geojson: string | null };

export default async function AdminSpotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await staffDb();

  const spot = await db.spot.findUnique({
    where: { id },
    include: {
      category: true,
      submittedBy: { select: { id: true, handle: true, name: true } },
      photos: { where: { status: 'ACTIVE' }, orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: true } },
      _count: { select: { votes: true, reviews: true, photos: true } },
    },
  });

  if (!spot) notFound();

  // Geometry: PostGIS column is not in Prisma schema, so use raw query.
  const geomRows = await pgQuery<GeomRow>(
    `SELECT ST_AsGeoJSON("geom") AS geojson FROM "Spot" WHERE "id" = $1`,
    [id],
  );
  const geojson = geomRows[0]?.geojson
    ? (JSON.parse(geomRows[0].geojson) as { type: string; coordinates: unknown })
    : null;

  // Derive polygon coords for the edit island.
  let polygonCoords: Array<{ lat: number; lng: number }> | null = null;
  if (geojson?.type === 'Polygon') {
    const rings = geojson.coordinates as Array<Array<[number, number]>>;
    const outer = rings[0];
    if (outer) {
      // GeoJSON is [lng, lat]; close the ring by skipping the last repeated point.
      polygonCoords = outer.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
    }
  }

  const statusMeta = STATUS_META[spot.status];
  const submitter = spot.submittedBy;
  const submitterLabel = submitter
    ? (submitter.handle ?? submitter.name ?? 'onbekend')
    : 'onbekend';

  const publicUrl = spot.type === 'REGION' ? `/gebied/${spot.slug}` : `/plek/${spot.slug}`;

  const initialAmenityIds = spot.amenities.map((sa) => sa.amenity.id);
  const initialPhotos = spot.photos.map((p) => ({ id: p.id, url: p.url }));

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
        <Link href="/admin/spots" style={{ color: 'var(--ink-3)' }}>
          ← Terug naar plekken
        </Link>
      </nav>

      <span className="eyebrow">Beheer · Plekken</span>
      <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', margin: '8px 0 4px' }}>{spot.name}</h1>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        {statusMeta ? (
          <span className="badge" style={{ background: statusMeta.bg, color: statusMeta.fg }}>
            {statusMeta.label}
          </span>
        ) : null}
        <span className="muted" style={{ fontSize: 14 }}>
          {spot.type === 'REGION' ? 'Gebied' : 'POI'} · {spot.category.label}
        </span>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="muted"
          style={{ fontSize: 13 }}
        >
          Bekijk op site ↗
        </a>
      </div>

      {/* Meta strip */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: 28,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 24px',
          fontSize: 13.5,
          color: 'var(--ink-2)',
        }}
      >
        <span>
          Inzender: <strong>{submitterLabel}</strong>
        </span>
        <span>
          Score:{' '}
          <strong>
            {spot.netScore >= 0 ? '+' : ''}
            {spot.netScore}
          </strong>{' '}
          ({spot.confirmCount} ✓ / {spot.denyCount} ✕)
        </span>
        <span>
          Stemmen: <strong>{spot._count.votes}</strong>
        </span>
        <span>
          Reviews: <strong>{spot._count.reviews}</strong>
        </span>
        <span>
          Aangemaakt: <strong>{fmtDateTime(spot.createdAt.toISOString())}</strong>
        </span>
        <span>
          Slug: <code style={{ fontFamily: 'monospace', fontSize: 13 }}>{spot.slug}</code>
        </span>
      </div>

      {/* Full-width edit island — all sections stacked */}
      <EditSpot
        spotId={spot.id}
        spotType={spot.type as 'POI' | 'REGION'}
        initialName={spot.name}
        initialDescription={spot.description ?? null}
        initialCategoryId={spot.categoryId}
        initialStatus={spot.status as 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED'}
        initialAddress={spot.address ?? null}
        initialPhone={spot.phone ?? null}
        initialWebsite={spot.website ?? null}
        initialAmenityIds={initialAmenityIds}
        initialPhotos={initialPhotos}
        lat={spot.lat ?? null}
        lng={spot.lng ?? null}
        polygonCoords={polygonCoords}
      />
    </div>
  );
}
