import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.WEB_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
  ignoreErrors: [
    // Thrown inside the Google Maps loader (main.js) when one of its own
    // sub-libraries fails to fetch, usually a flaky network or an adblocker.
    // Nothing on our side to fix and the map recovers on reload.
    /^Could not load "[^"]+"\.$/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
