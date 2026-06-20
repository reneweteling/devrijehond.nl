import { adminDb } from '@/lib/admin-db';
import { setUserRole } from '../actions';

/**
 * User management — ADMIN only. Lists every user with their role, reputation
 * and activity counts. Each row has three role buttons; clicking one sets that
 * role via a server action.
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

export default async function AdminUsersPage() {
  const db = await adminDb();

  const users = await db.user.findMany({
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      handle: true,
      role: true,
      reputation: true,
      createdAt: true,
      _count: { select: { spots: true, reports: true } },
    },
  });

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
          <div className="n">{users.length}</div>
          <div className="l">gebruikers totaal</div>
        </div>
        <div className="admin-stat">
          <div className="n">{users.filter((u) => u.role === 'MODERATOR').length}</div>
          <div className="l">moderatoren</div>
        </div>
        <div className="admin-stat">
          <div className="n">{users.filter((u) => u.role === 'ADMIN').length}</div>
          <div className="l">beheerders</div>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="muted">Nog geen gebruikers.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14.5,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--line)',
                  textAlign: 'left',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                }}
              >
                <th style={{ padding: '8px 12px 8px 0', fontWeight: 500 }}>Naam</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>E-mail</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Reputatie</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Plekken</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Lid sinds</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const currentRole = u.role as Role;
                const meta = ROLE_META[currentRole] ?? ROLE_META.USER;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'middle' }}>
                      <strong>{u.name ?? '—'}</strong>
                      {u.handle ? (
                        <span className="muted" style={{ marginLeft: 6, fontSize: 13 }}>
                          @{u.handle}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="muted"
                      style={{ padding: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
                    >
                      {u.email}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {u.reputation}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {u._count.spots}
                    </td>
                    <td
                      className="muted"
                      style={{ padding: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
                    >
                      {new Date(u.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                      <div
                        style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <span
                          className="badge"
                          style={{ background: meta.bg, color: meta.fg, marginRight: 4 }}
                        >
                          {meta.label}
                        </span>
                        {ROLES.filter((r) => r !== currentRole).map((role) => (
                          <form key={role} action={setUserRole.bind(null, u.id, role)}>
                            <button type="submit" className="btn btn-sm btn-soft">
                              → {ROLE_META[role].label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
