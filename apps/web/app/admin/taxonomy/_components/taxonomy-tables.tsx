'use client';

import { DataTable, type ColumnDef } from '../../_components/data-table';
import { promoteCategory, promoteAmenity, updateCategory, updateAmenity } from '../../actions';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryRow = {
  id: string;
  label: string;
  type: string;
  sortOrder: number;
  status: string;
  visible: boolean;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'PROPOSED') {
    return <span className="badge badge-unverified">Voorstel</span>;
  }
  return (
    <span className="muted" style={{ fontSize: 13 }}>
      {status}
    </span>
  );
}

const categoryColumns: ColumnDef<CategoryRow, unknown>[] = [
  {
    accessorKey: 'label',
    header: 'Label',
    meta: { className: 'row-title' },
    enableSorting: true,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="muted" style={{ fontSize: 13 }}>
        {row.original.type}
      </span>
    ),
  },
  {
    accessorKey: 'sortOrder',
    header: 'Volgorde',
    meta: { className: 'num' },
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'visible',
    header: 'Zichtbaar',
    cell: ({ row }) =>
      row.original.visible ? null : (
        <span className="badge" style={{ background: '#eee', color: '#8a8a76' }}>
          Verborgen
        </span>
      ),
  },
  {
    id: 'acties',
    header: 'Acties',
    meta: { className: 'actions' },
    cell: ({ row }) => {
      const c = row.original;
      return (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {c.status === 'PROPOSED' ? (
            <form action={promoteCategory.bind(null, c.id)}>
              <button type="submit" className="btn btn-sm btn-primary">
                Promoten
              </button>
            </form>
          ) : null}
          <form action={updateCategory.bind(null, c.id, { visible: !c.visible })}>
            <button type="submit" className="btn btn-sm btn-soft">
              {c.visible ? 'Verbergen' : 'Tonen'}
            </button>
          </form>
        </span>
      );
    },
  },
];

export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  return (
    <DataTable
      columns={categoryColumns}
      data={rows}
      searchPlaceholder="Zoek categorie…"
      emptyText="Geen categorieën gevonden."
    />
  );
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

export type AmenityRow = {
  id: string;
  label: string;
  sortOrder: number;
  status: string;
  visible: boolean;
};

const amenityColumns: ColumnDef<AmenityRow, unknown>[] = [
  {
    accessorKey: 'label',
    header: 'Label',
    meta: { className: 'row-title' },
    enableSorting: true,
  },
  {
    accessorKey: 'sortOrder',
    header: 'Volgorde',
    meta: { className: 'num' },
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'visible',
    header: 'Zichtbaar',
    cell: ({ row }) =>
      row.original.visible ? null : (
        <span className="badge" style={{ background: '#eee', color: '#8a8a76' }}>
          Verborgen
        </span>
      ),
  },
  {
    id: 'acties',
    header: 'Acties',
    meta: { className: 'actions' },
    cell: ({ row }) => {
      const a = row.original;
      return (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {a.status === 'PROPOSED' ? (
            <form action={promoteAmenity.bind(null, a.id)}>
              <button type="submit" className="btn btn-sm btn-primary">
                Promoten
              </button>
            </form>
          ) : null}
          <form action={updateAmenity.bind(null, a.id, { visible: !a.visible })}>
            <button type="submit" className="btn btn-sm btn-soft">
              {a.visible ? 'Verbergen' : 'Tonen'}
            </button>
          </form>
        </span>
      );
    },
  },
];

export function AmenitiesTable({ rows }: { rows: AmenityRow[] }) {
  return (
    <DataTable
      columns={amenityColumns}
      data={rows}
      searchPlaceholder="Zoek voorziening…"
      emptyText="Geen voorzieningen gevonden."
    />
  );
}
