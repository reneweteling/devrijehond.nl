import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { CreateFeatureRequestRequestSchema, type FeatureRequestDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/** POST /api/v1/me/feature-requests — create a community feature request. */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }
  const parsed = CreateFeatureRequestRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Feature request did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = authDb(ctx.user);
  const created = await db.featureRequest.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      component: parsed.data.component ?? null,
      createdById: ctx.user.id,
    },
  });

  const dto: FeatureRequestDto = {
    id: created.id,
    title: created.title,
    body: created.body ?? null,
    component: created.component ?? null,
    status: created.status,
    upvoteCount: created.upvoteCount,
    viewerHasVoted: false,
    createdAt: created.createdAt.toISOString(),
  };
  return ok(dto, { status: 201, cacheControl: NO_STORE_CACHE_CONTROL });
}
