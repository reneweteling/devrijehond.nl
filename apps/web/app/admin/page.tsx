import { adminDb } from '@/lib/admin-db';
import { restoreSpot, forceVerifySpot, removeSpot, resolveReport } from './actions';

/**
 * Admin, needs-attention queue (the moderation safety-net).
 *
 * Surfaces: auto-hidden spots, spots with open reports, and contested spots
 * (high deny count but not yet hidden). Each row offers restore / force-verify
 * / remove via server actions that also write an AdminAction log row.
 *
 * Role gate: `proxy.ts` redirects non-admins; `adminDb()` re-asserts ADMIN and
 * yields a policy-bound client that can read HIDDEN/REMOVED content.
 */
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const db = await adminDb();

  const [hidden, contested, openReports] = await Promise.all([
    db.spot.findMany({
      where: { status: 'HIDDEN' },
      orderBy: { hiddenAt: 'desc' },
      take: 50,
      select: { id: true, name: true, slug: true, denyCount: true, netScore: true },
    }),
    db.spot.findMany({
      where: { status: 'UNVERIFIED', denyCount: { gte: 1 } },
      orderBy: { denyCount: 'desc' },
      take: 50,
      select: { id: true, name: true, slug: true, denyCount: true, netScore: true },
    }),
    db.report.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, targetType: true, targetId: true, reason: true, note: true },
    }),
  ]);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px' }}>
      <h1>Needs attention</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Auto-hidden spots ({hidden.length})</h2>
        {hidden.length === 0 ? <p>Niets verborgen.</p> : null}
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {hidden.map((s) => (
            <li key={s.id} style={rowStyle}>
              <span>
                {s.name}{' '}
                <small style={{ color: '#9a7b3f' }}>
                  deny {s.denyCount} · net {s.netScore}
                </small>
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <form action={restoreSpot.bind(null, s.id)}>
                  <button type="submit">Restore</button>
                </form>
                <form action={forceVerifySpot.bind(null, s.id)}>
                  <button type="submit">Force-verify</button>
                </form>
                <form action={removeSpot.bind(null, s.id, undefined)}>
                  <button type="submit">Remove</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Contested ({contested.length})</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {contested.map((s) => (
            <li key={s.id} style={rowStyle}>
              <span>
                {s.name} <small style={{ color: '#9a7b3f' }}>deny {s.denyCount}</small>
              </span>
              <form action={forceVerifySpot.bind(null, s.id)}>
                <button type="submit">Force-verify</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Open reports ({openReports.length})</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {openReports.map((r) => (
            <li key={r.id} style={rowStyle}>
              <span>
                {r.targetType} · {r.reason}
                {r.note ? <small style={{ color: '#4a5a4d' }}>, {r.note}</small> : null}
              </span>
              <form action={resolveReport.bind(null, r.id)}>
                <button type="submit">Resolve</button>
              </form>
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
