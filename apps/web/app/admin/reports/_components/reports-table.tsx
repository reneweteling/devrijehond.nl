'use client';

import { StatusPill } from '../../_components/status-pill';
import { ConfirmAction, IconAction, Icons } from '../../_components/action-buttons';
import { Pagination } from '../../_components/table-ui';
import { resolveReport } from '../actions';

const BASE = '/admin/reports';

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

export type ReportFilter = 'open' | 'resolved' | 'all';

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
  spotType: string | null;
};

const TABS: { value: ReportFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Afgehandeld' },
  { value: 'all', label: 'Alles' },
];

function targetHref(r: ReportRow): string | null {
  // Region spots live at /gebied/<slug>, POI spots at /plek/<slug> (mirrors
  // admin/spots/[id]/page.tsx). Using /plek for a region would 404.
  if (r.targetType === 'SPOT' && r.spotSlug) {
    const base = r.spotType === 'REGION' ? '/gebied/' : '/plek/';
    return `${base}${r.spotSlug}`;
  }
  return null;
}

function targetLabel(r: ReportRow): string {
  if (r.targetType === 'SPOT' && r.spotName) return r.spotName;
  return `${TARGET_LABELS[r.targetType] ?? r.targetType} · ${r.targetId.slice(0, 8)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ReportsTable({
  rows,
  page,
  total,
  filter,
}: {
  rows: ReportRow[];
  page: number;
  total: number;
  filter: ReportFilter;
}) {
  const emptyText =
    filter === 'open'
      ? 'Geen open meldingen.'
      : filter === 'resolved'
        ? 'Geen afgehandelde meldingen.'
        : 'Geen meldingen.';

  return (
    <div>
      <div className="admin-toolbar">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((tab) => {
            const isActive = tab.value === filter;
            const href = tab.value === 'open' ? BASE : `${BASE}?filter=${tab.value}`;
            return (
              <a
                key={tab.value}
                href={href}
                className="btn btn-sm"
                style={
                  isActive
                    ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {tab.label}
              </a>
            );
          })}
        </div>
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="row-title">Doel</th>
              <th>Reden</th>
              <th>Notitie</th>
              <th>Melder</th>
              <th>Datum</th>
              <th>Status</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const href = targetHref(r);
                return (
                  <tr key={r.id}>
                    <td className="row-title">
                      {href ? <a href={href}>{targetLabel(r)}</a> : targetLabel(r)}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: 'var(--terra-soft)', color: 'var(--terra-700)' }}
                      >
                        {REASON_LABELS[r.reason] ?? r.reason}
                      </span>
                    </td>
                    <td>{r.note ? r.note : <span className="muted">-</span>}</td>
                    <td>{r.reporterLabel}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</td>
                    <td>
                      <StatusPill status={r.resolved ? 'RESOLVED' : 'OPEN'} />
                    </td>
                    <td className="actions">
                      <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {href ? (
                          <IconAction icon={Icons.view} label="Bekijk doel" href={href} />
                        ) : null}
                        {r.resolved ? null : (
                          <ConfirmAction
                            icon={Icons.approve}
                            label="Afhandelen"
                            confirmTitle="Melding afhandelen?"
                            confirmBody="De melding wordt gemarkeerd als afgehandeld."
                            confirmLabel="Afhandelen"
                            onConfirm={() => resolveReport(r.id)}
                          />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath={BASE}
        page={page}
        total={total}
        params={{ filter: filter === 'open' ? undefined : filter }}
      />
    </div>
  );
}
