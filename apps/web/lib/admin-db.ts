import { headers } from 'next/headers';
import { withContext } from '@devrijehond/server';
import { authDb } from '@devrijehond/db';

/**
 * Resolve an ADMIN-scoped `authDb` inside an admin server component.
 *
 * `proxy.ts` already redirects non-admins away from `/admin/**`, but the
 * server component still needs an authenticated, policy-bound client to READ
 * hidden/removed content (the `@@allow('all', ADMIN)` grant). This re-resolves
 * the session from the request headers and asserts ADMIN, then returns the
 * policy-bound client.
 */
export async function adminDb() {
  const h = await headers();
  const ctx = await withContext(new Request('http://internal/admin', { headers: h }));
  return authDb(ctx.user);
}
