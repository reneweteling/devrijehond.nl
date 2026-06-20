import Link from 'next/link';
import { adminDb } from '@/lib/admin-db';
import { approveModeratorApplication, rejectModeratorApplication } from '../actions';
import { AdminSearch, Pagination, ADMIN_PAGE_SIZE, parsePage } from '../_components/table-ui';

/**
 * Moderator-application review — ADMIN only. Lists all applications with
 * search, status filter, and pagination.
 *
 * `adminDb()` throws 403 for MODERATOR callers, so no additional role check
 * needed here.
 */
export const dynamic = 'force-dynamic';

const BASE = '/admin/applications';

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type AppStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(v: string | undefined): v is AppStatus {
  return VALID_STATUSES.includes(v as AppStatus);
}

const STATUS_META: Record<AppStatus, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'In behandeling', bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { label: 'Goedgekeurd', bg: '#d1fae5', fg: '#065f46' },
  REJECTED: { label: 'Afgewezen', bg: '#fee2e2', fg: '#991b1b' },
};

const ROLE_META: Record<string, { label: string; bg: string; fg: string }> = {
  USER: { label: 'Gebruiker', bg: '#eee', fg: '#5a5a4a' },
  MODERATOR: { label: 'Moderator', bg: '#dde6f2', fg: '#3a5a86' },
  ADMIN: { label: 'Admin', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
};

const FILTER_OPTIONS: { label: string; value: AppStatus | '' }[] = [
  { label: 'Alle', value: '' },
  { label: 'In behandeling', value: 'PENDING' },
  { label: 'Goedgekeurd', value: 'APPROVED' },
  { label: 'Afgewezen', value: 'REJECTED' },
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const activeStatus = isValidStatus(sp.status) ? sp.status : undefined;
  const page = parsePage(sp.page);
  const skip = (page - 1) * ADMIN_PAGE_SIZE;

  const db = await adminDb();

  const where = {
    ...(activeStatus ? { status: activeStatus } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: 'insensitive' as const } } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
            { user: { handle: { contains: q, mode: 'insensitive' as const } } },
            { motivation: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [applications, total] = await Promise.all([
    db.moderatorApplication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        motivation: true,
        createdAt: true,
        user: { select: { name: true, email: true, handle: true, role: true } },
      },
    }),
    db.moderatorApplication.count({ where }),
  ]);

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Aanmeldingen</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 20 }}>
        Gebruikers die zich hebben aangemeld als moderator. Keur goed om de rol direct te zetten op
        Moderator, of wijs af.
      </p>

      <div className="admin-toolbar">
        <AdminSearch
          basePath={BASE}
          q={q}
          placeholder="Zoek op naam, e-mail of motivatie…"
          keep={{ status: activeStatus }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = (opt.value || undefined) === activeStatus;
            return (
              <Link
                key={opt.value || 'all'}
                href={opt.value ? `${BASE}?status=${opt.value}` : BASE}
                className="btn btn-sm"
                style={
                  isActive
                    ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
        <span className="admin-count">{total} resultaten</span>
      </div>

      {applications.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>
          {q || activeStatus
            ? 'Geen aanmeldingen gevonden voor deze filter.'
            : 'Nog geen aanmeldingen.'}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aanvrager</th>
                <th>E-mail</th>
                <th>Huidige rol</th>
                <th>Motivatie</th>
                <th>Status</th>
                <th>Datum</th>
                <th className="actions">Acties</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const statusMeta = STATUS_META[app.status as AppStatus] ?? {
                  label: app.status,
                  bg: '#eee',
                  fg: '#5a5a4a',
                };
                const roleMeta = ROLE_META[app.user.role] ?? {
                  label: app.user.role,
                  bg: '#eee',
                  fg: '#5a5a4a',
                };
                const date = new Date(app.createdAt).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <tr key={app.id}>
                    <td className="row-title">
                      {app.user.name ?? '—'}
                      {app.user.handle ? (
                        <span
                          className="muted"
                          style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}
                        >
                          @{app.user.handle}
                        </span>
                      ) : null}
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {app.user.email}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: roleMeta.bg, color: roleMeta.fg }}
                      >
                        {roleMeta.label}
                      </span>
                    </td>
                    <td
                      title={app.motivation ?? undefined}
                      style={{
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {app.motivation ?? <span className="muted">—</span>}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: statusMeta.bg, color: statusMeta.fg }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {date}
                    </td>
                    <td className="actions">
                      {app.status === 'PENDING' ? (
                        <span
                          style={{
                            display: 'flex',
                            gap: 6,
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                          }}
                        >
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
                        </span>
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

      <Pagination
        basePath={BASE}
        page={page}
        total={total}
        params={{ q: q || undefined, status: activeStatus }}
      />
    </div>
  );
}
