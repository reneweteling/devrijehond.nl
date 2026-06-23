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

/**
 * Production origin: the API is served through CloudFront at api.devrijehond.nl
 * (the direct dokku origin was unreachable from some devices/networks while the
 * CDN edge is reached fine). This is also the fallback when EXPO_PUBLIC_API_URL
 * wasn't inlined at build time.
 */
const DEFAULT_API_URL = 'https://api.devrijehond.nl';

/**
 * A localhost / private-LAN / *.local origin must never ship in a release build.
 * The `.local` check matters: our dev host is `app.devrijehond.local`, and if it
 * leaks into the bundle the app talks to a Bonjour/mDNS host, which triggers the
 * iOS "find devices on your local network" prompt and stalls DNS (~12s) so the
 * map + profile never load. This is the last-line safety net; the build scripts
 * also force the prod EXPO_PUBLIC_* values.
 */
function isLocalUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1|\b10\.|\b192\.168\.|\b172\.(1[6-9]|2\d|3[01])\.|\.local\b/.test(
    url,
  );
}

function resolveApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL;
  // In a RELEASE build, never trust a local URL: it means a dev value leaked
  // into the bundle (e.g. a stale Metro transform cache from `expo run:ios`).
  // Talking to localhost on a device hangs every request and triggers the iOS
  // local-network prompt, so force production instead.
  if (!__DEV__ && (!value || isLocalUrl(value))) return DEFAULT_API_URL;
  if (typeof value === 'string' && value.length > 0) return value;
  // Dev with no env: fail fast so the misconfig is obvious.
  if (__DEV__) {
    throw new Error(
      '[config] EXPO_PUBLIC_API_URL is not set. Configure it in ' +
        'apps/mobile/.env.development.local for local dev.',
    );
  }
  return DEFAULT_API_URL;
}

export const API_URL: string = resolveApiUrl();

function resolveAuthUrl(): string {
  const value = process.env.EXPO_PUBLIC_AUTH_URL;
  if (!__DEV__ && (!value || isLocalUrl(value))) return API_URL;
  return value && value.length > 0 ? value : API_URL;
}

export const AUTH_URL: string = resolveAuthUrl();

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
