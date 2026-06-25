import { adminDb } from '@/lib/admin-db';
import { parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
import { ApplicationsTable, type ApplicationRow } from './applications-table';

/**
 * Moderator-application review, ADMIN only. Lists applications server-side
 * paginated with a status filter (PENDING by default). `adminDb()` throws 403
 * for MODERATOR callers, so no extra role check is needed here.
 *
 * orderBy [status, createdAt desc] matches the @@index([status, createdAt]).
 */
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type AppStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string | undefined): value is AppStatus {
  return VALID_STATUSES.includes(value as AppStatus);
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  // Default to the queue you actually act on: pending applications.
  // ?status=ALL drops the filter; an unknown value also falls back to PENDING.
  const activeFilter: AppStatus | undefined =
    sp.status === 'ALL' ? undefined : isValidStatus(sp.status) ? sp.status : 'PENDING';
  const page = parsePage(sp.page);

  const where = activeFilter ? { status: activeFilter } : {};

  const db = await adminDb();

  const [applications, total] = await Promise.all([
    db.moderatorApplication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        motivation: true,
        createdAt: true,
        user: { select: { name: true, handle: true, role: true } },
      },
    }),
    db.moderatorApplication.count({ where }),
  ]);

  const rows: ApplicationRow[] = applications.map((app) => ({
    id: app.id,
    userName: app.user.name,
    userHandle: app.user.handle,
    userRole: app.user.role,
    motivation: app.motivation,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
  }));

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Aanmeldingen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        Gebruikers die zich hebben aangemeld als moderator. Keur goed om de rol direct te zetten op
        Moderator, of wijs af.
      </p>

      <ApplicationsTable
        rows={rows}
        statusFilter={activeFilter}
        // The raw ?status value drives pagination links so ALL survives paging.
        statusParam={sp.status === 'ALL' ? 'ALL' : activeFilter}
        page={page}
        total={total}
      />
    </div>
  );
}
