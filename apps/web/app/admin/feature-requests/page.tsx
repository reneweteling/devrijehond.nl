import { adminDb } from '@/lib/admin-db';
import { setFeatureStatus } from '../actions';

/**
 * Admin control over the public "Wensen" board. Lists feature requests by
 * upvotes and lets an admin set the status (CONSIDERING / PLANNED / DONE /
 * DECLINED), which the mobile app surfaces back to the community.
 */
export const dynamic = 'force-dynamic';

const STATUSES = ['CONSIDERING', 'PLANNED', 'DONE', 'DECLINED'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  CONSIDERING: { label: 'In overweging', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  PLANNED: { label: 'Gepland', bg: '#dde6f2', fg: '#3a5a86' },
  DONE: { label: 'Gedaan', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  DECLINED: { label: 'Afgewezen', bg: '#eee', fg: '#8a8a76' },
};

export default async function AdminFeatureRequestsPage() {
  const db = await adminDb();
  const requests = await db.featureRequest.findMany({
    orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: { id: true, title: true, body: true, component: true, status: true, upvoteCount: true },
  });

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Wensen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        De wensen die de community indient en omhoog stemt. Zet de status; de app laat die
        terugzien.
      </p>

      {requests.length === 0 ? (
        <p className="muted">Nog geen wensen ingediend.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {requests.map((r) => {
            const meta = STATUS_META[r.status as Status];
            return (
              <div key={r.id} className="card" style={{ padding: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                    >
                      <strong style={{ fontSize: 16 }}>{r.title}</strong>
                      <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
                        {meta.label}
                      </span>
                      {r.component ? <small className="muted">· {r.component}</small> : null}
                    </div>
                    {r.body ? (
                      <p
                        className="muted"
                        style={{ fontSize: 14.5, marginTop: 6, maxWidth: '70ch' }}
                      >
                        {r.body}
                      </p>
                    ) : null}
                  </div>
                  <div
                    style={{
                      flex: 'none',
                      textAlign: 'center',
                      background: 'var(--sand)',
                      borderRadius: 12,
                      padding: '8px 12px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display-stack)',
                        fontSize: 20,
                        fontWeight: 600,
                      }}
                    >
                      {r.upvoteCount}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      stemmen
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <form key={s} action={setFeatureStatus.bind(null, r.id, s)}>
                      <button type="submit" className="btn btn-sm btn-soft">
                        → {STATUS_META[s].label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
