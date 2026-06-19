import type { NextRequest } from 'next/server';
import { anonDb } from '@devrijehond/db';
import { type ReviewDto, type ReviewsResponseDto } from '@devrijehond/types';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/spots/:slug/reviews — public, anonymous list of ACTIVE reviews for
 * a spot, newest-first. Resolves the spot by slug through `anonDb()` so the
 * HIDDEN/REMOVED read policy is enforced (a hidden spot's reviews 404). Writing
 * a review lives under `POST /api/v1/me/spots/:id/reviews` (auth-gated).
 */
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const db = anonDb();

  const spot = await db.spot.findUnique({ where: { slug }, select: { id: true } });
  if (!spot) {
    return error('NOT_FOUND', 'Spot not found.', { status: 404 });
  }

  const rows = await db.review.findMany({
    where: { spotId: spot.id, status: 'ACTIVE' },
    include: { user: { select: { id: true, handle: true, name: true, image: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const items: ReviewDto[] = rows.map((r) => ({
    id: r.id,
    spotId: r.spotId,
    stars: r.stars,
    body: r.body ?? null,
    helpfulCount: r.helpfulCount,
    author: {
      id: r.user.id,
      handle: r.user.handle ?? null,
      name: r.user.name ?? null,
      image: r.user.image ?? null,
    },
    createdAt: r.createdAt.toISOString(),
  }));

  const body: ReviewsResponseDto = { items, nextCursor: null };
  return ok(body);
}
