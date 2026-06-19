import type { NextRequest } from 'next/server';
import { authDb, db as rawDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { type FeatureVoteResponseDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * POST /api/v1/me/feature-requests/:id/vote, toggle the viewer's upvote.
 *
 * If the user has not voted, create a `FeatureVote` and increment
 * `upvoteCount`; if they have, remove it and decrement. The count is kept in
 * sync via the raw client (the FeatureRequest aggregate is not user-owned).
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
  const { id: requestId } = await params;

  const db = authDb(user);

  // Composite-key accessor derived from `@@id([requestId, userId])`.
  const existing = await db.featureVote.findUnique({
    where: { requestId_userId: { requestId, userId: user.id } },
    select: { requestId: true },
  });

  let viewerHasVoted: boolean;
  if (existing) {
    await db.featureVote.delete({
      where: { requestId_userId: { requestId, userId: user.id } },
    });
    viewerHasVoted = false;
  } else {
    try {
      await db.featureVote.create({ data: { requestId, userId: user.id } });
    } catch (e) {
      return error('VOTE_FAILED', 'Could not toggle the upvote.', {
        status: 400,
        details: process.env.NODE_ENV === 'production' ? undefined : String(e),
      });
    }
    viewerHasVoted = true;
  }

  // Recompute the denormalised count from the join table (raw client, the
  // FeatureRequest row isn't user-owned).
  const upvoteCount = await rawDb.featureVote.count({ where: { requestId } });
  await rawDb.featureRequest.update({ where: { id: requestId }, data: { upvoteCount } });

  const body: FeatureVoteResponseDto = { requestId, upvoteCount, viewerHasVoted };
  return ok(body, { cacheControl: NO_STORE_CACHE_CONTROL });
}
