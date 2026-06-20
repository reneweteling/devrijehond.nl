import Link from 'next/link';
import { staffDb } from '@/lib/admin-db';
import { setSpotStatus } from '../actions';

/**
 * Spots management table for staff (ADMIN + MODERATOR).
 *
 * Supports filtering by status via ?status= query param. Renders 100 spots
 * ordered newest-first with direct status controls per row.
 */
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

// Status transitions: which buttons to show and in which order.
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const activeFilter = isValidStatus(rawStatus) ? rawStatus : 'ALL';

  const db = await staffDb();

  const spots = await db.spot.findMany({
    where: activeFilter !== 'ALL' ? { status: activeFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
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
  });

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 20px' }}>Plekken</h1>

      {/* Filter links */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = opt.value === activeFilter;
          return (
            <Link
              key={opt.value}
              href={opt.value === 'ALL' ? '/admin/spots' : `/admin/spots?status=${opt.value}`}
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

      {spots.length === 0 ? (
        <p className="muted" style={{ fontSize: 14.5 }}>
          Geen plekken gevonden.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Naam</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Categorie</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>Score</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>
                  Ingediend door
                </th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Datum</th>
                <th style={{ paddingBottom: 8 }} />
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
                  <tr key={spot.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px 10px 0' }}>
                      <Link
                        href={spotUrl(spot.slug, spot.type)}
                        target="_blank"
                        style={{ fontWeight: 600, color: 'var(--ink)' }}
                      >
                        {spot.name}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                      {spot.category?.label ?? <span className="muted">–</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 13 }}>
                      {spot.type}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {meta ? (
                        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
                          {meta.label}
                        </span>
                      ) : (
                        <span className="muted">{spot.status}</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {spot.netScore >= 0 ? '+' : ''}
                      {spot.netScore}
                      {spot.denyCount > 0 ? (
                        <small className="muted" style={{ marginLeft: 4 }}>
                          ({spot.denyCount}✕)
                        </small>
                      ) : null}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 13 }}>
                      {submitterLabel}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        color: 'var(--ink-2)',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {date}
                    </td>
                    <td style={{ padding: '10px 0 10px 12px' }}>
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
    </div>
  );
}
