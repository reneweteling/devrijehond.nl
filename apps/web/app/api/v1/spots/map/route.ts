import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { pgQuery } from '@devrijehond/server';
import {
  SpotsMapQuerySchema,
  type SpotsMapResponseDto,
  type SpotSummaryDto,
} from '@devrijehond/types';
import { ok, error } from '@/lib/api-response';

/**
 * GET /api/v1/spots/map, public, anonymous markers within a map viewport.
 *
 * Unlike `GET /api/v1/spots` (keyset-paginated list), the map read returns
 * every visible spot whose geometry intersects the requested bbox in one shot
 * so the client can draw all markers, capped at MAP_MARKER_LIMIT as a safety
 * valve. Bbox intersection runs against the GiST-indexed `geom` column.
 *
 * This lives at its own static segment so `/spots/map` isn't captured by the
 * sibling `/spots/[slug]` route. It uses the raw PostGIS pool (which bypasses
 * ZenStack policies to reach the `Unsupported` geometry column); the
 * `status NOT IN ('HIDDEN','REMOVED')` predicate reproduces the read policy for
 * the anonymous public case.
 */
export const runtime = 'nodejs';

const MAP_MARKER_LIMIT = 2000;

// Query-string params arrive as strings; coerce the bbox numbers (the contract
// `SpotsMapQuerySchema` types them as `number` for the OpenAPI doc).
const MapQuerySchema = SpotsMapQuerySchema.extend({
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
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
  geojson: string | null;
};

/** A REGION's polygon outline (geofence) as GeoJSON, added to the map items. */
type MapItem = SpotSummaryDto & {
  geometry: { type: string; coordinates: unknown } | null;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = MapQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Invalid viewport query.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const q = parsed.data;

  // Geometry simplification scaled to zoom: at a wide viewport the polygons are
  // a few pixels across, so a coarse tolerance (relative to the bbox width)
  // strips most vertices with no visible loss; zoomed in the tolerance shrinks
  // toward full detail. This is what keeps the wide-view payload small enough
  // for a phone on cellular (a NL-wide read drops from ~2.6 MB to a fraction).
  const simplifyTol = Math.max(0, (q.maxLng - q.minLng) / 900);

  const where: string[] = [];
  const args: unknown[] = [];
  const param = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };

  // Public visibility: reproduce the HIDDEN/REMOVED read policy in SQL.
  where.push(`s."status" NOT IN ('HIDDEN','REMOVED')`);

  if (q.type) where.push(`s."type" = ${param(q.type)}`);
  if (q.categoryId) where.push(`s."categoryId" = ${param(q.categoryId)}`);
  if (q.since) where.push(`s."updatedAt" >= ${param(new Date(q.since))}`);

  // GiST-indexed bbox intersection. ST_MakeEnvelope(minLng,minLat,maxLng,maxLat,4326).
  const env = `ST_MakeEnvelope(${param(q.minLng)}, ${param(q.minLat)}, ${param(q.maxLng)}, ${param(q.maxLat)}, 4326)`;
  where.push(`s."geom" && ${env}`);

  const sql = `
    SELECT
      s."id", s."slug", s."type", s."name", s."categoryId" AS category_id,
      s."status", s."lat", s."lng",
      s."ratingAvg" AS rating_avg, s."ratingCount" AS rating_count,
      s."updatedAt" AS updated_at,
      -- REGION outline as GeoJSON (the geofence); POIs need only the centroid.
      -- Simplified to the current zoom and emitted at 5-decimal (~1 m) precision
      -- to keep the payload small. ST_SimplifyPreserveTopology avoids self-
      -- intersections; tolerance 0 (fully zoomed in) is a no-op.
      CASE WHEN s."type" = 'REGION'
        THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(s."geom", ${param(simplifyTol)}), 5)
        ELSE NULL END AS geojson,
      (
        SELECT p."url" FROM "SpotPhoto" p
        WHERE p."spotId" = s."id" AND p."status" = 'ACTIVE'
        ORDER BY p."sortOrder" ASC
        LIMIT 1
      ) AS photo_url
    FROM "Spot" s
    WHERE ${where.join(' AND ')}
    ORDER BY s."updatedAt" DESC
    LIMIT ${param(MAP_MARKER_LIMIT)}
  `;

  let rows: SpotRow[];
  try {
    rows = await pgQuery<SpotRow>(sql, args);
  } catch (e) {
    return error('QUERY_FAILED', 'Map query failed.', {
      status: 500,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  const items: MapItem[] = rows.map((r) => ({
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
    geometry: r.geojson ? JSON.parse(r.geojson) : null,
  }));

  const body = { items } satisfies SpotsMapResponseDto;
  return ok(body);
}
