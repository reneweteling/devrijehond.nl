import { adminDb, currentStaff } from '@/lib/admin-db';
import { parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
import { UsersTable, type UserRow } from './users-table';

/**
 * User management — ADMIN only. Lists users with role, reputation and spot
 * count. Paging, search and field edits are all server-driven: this page reads
 * `?page` / `?q` from the URL, fetches only the rows shown (take + skip) and the
 * total count, and selects only the columns the table renders.
 *
 * `adminDb()` throws a 403 Response if the caller is a MODERATOR, so no extra
 * role check is needed here.
 */
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() || undefined;

  const [db, me] = await Promise.all([adminDb(), currentStaff()]);

  // Optional search across name / handle / email (case-insensitive).
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { handle: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total, totalMods, totalAdmins] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
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
    db.user.count({ where }),
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
        Alle geregistreerde gebruikers. Verander hier de rol of bewerk een profiel; moderatoren
        kunnen content beoordelen, beheerders kunnen alles.
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="n">{total}</div>
          <div className="l">{q ? 'gevonden' : 'gebruikers totaal'}</div>
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

      <UsersTable rows={rows} currentUserId={me.id} page={page} total={total} query={q} />
    </div>
  );
}
