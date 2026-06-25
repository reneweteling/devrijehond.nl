'use client';

/**
 * Presentational table for /admin/users. Renders one server-paginated page of
 * users with a search box, a role label per row, small icon actions for quick
 * role changes, and an edit affordance that opens a small modal form (name,
 * handle, e-mail, role). Paging/search are URL-driven (server-side), so this
 * component holds no list state. It only fires the user server actions and
 * refreshes the route.
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState, useRef, useEffect, type CSSProperties } from 'react';
import { IconAction, Icons } from '../_components/action-buttons';
import { AdminSearch, Pagination } from '../_components/table-ui';
import { setUserRole } from '../actions';
import { updateUser } from './actions';

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

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--ink-3)',
  marginBottom: 5,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
  background: '#fff',
  color: 'var(--ink)',
  fontFamily: 'inherit',
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role as Role] ?? { label: role, bg: '#eee', fg: '#5a5a4a' };
  return (
    <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

function EditUserDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: UserRow;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user.name ?? '');
  const [handle, setHandle] = useState(user.handle ?? '');
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>((user.role as Role) ?? 'USER');

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateUser(user.id, {
          name,
          handle,
          email: email !== user.email ? email : undefined,
          role: !isSelf && role !== user.role ? role : undefined,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
      }
    });
  }

  return (
    <dialog ref={dialogRef} className="admin-confirm-dialog" aria-labelledby="edit-user-title">
      <div className="admin-confirm-overlay" onClick={onClose} aria-hidden="true" />
      <div className="admin-confirm-box" style={{ maxWidth: 420 }}>
        <p id="edit-user-title" className="admin-confirm-title">
          Gebruiker bewerken
        </p>

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="edit-user-name">
              Naam
            </label>
            <input
              id="edit-user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="edit-user-handle">
              Handle
            </label>
            <input
              id="edit-user-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="zonder @"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="edit-user-email">
              E-mail
            </label>
            <input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="edit-user-role">
              Rol
            </label>
            <select
              id="edit-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={isSelf}
              style={inputStyle}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
            {isSelf ? (
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Je kunt je eigen rol niet wijzigen.
              </span>
            ) : null}
          </div>

          {error ? <p style={{ fontSize: 13, color: 'var(--rust)', margin: 0 }}>{error}</p> : null}
        </div>

        <div className="admin-confirm-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            disabled={pending}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={save}
            disabled={pending}
          >
            {pending ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

function UserActions({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function changeRole(key: string, role: Role) {
    setBusy(key);
    startTransition(async () => {
      try {
        await setUserRole(user.id, role);
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  if (isSelf) {
    return (
      <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
        <IconAction icon={Icons.edit} label="Bewerken" onClick={() => setEditing(true)} />
        {editing ? (
          <EditUserDialog
            user={user}
            isSelf
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        ) : null}
      </span>
    );
  }

  const role = user.role as Role;

  return (
    <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
      <IconAction icon={Icons.edit} label="Bewerken" onClick={() => setEditing(true)} />

      {role !== 'MODERATOR' && role !== 'ADMIN' ? (
        <IconAction
          icon={Icons.approve}
          label="Tot moderator maken"
          variant="primary"
          pending={isPending && busy === 'mod'}
          disabled={isPending}
          onClick={() => changeRole('mod', 'MODERATOR')}
        />
      ) : null}

      {role !== 'ADMIN' ? (
        <IconAction
          icon={Icons.verify}
          label="Tot beheerder maken"
          variant="success"
          pending={isPending && busy === 'admin'}
          disabled={isPending}
          onClick={() => changeRole('admin', 'ADMIN')}
        />
      ) : null}

      {role !== 'USER' ? (
        <IconAction
          icon={Icons.restore}
          label="Terug naar gebruiker"
          pending={isPending && busy === 'user'}
          disabled={isPending}
          onClick={() => changeRole('user', 'USER')}
        />
      ) : null}

      {editing ? (
        <EditUserDialog
          user={user}
          isSelf={false}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function UsersTable({
  rows,
  currentUserId,
  page,
  total,
  query,
}: {
  rows: UserRow[];
  currentUserId: string;
  page: number;
  total: number;
  query?: string;
}) {
  return (
    <div>
      <div className="admin-toolbar">
        <AdminSearch
          basePath="/admin/users"
          q={query}
          placeholder="Zoek op naam, e-mail of handle…"
        />
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Rol</th>
              <th className="num">Reputatie</th>
              <th className="num">Plekken</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Geen gebruikers gevonden.
                </td>
              </tr>
            ) : (
              rows.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id}>
                    <td
                      className="row-title"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.name ?? '–'}
                      {user.handle ? (
                        <span
                          className="muted"
                          style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}
                        >
                          @{user.handle}
                        </span>
                      ) : null}
                      {isSelf ? (
                        <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                          (jij)
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="muted"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={user.email}
                    >
                      {user.email}
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="num">{user.reputation}</td>
                    <td className="num">{user.spotCount}</td>
                    <td className="actions">
                      <UserActions user={user} isSelf={isSelf} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/admin/users" page={page} total={total} params={{ q: query }} />
    </div>
  );
}
