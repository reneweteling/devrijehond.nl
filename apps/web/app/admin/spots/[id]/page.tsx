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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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
      polygonCoords = outer.map(([lng, lat]) => ({ lat, lng }));
    }
  }

  const statusMeta = STATUS_META[spot.status];
  const submitter = spot.submittedBy;
  const submitterLabel = submitter
    ? (submitter.handle ?? submitter.name ?? 'onbekend')
    : 'onbekend';

  const publicUrl = spot.type === 'REGION' ? `/gebied/${spot.slug}` : `/plek/${spot.slug}`;

  return (
    <div>
      {/* Breadcrumb + header */}
      <nav style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
        <Link href="/admin/spots" style={{ color: 'var(--ink-3)' }}>
          ← Terug naar plekken
        </Link>
      </nav>

      <span className="eyebrow">Beheer · Plekken</span>
      <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', margin: '8px 0 4px' }}>{spot.name}</h1>

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

      {/* Two-column layout: info left, edit right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 36,
          alignItems: 'start',
        }}
      >
        {/* Left: full info */}
        <div style={{ display: 'grid', gap: 24 }}>
          <section className="card" style={{ padding: 20 }}>
            <h2
              style={{
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-3)',
                margin: '0 0 14px',
              }}
            >
              Gegevens
            </h2>
            <dl
              style={{ display: 'grid', gap: 10, gridTemplateColumns: 'auto 1fr', fontSize: 14.5 }}
            >
              <DtDd label="Naam" value={spot.name} />
              <DtDd label="Slug" value={spot.slug} />
              <DtDd label="Type" value={spot.type} />
              <DtDd label="Categorie" value={spot.category.label} />
              <DtDd
                label="Status"
                value={
                  statusMeta ? (
                    <span
                      className="badge"
                      style={{ background: statusMeta.bg, color: statusMeta.fg }}
                    >
                      {statusMeta.label}
                    </span>
                  ) : (
                    spot.status
                  )
                }
              />
              <DtDd
                label="Score"
                value={`${spot.netScore >= 0 ? '+' : ''}${spot.netScore} (${spot.confirmCount} ✓ / ${spot.denyCount} ✕)`}
              />
              <DtDd label="Stemmen" value={String(spot._count.votes)} />
              <DtDd label="Reviews" value={String(spot._count.reviews)} />
              <DtDd label="Foto's" value={String(spot._count.photos)} />
              <DtDd label="Inzender" value={submitterLabel} />
              {spot.address ? <DtDd label="Adres" value={spot.address} /> : null}
              {spot.phone ? <DtDd label="Telefoon" value={spot.phone} /> : null}
              {spot.website ? (
                <DtDd
                  label="Website"
                  value={
                    <a href={spot.website} target="_blank" rel="noreferrer">
                      {spot.website}
                    </a>
                  }
                />
              ) : null}
              <DtDd label="Aangemaakt" value={fmtDateTime(spot.createdAt.toISOString())} />
              <DtDd label="Bijgewerkt" value={fmtDate(spot.updatedAt.toISOString())} />
              {spot.verifiedAt ? (
                <DtDd label="Geverifieerd op" value={fmtDate(spot.verifiedAt.toISOString())} />
              ) : null}
            </dl>
          </section>

          {spot.description ? (
            <section className="card" style={{ padding: 20 }}>
              <h2
                style={{
                  fontSize: 15,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                  margin: '0 0 10px',
                }}
              >
                Beschrijving
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
                {spot.description}
              </p>
            </section>
          ) : null}

          {spot.amenities.length > 0 ? (
            <section className="card" style={{ padding: 20 }}>
              <h2
                style={{
                  fontSize: 15,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                  margin: '0 0 10px',
                }}
              >
                Voorzieningen
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {spot.amenities.map((sa) => (
                  <span key={sa.amenity.id} className="chip">
                    {sa.amenity.label}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {spot.photos.length > 0 ? (
            <section className="card" style={{ padding: 20 }}>
              <h2
                style={{
                  fontSize: 15,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                  margin: '0 0 10px',
                }}
              >
                Foto's
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8,
                }}
              >
                {spot.photos.map((p) => (
                  <img
                    key={p.id}
                    src={p.url}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '4/3',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Right: edit island */}
        <div className="card" style={{ padding: 24, position: 'sticky', top: 84 }}>
          <h2 style={{ fontSize: 17, marginBottom: 20 }}>Bewerken</h2>
          <EditSpot
            spotId={spot.id}
            spotType={spot.type as 'POI' | 'REGION'}
            initialName={spot.name}
            initialDescription={spot.description ?? null}
            initialCategoryId={spot.categoryId}
            initialStatus={spot.status as 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED'}
            lat={spot.lat ?? null}
            lng={spot.lng ?? null}
            polygonCoords={polygonCoords}
          />
        </div>
      </div>
    </div>
  );
}

function DtDd({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--ink-2)' }}>{value}</dd>
    </>
  );
}
