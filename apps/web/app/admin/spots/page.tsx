import { staffDb } from '@/lib/admin-db';
import { SpotsTable, type SpotRow } from './spots-table';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['UNVERIFIED', 'VERIFIED', 'HIDDEN', 'REMOVED'] as const;
type SpotStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string | undefined): value is SpotStatus {
  return VALID_STATUSES.includes(value as SpotStatus);
}

export default async function AdminSpotsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const activeFilter = isValidStatus(sp.status) ? sp.status : undefined;

  const db = await staffDb();

  const spots = await db.spot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      denyCount: true,
      netScore: true,
      createdAt: true,
      category: { select: { label: true } },
      submittedBy: { select: { handle: true, name: true } },
    },
  });

  const rows: SpotRow[] = spots.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    type: s.type,
    status: s.status as SpotStatus,
    netScore: s.netScore,
    denyCount: s.denyCount,
    createdAt: s.createdAt.toISOString(),
    categoryLabel: s.category?.label ?? null,
    submitterLabel: s.submittedBy
      ? (s.submittedBy.handle ?? s.submittedBy.name ?? 'onbekend')
      : 'onbekend',
  }));

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 20px' }}>Plekken</h1>
      <SpotsTable rows={rows} statusFilter={activeFilter} />
    </div>
  );
}
