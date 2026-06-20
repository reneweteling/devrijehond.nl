import { staffDb } from '@/lib/admin-db';
import { promoteCategory, promoteAmenity, updateCategory, updateAmenity } from '../actions';
import { ADMIN_PAGE_SIZE, AdminSearch, Pagination, parsePage } from '../_components/table-ui';

/**
 * Admin taxonomy curation. Lists categories + amenities with their visibility /
 * status, and lets an admin promote a PROPOSED (community-suggested) entry to
 * ACTIVE or toggle visibility. Mutations go through the server actions.
 */
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; catPage?: string; amPage?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const catPage = parsePage(sp.catPage);
  const amPage = parsePage(sp.amPage);
  const catSkip = (catPage - 1) * ADMIN_PAGE_SIZE;
  const amSkip = (amPage - 1) * ADMIN_PAGE_SIZE;

  const db = await staffDb();

  const where = q ? { label: { contains: q, mode: 'insensitive' as const } } : undefined;

  const [categories, catTotal, amenities, amTotal] = await Promise.all([
    db.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      skip: catSkip,
      take: ADMIN_PAGE_SIZE,
    }),
    db.category.count({ where }),
    db.amenity.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      skip: amSkip,
      take: ADMIN_PAGE_SIZE,
    }),
    db.amenity.count({ where }),
  ]);

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Taxonomie</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 16 }}>
        Categorieën en voorzieningen groeien mee met de community. Nieuwe voorstellen komen binnen
        als PROPOSED; promoot ze of verberg ze hier.
      </p>

      <div className="admin-toolbar">
        <AdminSearch
          basePath="/admin/taxonomy"
          q={q}
          placeholder="Zoeken op label…"
          keep={{
            catPage: catPage > 1 ? String(catPage) : undefined,
            amPage: amPage > 1 ? String(amPage) : undefined,
          }}
        />
        <span className="admin-count">{catTotal + amTotal} resultaten</span>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Categorieën</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th className="num">Volgorde</th>
                <th>Status</th>
                <th>Zichtbaar</th>
                <th className="actions">Acties</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                    Geen categorieën gevonden.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className="row-title">{c.label}</td>
                    <td>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {c.type}
                      </span>
                    </td>
                    <td className="num">{c.sortOrder}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.visible ? null : (
                        <span className="badge" style={{ background: '#eee', color: '#8a8a76' }}>
                          Verborgen
                        </span>
                      )}
                    </td>
                    <td className="actions">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/admin/taxonomy"
          page={catPage}
          total={catTotal}
          params={{ q, amPage: amPage > 1 ? String(amPage) : undefined, catPage: undefined }}
        />
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Voorzieningen</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th className="num">Volgorde</th>
                <th>Status</th>
                <th>Zichtbaar</th>
                <th className="actions">Acties</th>
              </tr>
            </thead>
            <tbody>
              {amenities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                    Geen voorzieningen gevonden.
                  </td>
                </tr>
              ) : (
                amenities.map((a) => (
                  <tr key={a.id}>
                    <td className="row-title">{a.label}</td>
                    <td className="num">{a.sortOrder}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      {a.visible ? null : (
                        <span className="badge" style={{ background: '#eee', color: '#8a8a76' }}>
                          Verborgen
                        </span>
                      )}
                    </td>
                    <td className="actions">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/admin/taxonomy"
          page={amPage}
          total={amTotal}
          params={{ q, catPage: catPage > 1 ? String(catPage) : undefined, amPage: undefined }}
        />
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PROPOSED') {
    return <span className="badge badge-unverified">Voorstel</span>;
  }
  return (
    <span className="muted" style={{ fontSize: 13 }}>
      {status}
    </span>
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
