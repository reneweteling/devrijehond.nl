import { staffDb } from '@/lib/admin-db';
import { ReportsTable, type ReportRow } from './_components/reports-table';

/**
 * Reports queue for staff (ADMIN + MODERATOR).
 *
 * Fetches all reports (no server pagination; client-side DataTable handles
 * sort/filter/paging). For SPOT reports the spot name/slug is resolved.
 */
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === 'done' ? 'done' : 'open';

  const db = await staffDb();

  const reports = await db.report.findMany({
    orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
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

  const rows: ReportRow[] = reports
    .filter((r) => (statusFilter === 'open' ? !r.resolved : r.resolved))
    .map((r) => {
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
      };
    });

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 24px' }}>Meldingen</h1>
      <ReportsTable rows={rows} statusFilter={statusFilter} />
    </div>
  );
}
