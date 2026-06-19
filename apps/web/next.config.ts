import type { NextConfig } from 'next';

/**
 * Next.js config for apps/web — the De Vrije Hond public website + API + the
 * admin-role-gated section (one deploy; blueprint §7 decision 3).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_TELEMETRY_DISABLED: '1',
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

export default nextConfig;
