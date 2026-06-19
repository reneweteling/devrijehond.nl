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

export function SpotView({ spot }: { spot: SpotDetailDto }) {
  const verified = spot.verification.status === 'VERIFIED';
  const [lead, ...rest] = spot.photos;
  const isPoi = spot.type === 'POI';

  return (
    <main>
      <div className="container" style={{ paddingTop: 24, paddingBottom: 8 }}>
        <nav style={{ fontSize: 14, marginBottom: 18 }}>
          <a href="/">De Vrije Hond</a>
          <span className="muted"> / {spot.category.label}</span>
        </nav>

        <span className="eyebrow">{spot.category.label}</span>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)', margin: '10px 0 14px' }}>{spot.name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${verified ? 'badge-verified' : 'badge-unverified'}`}>
            {verified ? '✓ Geverifieerd' : '◌ Nog niet geverifieerd'}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead.url}
            alt={spot.name}
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
      <div
        className="container"
        style={{
          marginTop: 32,
          display: 'grid',
          gap: 32,
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)',
          alignItems: 'start',
        }}
      >
        <div>
          {spot.description ? (
            <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>
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

          {rest.length > 0 ? (
            <section
              style={{
                marginTop: 28,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              {rest.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.url}
                  alt={spot.name}
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
              <div style={{ display: 'grid', gap: 8, fontSize: 15, color: 'var(--ink-2)' }}>
                {spot.address ? <div>📍 {spot.address}</div> : null}
                {spot.phone ? <div>📞 {spot.phone}</div> : null}
                {spot.website ? (
                  <div>
                    🔗{' '}
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
            <p style={{ margin: '0 0 14px', fontSize: 14.5, color: 'rgba(255,255,255,.9)' }}>
              Routebeschrijving, bevestigen en beoordelen doe je in de app.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <StoreButton href={IOS_URL} kind="ios" />
              <StoreButton href={ANDROID_URL} kind="android" />
            </div>
          </div>
        </aside>
      </div>

      <div style={{ height: 64 }} />
    </main>
  );
}
