'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { StatusPill } from '../../_components/status-pill';
import { IconAction, ConfirmAction, Icons } from '../../_components/action-buttons';
import { promoteCategory, promoteAmenity } from '../../actions';
import {
  createCategory,
  createAmenity,
  updateCategoryFull,
  updateAmenityFull,
  deleteCategory,
  deleteAmenity,
} from '../actions';

// ---------------------------------------------------------------------------
// Row types (mirror the page's serialised shapes)
// ---------------------------------------------------------------------------

export type CategoryRow = {
  id: string;
  label: string;
  type: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  status: string;
  visible: boolean;
};

export type AmenityRow = {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  status: string;
  visible: boolean;
};

// ---------------------------------------------------------------------------
// Shared styles (match the admin edit-spot inline style language)
// ---------------------------------------------------------------------------

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--ink-3)',
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
  background: '#fff',
  color: 'var(--ink)',
  fontFamily: 'inherit',
};

function Feedback({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <span style={{ fontSize: 13, color: 'var(--rust)', marginLeft: 8 }} role="alert">
      {msg}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pager: server-driven via URL, with a custom page param (cpage / apage)
// ---------------------------------------------------------------------------

function Pager({
  param,
  page,
  total,
  pageSize,
}: {
  param: 'cpage' | 'apage';
  page: number;
  total: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => (p <= 1 ? '/admin/taxonomy' : `/admin/taxonomy?${param}=${p}`);
  const prev = page > 1;
  const next = page < pages;
  return (
    <nav className="admin-pager" aria-label="Paginering">
      {prev ? <a href={href(page - 1)}>Vorige</a> : <span className="disabled">Vorige</span>}
      <span className="current">
        {page} / {pages}
      </span>
      {next ? <a href={href(page + 1)}>Volgende</a> : <span className="disabled">Volgende</span>}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Visibility badge
// ---------------------------------------------------------------------------

function VisibleCell({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="muted" style={{ fontSize: 13 }}>
      Zichtbaar
    </span>
  ) : (
    <span className="admin-pill admin-pill--grey">Verborgen</span>
  );
}

// ===========================================================================
// Categories
// ===========================================================================

const SPOT_TYPES: { value: 'POI' | 'REGION'; label: string }[] = [
  { value: 'POI', label: 'POI (punt)' },
  { value: 'REGION', label: 'Gebied (vlak)' },
];

function CategoryCreateForm() {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<'POI' | 'REGION'>('POI');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createCategory({
          label,
          icon: icon || undefined,
          type,
          sortOrder: Number(sortOrder) || 0,
        });
        setLabel('');
        setIcon('');
        setType('POI');
        setSortOrder('0');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Aanmaken mislukt.');
      }
    });
  }

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        background: 'var(--cream)',
        padding: 14,
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
      }}
    >
      <div style={{ flex: '2 1 180px' }}>
        <label style={labelStyle}>Label</label>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nieuwe categorie"
        />
      </div>
      <div style={{ flex: '1 1 120px' }}>
        <label style={labelStyle}>Icoon (optioneel)</label>
        <input
          style={inputStyle}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="SF / Tabler naam"
        />
      </div>
      <div style={{ flex: '1 1 140px' }}>
        <label style={labelStyle}>Type</label>
        <select
          style={inputStyle}
          value={type}
          onChange={(e) => setType(e.target.value as 'POI' | 'REGION')}
        >
          {SPOT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: '0 1 90px' }}>
        <label style={labelStyle}>Volgorde</label>
        <input
          type="number"
          style={inputStyle}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={submit}
          disabled={pending || !label.trim()}
        >
          {pending ? 'Bezig…' : 'Toevoegen'}
        </button>
        <Feedback msg={error} />
      </div>
    </div>
  );
}

function CategoryEditRow({ row, onDone }: { row: CategoryRow; onDone: () => void }) {
  const [label, setLabel] = useState(row.label);
  const [icon, setIcon] = useState(row.icon ?? '');
  const [type, setType] = useState<'POI' | 'REGION'>(row.type === 'REGION' ? 'REGION' : 'POI');
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateCategoryFull(row.id, {
          label,
          icon: icon || null,
          type,
          sortOrder: Number(sortOrder) || 0,
        });
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
      }
    });
  }

  return (
    <tr>
      <td colSpan={6}>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 4 }}
        >
          <div style={{ flex: '2 1 160px' }}>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={labelStyle}>Icoon</label>
            <input style={inputStyle} value={icon} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={labelStyle}>Type</label>
            <select
              style={inputStyle}
              value={type}
              onChange={(e) => setType(e.target.value as 'POI' | 'REGION')}
            >
              {SPOT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 1 90px' }}>
            <label style={labelStyle}>Volgorde</label>
            <input
              type="number"
              style={inputStyle}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Bezig…' : 'Opslaan'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onDone}
              disabled={pending}
            >
              Annuleren
            </button>
            <Feedback msg={error} />
          </div>
        </div>
      </td>
    </tr>
  );
}

function CategoryActions({ row, onEdit }: { row: CategoryRow; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mislukt.');
      }
    });
  }

  return (
    <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
      {error ? <Feedback msg={error} /> : null}
      {row.status === 'PROPOSED' ? (
        <IconAction
          icon={Icons.verify}
          label="Promoten"
          variant="success"
          onClick={() => run(() => promoteCategory(row.id))}
        />
      ) : null}
      <IconAction icon={Icons.edit} label="Bewerken" onClick={onEdit} />
      <IconAction
        icon={row.visible ? Icons.hide : Icons.view}
        label={row.visible ? 'Verbergen' : 'Tonen'}
        onClick={() => run(() => updateCategoryFull(row.id, { visible: !row.visible }))}
      />
      <ConfirmAction
        icon={Icons.trash}
        label="Verwijderen"
        variant="danger"
        confirmTitle="Verwijderen?"
        confirmBody={`Categorie "${row.label}" definitief verwijderen?`}
        onConfirm={() => deleteCategory(row.id)}
      />
    </span>
  );
}

export function CategoriesTable({
  rows,
  page,
  total,
  pageSize,
}: {
  rows: CategoryRow[];
  page: number;
  total: number;
  pageSize: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <CategoryCreateForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th className="num">Volgorde</th>
              <th>Status</th>
              <th>Zichtbaar</th>
              <th className="actions">Acties</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Geen categorieën gevonden.
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                editing === row.id ? (
                  <CategoryEditRow key={row.id} row={row} onDone={() => setEditing(null)} />
                ) : (
                  <tr key={row.id}>
                    <td className="row-title">{row.label}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {row.type}
                    </td>
                    <td className="num">{row.sortOrder}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <VisibleCell visible={row.visible} />
                    </td>
                    <td className="actions">
                      <CategoryActions row={row} onEdit={() => setEditing(row.id)} />
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
      <Pager param="cpage" page={page} total={total} pageSize={pageSize} />
    </>
  );
}

// ===========================================================================
// Amenities
// ===========================================================================

function AmenityCreateForm() {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createAmenity({ label, icon: icon || undefined, sortOrder: Number(sortOrder) || 0 });
        setLabel('');
        setIcon('');
        setSortOrder('0');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Aanmaken mislukt.');
      }
    });
  }

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        background: 'var(--cream)',
        padding: 14,
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
      }}
    >
      <div style={{ flex: '2 1 180px' }}>
        <label style={labelStyle}>Label</label>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nieuwe voorziening"
        />
      </div>
      <div style={{ flex: '1 1 140px' }}>
        <label style={labelStyle}>Icoon (optioneel)</label>
        <input
          style={inputStyle}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="SF / Tabler naam"
        />
      </div>
      <div style={{ flex: '0 1 90px' }}>
        <label style={labelStyle}>Volgorde</label>
        <input
          type="number"
          style={inputStyle}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={submit}
          disabled={pending || !label.trim()}
        >
          {pending ? 'Bezig…' : 'Toevoegen'}
        </button>
        <Feedback msg={error} />
      </div>
    </div>
  );
}

function AmenityEditRow({ row, onDone }: { row: AmenityRow; onDone: () => void }) {
  const [label, setLabel] = useState(row.label);
  const [icon, setIcon] = useState(row.icon ?? '');
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateAmenityFull(row.id, {
          label,
          icon: icon || null,
          sortOrder: Number(sortOrder) || 0,
        });
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
      }
    });
  }

  return (
    <tr>
      <td colSpan={5}>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 4 }}
        >
          <div style={{ flex: '2 1 160px' }}>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={labelStyle}>Icoon</label>
            <input style={inputStyle} value={icon} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div style={{ flex: '0 1 90px' }}>
            <label style={labelStyle}>Volgorde</label>
            <input
              type="number"
              style={inputStyle}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Bezig…' : 'Opslaan'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onDone}
              disabled={pending}
            >
              Annuleren
            </button>
            <Feedback msg={error} />
          </div>
        </div>
      </td>
    </tr>
  );
}

function AmenityActions({ row, onEdit }: { row: AmenityRow; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mislukt.');
      }
    });
  }

  return (
    <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
      {error ? <Feedback msg={error} /> : null}
      {row.status === 'PROPOSED' ? (
        <IconAction
          icon={Icons.verify}
          label="Promoten"
          variant="success"
          onClick={() => run(() => promoteAmenity(row.id))}
        />
      ) : null}
      <IconAction icon={Icons.edit} label="Bewerken" onClick={onEdit} />
      <IconAction
        icon={row.visible ? Icons.hide : Icons.view}
        label={row.visible ? 'Verbergen' : 'Tonen'}
        onClick={() => run(() => updateAmenityFull(row.id, { visible: !row.visible }))}
      />
      <ConfirmAction
        icon={Icons.trash}
        label="Verwijderen"
        variant="danger"
        confirmTitle="Verwijderen?"
        confirmBody={`Voorziening "${row.label}" definitief verwijderen?`}
        onConfirm={() => deleteAmenity(row.id)}
      />
    </span>
  );
}

export function AmenitiesTable({
  rows,
  page,
  total,
  pageSize,
}: {
  rows: AmenityRow[];
  page: number;
  total: number;
  pageSize: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <AmenityCreateForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Label</th>
              <th className="num">Volgorde</th>
              <th>Status</th>
              <th>Zichtbaar</th>
              <th className="actions">Acties</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Geen voorzieningen gevonden.
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                editing === row.id ? (
                  <AmenityEditRow key={row.id} row={row} onDone={() => setEditing(null)} />
                ) : (
                  <tr key={row.id}>
                    <td className="row-title">{row.label}</td>
                    <td className="num">{row.sortOrder}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <VisibleCell visible={row.visible} />
                    </td>
                    <td className="actions">
                      <AmenityActions row={row} onEdit={() => setEditing(row.id)} />
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
      <Pager param="apage" page={page} total={total} pageSize={pageSize} />
    </>
  );
}
