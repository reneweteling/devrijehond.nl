import { auth, type AuthUser, type AuthSession } from '@devrijehond/auth';
import { authDb, anonDb, type AuthUser as DbAuthUser } from '@devrijehond/db';

/**
 * Request context for the De Vrije Hond API.
 *
 * Mirrors dekmantel's `withContext` / `getContext` / `requireAuth` conventions,
 * adapted for the per-route auth model in `.claude`-style rules:
 *
 *   - PUBLIC reads (`/api/v1/...`)        → anonymous, cacheable. Use `anonDb()`.
 *   - PERSONALISED writes (`/api/v1/me/*`)→ CDN-bypass, auth per-route. Most
 *     handlers call `requireAuth(request)`; a few (analytics-style) call
 *     `getContext()` and only enrich with `userId` when a session is present.
 *   - ADMIN routes                        → `withContext(request)` asserts the
 *     ADMIN role and yields a policy-bound `authDb`.
 *
 * `getContext()` resolves the BetterAuth session off the request headers and
 * returns `{ user, session, authDb, canI }`. `authDb` is the policy-bound
 * ZenStack client (anonymous when there's no session). `requireAuth` throws a
 * 401 `Response` (the throw-a-Response pattern) so guards short-circuit nested
 * call sites; callers MUST `catch (res) { return res as Response; }`.
 */

const API_VERSION = 'v1';

/** A capability check helper bound to the resolved user (extend as policies grow). */
export type CanI = (action: 'admin' | 'moderate') => boolean;

export interface RequestContext {
  /** The authenticated user, or null for anonymous requests. */
  user: AuthUser | null;
  /** The BetterAuth session, or null. */
  session: AuthSession['session'] | null;
  /**
   * Policy-bound ZenStack client. Anonymous (`anonDb()`) when there is no
   * session, otherwise `authDb({ id, role })`.
   */
  authDb: ReturnType<typeof authDb>;
  /** Coarse capability check. `canI('admin')` is true only for ADMIN users. */
  canI: CanI;
}

function toDbUser(user: AuthUser): DbAuthUser {
  return { id: user.id, role: user.role };
}

function makeCanI(user: AuthUser | null): CanI {
  return (action) => {
    switch (action) {
      case 'admin':
        return user?.role === 'ADMIN';
      case 'moderate':
        return user?.role === 'ADMIN' || user?.role === 'MODERATOR';
      default:
        return false;
    }
  };
}

/**
 * Resolve the (optional) session and build the request context. Never throws
 * on a missing session, anonymous callers get `user: null` + an `anonDb()`
 * client. Use this for endpoints that work both signed-in and signed-out
 * (e.g. a public feature-request list that flags `viewerHasVoted`).
 */
export async function getContext(request: Request): Promise<RequestContext> {
  const session = (await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null)) as AuthSession | null;

  const user = session?.user ?? null;

  return {
    user,
    session: session?.session ?? null,
    authDb: user ? authDb(toDbUser(user)) : anonDb(),
    canI: makeCanI(user),
  };
}

/** Resolve only the session user (or null). Thin wrapper over `getContext`. */
export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const { user } = await getContext(request);
  return user;
}

function errorResponse(code: 'UNAUTHENTICATED' | 'FORBIDDEN', status: 401 | 403): Response {
  return new Response(JSON.stringify({ error: code, message: code }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Every API response (success OR error) carries the version header so
      // clients can key their response parser on it.
      'X-API-Version': API_VERSION,
      // Auth failures must never be cached at the edge.
      'Cache-Control': 'no-store',
    },
  });
}

export interface AuthedContext extends RequestContext {
  user: AuthUser;
  session: AuthSession['session'];
}

/**
 * Require a valid BetterAuth session. Throws a 401 `Response` when none is
 * attached. Returns the full request context narrowed so `user`/`session` are
 * non-null. Use in every `/api/v1/me/*` handler that requires a session.
 */
export async function requireAuth(request: Request): Promise<AuthedContext> {
  const ctx = await getContext(request);
  if (!ctx.user || !ctx.session) {
    throw errorResponse('UNAUTHENTICATED', 401);
  }
  return ctx as AuthedContext;
}

/**
 * Admin-only context. Throws 401 for anonymous callers and 403 for
 * authenticated non-admins. Use at the top of every admin server action that
 * mutates moderation state or taxonomy.
 *
 * Named `withContext` to match the dekmantel admin convention, though here it
 * resolves-and-returns rather than wrapping a handler (admin mutations are
 * server actions, not route handlers, so there's nothing to wrap).
 */
export async function withContext(request: Request): Promise<AuthedContext> {
  const ctx = await requireAuth(request);
  if (ctx.user.role !== 'ADMIN') {
    throw errorResponse('FORBIDDEN', 403);
  }
  return ctx;
}

/**
 * Staff context: ADMIN or MODERATOR. Throws 401 for anonymous callers, 403 for
 * plain users. Use for moderation actions (spot status, reports, taxonomy,
 * feature-request status) that a moderator may perform. Keep `withContext`
 * (ADMIN-only) for user-role management and other admin-only operations.
 */
export async function withStaffContext(request: Request): Promise<AuthedContext> {
  const ctx = await requireAuth(request);
  if (ctx.user.role !== 'ADMIN' && ctx.user.role !== 'MODERATOR') {
    throw errorResponse('FORBIDDEN', 403);
  }
  return ctx;
}
