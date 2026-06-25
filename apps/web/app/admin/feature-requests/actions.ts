'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { withStaffContext } from '@devrijehond/server';
import { authDb } from '@devrijehond/db';

/**
 * Feature-request server actions that live next to the page. Status changes
 * reuse `setFeatureStatus` from `../actions`; the destructive delete lives here
 * because the shared actions file has no delete for feature requests yet.
 */

/** Permanently delete a feature request (and its votes via cascade). Staff only. */
export async function deleteFeatureRequest(requestId: string): Promise<void> {
  const h = await headers();
  const ctx = await withStaffContext(new Request('http://internal/admin', { headers: h }));
  const db = authDb(ctx.user);
  await db.featureRequest.delete({ where: { id: requestId } });
  await db.adminAction.create({
    data: {
      adminId: ctx.user.id,
      action: 'REMOVE',
      targetType: 'FEATURE_REQUEST',
      targetId: requestId,
      note: 'deleted',
    },
  });
  revalidatePath('/admin/feature-requests');
}
