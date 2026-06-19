import type { NextRequest } from 'next/server';
import { anonDb } from '@devrijehond/db';
import { CategoriesQuerySchema, type CategoriesResponseDto } from '@devrijehond/types';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/categories — public, anonymous, CDN-cacheable.
 *
 * `anonDb()` enforces the `@@allow('read', visible || ADMIN)` policy, so only
 * visible categories come back to anonymous callers. Optional `?type` filter.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = CategoriesQuerySchema.safeParse({
    type: url.searchParams.get('type') ?? undefined,
  });
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Invalid query parameters.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = anonDb();
  const rows = await db.category.findMany({
    where: {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  const body: CategoriesResponseDto = {
    items: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.label,
      type: c.type,
      icon: c.icon ?? null,
      color: c.color ?? null,
      sortOrder: c.sortOrder,
    })),
  };

  return ok(body);
}
