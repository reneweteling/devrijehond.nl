import type { NextRequest } from 'next/server';
import { authDb, db as rawDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import {
  SubmitReviewRequestSchema,
  type ReviewDto,
  type ReviewsResponseDto,
} from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * /api/v1/me/spots/:id/reviews
 *   - GET  → list ACTIVE reviews for the spot (paginated, newest-first).
 *   - POST → create a 0–5 star review (+ optional body) and recompute the
 *            spot's `ratingAvg` / `ratingCount`.
 *
 * Both require auth (they live under `/me/*`). The recompute is a denormalised
 * aggregate over ACTIVE reviews; the cross-user spot aggregate write uses the
 * raw client (a USER can't update another user's Spot under policy).
 */
export const runtime = 'nodejs';

function authedDb(user: { id: string; role: 'USER' | 'MODERATOR' | 'ADMIN' }) {
  return authDb(user);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { id: spotId } = await params;

  const db = authedDb(ctx.user);
  const rows = await db.review.findMany({
    where: { spotId, status: 'ACTIVE' },
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
  return ok(body, { cacheControl: NO_STORE_CACHE_CONTROL });
}

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
  const parsed = SubmitReviewRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Review did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = authedDb(user);
  let created;
  try {
    created = await db.review.create({
      data: {
        spotId,
        userId: user.id,
        stars: parsed.data.stars,
        body: parsed.data.body ?? null,
      },
      include: { user: { select: { id: true, handle: true, name: true, image: true } } },
    });
  } catch (e) {
    return error('CREATE_FAILED', 'Could not create the review.', {
      status: 400,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  // Recompute the denormalised rating aggregate over ACTIVE reviews.
  const agg = await rawDb.review.aggregate({
    where: { spotId, status: 'ACTIVE' },
    _avg: { stars: true },
    _count: { _all: true },
  });
  await rawDb.spot.update({
    where: { id: spotId },
    data: {
      ratingAvg: agg._avg.stars ?? 0,
      ratingCount: agg._count._all,
    },
  });

  const dto: ReviewDto = {
    id: created.id,
    spotId: created.spotId,
    stars: created.stars,
    body: created.body ?? null,
    helpfulCount: created.helpfulCount,
    author: {
      id: created.user.id,
      handle: created.user.handle ?? null,
      name: created.user.name ?? null,
      image: created.user.image ?? null,
    },
    createdAt: created.createdAt.toISOString(),
  };
  return ok(dto, { status: 201, cacheControl: NO_STORE_CACHE_CONTROL });
}
