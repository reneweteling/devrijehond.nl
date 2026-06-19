import { adminDb } from '@/lib/admin-db';
import { promoteCategory, promoteAmenity, updateCategory, updateAmenity } from '../actions';

/**
 * Admin, taxonomy curation. Lists categories + amenities with their
 * visibility / sort order / status, and lets an admin promote a PROPOSED
 * (community-suggested) entry to ACTIVE or toggle visibility. All mutations go
 * through the server actions in `../actions.ts`.
 */
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage() {
  const db = await adminDb();

  const [categories, amenities] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
    db.amenity.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
  ]);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px' }}>
      <h1>Taxonomy</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Categories</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {categories.map((c) => (
            <li key={c.id} style={rowStyle}>
              <span>
                {c.label} <small style={{ color: '#4a5a4d' }}>· {c.type}</small>
                {c.status === 'PROPOSED' ? (
                  <small style={{ color: '#9a7b3f' }}> · PROPOSED</small>
                ) : null}
                {!c.visible ? <small style={{ color: '#b04a3a' }}> · hidden</small> : null}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {c.status === 'PROPOSED' ? (
                  <form action={promoteCategory.bind(null, c.id)}>
                    <button type="submit">Promote</button>
                  </form>
                ) : null}
                <form action={updateCategory.bind(null, c.id, { visible: !c.visible })}>
                  <button type="submit">{c.visible ? 'Hide' : 'Show'}</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Amenities</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {amenities.map((a) => (
            <li key={a.id} style={rowStyle}>
              <span>
                {a.label}
                {a.status === 'PROPOSED' ? (
                  <small style={{ color: '#9a7b3f' }}> · PROPOSED</small>
                ) : null}
                {!a.visible ? <small style={{ color: '#b04a3a' }}> · hidden</small> : null}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {a.status === 'PROPOSED' ? (
                  <form action={promoteAmenity.bind(null, a.id)}>
                    <button type="submit">Promote</button>
                  </form>
                ) : null}
                <form action={updateAmenity.bind(null, a.id, { visible: !a.visible })}>
                  <button type="submit">{a.visible ? 'Hide' : 'Show'}</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 8,
  backgroundColor: '#fff',
  border: '1px solid #e3e3da',
};
