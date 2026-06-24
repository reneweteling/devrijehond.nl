'use client';

import { authClient } from '@devrijehond/auth/client';

/**
 * Staff-only "Bewerken" link on a public spot page. The page is a cacheable
 * server component, so the staff check runs client-side via the session (never
 * gate a public cache key on auth). Links to the existing admin spot editor,
 * which ADMIN and MODERATOR can both use.
 */
export function SpotEditButton({ spotId }: { spotId: string }) {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== 'ADMIN' && role !== 'MODERATOR') return null;
  return (
    <a href={`/admin/spots/${spotId}`} className="btn btn-ghost btn-sm">
      Bewerken
    </a>
  );
}
