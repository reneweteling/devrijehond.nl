import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { SubmitVoteRequestSchema, type VoteResponseDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';
import { tallyVotes, resolveStatus } from '@/lib/verification';
import { haversineMeters, PROXIMITY_RADIUS_M } from '@/lib/geo';

/**
 * POST /api/v1/me/spots/:id/vote — cast (or change) a verification vote.
 *
 * Rules (docs/wireframes-mobile.md §verification):
 *   - Authenticated; one vote per user per spot (DB `@@unique([spotId,userId])`).
 *   - Not your own spot (policy `spot.submittedById != auth().id` + explicit
 *     guard here for a friendly 403).
 *   - Optional `proof` location runs the proximity gate; within
 *     PROXIMITY_RADIUS_M → `proximityVerified` and a heavier weight.
 *
 * After upsert, RECOMPUTE the spot tally from all votes and apply thresholds:
 *   - netScore >= VERIFY_NET_SCORE (+5)  → VERIFIED (+verifiedAt)
 *   - denyCount >= HIDE_DENY_COUNT (3)   → HIDDEN (+hiddenAt)
 *   - HIDE TAKES PRECEDENCE (resolveStatus encodes this).
 *
 * Returns the new vote + recomputed tally + status.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;
  const { id: spotId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }
  const parsed = SubmitVoteRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Vote did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const dto = parsed.data;

  const db = authDb({ id: user.id, role: user.role });

  // Load the spot (policy-enforced read). Need submitter + centroid + status.
  const spot = await db.spot.findUnique({
    where: { id: spotId },
    select: {
      id: true,
      status: true,
      submittedById: true,
      lat: true,
      lng: true,
      verifiedAt: true,
      hiddenAt: true,
    },
  });
  if (!spot) {
    return error('NOT_FOUND', 'Spot not found.', { status: 404 });
  }
  if (spot.submittedById === user.id) {
    return error('OWN_SPOT', 'You cannot vote on your own spot.', { status: 403 });
  }

  // Proximity gate: if a proof location is supplied AND the spot has a
  // centroid, mark proximityVerified when within range. Reputation-scaled
  // weight: base voteWeight, boosted when the vote is proximity-verified.
  let proximityVerified = false;
  if (dto.proof && spot.lat != null && spot.lng != null) {
    const meters = haversineMeters(dto.proof, { lat: spot.lat, lng: spot.lng });
    proximityVerified = meters <= PROXIMITY_RADIUS_M;
  }

  const voter = await db.user.findUnique({
    where: { id: user.id },
    select: { voteWeight: true },
  });
  const baseWeight = voter?.voteWeight ?? 1;
  // A proximity-verified vote counts for more (the voter was actually there).
  const weight = proximityVerified ? baseWeight : baseWeight * 0.5;

  // Upsert the vote (one per user per spot).
  let voteId: string;
  let voteCreatedAt: Date;
  try {
    // Composite-unique accessor derived from `@@unique([spotId, userId])`.
    const existing = await db.vote.findUnique({
      where: { spotId_userId: { spotId, userId: user.id } },
      select: { id: true },
    });
    if (existing) {
      const updated = await db.vote.update({
        where: { id: existing.id },
        data: { value: dto.value, weight, proximityVerified },
        select: { id: true, createdAt: true },
      });
      voteId = updated.id;
      voteCreatedAt = updated.createdAt;
    } else {
      const createdVote = await db.vote.create({
        data: {
          spotId,
          userId: user.id,
          value: dto.value,
          weight,
          proximityVerified,
        },
        select: { id: true, createdAt: true },
      });
      voteId = createdVote.id;
      voteCreatedAt = createdVote.createdAt;
    }
  } catch (e) {
    return error('VOTE_FAILED', 'Could not record the vote.', {
      status: 400,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  // RECOMPUTE — sum all votes, derive status (HIDE precedence).
  const allVotes = await db.vote.findMany({
    where: { spotId },
    select: { value: true, weight: true },
  });
  const tally = tallyVotes(allVotes);
  const nextStatus = resolveStatus(spot.status, tally);

  const data: Record<string, unknown> = {
    confirmScore: tally.confirmScore,
    denyScore: tally.denyScore,
    netScore: tally.netScore,
    confirmCount: tally.confirmCount,
    denyCount: tally.denyCount,
    status: nextStatus,
  };
  // Stamp transition timestamps only on entry into the state.
  if (nextStatus === 'VERIFIED' && spot.status !== 'VERIFIED' && !spot.verifiedAt) {
    data.verifiedAt = new Date();
  }
  if (nextStatus === 'HIDDEN' && spot.status !== 'HIDDEN' && !spot.hiddenAt) {
    data.hiddenAt = new Date();
  }

  // The submitter-edit policy only allows owner updates; recompute is a
  // system-driven status change, so write it through `authDb` as the voter
  // would be denied. Use the raw policy-bypassing path via update on the
  // spot — but our schema's `@@allow('all', ADMIN)` blocks a USER update of
  // another user's spot. So recompute through the unrestricted client.
  // TODO(verify): in release 1 this recompute moves to a queue job using the
  // raw `db` client / a SECURITY DEFINER trigger. For now we use authDb and
  // rely on a dedicated recompute policy; if the policy rejects, fall back.
  try {
    await db.spot.update({ where: { id: spotId }, data });
  } catch {
    // Policy rejected the cross-user status write — apply via the raw client.
    // (Imported lazily to keep the policy path as the default.)
    const { db: rawDb } = await import('@devrijehond/db');
    await rawDb.spot.update({ where: { id: spotId }, data });
  }

  const body: VoteResponseDto = {
    vote: {
      id: voteId,
      spotId,
      value: dto.value,
      proximityVerified,
      createdAt: voteCreatedAt.toISOString(),
    },
    netScore: tally.netScore,
    confirmCount: tally.confirmCount,
    denyCount: tally.denyCount,
    status: nextStatus,
  };

  return ok(body, { cacheControl: NO_STORE_CACHE_CONTROL });
}
