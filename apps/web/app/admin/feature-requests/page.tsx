import { staffDb } from '@/lib/admin-db';
import { setFeatureStatus } from '../actions';
import { ADMIN_PAGE_SIZE, AdminSearch, Pagination, parsePage } from '../_components/table-ui';

/**
 * Admin control over the public "Wensen" board. Lists feature requests by
 * upvotes and lets an admin set the status (CONSIDERING / PLANNED / DONE /
 * DECLINED), which the mobile app surfaces back to the community.
 */
export const dynamic = 'force-dynamic';

const BASE = '/admin/feature-requests';

const STATUSES = ['CONSIDERING', 'PLANNED', 'DONE', 'DECLINED'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  CONSIDERING: { label: 'In overweging', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  PLANNED: { label: 'Gepland', bg: '#dde6f2', fg: '#3a5a86' },
  DONE: { label: 'Gedaan', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  DECLINED: { label: 'Afgewezen', bg: '#eee', fg: '#8a8a76' },
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  '': 'Alle',
  CONSIDERING: 'In overweging',
  PLANNED: 'Gepland',
  DONE: 'Gedaan',
  DECLINED: 'Afgewezen',
};

export default async function AdminFeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const statusFilter = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : '';
  const page = parsePage(sp.page);
  const skip = (page - 1) * ADMIN_PAGE_SIZE;

  const where = {
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const db = await staffDb();
  const [requests, total] = await Promise.all([
    db.featureRequest.findMany({
      where,
      orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        body: true,
        component: true,
        status: true,
        upvoteCount: true,
        createdAt: true,
      },
    }),
    db.featureRequest.count({ where }),
  ]);

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Wensen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        De wensen die de community indient en omhoog stemt. Zet de status; de app laat die
        terugzien.
      </p>

      <div className="admin-toolbar">
        <AdminSearch
          basePath={BASE}
          q={q}
          placeholder="Zoeken op titel…"
          keep={{ status: statusFilter || undefined }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => {
            const active = value === statusFilter;
            return (
              <a
                key={value}
                href={
                  value
                    ? `${BASE}?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ''}`
                    : `${BASE}${q ? `?q=${encodeURIComponent(q)}` : ''}`
                }
                className={`btn btn-sm${active ? ' btn-primary' : ' btn-soft'}`}
              >
                {label}
              </a>
            );
          })}
        </div>
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Onderdeel</th>
              <th>Status</th>
              <th className="num">Stemmen</th>
              <th>Datum</th>
              <th className="actions">Status-actie</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                  Geen wensen gevonden.
                </td>
              </tr>
            ) : (
              requests.map((r) => {
                const meta = STATUS_META[r.status as Status];
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="row-title">{r.title}</span>
                      {r.body ? (
                        <span
                          className="muted"
                          style={{ display: 'block', fontSize: 13, marginTop: 2 }}
                        >
                          {r.body.length > 100 ? `${r.body.slice(0, 100)}…` : r.body}
                        </span>
                      ) : null}
                    </td>
                    <td>{r.component ?? <span className="muted">—</span>}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="num">{r.upvoteCount}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.createdAt.toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="actions">
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {STATUSES.filter((s) => s !== r.status).map((s) => (
                          <form key={s} action={setFeatureStatus.bind(null, r.id, s)}>
                            <button type="submit" className="btn btn-sm btn-soft">
                              {STATUS_META[s].label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath={BASE}
        page={page}
        total={total}
        params={{ q: q || undefined, status: statusFilter || undefined }}
      />
    </div>
  );
}
