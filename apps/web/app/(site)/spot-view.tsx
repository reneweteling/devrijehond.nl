import type { SpotDetailDto, ReviewDto } from '@devrijehond/types';

import type { NearbySpot } from '@/lib/spot-detail';
import { StoreButton } from './site-chrome';
import { SpotParticipation } from './spot-participation';

function detailHref(type: 'REGION' | 'POI', slug: string) {
  return `/${type === 'REGION' ? 'gebied' : 'plek'}/${slug}`;
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span aria-label={`${value} van de 5 sterren`} style={{ color: 'var(--terra)', fontSize: 15 }}>
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

/**
 * Server-rendered spot detail, shared by `/plek/[slug]` (POI) and
 * `/gebied/[slug]` (REGION). The crawlable, verified content: name, category,
 * description, amenities, rating, verification status, a photo gallery and POI
 * contact details, styled to the site design system (globals.css).
 * Also renders the SSR review list (SEO + trust) and mounts the client-side
 * participation island for signed-in users.
 */

const IOS_URL = 'https://apps.apple.com/app/de-vrije-hond/id000000000';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=nl.devrijehond.app';

/* Small inline icons tinted with currentColor, in the PawMark line style. */
function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={d} />
    </svg>
  );
}
const CHECK = 'M20 6 9 17l-5-5';
const QUESTION =
  'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z';
const PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z';
const PHONE =
  'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.7.6 2.7.7a2 2 0 0 1 1.7 2Z';
const LINK =
  'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1';

export function SpotView({
  spot,
  nearby = [],
  reviews = [],
}: {
  spot: SpotDetailDto;
  nearby?: NearbySpot[];
  reviews?: ReviewDto[];
}) {
  const verified = spot.verification.status === 'VERIFIED';
  const [lead, ...rest] = spot.photos;
  const isPoi = spot.type === 'POI';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.devrijehond.nl';
  const url = `${baseUrl}/${isPoi ? 'plek' : 'gebied'}/${spot.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': isPoi ? 'LocalBusiness' : 'Place',
    name: spot.name,
    url,
    ...(spot.description ? { description: spot.description } : {}),
    ...(lead ? { image: lead.url } : {}),
    ...(isPoi && spot.address ? { address: spot.address } : {}),
    ...(spot.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: spot.rating.average,
            reviewCount: spot.rating.count,
          },
        }
      : {}),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 8 }}>
        <nav aria-label="Kruimelpad" style={{ fontSize: 14, marginBottom: 18 }}>
          <a href="/">De Vrije Hond</a>
          <span className="muted"> / {spot.category.label}</span>
        </nav>

        <span className="eyebrow">{spot.category.label}</span>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)', margin: '10px 0 14px' }}>{spot.name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${verified ? 'badge-verified' : 'badge-unverified'}`}>
            <Ico d={verified ? CHECK : QUESTION} size={13} />
            {verified ? 'Geverifieerd' : 'Nog niet geverifieerd'}
          </span>
          {spot.rating.count > 0 ? (
            <span className="muted" style={{ fontSize: 15 }}>
              ★ {spot.rating.average.toFixed(1).replace('.', ',')} · {spot.rating.count}{' '}
              {spot.rating.count === 1 ? 'beoordeling' : 'beoordelingen'}
            </span>
          ) : null}
        </div>
      </div>

      {/* Lead photo */}
      {lead ? (
        <div className="container" style={{ marginTop: 20 }}>
          <img
            src={lead.url}
            alt={`Foto van ${spot.name}, ${spot.category.label}`}
            style={{
              width: '100%',
              maxHeight: 460,
              objectFit: 'cover',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow)',
            }}
          />
        </div>
      ) : null}

      {/* Two-column body */}
      <div className="container spot-body" style={{ marginTop: 32 }}>
        <div>
          {spot.description ? (
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: 'var(--ink-2)',
                margin: 0,
                maxWidth: '64ch',
              }}
            >
              {spot.description}
            </p>
          ) : null}

          {spot.amenities.length > 0 ? (
            <section style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 20, marginBottom: 14 }}>Voorzieningen</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {spot.amenities.map((a) => (
                  <span key={a.id} className="chip">
                    {a.label}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {rest.length === 1 ? (
            <img
              src={rest[0]!.url}
              alt={`${spot.name}, foto 2`}
              loading="lazy"
              style={{
                marginTop: 28,
                width: '100%',
                aspectRatio: '16 / 10',
                objectFit: 'cover',
                borderRadius: 'var(--radius)',
              }}
            />
          ) : rest.length > 1 ? (
            <section
              style={{
                marginTop: 28,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              {rest.map((p, i) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt={`${spot.name}, foto ${i + 2}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    aspectRatio: '4 / 3',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius)',
                  }}
                />
              ))}
            </section>
          ) : null}

          {/* Reviews list — server-rendered for SEO + trust */}
          {reviews.length > 0 ? (
            <section style={{ marginTop: 36 }}>
              <h2 style={{ fontSize: 22, marginBottom: 20 }}>
                Beoordelingen{' '}
                <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>
                  ({reviews.length})
                </span>
              </h2>
              <div style={{ display: 'grid', gap: 16 }}>
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="card"
                    style={{ padding: '16px 18px', overflow: 'visible' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {r.author.image ? (
                          <img
                            src={r.author.image}
                            alt={r.author.handle ?? r.author.name ?? 'Gebruiker'}
                            width={32}
                            height={32}
                            style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--moss-soft)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              color: 'var(--moss-700)',
                              fontWeight: 600,
                              flex: 'none',
                            }}
                          >
                            {(r.author.handle ?? r.author.name ?? '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                          {r.author.handle ?? r.author.name ?? 'Anoniem'}
                        </span>
                      </div>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {fmtDate(r.createdAt)}
                      </span>
                    </div>
                    <StarDisplay value={r.stars} />
                    {r.body ? (
                      <p
                        style={{
                          marginTop: 8,
                          fontSize: 15,
                          color: 'var(--ink-2)',
                          lineHeight: 1.6,
                        }}
                      >
                        {r.body}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 84 }}>
          {spot.lat != null && spot.lng != null ? (
            <a
              className="btn btn-primary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
              target="_blank"
              rel="noreferrer"
              style={{ width: '100%' }}
            >
              <Ico d={PIN} size={15} /> Route via Google Maps
            </a>
          ) : null}
          {isPoi && (spot.address || spot.phone || spot.website) ? (
            <div className="card" style={{ padding: 20 }}>
              <h3
                style={{
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                  margin: '0 0 12px',
                }}
              >
                Informatie
              </h3>
              <div style={{ display: 'grid', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                {spot.address ? (
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Ico d={PIN} /> {spot.address}
                  </div>
                ) : null}
                {spot.phone ? (
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    <Ico d={PHONE} /> {spot.phone}
                  </div>
                ) : null}
                {spot.website ? (
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    <Ico d={LINK} />{' '}
                    <a href={spot.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Signed-in participation: vote, review, report */}
          <SpotParticipation spotId={spot.id} status={spot.verification.status} />

          <div
            className="card"
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, var(--moss) 0%, var(--moss-700) 100%)',
              color: '#fff',
              border: 'none',
            }}
          >
            <h3 style={{ color: '#fff', fontSize: 18, margin: '0 0 6px' }}>Open in de app</h3>
            <p style={{ margin: '0 0 14px', fontSize: 14.5, color: '#fff' }}>
              Gebruik de app voor navigatie en meer functies.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <StoreButton href={IOS_URL} kind="ios" />
              <StoreButton href={ANDROID_URL} kind="android" />
            </div>
          </div>
        </aside>
      </div>

      {nearby.length > 0 ? (
        <section className="container" style={{ marginTop: 44, marginBottom: 8 }}>
          <h2 className="section-title" style={{ fontSize: 24 }}>
            In de buurt
          </h2>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            {nearby.map((n) => (
              <a
                key={n.slug}
                href={detailHref(n.type, n.slug)}
                className="card card-link"
                style={{ display: 'block', overflow: 'hidden' }}
              >
                {n.photo ? (
                  <div className="card-media" style={{ height: 132, position: 'relative' }}>
                    <img src={n.photo} alt={`${n.catLabel} ${n.name}`} />
                  </div>
                ) : null}
                <div className="card-body">
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{n.name}</div>
                  <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>
                    {n.catLabel} · {fmtDistance(n.distanceM)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
