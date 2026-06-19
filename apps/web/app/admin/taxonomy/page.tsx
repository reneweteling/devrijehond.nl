import { adminDb } from '@/lib/admin-db';
import { promoteCategory, promoteAmenity, updateCategory, updateAmenity } from '../actions';

/**
 * Admin taxonomy curation. Lists categories + amenities with their visibility /
 * status, and lets an admin promote a PROPOSED (community-suggested) entry to
 * ACTIVE or toggle visibility. Mutations go through the server actions.
 */
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage() {
  const db = await adminDb();

  const [categories, amenities] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
    db.amenity.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
  ]);

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Taxonomie</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 8 }}>
        Categorieën en voorzieningen groeien mee met de community. Nieuwe voorstellen komen binnen
        als PROPOSED; promoot ze of verberg ze hier.
      </p>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Categorieën</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {categories.map((c) => (
            <div key={c.id} className="admin-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{c.label}</strong>
                <small className="muted">{c.type}</small>
                <StatusBadges status={c.status} visible={c.visible} />
              </span>
              <span className="actions">
                {c.status === 'PROPOSED' ? (
                  <Action
                    action={promoteCategory.bind(null, c.id)}
                    label="Promoten"
                    variant="primary"
                  />
                ) : null}
                <Action
                  action={updateCategory.bind(null, c.id, { visible: !c.visible })}
                  label={c.visible ? 'Verbergen' : 'Tonen'}
                  variant="soft"
                />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Voorzieningen</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {amenities.map((a) => (
            <div key={a.id} className="admin-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{a.label}</strong>
                <StatusBadges status={a.status} visible={a.visible} />
              </span>
              <span className="actions">
                {a.status === 'PROPOSED' ? (
                  <Action
                    action={promoteAmenity.bind(null, a.id)}
                    label="Promoten"
                    variant="primary"
                  />
                ) : null}
                <Action
                  action={updateAmenity.bind(null, a.id, { visible: !a.visible })}
                  label={a.visible ? 'Verbergen' : 'Tonen'}
                  variant="soft"
                />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadges({ status, visible }: { status: string; visible: boolean }) {
  return (
    <>
      {status === 'PROPOSED' ? <span className="badge badge-unverified">Voorstel</span> : null}
      {!visible ? (
        <span className="badge" style={{ background: '#eee', color: '#8a8a76' }}>
          Verborgen
        </span>
      ) : null}
    </>
  );
}

function Action({
  action,
  label,
  variant,
}: {
  action: () => Promise<void>;
  label: string;
  variant: 'primary' | 'soft';
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={`btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-soft'}`}
      >
        {label}
      </button>
    </form>
  );
}
