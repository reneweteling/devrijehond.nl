import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { withContext, withStaffContext } from '@devrijehond/server';
import { authDb } from '@devrijehond/db';

/**
 * Policy-bound `authDb` clients for admin server components.
 *
 * `proxy.ts` redirects non-staff away from `/admin/**`, but a server component
 * still needs an authenticated, policy-bound client to READ hidden/removed
 * content. These re-resolve the session from the request headers and assert the
 * required role, then return the policy-bound client.
 *
 * - `staffDb()`  — ADMIN or MODERATOR. Moderation pages (dashboard, spots,
 *   reports, taxonomy, feature requests).
 * - `adminDb()`  — ADMIN only. User-role management.
 */
async function reqHeaders(): Promise<Request> {
  const h = await headers();
  return new Request('http://internal/admin', { headers: h });
}

/**
 * withContext/withStaffContext throw a raw 401/403 `Response` on denial, which
 * crashes a server component. Turn that into a clean redirect: 401 → /signin,
 * 403 → /unauthorized, so e.g. a moderator opening an ADMIN-only page gets a
 * tidy denial instead of a 500.
 */
async function resolveOrRedirect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const status = e instanceof Response ? e.status : 500;
    if (status === 401) redirect('/signin?next=/admin');
    if (status === 403) redirect('/unauthorized');
    throw e;
  }
}

export async function staffDb() {
  const ctx = await resolveOrRedirect(async () => withStaffContext(await reqHeaders()));
  return authDb(ctx.user);
}

export async function adminDb() {
  const ctx = await resolveOrRedirect(async () => withContext(await reqHeaders()));
  return authDb(ctx.user);
}

/** The current staff user (e.g. to gate ADMIN-only nav/actions by role). */
export async function currentStaff() {
  const ctx = await resolveOrRedirect(async () => withStaffContext(await reqHeaders()));
  return ctx.user;
}
