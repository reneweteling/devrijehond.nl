/**
 * Runtime config for the De Vrije Hond mobile app.
 *
 * `API_URL` is the canonical origin for the REST surface: public reads
 * (`/api/v1/*`) and the personalised `/me/*` writes, hit via
 * `@devrijehond/api-client` (which reads the same value from
 * `globalThis.__DEVRIJEHOND_API_URL__`, we mirror it there at app start).
 *
 * `AUTH_URL` is the origin for every BetterAuth route (`/api/auth/*`). In local
 * dev a single Next server serves both, so it falls back to `API_URL`.
 *
 * IMPORTANT: each EXPO_PUBLIC_* MUST be referenced via a LITERAL
 * `process.env.NAME` access (never a dynamic `process.env[key]`). Expo's Babel
 * transform can only inline a literal key at bundle time; a dynamic key stays a
 * runtime lookup that comes back undefined on device and silently breaks boot.
 */

/** Production origin, the fallback when the env var wasn't inlined at build time. */
const DEFAULT_API_URL = 'https://www.devrijehond.nl';

function resolveApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL;
  if (typeof value === 'string' && value.length > 0) return value;
  // Fail fast in dev (a misconfigured local build), but NEVER hard-crash a
  // production app at launch over a missing inline: fall back to production.
  // A top-level throw here crashed the first TestFlight build, because
  // EXPO_PUBLIC_* is inlined at JS-bundle time and the archive's bundling phase
  // didn't have the var set.
  if (__DEV__) {
    throw new Error(
      '[config] EXPO_PUBLIC_API_URL is not set. Configure it in ' +
        'apps/mobile/.env.development.local for local dev.',
    );
  }
  return DEFAULT_API_URL;
}

export const API_URL: string = resolveApiUrl();

export const AUTH_URL: string = process.env.EXPO_PUBLIC_AUTH_URL ?? API_URL;

/**
 * Web OAuth client id for native Google Sign-In (Android picker). The ID token
 * the native SDK returns carries this value as its `aud`, validated server-side
 * by BetterAuth's `google` provider. Client ids are public, not secrets. When
 * unset the native Google flow is unavailable.
 */
export const GOOGLE_WEB_CLIENT_ID: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * iOS OAuth client id for the native Google Sign-In SDK on iOS. Its reversed
 * form is the URL scheme configured for the google-signin plugin in app.json.
 */
export const GOOGLE_IOS_CLIENT_ID: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
