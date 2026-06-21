'use client';

/**
 * Client table for /admin/spots. Receives pre-serialised rows from the server
 * page and wires them into the shared DataTable + setSpotStatus server action.
 */

import Link from 'next/link';
import { DataTable, type ColumnDef } from '../_components/data-table';
import { setSpotStatus } from '../actions';

type SpotStatus = 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';

const STATUS_META: Record<SpotStatus, { label: string; bg: string; fg: string }> = {
  UNVERIFIED: { label: 'Niet geverifieerd', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  VERIFIED: { label: 'Geverifieerd', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  HIDDEN: { label: 'Verborgen', bg: '#eee', fg: '#8a8a76' },
  REMOVED: { label: 'Verwijderd', bg: '#f5e0de', fg: 'var(--rust, #a33b2d)' },
};

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

const columns: ColumnDef<SpotRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Naam',
    meta: { className: 'row-title' },
    cell: ({ row }) => <Link href={`/admin/spots/${row.original.id}`}>{row.original.name}</Link>,
  },
  {
    accessorKey: 'categoryLabel',
    header: 'Categorie',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ?? <span className="muted">–</span>;
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ getValue }) => {
      const s = getValue() as SpotStatus;
      const meta = STATUS_META[s];
      return meta ? (
        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
      ) : (
        <span className="muted">{s}</span>
      );
    },
  },
  {
    accessorKey: 'netScore',
    header: 'Score',
    meta: { className: 'num' },
    enableSorting: true,
    cell: ({ row }) => (
      <>
        {row.original.netScore >= 0 ? '+' : ''}
        {row.original.netScore}
        {row.original.denyCount > 0 ? (
          <small className="muted" style={{ marginLeft: 4 }}>
            ({row.original.denyCount}✕)
          </small>
        ) : null}
      </>
    ),
  },
  {
    accessorKey: 'submitterLabel',
    header: 'Inzender',
  },
  {
    accessorKey: 'createdAt',
    header: 'Aangemaakt',
    enableSorting: true,
    sortingFn: 'datetime',
    cell: ({ getValue }) => {
      const iso = getValue() as string;
      return (
        <span style={{ whiteSpace: 'nowrap' }}>
          {new Date(iso).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    meta: { className: 'actions' },
    enableSorting: false,
    cell: ({ row }) => {
      const spot = row.original;
      return (
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {STATUS_ACTIONS.filter((a) => a.status !== spot.status).map((a) => {
            const cls =
              a.variant === 'primary'
                ? 'btn btn-sm btn-primary'
                : a.variant === 'danger'
                  ? 'btn btn-sm btn-danger'
                  : 'btn btn-sm btn-soft';
            return (
              <form key={a.status} action={setSpotStatus.bind(null, spot.id, a.status)}>
                <button type="submit" className={cls}>
                  {a.label}
                </button>
              </form>
            );
          })}
        </span>
      );
    },
  },
];

export function SpotsTable({ rows, statusFilter }: { rows: SpotRow[]; statusFilter?: SpotStatus }) {
  const FILTER_OPTIONS: { label: string; value: string }[] = [
    { label: 'Alle', value: 'ALL' },
    { label: 'Niet geverifieerd', value: 'UNVERIFIED' },
    { label: 'Geverifieerd', value: 'VERIFIED' },
    { label: 'Verborgen', value: 'HIDDEN' },
    { label: 'Verwijderd', value: 'REMOVED' },
  ];

  const toolbarExtra = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {FILTER_OPTIONS.map((opt) => {
        const isActive = opt.value === 'ALL' ? !statusFilter : opt.value === statusFilter;
        const href = opt.value === 'ALL' ? '/admin/spots' : `/admin/spots?status=${opt.value}`;
        return (
          <a
            key={opt.value}
            href={href}
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
  );

  const filtered = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <DataTable
      columns={columns}
      data={filtered}
      searchPlaceholder="Zoek op naam, categorie, inzender…"
      toolbarExtra={toolbarExtra}
    />
  );
}
