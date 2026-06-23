import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.WEB_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
  includeLocalVariables: true,
});
