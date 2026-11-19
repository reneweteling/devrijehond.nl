import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

/**
 * Next.js config for apps/web — the De Vrije Hond public website + API + the
 * admin-role-gated section (one deploy; blueprint §7 decision 3).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_TELEMETRY_DISABLED: '1',
    // WEB_SENTRY_DSN is publishable (non-secret). Listing it here causes Next
    // to statically inline it so the browser bundle can read it via
    // process.env.WEB_SENTRY_DSN — same pattern as NEXT_PUBLIC_* but without
    // the automatic client exposure that prefix implies.
    WEB_SENTRY_DSN: process.env.WEB_SENTRY_DSN,
  },

  // Workspace packages are published as source `.ts` — Next must transpile
  // them instead of treating them as already-built JS in node_modules.
  // Without this, `import '../schema.js'` inside @devrijehond/db fails to
  // resolve (`.js` → `.ts`).
  transpilePackages: [
    '@devrijehond/db',
    '@devrijehond/server',
    '@devrijehond/types',
    '@devrijehond/auth',
    '@devrijehond/email',
    '@devrijehond/s3',
  ],

  // pino (pulled in transitively by BetterAuth + @devrijehond/server) spawns a
  // worker thread via thread-stream that Next's bundler can't trace. `pg` and
  // `sharp` ship native bindings that webpack mis-resolves. Keep all external.
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', 'pg', 'sharp'],

  typescript: {
    // `tsc --noEmit` runs in `check-types`; the build should not re-run it.
    ignoreBuildErrors: false,
  },
};

// Release health needs a release name on every session. The Docker build has
// no .git (see .dockerignore), so Sentry cannot detect one itself. Dokku
// passes the deployed commit as GIT_REV, the Dockerfile maps it to
// SENTRY_RELEASE. Sessions without a release are dropped by Sentry.
const release = process.env.SENTRY_RELEASE || process.env.GIT_REV || undefined;

export default withSentryConfig(nextConfig, {
  release: { name: release },
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  silent: !process.env.CI,
  // Skip source-map upload when creds are absent so the build never fails.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
