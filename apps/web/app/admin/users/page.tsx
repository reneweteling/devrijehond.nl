import { adminDb, currentStaff } from '@/lib/admin-db';
import { AdminSearch, Pagination, parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
import { setUserRole } from '../actions';

/**
 * User management — ADMIN only. Lists every user with role, reputation and
 * activity counts. Supports search (name/email/handle) and URL-driven pagination.
 *
 * `adminDb()` throws a 403 Response if the caller is a MODERATOR, so no
 * additional role check is needed here.
 */
export const dynamic = 'force-dynamic';

const ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

const ROLE_META: Record<Role, { label: string; bg: string; fg: string }> = {
  USER: { label: 'Gebruiker', bg: '#eee', fg: '#5a5a4a' },
  MODERATOR: { label: 'Moderator', bg: '#dde6f2', fg: '#3a5a86' },
  ADMIN: { label: 'Admin', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = parsePage(sp.page);
  const skip = (page - 1) * ADMIN_PAGE_SIZE;

  const [db, me] = await Promise.all([adminDb(), currentStaff()]);

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { handle: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const orderBy = [{ role: 'desc' as const }, { createdAt: 'asc' as const }];

  const [users, total, totalUsers, totalMods, totalAdmins] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip,
      take: ADMIN_PAGE_SIZE,
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
    db.user.count(),
    db.user.count({ where: { role: 'MODERATOR' } }),
    db.user.count({ where: { role: 'ADMIN' } }),
  ]);

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

      <div className="admin-toolbar">
        <AdminSearch basePath="/admin/users" q={q} placeholder="Zoek op naam, e-mail of handle…" />
        <span className="admin-count">{total} resultaten</span>
      </div>

      {users.length === 0 ? (
        <p className="muted">Geen gebruikers gevonden.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mail</th>
                <th>Rol</th>
                <th className="num">Reputatie</th>
                <th className="num">Plekken</th>
                <th>Lid sinds</th>
                <th className="actions">Rol-acties</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const currentRole = u.role as Role;
                const meta = ROLE_META[currentRole] ?? ROLE_META.USER;
                const isSelf = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td className="row-title">
                      {u.name ?? '—'}
                      {u.handle ? (
                        <span
                          className="muted"
                          style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}
                        >
                          @{u.handle}
                        </span>
                      ) : null}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="num">{u.reputation}</td>
                    <td className="num">{u._count.spots}</td>
                    <td className="muted">
                      {new Date(u.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="actions">
                      {isSelf ? (
                        <span className="muted" style={{ fontSize: 13 }}>
                          eigen account
                        </span>
                      ) : (
                        ROLES.filter((r) => r !== currentRole).map((role) => (
                          <form key={role} action={setUserRole.bind(null, u.id, role)}>
                            <button type="submit" className="btn btn-sm btn-soft">
                              {ROLE_META[role].label}
                            </button>
                          </form>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/admin/users" page={page} total={total} params={{ q }} />
    </div>
  );
}
