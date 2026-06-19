/**
 * BetterAuth catch-all route handler.
 *
 * BetterAuth mounts its entire HTTP surface (sign-in, magic-link request /
 * verify, sign-out, session, social) under `/api/auth/*`. `toNextJsHandler`
 * adapts the framework-agnostic handler to Next's Request/Response shape for
 * both GET and POST.
 *
 * PUBLIC, no `requireAuth` here. BetterAuth runs its own origin / CSRF /
 * rate-limit checks per the config in `packages/auth/src/auth.ts`.
 */

import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@devrijehond/auth';

export const { GET, POST } = toNextJsHandler(auth);
