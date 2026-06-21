'use client';

import { useState } from 'react';
import { DataTable, type ColumnDef } from '../_components/data-table';
import { approveModeratorApplication, rejectModeratorApplication } from '../actions';

type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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

export type ApplicationRow = {
  id: string;
  userName: string | null;
  userEmail: string;
  userHandle: string | null;
  userRole: string;
  motivation: string | null;
  status: string;
  createdAt: string;
};

const columns: ColumnDef<ApplicationRow, unknown>[] = [
  {
    accessorKey: 'userName',
    header: 'Aanvrager',
    meta: { className: 'row-title' },
    cell: ({ row }) => (
      <>
        {row.original.userName ?? '—'}
        {row.original.userHandle ? (
          <span className="muted" style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}>
            @{row.original.userHandle}
          </span>
        ) : null}
      </>
    ),
  },
  {
    accessorKey: 'userEmail',
    header: 'E-mail',
    cell: ({ getValue }) => (
      <span className="muted" style={{ whiteSpace: 'nowrap' }}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: 'userRole',
    header: 'Huidige rol',
    cell: ({ getValue }) => {
      const role = getValue() as string;
      const meta = ROLE_META[role] ?? { label: role, bg: '#eee', fg: '#5a5a4a' };
      return (
        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
      );
    },
  },
  {
    accessorKey: 'motivation',
    header: 'Motivatie',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span
          title={v}
          style={{
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {v}
        </span>
      ) : (
        <span className="muted">—</span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ getValue }) => {
      const s = getValue() as string;
      const meta = STATUS_META[s as AppStatus] ?? { label: s, bg: '#eee', fg: '#5a5a4a' };
      return (
        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Datum',
    enableSorting: true,
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
  {
    id: 'actions',
    header: 'Acties',
    enableSorting: false,
    meta: { className: 'actions' },
    cell: ({ row }) =>
      row.original.status === 'PENDING' ? (
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <form action={approveModeratorApplication.bind(null, row.original.id)}>
            <button type="submit" className="btn btn-sm btn-primary">
              Goedkeuren
            </button>
          </form>
          <form action={rejectModeratorApplication.bind(null, row.original.id)}>
            <button type="submit" className="btn btn-sm btn-soft">
              Afwijzen
            </button>
          </form>
        </span>
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>
          Afgehandeld
        </span>
      ),
  },
];

function StatusFilter({
  value,
  onChange,
}: {
  value: AppStatus | '';
  onChange: (v: AppStatus | '') => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value || 'all'}
          type="button"
          className="btn btn-sm"
          style={
            opt.value === value
              ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
              : undefined
          }
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
  const [statusFilter, setStatusFilter] = useState<AppStatus | ''>('');

  const filtered = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <DataTable
      columns={columns}
      data={filtered}
      searchPlaceholder="Zoek op naam, e-mail of motivatie…"
      toolbarExtra={<StatusFilter value={statusFilter} onChange={setStatusFilter} />}
    />
  );
}
