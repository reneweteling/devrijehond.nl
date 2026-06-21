import { staffDb } from '@/lib/admin-db';
import { FeatureRequestsTable, type FeatureRequestRow } from './_components/feature-requests-table';

/**
 * Admin control over the public "Wensen" board. Lists feature requests by
 * upvotes and lets an admin set the status (CONSIDERING / PLANNED / DONE /
 * DECLINED), which the mobile app surfaces back to the community.
 *
 * Fetches all rows (admin data volumes are small); client-side DataTable handles
 * sort/search/paging.
 */
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['CONSIDERING', 'PLANNED', 'DONE', 'DECLINED'] as const;
type Status = (typeof VALID_STATUSES)[number];

function isValidStatus(v: string | undefined): v is Status {
  return VALID_STATUSES.includes(v as Status);
}

export default async function AdminFeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = isValidStatus(sp.status) ? sp.status : '';

  const db = await staffDb();

  const requests = await db.featureRequest.findMany({
    orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      body: true,
      component: true,
      status: true,
      upvoteCount: true,
      createdAt: true,
    },
  });

  const rows: FeatureRequestRow[] = requests
    .filter((r) => (statusFilter ? r.status === statusFilter : true))
    .map((r) => ({
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
    </div>
  );
}
