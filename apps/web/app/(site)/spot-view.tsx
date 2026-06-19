import type { SpotDetailDto } from '@devrijehond/types';

import { StoreButton } from './site-chrome';

/**
 * Server-rendered spot detail, shared by `/plek/[slug]` (POI) and
 * `/gebied/[slug]` (REGION). The crawlable, verified content: name, category,
 * description, amenities, rating, verification status, a photo gallery and POI
 * contact details, styled to the site design system (globals.css).
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

export function SpotView({ spot }: { spot: SpotDetailDto }) {
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
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 84 }}>
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
              Routebeschrijving, bevestigen en beoordelen doe je in de app.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <StoreButton href={IOS_URL} kind="ios" />
              <StoreButton href={ANDROID_URL} kind="android" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
