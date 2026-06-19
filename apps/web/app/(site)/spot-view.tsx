import type { SpotDetailDto } from '@devrijehond/types';

/**
 * Server-rendered spot detail view, shared by `/plek/[slug]` (POI) and
 * `/gebied/[slug]` (REGION). Renders the verified, crawlable content:
 * name, category, description, amenities, rating, verification badge, and
 * POI extras (address/phone/website).
 */
export function SpotView({ spot }: { spot: SpotDetailDto }) {
  const verified = spot.verification.status === 'VERIFIED';
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <nav style={{ marginBottom: 16, fontSize: 14 }}>
        <a href="/" style={{ color: '#3F6B4C', textDecoration: 'none' }}>
          ← Terug naar de kaart
        </a>
      </nav>

      <header style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, color: '#4a5a4d', fontSize: 14, textTransform: 'uppercase' }}>
          {spot.category.label}
        </p>
        <h1 style={{ fontSize: 30, margin: '4px 0' }}>{spot.name}</h1>
        <p style={{ margin: 0 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: verified ? '#3F6B4C' : '#e7dcc2',
              color: verified ? '#f4efe6' : '#6b5320',
            }}
          >
            {verified ? 'Geverifieerd' : 'Nog niet geverifieerd'}
          </span>
          {spot.rating.count > 0 ? (
            <span style={{ marginLeft: 12, color: '#4a5a4d' }}>
              ★ {spot.rating.average.toFixed(1)} ({spot.rating.count})
            </span>
          ) : null}
        </p>
      </header>

      {spot.description ? (
        <p style={{ fontSize: 16, lineHeight: 1.6 }}>{spot.description}</p>
      ) : null}

      {spot.amenities.length > 0 ? (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18 }}>Voorzieningen</h2>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
            {spot.amenities.map((a) => (
              <li
                key={a.id}
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  backgroundColor: '#dfe7df',
                  fontSize: 14,
                }}
              >
                {a.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {spot.type === 'POI' ? (
        <section style={{ marginTop: 20, fontSize: 15, lineHeight: 1.6 }}>
          {spot.address ? <p style={{ margin: '4px 0' }}>{spot.address}</p> : null}
          {spot.phone ? <p style={{ margin: '4px 0' }}>{spot.phone}</p> : null}
          {spot.website ? (
            <p style={{ margin: '4px 0' }}>
              <a href={spot.website} style={{ color: '#3F6B4C' }}>
                {spot.website}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {spot.photos.length > 0 ? (
        <section
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {spot.photos.map((p) => (
            // Plain <img>: these are remote S3 URLs rendered in a simple SSR
            // grid; next/image's loader/optimisation isn't wired for them.
            <img
              key={p.id}
              src={p.url}
              alt={spot.name}
              style={{ width: '100%', borderRadius: 8, aspectRatio: '4 / 3', objectFit: 'cover' }}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
