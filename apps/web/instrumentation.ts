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
 * Keep the homepage render hot. On this low-traffic, shared host an idle dynamic
 * render goes cold after ~25s and a cold render costs several seconds, so the
 * first real visitor after a quiet spell waits. A lightweight self-ping every
 * 15s keeps the render path (and the in-process data memo) warm, so visitors
 * land on the ~100ms path. Node runtime only; failures are ignored.
 */
function startKeepWarm() {
  const url = `http://127.0.0.1:${process.env.PORT || '3000'}/`;
  const ping = () => void fetch(url, { headers: { 'x-keep-warm': '1' } }).catch(() => {});
  setTimeout(ping, 5_000);
  setInterval(ping, 15_000);
}

export const onRequestError = Sentry.captureRequestError;
