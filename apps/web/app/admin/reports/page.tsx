import { staffDb } from '@/lib/admin-db';
import { resolveReport } from '../actions';
import { ADMIN_PAGE_SIZE, Pagination, parsePage } from '../_components/table-ui';

/**
 * Reports queue for staff (ADMIN + MODERATOR).
 *
 * Filterable by ?status=open (default) or ?status=done.
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === 'done' ? 'done' : 'open';
  const page = parsePage(sp.page);
  const skip = (page - 1) * ADMIN_PAGE_SIZE;

  const db = await staffDb();

  const where = { resolved: statusFilter === 'done' };

  const [reports, total] = await Promise.all([
    db.report.findMany({
      where,
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: ADMIN_PAGE_SIZE,
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
    }),
    db.report.count({ where }),
  ]);

  // Resolve spot names for SPOT-type reports.
  const spotIds = reports.filter((r) => r.targetType === 'SPOT').map((r) => r.targetId);

  const spotMap = new Map<string, { name: string; slug: string }>();
  if (spotIds.length > 0) {
    const spots = await db.spot.findMany({
      where: { id: { in: spotIds } },
      select: { id: true, name: true, slug: true },
    });
    for (const s of spots) {
      spotMap.set(s.id, { name: s.name, slug: s.slug });
    }
  }

  const basePath = '/admin/reports';

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 16px' }}>Meldingen</h1>

      <div className="admin-toolbar">
        <nav style={{ display: 'flex', gap: 8 }}>
          <a
            href={basePath}
            className={statusFilter === 'open' ? 'filter-link active' : 'filter-link'}
          >
            Open
          </a>
          <a
            href={`${basePath}?status=done`}
            className={statusFilter === 'done' ? 'filter-link active' : 'filter-link'}
          >
            Afgehandeld
          </a>
        </nav>
        <span className="admin-count">
          {total} {total === 1 ? 'melding' : 'meldingen'}
        </span>
      </div>

      {reports.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          {statusFilter === 'open' ? 'Geen open meldingen.' : 'Geen afgehandelde meldingen.'}
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="row-title">Doel</th>
                  <th>Reden</th>
                  <th>Notitie</th>
                  <th>Melder</th>
                  <th>Datum</th>
                  <th className="actions">Status / Actie</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const spot = r.targetType === 'SPOT' ? spotMap.get(r.targetId) : undefined;
                  const dateStr = new Date(r.createdAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const reporterLabel = r.reporter.handle ?? r.reporter.name ?? 'Onbekend';

                  return (
                    <tr key={r.id}>
                      <td className="row-title">
                        {spot ? (
                          <a href={`/plek/${spot.slug}`}>{spot.name}</a>
                        ) : (
                          `${TARGET_LABELS[r.targetType] ?? r.targetType} · ${r.targetId.slice(0, 8)}`
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: 'var(--terra-soft)', color: 'var(--terra-700)' }}
                        >
                          {REASON_LABELS[r.reason] ?? r.reason}
                        </span>
                      </td>
                      <td>{r.note ?? <span className="muted">—</span>}</td>
                      <td>{reporterLabel}</td>
                      <td>{dateStr}</td>
                      <td className="actions">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            basePath={basePath}
            page={page}
            total={total}
            params={{ status: statusFilter === 'done' ? 'done' : undefined }}
          />
        </>
      )}
    </div>
  );
}
