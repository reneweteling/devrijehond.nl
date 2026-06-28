import { z } from 'zod';
import { IsoDateTimeSchema } from './common';
import '../registry';

/**
 * Custom mobile-auth endpoints. These sit under `/api/auth/*` (BetterAuth's
 * mount), not `/api/v1`, but the native app depends on them so they are part of
 * the contract.
 *
 *  - `POST /api/auth/mobile/{apple,google}-native`: the app runs the native
 *    Apple / Google sheet, gets an identity token, and posts `{ idToken }`. We
 *    verify it and return a bearer `{ token, expiresAt }` for the Keychain.
 *  - `POST /api/auth/sign-in/magic-link`: request a magic-link email.
 *  - `GET /api/auth/magic-link/verify`: redeem a magic-link token. BetterAuth
 *    returns the bearer in the `set-auth-token` response header (and a redirect),
 *    so clients must not follow the redirect.
 */

/** Bearer session token issued by the native sign-in bridge / magic-link verify. */
export const AuthTokenSchema = z
  .object({
    token: z.string().openapi({
      description: 'BetterAuth signed session token. Sent as `Authorization: Bearer <token>`.',
    }),
    expiresAt: IsoDateTimeSchema.nullable().openapi({
      description: 'When the token expires, or null when the API does not surface it.',
    }),
  })
  .openapi('AuthToken', { description: 'A bearer session token + optional expiry.' });
export type AuthTokenDto = z.infer<typeof AuthTokenSchema>;

/** Body for the native Apple/Google sign-in bridge. */
export const NativeIdTokenRequestSchema = z
  .object({
    idToken: z.string().min(1).openapi({
      description: 'Identity token from the native Apple / Google sign-in sheet.',
    }),
  })
  .openapi('NativeIdTokenRequest', {
    description: 'Body for `POST /api/auth/mobile/{apple,google}-native`.',
  });
export type NativeIdTokenRequestDto = z.infer<typeof NativeIdTokenRequestSchema>;

/** Body for requesting a magic-link email. */
export const MagicLinkRequestSchema = z
  .object({
    email: z.string().email().openapi({ description: 'Email to send the magic link to.' }),
    callbackURL: z.string().optional().openapi({
      description: 'Deep link the interstitial hops to after verifying.',
      example: 'vrijehond://verify',
    }),
  })
  .openapi('MagicLinkRequest', { description: 'Body for `POST /api/auth/sign-in/magic-link`.' });
export type MagicLinkRequestDto = z.infer<typeof MagicLinkRequestSchema>;
