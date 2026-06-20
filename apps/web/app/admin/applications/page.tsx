import { adminDb } from '@/lib/admin-db';
import { approveModeratorApplication, rejectModeratorApplication } from '../actions';

/**
 * Moderator-application review — ADMIN only. Lists all applications ordered by
 * PENDING first, then newest first. For pending rows the admin can approve or
 * reject via server action forms.
 *
 * `adminDb()` throws 403 for MODERATOR callers, so no additional role check
 * needed here.
 */
export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'In behandeling', bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { label: 'Goedgekeurd', bg: '#d1fae5', fg: '#065f46' },
  REJECTED: { label: 'Afgewezen', bg: '#fee2e2', fg: '#991b1b' },
};

const ROLE_META: Record<string, { label: string; bg: string; fg: string }> = {
  USER: { label: 'Gebruiker', bg: '#eee', fg: '#5a5a4a' },
  MODERATOR: { label: 'Moderator', bg: '#dde6f2', fg: '#3a5a86' },
  ADMIN: { label: 'Admin', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
};

export default async function ApplicationsPage() {
  const db = await adminDb();

  const applications = await db.moderatorApplication.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { name: true, email: true, handle: true, role: true } },
    },
  });

  const pending = applications.filter((a) => a.status === 'PENDING').length;

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Aanmeldingen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        Gebruikers die zich hebben aangemeld als moderator. Keur goed om de rol direct te zetten op
        Moderator, of wijs af.
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="n">{applications.length}</div>
          <div className="l">aanmeldingen totaal</div>
        </div>
        <div className="admin-stat">
          <div className="n">{pending}</div>
          <div className="l">in behandeling</div>
        </div>
        <div className="admin-stat">
          <div className="n">{applications.filter((a) => a.status === 'APPROVED').length}</div>
          <div className="l">goedgekeurd</div>
        </div>
      </div>

      {applications.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>
          Nog geen aanmeldingen.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--line)',
                  textAlign: 'left',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                }}
              >
                <th style={{ padding: '8px 12px 8px 0', fontWeight: 500 }}>Aanmelder</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Motivatie</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Rol</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Aangemeld op</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const statusMeta = STATUS_META[app.status] ?? {
                  label: app.status,
                  bg: '#eee',
                  fg: '#5a5a4a',
                };
                const roleMeta = ROLE_META[app.user.role] ?? {
                  label: app.user.role,
                  bg: '#eee',
                  fg: '#5a5a4a',
                };
                return (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                      <strong>{app.user.name ?? '—'}</strong>
                      {app.user.handle ? (
                        <span className="muted" style={{ marginLeft: 6, fontSize: 13 }}>
                          @{app.user.handle}
                        </span>
                      ) : null}
                      <br />
                      <span className="muted" style={{ fontSize: 13 }}>
                        {app.user.email}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        verticalAlign: 'top',
                        maxWidth: 360,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {app.motivation}
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <span
                        className="badge"
                        style={{ background: roleMeta.bg, color: roleMeta.fg }}
                      >
                        {roleMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <span
                        className="badge"
                        style={{ background: statusMeta.bg, color: statusMeta.fg }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td
                      className="muted"
                      style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}
                    >
                      {new Date(app.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      {app.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <form action={approveModeratorApplication.bind(null, app.id)}>
                            <button type="submit" className="btn btn-sm btn-primary">
                              Goedkeuren
                            </button>
                          </form>
                          <form action={rejectModeratorApplication.bind(null, app.id)}>
                            <button type="submit" className="btn btn-sm btn-soft">
                              Afwijzen
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 13 }}>
                          Afgehandeld
                        </span>
                      )}
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
