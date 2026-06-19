'use client';

/**
 * BetterAuth React client, consumed by the web/admin sign-in UI and, in a
 * wrapped form, by the Expo mobile app.
 *
 * Why a single client export:
 *   - The session shape, hooks, and magic-link plugin protocol are identical on
 *     web and mobile. Mobile wraps this with a fetch interceptor that pins the
 *     deep-link callback URL and attaches the Expo SecureStore-backed token
 *     store, but the underlying call surface
 *     (`authClient.signIn.magicLink(...)`, `authClient.useSession()`) is the
 *     same.
 *   - Keeping the client here keeps the API-shape / types in lockstep with
 *     `src/auth.ts`, no drift between what the server advertises and what the
 *     client infers.
 */

import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // The canonical origin both apps talk to:
  //   - web dev:   https://devrijehond.local
  //   - web prod:  https://devrijehond.nl
  //   - mobile:    the accept / prod app origin
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [magicLinkClient()],
});

export type AuthClient = typeof authClient;
