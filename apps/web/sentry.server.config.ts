import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.WEB_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
  ignoreErrors: [
    // Next treats any POST to a page route as a server action call. The site
    // has no server actions outside /admin, so these are bots posting form
    // bodies at the homepage. Next already answers them with a 404.
    /Failed to find Server Action/,
  ],
});
