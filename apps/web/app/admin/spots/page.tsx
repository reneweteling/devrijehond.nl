import Link from 'next/link';
import { staffDb } from '@/lib/admin-db';
import { setSpotStatus } from '../actions';
import { ADMIN_PAGE_SIZE, AdminSearch, Pagination, parsePage } from '../_components/table-ui';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['UNVERIFIED', 'VERIFIED', 'HIDDEN', 'REMOVED'] as const;
type SpotStatus = (typeof VALID_STATUSES)[number];

const STATUS_META: Record<SpotStatus, { label: string; bg: string; fg: string }> = {
  UNVERIFIED: { label: 'Niet geverifieerd', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  VERIFIED: { label: 'Geverifieerd', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  HIDDEN: { label: 'Verborgen', bg: '#eee', fg: '#8a8a76' },
  REMOVED: { label: 'Verwijderd', bg: '#f5e0de', fg: 'var(--rust, #a33b2d)' },
};

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Alle', value: 'ALL' },
  { label: 'Niet geverifieerd', value: 'UNVERIFIED' },
  { label: 'Geverifieerd', value: 'VERIFIED' },
  { label: 'Verborgen', value: 'HIDDEN' },
  { label: 'Verwijderd', value: 'REMOVED' },
];

const STATUS_ACTIONS: {
  status: SpotStatus;
  label: string;
  variant: 'primary' | 'soft' | 'danger';
}[] = [
  { status: 'VERIFIED', label: 'Verifieer', variant: 'primary' },
  { status: 'UNVERIFIED', label: 'Herstel', variant: 'soft' },
  { status: 'HIDDEN', label: 'Verberg', variant: 'soft' },
  { status: 'REMOVED', label: 'Verwijder', variant: 'danger' },
];

function isValidStatus(value: string | undefined): value is SpotStatus {
  return VALID_STATUSES.includes(value as SpotStatus);
}

function spotUrl(slug: string, type: string): string {
  return type === 'GEBIED' ? `/gebied/${slug}` : `/plek/${slug}`;
}

export default async function AdminSpotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const activeFilter = isValidStatus(sp.status) ? sp.status : undefined;
  const page = parsePage(sp.page);
  const skip = (page - 1) * ADMIN_PAGE_SIZE;

  const db = await staffDb();

  const where = {
    ...(activeFilter ? { status: activeFilter } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const [spots, total] = await Promise.all([
    db.spot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        denyCount: true,
        netScore: true,
        createdAt: true,
        category: { select: { label: true } },
        submittedBy: { select: { handle: true, name: true } },
      },
    }),
    db.spot.count({ where }),
  ]);

  const filterHref = (value: string) => {
    if (value === 'ALL') return q ? `/admin/spots?q=${encodeURIComponent(q)}` : '/admin/spots';
    const params = new URLSearchParams({ status: value });
    if (q) params.set('q', q);
    return `/admin/spots?${params.toString()}`;
  };

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 20px' }}>Plekken</h1>

      <div className="admin-toolbar">
        <AdminSearch
          basePath="/admin/spots"
          q={q}
          placeholder="Zoek op naam..."
          keep={{ status: activeFilter }}
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = opt.value === 'ALL' ? !activeFilter : opt.value === activeFilter;
            return (
              <Link
                key={opt.value}
                href={filterHref(opt.value)}
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

      {spots.length === 0 ? (
        <p className="muted" style={{ fontSize: 14.5 }}>
          Geen plekken gevonden.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Categorie</th>
                <th>Type</th>
                <th>Status</th>
                <th className="num">Score</th>
                <th>Inzender</th>
                <th>Aangemaakt</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody>
              {spots.map((spot) => {
                const meta = STATUS_META[spot.status as SpotStatus];
                const submitter = spot.submittedBy;
                const submitterLabel = submitter
                  ? (submitter.handle ?? submitter.name ?? 'onbekend')
                  : 'onbekend';
                const date = spot.createdAt
                  ? new Date(spot.createdAt).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '';

                return (
                  <tr key={spot.id}>
                    <td className="row-title">
                      <Link href={spotUrl(spot.slug, spot.type)} target="_blank">
                        {spot.name}
                      </Link>
                    </td>
                    <td>{spot.category?.label ?? <span className="muted">–</span>}</td>
                    <td>{spot.type}</td>
                    <td>
                      {meta ? (
                        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
                          {meta.label}
                        </span>
                      ) : (
                        <span className="muted">{spot.status}</span>
                      )}
                    </td>
                    <td className="num">
                      {spot.netScore >= 0 ? '+' : ''}
                      {spot.netScore}
                      {spot.denyCount > 0 ? (
                        <small className="muted" style={{ marginLeft: 4 }}>
                          ({spot.denyCount}✕)
                        </small>
                      ) : null}
                    </td>
                    <td>{submitterLabel}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{date}</td>
                    <td className="actions">
                      <span
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {STATUS_ACTIONS.filter((a) => a.status !== spot.status).map((a) => {
                          const cls =
                            a.variant === 'primary'
                              ? 'btn btn-sm btn-primary'
                              : a.variant === 'danger'
                                ? 'btn btn-sm btn-danger'
                                : 'btn btn-sm btn-soft';
                          return (
                            <form
                              key={a.status}
                              action={setSpotStatus.bind(null, spot.id, a.status)}
                            >
                              <button type="submit" className={cls}>
                                {a.label}
                              </button>
                            </form>
                          );
                        })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/spots"
        page={page}
        total={total}
        params={{ q, status: activeFilter }}
      />
    </div>
  );
}
