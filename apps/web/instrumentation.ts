import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    startKeepWarm();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Keep the ISR homepage fresh. The homepage is served as cached HTML (it renders
 * far too slowly per-request on this shared host when cold). The build render has
 * no DB (so 0 plekken); this triggers an on-demand revalidation shortly after
 * startup to replace it with live data, then periodically so counts stay current
 * on a low-traffic site. Node runtime only; failures are ignored.
 */
function startKeepWarm() {
  const base = `http://127.0.0.1:${process.env.PORT || '3000'}`;
  const token = process.env.WARM_TOKEN ?? 'dvh-warm';
  const refresh = async () => {
    try {
      await fetch(`${base}/api/internal/revalidate-home`, { headers: { 'x-warm': token } });
      // Pull once so the regeneration runs now (this request absorbs it), leaving
      // fresh cached HTML for real visitors.
      await fetch(`${base}/`);
    } catch {
      /* ignore */
    }
  };
  setTimeout(refresh, 6_000);
  setInterval(refresh, 240_000);
}

export const onRequestError = Sentry.captureRequestError;
