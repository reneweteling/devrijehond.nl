import { adminDb } from '@/lib/admin-db';
import { restoreSpot, forceVerifySpot, removeSpot, resolveReport } from './actions';

/**
 * Admin needs-attention queue (the moderation safety-net).
 *
 * Surfaces auto-hidden spots, contested spots (deny votes but not yet hidden)
 * and open reports. Each row offers restore / force-verify / remove / resolve
 * via server actions that also write an AdminAction log row.
 *
 * Role gate: proxy.ts redirects non-admins; adminDb() re-asserts ADMIN and
 * yields a policy-bound client that can read HIDDEN/REMOVED content.
 */
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const db = await adminDb();

  const [hidden, contested, openReports, totalSpots, verifiedSpots] = await Promise.all([
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
    db.spot.count({ where: { status: { in: ['VERIFIED', 'UNVERIFIED'] } } }),
    db.spot.count({ where: { status: 'VERIFIED' } }),
  ]);

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 20px' }}>
        Wat vraagt aandacht
      </h1>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="n">{totalSpots}</div>
          <div className="l">plekken totaal</div>
        </div>
        <div className="admin-stat">
          <div className="n">{verifiedSpots}</div>
          <div className="l">geverifieerd</div>
        </div>
        <div className="admin-stat">
          <div className="n" style={{ color: hidden.length ? 'var(--rust,#a33b2d)' : undefined }}>
            {hidden.length}
          </div>
          <div className="l">verborgen</div>
        </div>
        <div className="admin-stat">
          <div className="n" style={{ color: openReports.length ? 'var(--terra)' : undefined }}>
            {openReports.length}
          </div>
          <div className="l">open meldingen</div>
        </div>
      </div>

      <Section title="Automatisch verborgen" count={hidden.length} empty="Niets verborgen.">
        {hidden.map((s) => (
          <div key={s.id} className="admin-row">
            <span>
              <strong>{s.name}</strong>{' '}
              <small className="muted">
                deny {s.denyCount} · net {s.netScore}
              </small>
            </span>
            <span className="actions">
              <Action action={restoreSpot.bind(null, s.id)} label="Herstellen" variant="soft" />
              <Action
                action={forceVerifySpot.bind(null, s.id)}
                label="Verifiëren"
                variant="primary"
              />
              <Action
                action={removeSpot.bind(null, s.id, undefined)}
                label="Verwijderen"
                variant="danger"
              />
            </span>
          </div>
        ))}
      </Section>

      <Section title="Betwist" count={contested.length} empty="Niets betwist.">
        {contested.map((s) => (
          <div key={s.id} className="admin-row">
            <span>
              <strong>{s.name}</strong> <small className="muted">deny {s.denyCount}</small>
            </span>
            <span className="actions">
              <Action
                action={forceVerifySpot.bind(null, s.id)}
                label="Verifiëren"
                variant="primary"
              />
              <Action
                action={removeSpot.bind(null, s.id, undefined)}
                label="Verwijderen"
                variant="danger"
              />
            </span>
          </div>
        ))}
      </Section>

      <Section title="Open meldingen" count={openReports.length} empty="Geen open meldingen.">
        {openReports.map((r) => (
          <div key={r.id} className="admin-row">
            <span>
              <strong>{r.targetType}</strong> · {r.reason}
              {r.note ? <small className="muted"> · {r.note}</small> : null}
            </span>
            <span className="actions">
              <Action action={resolveReport.bind(null, r.id)} label="Afhandelen" variant="soft" />
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, marginBottom: 14 }}>
        {title}{' '}
        <span className="muted" style={{ fontWeight: 400 }}>
          ({count})
        </span>
      </h2>
      {count === 0 ? (
        <p className="muted" style={{ fontSize: 14.5 }}>
          {empty}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>{children}</div>
      )}
    </section>
  );
}

function Action({
  action,
  label,
  variant,
}: {
  action: () => Promise<void>;
  label: string;
  variant: 'primary' | 'soft' | 'danger';
}) {
  const cls =
    variant === 'primary'
      ? 'btn btn-sm btn-primary'
      : variant === 'danger'
        ? 'btn btn-sm btn-danger'
        : 'btn btn-sm btn-soft';
  return (
    <form action={action}>
      <button type="submit" className={cls}>
        {label}
      </button>
    </form>
  );
}
