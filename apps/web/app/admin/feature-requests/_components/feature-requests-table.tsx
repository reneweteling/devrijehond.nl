'use client';

import type { ReactNode } from 'react';
import { StatusPill } from '../../_components/status-pill';
import { ConfirmAction, Icons } from '../../_components/action-buttons';
import { setFeatureStatus } from '../../actions';
import { deleteFeatureRequest } from '../actions';

/**
 * Server-rendered table for the "Wensen" board. Status is shown as a StatusPill;
 * non-destructive transitions are small IconAction buttons, the destructive ones
 * (afwijzen + verwijderen) are ConfirmAction with a Dutch confirm dialog.
 */

type Status = 'CONSIDERING' | 'PLANNED' | 'DONE' | 'DECLINED';

// Non-destructive transitions, rendered as small icon buttons.
const STATUS_ACTIONS: { status: Status; label: string; icon: keyof typeof Icons }[] = [
  { status: 'CONSIDERING', label: 'In overweging', icon: 'restore' },
  { status: 'PLANNED', label: 'Gepland', icon: 'planned' },
  { status: 'DONE', label: 'Klaar', icon: 'approve' },
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

function RowActions({ row }: { row: FeatureRequestRow }) {
  return (
    <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
      {STATUS_ACTIONS.filter((a) => a.status !== row.status).map((a) => (
        <form key={a.status} action={setFeatureStatus.bind(null, row.id, a.status)}>
          <IconButtonSubmit icon={Icons[a.icon]} label={a.label} />
        </form>
      ))}

      {row.status !== 'DECLINED' ? (
        <ConfirmAction
          icon={Icons.reject}
          label="Afwijzen"
          variant="danger"
          confirmTitle="Wens afwijzen?"
          confirmBody="De wens wordt op afgewezen gezet. De community ziet dit terug."
          confirmLabel="Afwijzen"
          onConfirm={() => setFeatureStatus(row.id, 'DECLINED')}
        />
      ) : null}

      <ConfirmAction
        icon={Icons.trash}
        label="Verwijderen"
        variant="danger"
        confirmTitle="Wens verwijderen?"
        confirmBody="De wens en alle stemmen worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        onConfirm={() => deleteFeatureRequest(row.id)}
      />
    </span>
  );
}

/**
 * IconAction inside a server-action <form> needs a real submit button, so we use
 * the same look via a plain button with the admin-icon-btn class.
 */
function IconButtonSubmit({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="submit"
      className="admin-icon-btn admin-icon-btn--default"
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Alle', value: '' },
  { label: 'In overweging', value: 'CONSIDERING' },
  { label: 'Gepland', value: 'PLANNED' },
  { label: 'Klaar', value: 'DONE' },
  { label: 'Afgewezen', value: 'DECLINED' },
];

const BASE = '/admin/feature-requests';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FeatureRequestsTable({
  rows,
  statusFilter,
}: {
  rows: FeatureRequestRow[];
  statusFilter: string;
}) {
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-filters">
          {FILTER_OPTIONS.map((opt) => {
            const active = opt.value === statusFilter;
            const href = opt.value ? `${BASE}?status=${opt.value}` : BASE;
            return (
              <a
                key={opt.value || 'alle'}
                href={href}
                className="btn btn-sm"
                style={
                  active
                    ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {opt.label}
              </a>
            );
          })}
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Onderdeel</th>
              <th>Status</th>
              <th className="num">Stemmen</th>
              <th>Datum</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="muted"
                  style={{ textAlign: 'center', padding: '28px 16px' }}
                >
                  Geen wensen gevonden.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="row-title">{r.title}</span>
                    {r.body ? (
                      <span
                        className="muted"
                        style={{ display: 'block', fontSize: 13, marginTop: 2 }}
                      >
                        {r.body.length > 100 ? `${r.body.slice(0, 100)}…` : r.body}
                      </span>
                    ) : null}
                  </td>
                  <td>{r.component ? r.component : <span className="muted">-</span>}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className="num">{r.upvoteCount}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                  <td className="actions">
                    <RowActions row={r} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
