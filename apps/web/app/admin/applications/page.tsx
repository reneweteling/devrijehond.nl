import { adminDb } from '@/lib/admin-db';
import { ApplicationsTable, type ApplicationRow } from './applications-table';

/**
 * Moderator-application review — ADMIN only. Lists all applications; the
 * client DataTable handles search, sort, pagination, and status filtering.
 *
 * `adminDb()` throws 403 for MODERATOR callers, so no additional role check
 * needed here.
 */
export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const db = await adminDb();

  const applications = await db.moderatorApplication.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      motivation: true,
      createdAt: true,
      user: { select: { name: true, email: true, handle: true, role: true } },
    },
  });

  const rows: ApplicationRow[] = applications.map((app) => ({
    id: app.id,
    userName: app.user.name,
    userEmail: app.user.email,
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

      <ApplicationsTable rows={rows} />
    </div>
  );
}
