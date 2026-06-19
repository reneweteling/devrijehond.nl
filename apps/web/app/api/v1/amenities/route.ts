import type { NextRequest } from 'next/server';
import { anonDb } from '@devrijehond/db';
import { AmenitiesQuerySchema, type AmenitiesResponseDto } from '@devrijehond/types';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/amenities — public, anonymous, CDN-cacheable.
 *
 * Returns visible amenities (policy-enforced via `anonDb()`) with their
 * category mapping (`categoryIds` from `AmenityOnCategory`). Optional
 * `?categoryId` restricts to amenities offered by that category.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = AmenitiesQuerySchema.safeParse({
    categoryId: url.searchParams.get('categoryId') ?? undefined,
  });
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Invalid query parameters.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = anonDb();
  const rows = await db.amenity.findMany({
    where: parsed.data.categoryId
      ? { categories: { some: { categoryId: parsed.data.categoryId } } }
      : {},
    include: { categories: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  const body: AmenitiesResponseDto = {
    items: rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      label: a.label,
      icon: a.icon ?? null,
      sortOrder: a.sortOrder,
      categoryIds: a.categories.map((c) => c.categoryId),
    })),
  };

  return ok(body);
}
