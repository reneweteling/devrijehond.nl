import { adminDb, currentStaff } from '@/lib/admin-db';
import { UsersTable, type UserRow } from './users-table';

/**
 * User management — ADMIN only. Lists every user with role, reputation and
 * activity counts. The full row set is fetched server-side and handed to the
 * client DataTable which handles search/sort/pagination in the browser.
 *
 * `adminDb()` throws a 403 Response if the caller is a MODERATOR, so no
 * additional role check is needed here.
 */
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [db, me] = await Promise.all([adminDb(), currentStaff()]);

  const [users, totalUsers, totalMods, totalAdmins] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        handle: true,
        role: true,
        reputation: true,
        createdAt: true,
        _count: { select: { spots: true } },
      },
    }),
    db.user.count(),
    db.user.count({ where: { role: 'MODERATOR' } }),
    db.user.count({ where: { role: 'ADMIN' } }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    handle: u.handle,
    role: u.role,
    reputation: u.reputation,
    spotCount: u._count.spots,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Gebruikers</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        Alle geregistreerde gebruikers. Verander hier de rol; moderatoren kunnen content beoordelen,
        beheerders kunnen alles.
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="n">{totalUsers}</div>
          <div className="l">gebruikers totaal</div>
        </div>
        <div className="admin-stat">
          <div className="n">{totalMods}</div>
          <div className="l">moderatoren</div>
        </div>
        <div className="admin-stat">
          <div className="n">{totalAdmins}</div>
          <div className="l">beheerders</div>
        </div>
      </div>

      <UsersTable rows={rows} currentUserId={me.id} />
    </div>
  );
}
