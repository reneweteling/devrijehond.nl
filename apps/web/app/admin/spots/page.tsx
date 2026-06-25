import { staffDb } from '@/lib/admin-db';
import { parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
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
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const activeFilter = isValidStatus(sp.status) ? sp.status : undefined;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() || undefined;

  const where = {
    ...(activeFilter ? { status: activeFilter } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const db = await staffDb();

  const [spots, total] = await Promise.all([
    db.spot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
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
    }),
    db.spot.count({ where }),
  ]);

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
      <SpotsTable rows={rows} statusFilter={activeFilter} page={page} total={total} query={q} />
    </div>
  );
}
