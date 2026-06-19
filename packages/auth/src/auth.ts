/**
 * BetterAuth instance for De Vrije Hond.
 *
 * Design (mirrors the dekmantel chassis, drops everything Cognito/Paylogic):
 *   - Sign-in methods: magic link (email) + native Apple + native Google.
 *     Email/password is disabled entirely.
 *   - Magic link emails are sent via `@devrijehond/email`'s `sendMagicLink`;
 *     this package owns only the link-rewrite logic, not the template.
 *   - The deep-link decision (blueprint §5): Gmail / Outlook / Yahoo strip the
 *     `href` on non-HTTP(S) schemes, so a raw `vrijehond://verify` link renders
 *     as a dead span. We wrap mobile callbacks in an HTTPS interstitial on our
 *     own domain (`/verify-mobile`); the interstitial hops to the app deep link.
 *   - Database: the ZenStack v3 better-auth adapter against the raw `db` client
 *     from `@devrijehond/db/client`. Policies are bypassed on the raw client,
 *     which is exactly what BetterAuth needs to manage its own tables.
 *   - Sessions: 30-day sliding expiry, role surfaced on the session via
 *     `additionalFields.role` so route handlers / proxy can gate ADMIN without
 *     a second DB round-trip.
 *   - Mobile uses the `bearer()` plugin: a `set-auth-token` response header lets
 *     the Expo app persist the token into SecureStore (it can't read HttpOnly
 *     cookies) and send `Authorization: Bearer ...`.
 *   - `advanced.cookiePrefix: 'dvh'` scopes cookies to our domain set.
 *   - Rate limiting is a production-only concern (dev iteration trips the
 *     in-memory limiter instantly).
 */

import { betterAuth } from 'better-auth';
import { bearer, magicLink } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { zenstackAdapter } from '@zenstackhq/better-auth';
import { db } from '@devrijehond/db/client';
import { sendMagicLink } from '@devrijehond/email';

// ---------------------------------------------------------------------------
// trustedOrigins: BetterAuth hard-requires callers to come from an allowed
// origin. Dev gets a local set; accept / production inject their real hosts
// via `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated).
// ---------------------------------------------------------------------------

function resolveTrustedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'https://devrijehond.local',
      'https://app.devrijehond.local',
    );
  }
  // The mobile app's callbackURL uses a custom scheme: `vrijehond://` (native
  // deep link, prod + dev-client) and `exp://` (Expo Go convenience). In
  // BetterAuth, callbackURLs must match an allowed origin and `*` wildcards
  // aren't allowed, so they're listed explicitly.
  origins.push('vrijehond://', 'exp://');
  const fromEnv = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (fromEnv) {
    for (const origin of fromEnv.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) origins.push(trimmed);
    }
  }
  return origins;
}

// ---------------------------------------------------------------------------
// BetterAuth instance.
// ---------------------------------------------------------------------------

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: resolveTrustedOrigins(),

  // ZenStack v3's better-auth adapter manages BetterAuth's own tables
  // (user / session / account / verification) on the raw DvhClient.
  database: zenstackAdapter(db, { provider: 'postgresql' }),

  // Magic-link + social only — kill the email/password surface entirely so we
  // don't accidentally expose `/sign-up/email` etc.
  emailAndPassword: { enabled: false },

  session: {
    // 30-day absolute expiry, sliding refresh after 24h.
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    // A tiny cookie cache avoids a DB round-trip on every request. Keep it
    // short so a server-side revocation (account deletion, manual sign-out)
    // stops authenticating within ~60s without a client refresh.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  user: {
    additionalFields: {
      // `role` ships on every session payload so the admin proxy / route
      // handlers can gate ADMIN routes without hitting the DB. Default USER
      // matches the schema default; BetterAuth writes this on signUp.
      role: { type: 'string', required: false, defaultValue: 'USER' },
    },
  },

  // Native social sign-in. The native paths POST an identity token from
  // expo-apple-authentication / @react-native-google-signin to
  // /api/auth/mobile/<provider>-native, which calls `auth.api.signInSocial`
  // with the idToken. BetterAuth verifies the token against the provider's
  // public keys and checks its `aud`, so no client secret is needed on the
  // native path (clientSecret only drives the web authorization-code flow).
  socialProviders: {
    apple: {
      // Services ID for a future web Apple flow; the native token's `aud` is
      // the app bundle id (`appBundleIdentifier`), so a native sign-in
      // validates against that.
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
      appBundleIdentifier: process.env.APPLE_BUNDLE_ID ?? '',
    },
    // Native Google Sign-In. `clientId` MUST be the WEB OAuth client id the
    // native SDK is configured with (`webClientId`) — that is the token's
    // audience BetterAuth checks against.
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },

  // Apple/Google both verify the email before issuing a token, so it's safe
  // to auto-link onto an existing User with the matching email. Without this,
  // BetterAuth refuses with `account_not_linked` when a user who first signed
  // in via magic-link later uses an OAuth flow on the same address.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['apple', 'google'],
    },
  },

  // Rate-limit auth endpoints (blueprint §5). Production-only: in local dev the
  // in-memory limiter is a footgun (iterating on sign-in trips 5/min instantly)
  // and e2e fires parallel sign-in POSTs that blow past the ceiling.
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production' && process.env.E2E !== '1',
    window: 60,
    max: 5,
    customRules: {
      '/sign-in/magic-link': { window: 60, max: 5 },
      // 20 req / hour ceiling — magic-link spam protection at the email level.
      '/magic-link/verify': { window: 60 * 60, max: 20 },
    },
  },

  advanced: {
    // All De Vrije Hond auth cookies get the `dvh_` prefix so they don't
    // collide with cookies set by other BetterAuth apps on the same hostname.
    cookiePrefix: 'dvh',
    // BetterAuth defaults to nanoid-style string IDs. Our ZenStack schema
    // types the id columns on User / Session / Account / Verification as
    // Postgres `uuid`, so those inserts would fail with 22P02. Force UUIDs.
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  plugins: [
    // Bearer-token plumbing for the mobile app. On a fresh session the plugin
    // emits a `set-auth-token` response header so the RN client can persist the
    // token into SecureStore; on the request side it accepts the token via
    // `Authorization: Bearer ...`.
    bearer(),

    magicLink({
      sendMagicLink: async ({ email, url, token }, _request) => {
        // Mobile rewrite: if the original request's callbackURL points at the
        // native app (`vrijehond://`) or Expo Go (`exp://`), wrap the deep link
        // in an HTTPS interstitial hosted on BETTER_AUTH_BASE_URL so Gmail /
        // Outlook / Yahoo don't strip the href. The interstitial detects the
        // platform and either hops to the deep link (mobile) or shows an
        // "open this on your phone" fallback (desktop). The token is forwarded
        // verbatim and `callback` carries the original scheme so Expo Go vs
        // dev-client vs prod all keep working.
        let finalUrl = url;
        try {
          const parsed = new URL(url);
          const originalCallback = parsed.searchParams.get('callbackURL') ?? '';
          if (
            originalCallback &&
            (originalCallback.startsWith('exp://') || originalCallback.startsWith('vrijehond://'))
          ) {
            const t = parsed.searchParams.get('token') ?? token;
            const baseURL = process.env.BETTER_AUTH_BASE_URL;
            if (baseURL) {
              const interstitial = new URL('/verify-mobile', baseURL);
              interstitial.searchParams.set('token', t);
              interstitial.searchParams.set('callback', originalCallback);
              finalUrl = interstitial.toString();
            } else {
              // No baseURL configured (shouldn't happen in any deployed env) —
              // fall back to the direct deep link so we don't strand the user.
              const separator = originalCallback.includes('?') ? '&' : '?';
              finalUrl = `${originalCallback}${separator}token=${encodeURIComponent(t)}`;
            }
          }
        } catch {
          // Fall through with the original url if anything is malformed.
        }

        await sendMagicLink({ email, url: finalUrl });
      },
      // BetterAuth default is 5 min; short enough to mitigate forwarded-email
      // attacks, long enough for a user to tap through.
      expiresIn: 5 * 60,
    }),

    // Next.js cookie plumbing: sets / clears auth cookies on RSC responses
    // without route-handler callers doing it manually. MUST be last — BetterAuth
    // warns at boot if any plugin with `hooks.after` runs after nextCookies,
    // because their Set-Cookie headers would never reach the framework store.
    nextCookies(),
  ],
});

// ---------------------------------------------------------------------------
// Session / user type helpers. Callers should prefer these over re-deriving
// from BetterAuth's `$Infer.Session` so a future additionalFields change flows
// out from one place.
// ---------------------------------------------------------------------------

type InferSession = typeof auth.$Infer.Session;

export type AuthUser = InferSession['user'] & {
  /**
   * Role is surfaced via `additionalFields.role`. BetterAuth types it as a
   * plain string at the session level; we narrow it here so middleware can
   * switch on a typed union without a cast.
   */
  role: 'ADMIN' | 'USER';
};

export type AuthSession = Omit<InferSession, 'user'> & { user: AuthUser };
