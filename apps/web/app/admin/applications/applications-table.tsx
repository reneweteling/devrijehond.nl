'use client';

/**
 * Presentational table for /admin/applications. Renders one server-paginated
 * page of moderator applications with status filter chips and small icon
 * actions per row. Paging/filtering are driven by URL search params
 * (server-side), so this component holds no list state, it only fires the
 * decision server actions and refreshes the route.
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { StatusPill } from '../_components/status-pill';
import { IconAction, ConfirmAction, Icons } from '../_components/action-buttons';
import { Pagination } from '../_components/table-ui';
import { approveModeratorApplication, rejectModeratorApplication } from '../actions';

type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const ROLE_META: Record<string, { label: string; bg: string; fg: string }> = {
  USER: { label: 'Gebruiker', bg: '#eee', fg: '#5a5a4a' },
  MODERATOR: { label: 'Moderator', bg: '#dde6f2', fg: '#3a5a86' },
  ADMIN: { label: 'Admin', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
};

export type ApplicationRow = {
  id: string;
  userName: string | null;
  userHandle: string | null;
  userRole: string;
  motivation: string | null;
  status: string;
  createdAt: string;
};

// "Alles" maps to ?status=ALL; the default (no param) is PENDING.
const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'In behandeling', value: 'PENDING' },
  { label: 'Goedgekeurd', value: 'APPROVED' },
  { label: 'Afgewezen', value: 'REJECTED' },
  { label: 'Alles', value: 'ALL' },
];

function filterHref(value: string): string {
  // PENDING is the server default, so it needs no query string.
  return value === 'PENDING' ? '/admin/applications' : `/admin/applications?status=${value}`;
}

function ApplicationActions({ app }: { app: ApplicationRow }) {
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

  if (app.status !== 'PENDING') {
    return (
      <span className="muted" style={{ fontSize: 13 }}>
        Afgehandeld
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
      <IconAction
        icon={Icons.approve}
        label="Goedkeuren"
        variant="success"
        pending={isPending && busy === 'approve'}
        disabled={isPending}
        onClick={() => run('approve', () => approveModeratorApplication(app.id))}
      />
      <ConfirmAction
        icon={Icons.reject}
        label="Afwijzen"
        variant="danger"
        confirmTitle="Aanmelding afwijzen?"
        confirmBody={app.userName ?? (app.userHandle ? `@${app.userHandle}` : undefined)}
        confirmLabel="Afwijzen"
        disabled={isPending}
        onConfirm={async () => {
          await rejectModeratorApplication(app.id);
          router.refresh();
        }}
      />
    </span>
  );
}

export function ApplicationsTable({
  rows,
  statusFilter,
  statusParam,
  page,
  total,
}: {
  rows: ApplicationRow[];
  statusFilter?: AppStatus;
  statusParam?: AppStatus | 'ALL';
  page: number;
  total: number;
}) {
  // No filter means the PENDING default is active.
  const activeValue = statusFilter ?? 'PENDING';

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-filters">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = opt.value === 'ALL' ? !statusFilter : opt.value === activeValue;
            return (
              <a
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
              </a>
            );
          })}
        </div>
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Aanvrager</th>
              <th>Huidige rol</th>
              <th>Motivatie</th>
              <th>Status</th>
              <th>Aangemeld</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Geen aanmeldingen gevonden.
                </td>
              </tr>
            ) : (
              rows.map((app) => {
                const roleMeta = ROLE_META[app.userRole] ?? {
                  label: app.userRole,
                  bg: '#eee',
                  fg: '#5a5a4a',
                };
                return (
                  <tr key={app.id}>
                    <td
                      className="row-title"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {app.userName ?? '–'}
                      {app.userHandle ? (
                        <span
                          className="muted"
                          style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}
                        >
                          @{app.userHandle}
                        </span>
                      ) : null}
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
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={app.motivation ?? undefined}
                    >
                      {app.motivation ?? <span className="muted">–</span>}
                    </td>
                    <td>
                      <StatusPill status={app.status} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(app.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="actions">
                      <ApplicationActions app={app} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/admin/applications"
        page={page}
        total={total}
        params={{ status: statusParam }}
      />
    </div>
  );
}
