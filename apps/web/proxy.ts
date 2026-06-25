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

  // Canonical host: redirect the apex (devrijehond.nl) to www. Keeping one host
  // means the page origin always matches the auth/API origin, so the BetterAuth
  // social sign-in fetch is same-origin (a no-www page POSTing to www was a
  // cross-origin CORS failure). Also good for SEO.
  const host = request.headers.get('host') ?? '';
  if (host === 'devrijehond.nl') {
    const url = request.nextUrl.clone();
    url.host = 'www.devrijehond.nl';
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  // The native app is bearer-only, but URLSession.shared can replay a stale
  // BetterAuth session cookie (set during an Apple/Google login) on the
  // unauthenticated magic-link sign-in POST. A request that carries a cookie but
  // no Origin trips BetterAuth's CSRF guard (403 MISSING_OR_NULL_ORIGIN), which
  // broke email sign-in from the app. This endpoint never needs a cookie, so
  // strip it here so any client (including older app builds) can sign in.
  if (pathname === '/api/auth/sign-in/magic-link' && request.headers.get('cookie')) {
    const headers = new Headers(request.headers);
    headers.delete('cookie');
    return NextResponse.next({ request: { headers } });
  }

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

  // Staff (ADMIN or MODERATOR) reach the admin section; user-management pages
  // gate to ADMIN at the page level.
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = '/unauthorized';
    unauthorizedUrl.search = '';
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  // Exclude static assets and the Sentry tunnel route from middleware processing.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|monitoring).*)',
  ],
};
