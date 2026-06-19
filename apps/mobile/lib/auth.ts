/**
 * Mobile-side wrappers for BetterAuth's auth endpoints.
 *
 * We deliberately call the `/api/auth/*` HTTP routes directly with raw `fetch`
 * rather than importing a BetterAuth React client: that client assumes browser
 * cookie semantics and never surfaces the `Set-Cookie` / `set-auth-token`
 * header we need to bridge into SecureStore. This is the one place raw `fetch`
 * is allowed (the generated Orval client does not cover auth).
 *
 * Three flows:
 *   1. Magic link — `requestMagicLink(email)` POSTs to /sign-in/magic-link with
 *      a runtime-aware `callbackURL`, the email links to an HTTPS interstitial
 *      that hops back to the app, then `verifyMagicLink(token)` redeems it.
 *   2. Native Apple — `signInWithAppleNative()` runs the system sheet and
 *      exchanges the identity token at /mobile/apple-native.
 *   3. Native Google — `signInWithGoogleNative()` runs the system picker and
 *      exchanges the id token at /mobile/google-native.
 */

import * as Application from 'expo-application';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { AUTH_URL, GOOGLE_WEB_CLIENT_ID } from './config';
import { extractTokenFromResponse, saveSession, type PersistedSession } from './session';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Identify Expo Go at runtime. `Application.applicationId` reads the native
 * bundle id, which is genuinely `host.exp.Exponent` (iOS) / `host.exp.exponent`
 * (Android) in Expo Go but our own `nl.devrijehond.app` in a dev client / prod
 * binary. `Constants.appOwnership` is deprecated (null in SDK 55),
 * `executionEnvironment` returns `bare` for projects with a prebuilt native
 * folder even inside Expo Go, and `expoGoConfig` is truthy in dev clients too —
 * so the bundle id is the only clean discriminator.
 */
function isExpoGo(): boolean {
  const bundleId = Application.applicationId ?? '';
  return bundleId === 'host.exp.Exponent' || bundleId === 'host.exp.exponent';
}

/**
 * Build the deep link the magic-link verify redirect lands on.
 * - dev client / prod: the `vrijehond://verify` custom scheme is registered.
 * - Expo Go: the custom scheme is NOT registered (Expo dropped that in SDK 53+),
 *   so route through Expo's own `exp://<host>/--/verify`. `Linking.createURL`
 *   cannot produce that when `scheme` is set in app.json.
 */
function verifyCallbackUrl(): string {
  if (isExpoGo()) {
    const hostUri = Constants.expoConfig?.hostUri ?? 'localhost:8081';
    return `exp://${hostUri}/--/verify`;
  }
  return Linking.createURL('verify');
}

export type MagicLinkRequestResult =
  | { ok: true }
  | { ok: false; code: 'rate_limited' | 'invalid_email' | 'network' | 'unknown' };

/**
 * POST /api/auth/sign-in/magic-link
 *
 * `callbackURL` is where BetterAuth's verify page redirects after a successful
 * verify. We pass the app deep link so the email's "open in app" button lands
 * back in Expo. The email itself links to an HTTPS interstitial (per the
 * architecture decision) that then hops to this deep link — Gmail/Outlook strip
 * `href` on non-HTTP(S) schemes, so a raw `vrijehond://` link in the email body
 * would render dead.
 */
export async function requestMagicLink(email: string): Promise<MagicLinkRequestResult> {
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/sign-in/magic-link`, {
      method: 'POST',
      // Mobile is bearer-only — never send the RN cookie jar. A stale session
      // cookie from a prior verify would make BetterAuth 403 a re-sign-in.
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, callbackURL: verifyCallbackUrl() }),
    });

    if (response.ok) return { ok: true };
    if (response.status === 429) return { ok: false, code: 'rate_limited' };
    if (response.status === 400) return { ok: false, code: 'invalid_email' };
    return { ok: false, code: 'unknown' };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export type VerifyMagicLinkResult = { ok: true; session: PersistedSession } | { ok: false };

/**
 * GET /api/auth/magic-link/verify?token=...
 *
 * On success BetterAuth issues the session cookie + `set-auth-token` header (and
 * a JSON body with the raw token when no `callbackURL` is supplied). We extract
 * the bearer and persist it. The caller wires it into the API client via
 * `setAuthToken`.
 */
export async function verifyMagicLink(token: string): Promise<VerifyMagicLinkResult> {
  try {
    const response = await fetch(
      `${AUTH_URL}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
        // `manual` so a 302 back to callbackURL doesn't swallow the headers.
        redirect: 'manual',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      },
    );

    const isSuccess =
      response.ok ||
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400);
    if (!isSuccess) return { ok: false };

    type VerifyBody = {
      token?: string;
      session?: { token?: string; expiresAt?: string };
    };
    let body: VerifyBody | null = null;
    try {
      body = (await response.clone().json()) as VerifyBody | null;
    } catch {
      body = null;
    }

    const headerToken = extractTokenFromResponse(response);
    const bodyToken = body?.token ?? body?.session?.token ?? null;
    const extractedToken = headerToken ?? bodyToken;
    if (!extractedToken) return { ok: false };

    let expiresAt: Date | null = null;
    if (body?.session?.expiresAt) {
      const parsed = new Date(body.session.expiresAt);
      if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
    }
    if (!expiresAt) expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

    const session: PersistedSession = { token: extractedToken, expiresAt };
    await saveSession(session.token, session.expiresAt);
    return { ok: true, session };
  } catch {
    return { ok: false };
  }
}

export type NativeSignInResult =
  | { ok: true; session: PersistedSession }
  | { ok: false; code: 'cancelled' | 'exchange_failed' | 'network' };

async function exchangeIdToken(
  endpoint: 'apple-native' | 'google-native',
  idToken: string,
): Promise<NativeSignInResult> {
  let token: string | undefined;
  let expiresAtParam: string | undefined;
  try {
    const res = await fetch(`${AUTH_URL}/api/auth/mobile/${endpoint}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return { ok: false, code: 'exchange_failed' };
    const data = (await res.json()) as { token?: string; expiresAt?: string };
    token = data.token;
    expiresAtParam = data.expiresAt;
  } catch {
    return { ok: false, code: 'network' };
  }

  if (!token) return { ok: false, code: 'exchange_failed' };

  let expiresAt: Date | null = expiresAtParam ? new Date(expiresAtParam) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  }

  const session: PersistedSession = { token, expiresAt };
  await saveSession(session.token, session.expiresAt);
  return { ok: true, session };
}

/**
 * Native Sign in with Apple (iOS). Runs the system sheet, then exchanges the
 * identity token at /api/auth/mobile/apple-native (BetterAuth verifies it
 * against Apple's keys). Required by App Store guideline 4.8 when Google is
 * also offered.
 */
export async function signInWithAppleNative(): Promise<NativeSignInResult> {
  let identityToken: string | null = null;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    identityToken = credential.identityToken;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    return { ok: false, code: code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'network' };
  }
  if (!identityToken) return { ok: false, code: 'exchange_failed' };
  return exchangeIdToken('apple-native', identityToken);
}

/**
 * Native Google Sign-In. Runs the system account picker via
 * `@react-native-google-signin`, then exchanges the returned id token at
 * /api/auth/mobile/google-native.
 *
 * Lazy `require` — NOT a top-level import: the native module is absent on a
 * JS-only / not-yet-rebuilt dev client, and a static import would throw at
 * module-eval and cascade into every file that imports this one. The binding is
 * only touched when the flow actually runs, after a native rebuild.
 */
export async function signInWithGoogleNative(): Promise<NativeSignInResult> {
  if (!GOOGLE_WEB_CLIENT_ID) return { ok: false, code: 'exchange_failed' };

  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  let statusCodes: typeof import('@react-native-google-signin/google-signin').statusCodes;
  let isErrorWithCode: typeof import('@react-native-google-signin/google-signin').isErrorWithCode;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy load
    const mod =
      require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    ({ GoogleSignin, statusCodes, isErrorWithCode } = mod);
  } catch {
    return { ok: false, code: 'exchange_failed' };
  }

  let idToken: string | null = null;
  try {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Force the chooser every time: drop the SDK's cached account.
    await GoogleSignin.signOut().catch(() => {});
    const response = await GoogleSignin.signIn();
    const flat = response as unknown as { idToken?: string | null };
    idToken = response.type === 'success' ? response.data.idToken : (flat.idToken ?? null);
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, code: 'cancelled' };
    }
    return { ok: false, code: 'network' };
  }

  if (!idToken) return { ok: false, code: 'exchange_failed' };
  return exchangeIdToken('google-native', idToken);
}
