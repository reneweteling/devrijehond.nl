import type { NextRequest } from 'next/server';
import { db } from '@devrijehond/db/client';
import { requireAuth } from '@devrijehond/server';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * DELETE /api/v1/me/account, in-app account deletion (App Store requirement).
 *
 * Hard-deletes the authenticated user's User row. The BetterAuth auth records
 * (Session, Account) and the user's personal children (Dog, Vote, Review,
 * SpotPhoto, Report, FeatureRequest, FeatureVote, ModeratorApplication) all
 * have `onDelete: Cascade` on their User FK, so they go with the user.
 *
 * Community map content is preserved. `Spot.submittedById` is NOT nullable and
 * is `onDelete: Cascade`, so deleting the user would cascade-delete their spots
 * and wipe them off the map. Instead we reassign the user's spots to a stable
 * system "verwijderde gebruiker" account first, then delete the user. The spots
 * stay live; they just lose their personal author link.
 *
 * `Category.proposedById` / `Amenity.proposedById` and
 * `ModeratorApplication.decidedById` are `onDelete: SetNull`, so they never
 * block the delete.
 *
 * Uses the raw (privileged) `db` client, not `authDb`: the access policies
 * forbid deleting auth rows and reassigning another account's spots, and a user
 * deleting their own account is a system action. Every operation below is
 * scoped strictly to the authenticated user's id. The whole thing runs in one
 * transaction so a failure leaves the account intact.
 */
export const runtime = 'nodejs';

// Stable system account that inherits the spots of deleted users, so community
// content stays on the map without a personal author. Looked up / created by a
// fixed sentinel email; never signs in (no Account rows, unverified).
const DELETED_USER_EMAIL = 'deleted-user@devrijehond.nl';

export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const userId = ctx.user.id;

  try {
    await db.$transaction(async (tx) => {
      // Bail cleanly if the account is already gone (e.g. double-tap, stale
      // token). The outer catch turns a missing user into a 404.
      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!existing) {
        throw new AccountGoneError();
      }

      // Only reassign spots when this user actually submitted some, so we don't
      // create the sentinel account for accounts that never contributed a spot.
      const spotCount = await tx.spot.count({ where: { submittedById: userId } });
      if (spotCount > 0) {
        const sentinel = await tx.user.upsert({
          where: { email: DELETED_USER_EMAIL },
          update: {},
          create: {
            email: DELETED_USER_EMAIL,
            name: 'Verwijderde gebruiker',
            emailVerified: false,
            role: 'USER',
          },
          select: { id: true },
        });
        await tx.spot.updateMany({
          where: { submittedById: userId },
          data: { submittedById: sentinel.id },
        });
      }

      // Hard-delete the user. Personal children + auth rows cascade.
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (e) {
    if (e instanceof AccountGoneError) {
      // Already deleted: treat as success so the client clears local state.
      return ok({ ok: true }, { cacheControl: NO_STORE_CACHE_CONTROL });
    }
    return error('DELETE_FAILED', 'Could not delete the account.', {
      status: 500,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  return ok({ ok: true }, { cacheControl: NO_STORE_CACHE_CONTROL });
}

class AccountGoneError extends Error {}
