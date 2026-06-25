import { staffDb } from '@/lib/admin-db';
import { ADMIN_PAGE_SIZE, parsePage } from '../_components/table-ui';
import { ReportsTable, type ReportRow, type ReportFilter } from './_components/reports-table';

/**
 * Reports queue for staff (ADMIN + MODERATOR).
 *
 * Server-paginated: we fetch only one page (ADMIN_PAGE_SIZE) plus a count,
 * ordered [resolved asc, createdAt desc] (open first), filtered by ?filter.
 * The [resolved, createdAt] index backs this query, so it scales to many rows.
 * The table is presentational; paging + filter live in the URL.
 */
export const dynamic = 'force-dynamic';

const FILTERS = ['open', 'resolved', 'all'] as const;

function parseFilter(raw: string | undefined): ReportFilter {
  return (FILTERS as readonly string[]).includes(raw ?? '') ? (raw as ReportFilter) : 'open';
}

function whereFor(filter: ReportFilter) {
  if (filter === 'open') return { resolved: false };
  if (filter === 'resolved') return { resolved: true };
  return {};
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const filter = parseFilter(sp.filter);
  const where = whereFor(filter);

  const db = await staffDb();

  const [reports, total] = await Promise.all([
    db.report.findMany({
      where,
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
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

  // Resolve spot names only for SPOT-type reports on this page (one extra query,
  // scoped to the visible page so it stays cheap).
  const spotIds = reports.filter((r) => r.targetType === 'SPOT').map((r) => r.targetId);
  const spotMap = new Map<string, { name: string; slug: string; type: string }>();
  if (spotIds.length > 0) {
    const spots = await db.spot.findMany({
      where: { id: { in: spotIds } },
      select: { id: true, name: true, slug: true, type: true },
    });
    for (const s of spots) spotMap.set(s.id, { name: s.name, slug: s.slug, type: s.type });
  }

  const rows: ReportRow[] = reports.map((r) => {
    const spot = r.targetType === 'SPOT' ? spotMap.get(r.targetId) : undefined;
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      note: r.note,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
      reporterLabel: r.reporter.handle ?? r.reporter.name ?? 'Onbekend',
      spotName: spot?.name ?? null,
      spotSlug: spot?.slug ?? null,
      spotType: spot?.type ?? null,
    };
  });

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 24px' }}>Meldingen</h1>
      <ReportsTable rows={rows} page={page} total={total} filter={filter} />
    </div>
  );
}
