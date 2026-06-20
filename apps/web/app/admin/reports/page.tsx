import { staffDb } from '@/lib/admin-db';
import { resolveReport } from '../actions';

/**
 * Reports queue for staff (ADMIN + MODERATOR).
 *
 * Shows all reports ordered by unresolved-first, then newest-first.
 * For SPOT reports, resolves the spot name and links to the spot page.
 * Each open report has an "Afhandelen" action; resolved rows show a muted tag.
 */
export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string> = {
  DUPLICATE: 'Duplicaat',
  SPAM: 'Spam',
  WRONG_INFO: 'Onjuiste info',
  INAPPROPRIATE: 'Ongepast',
  OTHER: 'Anders',
};

const TARGET_LABELS: Record<string, string> = {
  SPOT: 'Plek',
  PHOTO: 'Foto',
  REVIEW: 'Recensie',
};

export default async function AdminReportsPage() {
  const db = await staffDb();

  const reports = await db.report.findMany({
    orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      note: true,
      resolved: true,
      createdAt: true,
      reporter: { select: { handle: true, name: true } },
    },
  });

  // Resolve spot names for SPOT-type reports.
  const spotIds = reports.filter((r) => r.targetType === 'SPOT').map((r) => r.targetId);

  const spotMap = new Map<string, { name: string; slug: string; type: string }>();
  if (spotIds.length > 0) {
    const spots = await db.spot.findMany({
      where: { id: { in: spotIds } },
      select: { id: true, name: true, slug: true, type: true },
    });
    for (const s of spots) {
      spotMap.set(s.id, { name: s.name, slug: s.slug, type: s.type });
    }
  }

  const openCount = reports.filter((r) => !r.resolved).length;

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Meldingen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        {openCount === 0
          ? 'Geen open meldingen.'
          : `${openCount} open ${openCount === 1 ? 'melding' : 'meldingen'}.`}
      </p>

      {reports.length === 0 ? (
        <p className="muted">Nog geen meldingen binnengekomen.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {reports.map((r) => {
            const spot = r.targetType === 'SPOT' ? spotMap.get(r.targetId) : undefined;
            const dateStr = new Date(r.createdAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const reporterLabel = r.reporter.handle ?? r.reporter.name ?? 'Onbekend';

            return (
              <div key={r.id} className="admin-row">
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>
                      {spot ? (
                        <a href={`/plek/${spot.slug}`} style={{ color: 'inherit' }}>
                          {spot.name}
                        </a>
                      ) : (
                        `${TARGET_LABELS[r.targetType] ?? r.targetType} · ${r.targetId.slice(0, 8)}`
                      )}
                    </strong>
                    <span
                      className="badge"
                      style={{ background: 'var(--sand)', color: 'var(--ink-2)' }}
                    >
                      {TARGET_LABELS[r.targetType] ?? r.targetType}
                    </span>
                    <span
                      className="badge"
                      style={{ background: 'var(--terra-soft)', color: 'var(--terra-700)' }}
                    >
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 13.5 }}>
                    {r.note ? <span style={{ marginRight: 8 }}>{r.note}</span> : null}
                    door {reporterLabel} · {dateStr}
                  </span>
                </span>

                <span className="actions">
                  {r.resolved ? (
                    <span
                      className="badge"
                      style={{ background: '#eee', color: '#8a8a76', whiteSpace: 'nowrap' }}
                    >
                      Afgehandeld
                    </span>
                  ) : (
                    <form action={resolveReport.bind(null, r.id)}>
                      <button type="submit" className="btn btn-sm btn-soft">
                        Afhandelen
                      </button>
                    </form>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
