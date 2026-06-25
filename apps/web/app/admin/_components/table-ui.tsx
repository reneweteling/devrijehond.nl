/**
 * Shared admin list-table UI: a search box, a page count, and pagination.
 * Server components driven by URL search params, so they need no client JS.
 */

export const ADMIN_PAGE_SIZE = 25;

function buildHref(basePath: string, params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && !(k === 'page' && Number(v) <= 1)) sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/** A GET search form that updates `?q=` (keeps other params via hidden inputs). */
export function AdminSearch({
  basePath,
  q,
  placeholder = 'Zoeken…',
  keep = {},
}: {
  basePath: string;
  q?: string;
  placeholder?: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form className="admin-search" action={basePath} method="get">
      {Object.entries(keep).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
        style={{ color: 'var(--ink-3)', flex: 'none' }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        defaultValue={q ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </form>
  );
}

/** Prev / page-of-total / Next pager. `total` is the full row count. */
export function Pagination({
  basePath,
  page,
  total,
  pageSize = ADMIN_PAGE_SIZE,
  params = {},
}: {
  basePath: string;
  page: number;
  total: number;
  pageSize?: number;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  // Clamp an out-of-range ?page so the display and the Prev/Next targets stay
  // inside [1, pages]. From page 99999 Prev now lands on the last real page.
  const current = Math.min(Math.max(page, 1), pages);
  const prev = current > 1;
  const next = current < pages;
  return (
    <nav className="admin-pager" aria-label="Paginering">
      {prev ? (
        <a href={buildHref(basePath, { ...params, page: current - 1 })}>Vorige</a>
      ) : (
        <span className="disabled">Vorige</span>
      )}
      <span className="current">
        {current} / {pages}
      </span>
      {next ? (
        <a href={buildHref(basePath, { ...params, page: current + 1 })}>Volgende</a>
      ) : (
        <span className="disabled">Volgende</span>
      )}
    </nav>
  );
}

/** Parse a 1-based page number from a search param. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
