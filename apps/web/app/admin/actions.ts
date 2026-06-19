'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authDb } from '@devrijehond/db';
import { withContext } from '@devrijehond/server';

/**
 * Admin server actions, the moderation safety-net + taxonomy curation.
 *
 * Each action:
 *   1. resolves the ADMIN context via `withContext` (throws 401/403 otherwise),
 *   2. performs the mutation through the policy-bound `authDb` (admins have the
 *      `@@allow('all', ADMIN)` grant on every model),
 *   3. writes an `AdminAction` log row (audit trail),
 *   4. revalidates the affected admin path.
 *
 * Mutations are server actions (not API routes) per the project convention ,
 * public/mobile APIs are the only route handlers.
 */

type AdminCtx = Awaited<ReturnType<typeof withContext>>;

async function adminContext(): Promise<AdminCtx> {
  const h = await headers();
  // `withContext` reads the BetterAuth session off the request headers and
  // asserts the ADMIN role.
  return withContext(new Request('http://internal/admin', { headers: h }));
}

async function logAction(
  ctx: AdminCtx,
  action:
    | 'RESTORE'
    | 'FORCE_VERIFY'
    | 'REMOVE'
    | 'EDIT'
    | 'PROMOTE_TAXONOMY'
    | 'MERGE_TAXONOMY'
    | 'RESOLVE_REPORT'
    | 'SET_FEATURE_STATUS',
  targetType: string,
  targetId: string,
  note?: string,
): Promise<void> {
  const db = authDb(ctx.user);
  await db.adminAction.create({
    data: { adminId: ctx.user.id, action, targetType, targetId, note: note ?? null },
  });
}

// ---------------------------------------------------------------------------
// Spot moderation
// ---------------------------------------------------------------------------

/** Restore a hidden/removed spot back to UNVERIFIED (clears hiddenAt). */
export async function restoreSpot(spotId: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.spot.update({
    where: { id: spotId },
    data: { status: 'UNVERIFIED', hiddenAt: null },
  });
  await logAction(ctx, 'RESTORE', 'SPOT', spotId);
  revalidatePath('/admin');
}

/** Force-verify a spot regardless of its vote tally (+verifiedAt). */
export async function forceVerifySpot(spotId: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.spot.update({
    where: { id: spotId },
    data: { status: 'VERIFIED', verifiedAt: new Date(), hiddenAt: null },
  });
  await logAction(ctx, 'FORCE_VERIFY', 'SPOT', spotId);
  revalidatePath('/admin');
}

/** Permanently remove a spot (admin hard-removal, terminal). */
export async function removeSpot(spotId: string, note?: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.spot.update({
    where: { id: spotId },
    data: { status: 'REMOVED', hiddenAt: new Date() },
  });
  await logAction(ctx, 'REMOVE', 'SPOT', spotId, note);
  revalidatePath('/admin');
}

/** Mark a report resolved. */
export async function resolveReport(reportId: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  await logAction(ctx, 'RESOLVE_REPORT', 'REPORT', reportId);
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// Taxonomy curation
// ---------------------------------------------------------------------------

/** Promote a PROPOSED category/amenity to ACTIVE (and make it visible). */
export async function promoteCategory(categoryId: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.category.update({
    where: { id: categoryId },
    data: { status: 'ACTIVE', visible: true },
  });
  await logAction(ctx, 'PROMOTE_TAXONOMY', 'CATEGORY', categoryId);
  revalidatePath('/admin/taxonomy');
}

export async function promoteAmenity(amenityId: string): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.amenity.update({
    where: { id: amenityId },
    data: { status: 'ACTIVE', visible: true },
  });
  await logAction(ctx, 'PROMOTE_TAXONOMY', 'AMENITY', amenityId);
  revalidatePath('/admin/taxonomy');
}

/** Toggle visibility / re-order a category. */
export async function updateCategory(
  categoryId: string,
  patch: { visible?: boolean; sortOrder?: number },
): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.category.update({ where: { id: categoryId }, data: patch });
  await logAction(ctx, 'EDIT', 'CATEGORY', categoryId);
  revalidatePath('/admin/taxonomy');
}

export async function updateAmenity(
  amenityId: string,
  patch: { visible?: boolean; sortOrder?: number },
): Promise<void> {
  const ctx = await adminContext();
  const db = authDb(ctx.user);
  await db.amenity.update({ where: { id: amenityId }, data: patch });
  await logAction(ctx, 'EDIT', 'AMENITY', amenityId);
  revalidatePath('/admin/taxonomy');
}
