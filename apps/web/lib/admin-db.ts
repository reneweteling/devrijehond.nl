import { headers } from 'next/headers';
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

export async function staffDb() {
  const ctx = await withStaffContext(await reqHeaders());
  return authDb(ctx.user);
}

export async function adminDb() {
  const ctx = await withContext(await reqHeaders());
  return authDb(ctx.user);
}

/** The current staff user (e.g. to gate ADMIN-only nav/actions by role). */
export async function currentStaff() {
  const ctx = await withStaffContext(await reqHeaders());
  return ctx.user;
}
