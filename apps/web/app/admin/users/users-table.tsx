'use client';

import { DataTable, type ColumnDef } from '../_components/data-table';
import { setUserRole } from '../actions';

const ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

const ROLE_META: Record<Role, { label: string; bg: string; fg: string }> = {
  USER: { label: 'Gebruiker', bg: '#eee', fg: '#5a5a4a' },
  MODERATOR: { label: 'Moderator', bg: '#dde6f2', fg: '#3a5a86' },
  ADMIN: { label: 'Admin', bg: 'var(--terra-soft)', fg: 'var(--terra-700)' },
};

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  handle: string | null;
  role: string;
  reputation: number;
  spotCount: number;
  createdAt: string;
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role as Role] ?? { label: role, bg: '#eee', fg: '#5a5a4a' };
  return (
    <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

function RoleActions({ userId, currentRole }: { userId: string; currentRole: string }) {
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {ROLES.filter((r) => r !== currentRole).map((role) => (
        <form key={role} action={setUserRole.bind(null, userId, role)}>
          <button type="submit" className="btn btn-sm btn-soft">
            {ROLE_META[role].label}
          </button>
        </form>
      ))}
    </span>
  );
}

function cols(currentUserId: string): ColumnDef<UserRow, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Naam',
      meta: { className: 'row-title' },
      cell: ({ row }) => (
        <>
          {row.original.name ?? '—'}
          {row.original.handle ? (
            <span className="muted" style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}>
              @{row.original.handle}
            </span>
          ) : null}
        </>
      ),
    },
    {
      accessorKey: 'email',
      header: 'E-mail',
      cell: ({ getValue }) => <span className="muted">{getValue() as string}</span>,
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      enableSorting: true,
      cell: ({ getValue }) => <RoleBadge role={getValue() as string} />,
    },
    {
      accessorKey: 'reputation',
      header: 'Reputatie',
      enableSorting: true,
      meta: { className: 'num' },
    },
    {
      accessorKey: 'spotCount',
      header: 'Plekken',
      enableSorting: true,
      meta: { className: 'num' },
    },
    {
      accessorKey: 'createdAt',
      header: 'Lid sinds',
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
        row.original.id === currentUserId ? (
          <span className="muted" style={{ fontSize: 13 }}>
            eigen account
          </span>
        ) : (
          <RoleActions userId={row.original.id} currentRole={row.original.role} />
        ),
    },
  ];
}

export function UsersTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  return (
    <DataTable
      columns={cols(currentUserId)}
      data={rows}
      searchPlaceholder="Zoek op naam, e-mail of handle…"
    />
  );
}
