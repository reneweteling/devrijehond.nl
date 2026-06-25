/**
 * StatusPill: a compact rounded pill rendering a status value as a Dutch
 * label with a color-coded background. Works for spot statuses, report
 * statuses, feature-request statuses, moderator-application statuses and
 * taxonomy statuses. Unknown values fall back to a neutral grey pill showing
 * the raw status string.
 */

type PillMeta = { label: string; cls: string };

const STATUS_MAP: Record<string, PillMeta> = {
  // Spots
  UNVERIFIED: { label: 'Niet geverifieerd', cls: 'admin-pill--amber' },
  VERIFIED: { label: 'Geverifieerd', cls: 'admin-pill--green' },
  HIDDEN: { label: 'Verborgen', cls: 'admin-pill--grey' },
  REMOVED: { label: 'Verwijderd', cls: 'admin-pill--red' },

  // Reports
  OPEN: { label: 'Open', cls: 'admin-pill--amber' },
  RESOLVED: { label: 'Afgehandeld', cls: 'admin-pill--green' },
  DISMISSED: { label: 'Afgewezen', cls: 'admin-pill--grey' },

  // Feature requests / generic
  PLANNED: { label: 'Gepland', cls: 'admin-pill--blue' },
  IN_PROGRESS: { label: 'Mee bezig', cls: 'admin-pill--purple' },
  DONE: { label: 'Klaar', cls: 'admin-pill--green' },
  REJECTED: { label: 'Afgewezen', cls: 'admin-pill--red' },
  DUPLICATE: { label: 'Duplicaat', cls: 'admin-pill--grey' },
  CONSIDERING: { label: 'Wordt overwogen', cls: 'admin-pill--blue' },
  DECLINED: { label: 'Afgewezen', cls: 'admin-pill--red' },

  // Moderator applications
  PENDING: { label: 'In behandeling', cls: 'admin-pill--amber' },
  APPROVED: { label: 'Goedgekeurd', cls: 'admin-pill--green' },
  // REJECTED already covered above

  // Taxonomy
  ACTIVE: { label: 'Actief', cls: 'admin-pill--green' },
  PROPOSED: { label: 'Voorgesteld', cls: 'admin-pill--amber' },
};

export function statusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? status;
}

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_MAP[status];
  const cls = meta ? meta.cls : 'admin-pill--grey';
  const label = meta ? meta.label : status;

  return <span className={`admin-pill ${cls}`}>{label}</span>;
}
