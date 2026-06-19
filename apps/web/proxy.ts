import { NextResponse, type NextRequest } from 'next/server';
import { auth, type AuthSession } from '@devrijehond/auth';

/**
 * proxy.ts — the web app's edge entrypoint for auth redirects.
 *
 * We use `proxy.ts` rather than `middleware.ts` to match the dekmantel
 * convention. In Next 15+ the proxy/middleware runs on the Node runtime, so
 * BetterAuth's Postgres session lookup works without an edge-runtime shim.
 *
 * Gating rules:
 *   - Public site (`/`, `/plek/*`, `/gebied/*`), the API (`/api/*`), the
 *     magic-link interstitial (`/verify-mobile`) → pass through (their own
 *     per-route guards run).
 *   - `/admin/**`:
 *       no session         → redirect to `/signin?next=<path>`
 *       session, role USER  → redirect to `/unauthorized`
 *       session, role ADMIN → pass through
 */

const ADMIN_PREFIX = '/admin';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // Only the admin section is gated here. Everything else (public site + API)
  // passes through; API routes enforce auth per-route via `requireAuth`.
  if (!(pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`))) {
    return NextResponse.next();
  }

  const session = (await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null)) as AuthSession | null;

  if (!session?.user) {
    const signinUrl = request.nextUrl.clone();
    signinUrl.pathname = '/signin';
    signinUrl.search = '';
    signinUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signinUrl);
  }

  if (session.user.role !== 'ADMIN') {
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = '/unauthorized';
    unauthorizedUrl.search = '';
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};
