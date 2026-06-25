import { staffDb } from '@/lib/admin-db';
import { Pagination, parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
import { FeatureRequestsTable, type FeatureRequestRow } from './_components/feature-requests-table';

/**
 * Admin control over the public "Wensen" board. Lists feature requests and lets
 * staff set the status (CONSIDERING / PLANNED / DONE / DECLINED), which the
 * mobile app surfaces back to the community, or delete a request.
 *
 * Server-side pagination + optional ?status filter, ordered by status then
 * newest first (backed by the [status, createdAt] index).
 */
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['CONSIDERING', 'PLANNED', 'DONE', 'DECLINED'] as const;
type Status = (typeof VALID_STATUSES)[number];

function isValidStatus(v: string | undefined): v is Status {
  return VALID_STATUSES.includes(v as Status);
}

const BASE = '/admin/feature-requests';

export default async function AdminFeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = isValidStatus(sp.status) ? sp.status : '';
  const page = parsePage(sp.page);

  const where = statusFilter ? { status: statusFilter } : {};

  const db = await staffDb();

  const [requests, total] = await Promise.all([
    db.featureRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
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

  const rows: FeatureRequestRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    component: r.component,
    status: r.status,
    upvoteCount: r.upvoteCount,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Wensen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 24 }}>
        De wensen die de community indient en omhoog stemt. Zet de status; de app laat die
        terugzien.
      </p>
      <FeatureRequestsTable rows={rows} statusFilter={statusFilter} />
      <Pagination
        basePath={BASE}
        page={page}
        total={total}
        params={{ status: statusFilter || undefined }}
      />
    </div>
  );
}
