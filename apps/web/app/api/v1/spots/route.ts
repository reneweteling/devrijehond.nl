import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { pgQuery } from '@devrijehond/server';
import {
  SpotsQuerySchema,
  SpotStatusSchema,
  type SpotsResponseDto,
  type SpotSummaryDto,
} from '@devrijehond/types';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/spots, public, anonymous, CDN-cacheable list of spots.
 *
 * Two filtering modes, combinable:
 *   - **Viewport bbox** (`minLng,minLat,maxLng,maxLat`): returns spots whose
 *     geometry intersects the box via PostGIS `geom && ST_MakeEnvelope(...,
 *     4326)` against the GiST index. All four must be present to engage.
 *   - **Plain list** (no bbox): every visible spot, newest-first.
 *
 * Plus `type` / `categoryId` filters, a delta-sync `since` cursor (returns only
 * spots changed at/after that timestamp, every read model has an
 * `updated_at` index), an optional `verification` filter, and amenity filtering
 * (`amenity` = comma-separated amenity ids; a spot must have ALL of them).
 *
 * HIDDEN/REMOVED spots are excluded in SQL (`status NOT IN (...)`) because this
 * read uses the raw PostGIS pool (which bypasses ZenStack policies) to reach
 * the `Unsupported` geometry column. That SQL predicate reproduces the
 * `@@deny('read', HIDDEN/REMOVED …)` policy for the anonymous public case.
 *
 * Pagination is keyset on `(updatedAt, id)`, `cursor` is the base64 of the
 * last row's `updatedAt|id`. Cheaper + stable under inserts vs OFFSET.
 */
export const runtime = 'nodejs';

// Extend the contract query with the bbox + extra filters this endpoint honours.
const BboxSpotsQuerySchema = SpotsQuerySchema.extend({
  minLng: z.coerce.number().min(-180).max(180).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  verification: SpotStatusSchema.optional(),
  amenity: z.string().optional(),
});

type SpotRow = {
  id: string;
  slug: string;
  type: 'REGION' | 'POI';
  name: string;
  category_id: string;
  status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
  lat: number | null;
  lng: number | null;
  rating_avg: number;
  rating_count: number;
  photo_url: string | null;
  updated_at: Date;
};

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { updatedAt: string; id: string } | null {
  try {
    const [updatedAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!updatedAt || !id) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = BboxSpotsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Invalid query parameters.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const q = parsed.data;

  const hasBbox =
    q.minLng !== undefined &&
    q.minLat !== undefined &&
    q.maxLng !== undefined &&
    q.maxLat !== undefined;

  const where: string[] = [];
  const args: unknown[] = [];
  const param = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };

  // Public visibility: reproduce the HIDDEN/REMOVED read policy in SQL.
  where.push(`s."status" NOT IN ('HIDDEN','REMOVED')`);

  // Optional explicit verification filter (e.g. "only verified").
  if (q.verification && q.verification !== 'HIDDEN' && q.verification !== 'REMOVED') {
    where.push(`s."status" = ${param(q.verification)}`);
  }

  if (q.type) where.push(`s."type" = ${param(q.type)}`);
  if (q.categoryId) where.push(`s."categoryId" = ${param(q.categoryId)}`);
  if (q.since) where.push(`s."updatedAt" >= ${param(new Date(q.since))}`);

  if (hasBbox) {
    // GiST-indexed bbox intersection. ST_MakeEnvelope(minLng,minLat,maxLng,maxLat,4326).
    const env = `ST_MakeEnvelope(${param(q.minLng)}, ${param(q.minLat)}, ${param(q.maxLng)}, ${param(q.maxLat)}, 4326)`;
    where.push(`s."geom" && ${env}`);
  }

  // Amenity filter: a spot must carry ALL requested amenity ids.
  const amenityIds = (q.amenity ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (amenityIds.length > 0) {
    where.push(`(
      SELECT COUNT(*) FROM "SpotAmenity" sa
      WHERE sa."spotId" = s."id" AND sa."amenityId" = ANY(${param(amenityIds)}::uuid[])
    ) = ${param(amenityIds.length)}`);
  }

  // Nearest-first mode: when a point is given, order by PostGIS distance (KNN
  // via the GiST `<->` operator) instead of recency. This is what makes the
  // "Nabij" tab show genuinely close spots rather than the newest ones.
  const hasNear = q.nearLat !== undefined && q.nearLng !== undefined;
  const orderBy = hasNear
    ? `s."geom" <-> ST_SetSRID(ST_MakePoint(${param(q.nearLng)}, ${param(q.nearLat)}), 4326) ASC`
    : `s."updatedAt" DESC, s."id" DESC`;

  // Keyset pagination on (updatedAt DESC, id DESC). Only in recency mode; the
  // nearest-first list returns the closest `limit` without a cursor for now.
  if (!hasNear && q.cursor) {
    const cur = decodeCursor(q.cursor);
    if (cur) {
      where.push(`(s."updatedAt", s."id") < (${param(new Date(cur.updatedAt))}, ${param(cur.id)})`);
    }
  }

  const limit = q.limit;
  // Fetch one extra row to know whether there's a next page.
  const sql = `
    SELECT
      s."id", s."slug", s."type", s."name", s."categoryId" AS category_id,
      s."status", s."lat", s."lng",
      s."ratingAvg" AS rating_avg, s."ratingCount" AS rating_count,
      s."updatedAt" AS updated_at,
      (
        SELECT p."url" FROM "SpotPhoto" p
        WHERE p."spotId" = s."id" AND p."status" = 'ACTIVE'
        ORDER BY p."sortOrder" ASC
        LIMIT 1
      ) AS photo_url
    FROM "Spot" s
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ${param(limit + 1)}
  `;

  let rows: SpotRow[];
  try {
    rows = await pgQuery<SpotRow>(sql, args);
  } catch (e) {
    return error('QUERY_FAILED', 'Spot query failed.', {
      status: 500,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  // Keyset cursor only applies to recency mode; nearest-first has no cursor yet.
  const nextCursor = !hasNear && hasMore && last ? encodeCursor(last.updated_at, last.id) : null;

  const items: SpotSummaryDto[] = page.map((r) => ({
    id: r.id,
    slug: r.slug,
    type: r.type,
    name: r.name,
    categoryId: r.category_id,
    status: r.status,
    lat: r.lat,
    lng: r.lng,
    rating: { average: r.rating_avg, count: r.rating_count },
    photoUrl: r.photo_url,
    updatedAt: r.updated_at.toISOString(),
  }));

  const body: SpotsResponseDto = { items, nextCursor };
  return ok(body);
}
