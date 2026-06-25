'use client';

/**
 * Presentational table for /admin/spots. Renders one server-paginated page of
 * spots with status filter chips, a search box and small icon actions per row.
 * Paging/filtering/search are all driven by URL search params (server-side), so
 * this component holds no list state, it only fires the moderation server
 * actions and refreshes the route.
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { StatusPill } from '../_components/status-pill';
import { IconAction, ConfirmAction, Icons } from '../_components/action-buttons';
import { AdminSearch, Pagination } from '../_components/table-ui';
import { setSpotStatus, removeSpot } from '../actions';

type SpotStatus = 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';

export type SpotRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: SpotStatus;
  netScore: number;
  denyCount: number;
  createdAt: string;
  categoryLabel: string | null;
  submitterLabel: string;
};

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Alle', value: 'ALL' },
  { label: 'Niet geverifieerd', value: 'UNVERIFIED' },
  { label: 'Geverifieerd', value: 'VERIFIED' },
  { label: 'Verborgen', value: 'HIDDEN' },
  { label: 'Verwijderd', value: 'REMOVED' },
];

function filterHref(value: string, query?: string): string {
  const sp = new URLSearchParams();
  if (value !== 'ALL') sp.set('status', value);
  if (query) sp.set('q', query);
  const qs = sp.toString();
  return qs ? `/admin/spots?${qs}` : '/admin/spots';
}

function SpotActions({ spot }: { spot: SpotRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
      <IconAction icon={Icons.edit} label="Bewerken" href={`/admin/spots/${spot.id}`} />
      {spot.status !== 'VERIFIED' ? (
        <IconAction
          icon={Icons.verify}
          label="Verifiëren"
          variant="success"
          pending={isPending && busy === 'verify'}
          disabled={isPending}
          onClick={() => run('verify', () => setSpotStatus(spot.id, 'VERIFIED'))}
        />
      ) : null}
      {spot.status !== 'HIDDEN' ? (
        <IconAction
          icon={Icons.hide}
          label="Verbergen"
          pending={isPending && busy === 'hide'}
          disabled={isPending}
          onClick={() => run('hide', () => setSpotStatus(spot.id, 'HIDDEN'))}
        />
      ) : null}
      <ConfirmAction
        icon={Icons.remove}
        label="Verwijderen"
        variant="danger"
        confirmTitle="Plek verwijderen?"
        confirmBody={spot.name}
        confirmLabel="Verwijderen"
        disabled={isPending}
        onConfirm={async () => {
          await removeSpot(spot.id);
          router.refresh();
        }}
      />
    </span>
  );
}

export function SpotsTable({
  rows,
  statusFilter,
  page,
  total,
  query,
}: {
  rows: SpotRow[];
  statusFilter?: SpotStatus;
  page: number;
  total: number;
  query?: string;
}) {
  return (
    <div>
      <div className="admin-toolbar">
        <AdminSearch
          basePath="/admin/spots"
          q={query}
          placeholder="Zoek op naam…"
          keep={{ status: statusFilter }}
        />
        <div className="admin-filters">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = opt.value === 'ALL' ? !statusFilter : opt.value === statusFilter;
            return (
              <a
                key={opt.value}
                href={filterHref(opt.value, query)}
                className="btn btn-sm"
                style={
                  isActive
                    ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {opt.label}
              </a>
            );
          })}
        </div>
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Categorie</th>
              <th>Status</th>
              <th className="num">Score</th>
              <th>Inzender</th>
              <th>Aangemaakt</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Geen plekken gevonden.
                </td>
              </tr>
            ) : (
              rows.map((spot) => (
                <tr key={spot.id}>
                  <td className="row-title">
                    <a
                      href={`/admin/spots/${spot.id}`}
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={spot.name}
                    >
                      {spot.name}
                    </a>
                  </td>
                  <td
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {spot.categoryLabel ?? <span className="muted">-</span>}
                  </td>
                  <td>
                    <StatusPill status={spot.status} />
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
                  <td
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={spot.submitterLabel}
                  >
                    {spot.submitterLabel}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(spot.createdAt).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="actions">
                    <SpotActions spot={spot} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/admin/spots"
        page={page}
        total={total}
        params={{ status: statusFilter, q: query }}
      />
    </div>
  );
}
