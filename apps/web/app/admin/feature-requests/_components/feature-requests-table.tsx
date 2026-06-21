'use client';

import { DataTable, type ColumnDef } from '../../_components/data-table';
import { setFeatureStatus } from '../../actions';

const STATUSES = ['CONSIDERING', 'PLANNED', 'DONE', 'DECLINED'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  CONSIDERING: { label: 'In overweging', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
  PLANNED: { label: 'Gepland', bg: '#dde6f2', fg: '#3a5a86' },
  DONE: { label: 'Gedaan', bg: 'var(--moss-soft)', fg: 'var(--moss-700)' },
  DECLINED: { label: 'Afgewezen', bg: '#eee', fg: '#8a8a76' },
};

const STATUS_FILTER_LABELS: { value: string; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'CONSIDERING', label: 'In overweging' },
  { value: 'PLANNED', label: 'Gepland' },
  { value: 'DONE', label: 'Gedaan' },
  { value: 'DECLINED', label: 'Afgewezen' },
];

export type FeatureRequestRow = {
  id: string;
  title: string;
  body: string | null;
  component: string | null;
  status: string;
  upvoteCount: number;
  createdAt: string;
};

const columns: ColumnDef<FeatureRequestRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Titel',
    meta: { className: 'row-title' },
    cell: ({ row }) => {
      const r = row.original;
      return (
        <>
          <span className="row-title">{r.title}</span>
          {r.body ? (
            <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
              {r.body.length > 100 ? `${r.body.slice(0, 100)}…` : r.body}
            </span>
          ) : null}
        </>
      );
    },
  },
  {
    accessorKey: 'component',
    header: 'Onderdeel',
    cell: ({ row }) =>
      row.original.component ? row.original.component : <span className="muted">—</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status as Status];
      if (!meta) return <span className="muted">{row.original.status}</span>;
      return (
        <span
          className="badge"
          style={{ background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}
        >
          {meta.label}
        </span>
      );
    },
  },
  {
    accessorKey: 'upvoteCount',
    header: 'Stemmen',
    meta: { className: 'num' },
    enableSorting: true,
  },
  {
    accessorKey: 'createdAt',
    header: 'Datum',
    enableSorting: true,
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
  {
    id: 'status-actie',
    header: 'Status-actie',
    meta: { className: 'actions' },
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {STATUSES.filter((s) => s !== r.status).map((s) => (
            <form key={s} action={setFeatureStatus.bind(null, r.id, s)}>
              <button type="submit" className="btn btn-sm btn-soft">
                {STATUS_META[s].label}
              </button>
            </form>
          ))}
        </div>
      );
    },
  },
];

export function FeatureRequestsTable({
  rows,
  statusFilter,
}: {
  rows: FeatureRequestRow[];
  statusFilter: string;
}) {
  const BASE = '/admin/feature-requests';

  const toolbarExtra = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {STATUS_FILTER_LABELS.map(({ value, label }) => {
        const active = value === statusFilter;
        return (
          <a
            key={value || 'alle'}
            href={value ? `${BASE}?status=${value}` : BASE}
            className={`btn btn-sm${active ? ' btn-primary' : ' btn-soft'}`}
          >
            {label}
          </a>
        );
      })}
    </div>
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Zoek wens…"
      toolbarExtra={toolbarExtra}
      emptyText="Geen wensen gevonden."
    />
  );
}
