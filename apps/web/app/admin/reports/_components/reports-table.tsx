'use client';

import { DataTable, type ColumnDef } from '../../_components/data-table';
import { resolveReport } from '../../actions';

const REASON_LABELS: Record<string, string> = {
  DUPLICATE: 'Duplicaat',
  SPAM: 'Spam',
  WRONG_INFO: 'Onjuiste info',
  INAPPROPRIATE: 'Ongepast',
  OTHER: 'Anders',
};

const TARGET_LABELS: Record<string, string> = {
  SPOT: 'Plek',
  PHOTO: 'Foto',
  REVIEW: 'Recensie',
};

export type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  note: string | null;
  resolved: boolean;
  createdAt: string;
  reporterLabel: string;
  spotName: string | null;
  spotSlug: string | null;
};

const columns: ColumnDef<ReportRow, unknown>[] = [
  {
    accessorKey: 'spotName',
    header: 'Doel',
    meta: { className: 'row-title' },
    cell: ({ row }) => {
      const r = row.original;
      if (r.targetType === 'SPOT' && r.spotSlug && r.spotName) {
        return <a href={`/plek/${r.spotSlug}`}>{r.spotName}</a>;
      }
      return `${TARGET_LABELS[r.targetType] ?? r.targetType} · ${r.targetId.slice(0, 8)}`;
    },
  },
  {
    accessorKey: 'reason',
    header: 'Reden',
    cell: ({ row }) => (
      <span
        className="badge"
        style={{ background: 'var(--terra-soft)', color: 'var(--terra-700)' }}
      >
        {REASON_LABELS[row.original.reason] ?? row.original.reason}
      </span>
    ),
  },
  {
    accessorKey: 'note',
    header: 'Notitie',
    cell: ({ row }) => (row.original.note ? row.original.note : <span className="muted">—</span>),
  },
  {
    accessorKey: 'reporterLabel',
    header: 'Melder',
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
    accessorKey: 'resolved',
    header: 'Status / Actie',
    meta: { className: 'actions' },
    cell: ({ row }) => {
      const r = row.original;
      if (r.resolved) {
        return (
          <span
            className="badge"
            style={{ background: '#eee', color: '#8a8a76', whiteSpace: 'nowrap' }}
          >
            Afgehandeld
          </span>
        );
      }
      return (
        <form action={resolveReport.bind(null, r.id)}>
          <button type="submit" className="btn btn-sm btn-soft">
            Afhandelen
          </button>
        </form>
      );
    },
  },
];

export function ReportsTable({
  rows,
  statusFilter,
}: {
  rows: ReportRow[];
  statusFilter: 'open' | 'done';
}) {
  const BASE = '/admin/reports';

  const toolbarExtra = (
    <nav style={{ display: 'flex', gap: 8 }}>
      <a href={BASE} className={statusFilter === 'open' ? 'filter-link active' : 'filter-link'}>
        Open
      </a>
      <a
        href={`${BASE}?status=done`}
        className={statusFilter === 'done' ? 'filter-link active' : 'filter-link'}
      >
        Afgehandeld
      </a>
    </nav>
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Zoek melding…"
      toolbarExtra={toolbarExtra}
      emptyText={statusFilter === 'open' ? 'Geen open meldingen.' : 'Geen afgehandelde meldingen.'}
    />
  );
}
