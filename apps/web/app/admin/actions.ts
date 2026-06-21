'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authDb } from '@devrijehond/db';
import { withContext, withStaffContext, pgQuery } from '@devrijehond/server';
import { normaliseGeometry } from '@/lib/geo';

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

/** Moderation context: ADMIN or MODERATOR (most admin actions). */
async function staffContext(): Promise<AdminCtx> {
  const h = await headers();
  return withStaffContext(new Request('http://internal/admin', { headers: h }));
}

/** Admin-only context (user-role management). */
async function adminOnlyContext(): Promise<AdminCtx> {
  const h = await headers();
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
  const ctx = await staffContext();
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
  const ctx = await staffContext();
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
  const ctx = await staffContext();
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
  const ctx = await staffContext();
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
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  await db.category.update({
    where: { id: categoryId },
    data: { status: 'ACTIVE', visible: true },
  });
  await logAction(ctx, 'PROMOTE_TAXONOMY', 'CATEGORY', categoryId);
  revalidatePath('/admin/taxonomy');
}

export async function promoteAmenity(amenityId: string): Promise<void> {
  const ctx = await staffContext();
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
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  await db.category.update({ where: { id: categoryId }, data: patch });
  await logAction(ctx, 'EDIT', 'CATEGORY', categoryId);
  revalidatePath('/admin/taxonomy');
}

export async function updateAmenity(
  amenityId: string,
  patch: { visible?: boolean; sortOrder?: number },
): Promise<void> {
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  await db.amenity.update({ where: { id: amenityId }, data: patch });
  await logAction(ctx, 'EDIT', 'AMENITY', amenityId);
  revalidatePath('/admin/taxonomy');
}

// ---------------------------------------------------------------------------
// Feature requests
// ---------------------------------------------------------------------------

/** Set the status of a community feature request (the public "Wensen" board). */
export async function setFeatureStatus(
  requestId: string,
  status: 'CONSIDERING' | 'PLANNED' | 'DONE' | 'DECLINED',
): Promise<void> {
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  await db.featureRequest.update({ where: { id: requestId }, data: { status } });
  await logAction(ctx, 'SET_FEATURE_STATUS', 'FEATURE_REQUEST', requestId, status);
  revalidatePath('/admin/feature-requests');
}

// ---------------------------------------------------------------------------
// Spots management (direct status control)
// ---------------------------------------------------------------------------

/** Set a spot's status directly from the spots-management table. */
export async function setSpotStatus(
  spotId: string,
  status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED',
): Promise<void> {
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  const data: { status: typeof status; verifiedAt?: Date | null; hiddenAt?: Date | null } = {
    status,
  };
  if (status === 'VERIFIED') {
    data.verifiedAt = new Date();
    data.hiddenAt = null; // verifying a hidden spot must clear hiddenAt
  }
  if (status === 'HIDDEN' || status === 'REMOVED') data.hiddenAt = new Date();
  if (status === 'UNVERIFIED') data.hiddenAt = null;
  await db.spot.update({ where: { id: spotId }, data });
  await logAction(ctx, 'EDIT', 'SPOT', spotId, status);
  revalidatePath('/admin/spots');
  revalidatePath('/admin');
}

/** Edit a spot's core fields (staff). Policy-bound: only ADMIN/MODERATOR. */
export async function updateSpotFields(
  spotId: string,
  patch: { name?: string; description?: string | null; categoryId?: string },
): Promise<void> {
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  await db.spot.update({
    where: { id: spotId },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description ?? null }),
      ...(patch.categoryId !== undefined && { categoryId: patch.categoryId }),
    },
  });
  await logAction(ctx, 'EDIT', 'SPOT', spotId);
  revalidatePath(`/admin/spots/${spotId}`);
  revalidatePath('/admin/spots');
}

/**
 * Replace a spot's geometry (staff). Accepts a friendly point ({lat,lng}) or a
 * polygon ([{lat,lng},…]); writes the PostGIS geom + the lat/lng centroid via
 * the policy-bound client (so the staff edit grant is enforced) plus a raw geom
 * UPDATE (the geom column is Unsupported in Prisma).
 */
export async function updateSpotGeometry(
  spotId: string,
  geom: { point?: { lat: number; lng: number }; polygon?: { lat: number; lng: number }[] },
): Promise<void> {
  const ctx = await staffContext();
  const db = authDb(ctx.user);
  const normalised = normaliseGeometry({ point: geom.point, polygon: geom.polygon });
  if (!normalised) throw new Error('Geen geldige geometrie meegegeven.');
  // The authDb update enforces the staff edit policy on this spot; the raw geom
  // write only runs after that authorization succeeds.
  await db.spot.update({
    where: { id: spotId },
    data: { lat: normalised.lat, lng: normalised.lng },
  });
  await pgQuery(
    `UPDATE "Spot" SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE "id" = $2`,
    [JSON.stringify(normalised.geojson), spotId],
  );
  await logAction(ctx, 'EDIT', 'SPOT', spotId, 'geometry');
  revalidatePath(`/admin/spots/${spotId}`);
  revalidatePath('/admin/spots');
}

// ---------------------------------------------------------------------------
// User management (ADMIN only)
// ---------------------------------------------------------------------------

/** Change a user's role. Admin-only (moderators cannot manage roles). */
export async function setUserRole(
  userId: string,
  role: 'USER' | 'MODERATOR' | 'ADMIN',
): Promise<void> {
  const ctx = await adminOnlyContext();
  const db = authDb(ctx.user);
  // Guard rails: you can't change your own role (no self-demote lockout), and
  // you can't remove the last remaining admin.
  if (ctx.user.id === userId) {
    throw new Error('Je kunt je eigen rol niet wijzigen.');
  }
  if (role !== 'ADMIN') {
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === 'ADMIN') {
      const admins = await db.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new Error('Er moet minstens één beheerder blijven.');
    }
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  await logAction(ctx, 'EDIT', 'USER', userId, role);
  revalidatePath('/admin/users');
}

// ---------------------------------------------------------------------------
// Moderator applications (ADMIN only)
// ---------------------------------------------------------------------------

/** Approve a moderator application and promote the applicant to MODERATOR. */
export async function approveModeratorApplication(applicationId: string): Promise<void> {
  const ctx = await adminOnlyContext();
  const db = authDb(ctx.user);
  const application = await db.moderatorApplication.update({
    where: { id: applicationId },
    data: { status: 'APPROVED', decidedById: ctx.user.id, decidedAt: new Date() },
    select: { userId: true },
  });
  await db.user.update({ where: { id: application.userId }, data: { role: 'MODERATOR' } });
  await logAction(ctx, 'EDIT', 'MODERATOR_APPLICATION', applicationId, 'APPROVED');
  revalidatePath('/admin/applications');
}

/** Reject a moderator application. */
export async function rejectModeratorApplication(applicationId: string): Promise<void> {
  const ctx = await adminOnlyContext();
  const db = authDb(ctx.user);
  await db.moderatorApplication.update({
    where: { id: applicationId },
    data: { status: 'REJECTED', decidedById: ctx.user.id, decidedAt: new Date() },
  });
  await logAction(ctx, 'EDIT', 'MODERATOR_APPLICATION', applicationId, 'REJECTED');
  revalidatePath('/admin/applications');
}
