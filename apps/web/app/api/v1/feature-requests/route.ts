import type { NextRequest } from 'next/server';
import { anonDb } from '@devrijehond/db';
import { getContext } from '@devrijehond/server';
import { FeatureRequestsQuerySchema, type FeatureRequestsResponseDto } from '@devrijehond/types';
import {
  ok,
  error,
  NO_STORE_CACHE_CONTROL,
  DEFAULT_PUBLIC_CACHE_CONTROL,
} from '@/lib/api-response';

/**
 * GET /api/v1/feature-requests, public list of community feature requests.
 *
 * Works signed-in and signed-out (like dekmantel's `POST /me/analytics`):
 * anonymous reads are CDN-cacheable and report `viewerHasVoted: false`; a
 * request carrying a session is NOT cached and flags the viewer's own votes.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = FeatureRequestsQuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Invalid query parameters.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const ctx = await getContext(request);
  const db = anonDb();

  const rows = await db.featureRequest.findMany({
    where: { ...(parsed.data.status ? { status: parsed.data.status } : {}) },
    orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
    take: parsed.data.limit,
    include: { createdBy: { select: { handle: true, image: true } } },
  });

  // Resolve the viewer's votes in one query when signed in.
  let votedIds = new Set<string>();
  if (ctx.user) {
    const myVotes = await ctx.authDb.featureVote.findMany({
      where: { userId: ctx.user.id, requestId: { in: rows.map((r) => r.id) } },
      select: { requestId: true },
    });
    votedIds = new Set(myVotes.map((v) => v.requestId));
  }

  const body: FeatureRequestsResponseDto = {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? null,
      component: r.component ?? null,
      status: r.status,
      upvoteCount: r.upvoteCount,
      viewerHasVoted: votedIds.has(r.id),
      author: { handle: r.createdBy?.handle ?? null, image: r.createdBy?.image ?? null },
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: null,
  };

  // Personalised (session) reads bypass the CDN; anonymous reads are cacheable.
  return ok(body, {
    cacheControl: ctx.user ? NO_STORE_CACHE_CONTROL : DEFAULT_PUBLIC_CACHE_CONTROL,
  });
}
