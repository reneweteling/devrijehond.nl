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

function requireApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      '[config] EXPO_PUBLIC_API_URL is not set. Configure it in ' +
        'apps/mobile/.env.development.local for local dev, eas.json#build.<profile>.env ' +
        'for native builds, and via `eas env:create` for OTA updates.',
    );
  }
  return value;
}

export const API_URL: string = requireApiUrl();

export const AUTH_URL: string = process.env.EXPO_PUBLIC_AUTH_URL ?? API_URL;

/**
 * Web OAuth client id for native Google Sign-In (Android picker). The ID token
 * the native SDK returns carries this value as its `aud`, validated server-side
 * by BetterAuth's `google` provider. Client ids are public, not secrets. When
 * unset the native Google flow is unavailable.
 */
export const GOOGLE_WEB_CLIENT_ID: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
