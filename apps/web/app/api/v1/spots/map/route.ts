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
 * The viewport is split into a GRID_N × GRID_N grid (sized to the bbox, so it
 * tracks zoom). Spots are bucketed by their centroid:
 *   - a cell with a single spot is returned in full (with geometry for regions),
 *   - a cell with several spots collapses into one `cluster` (count + centroid).
 * So the payload is bounded by the grid (≤ GRID_N² markers) no matter how far
 * out you zoom, instead of streaming every spot (a NL-wide read used to return
 * thousands). Tapping a cluster zooms in until its cell resolves into spots.
 *
 * Bbox intersection + the centroid bucketing run against the GiST-indexed `geom`
 * column. This lives at its own static segment so `/spots/map` isn't captured by
 * the sibling `/spots/[slug]` route. It uses the raw PostGIS pool (which
 * bypasses ZenStack policies to reach the `Unsupported` geometry column); the
 * `status NOT IN ('HIDDEN','REMOVED')` predicate reproduces the read policy for
 * the anonymous public case.
 */
export const runtime = 'nodejs';

// Viewport grid resolution. ≤ GRID_N² markers (clusters + singles) are ever
// returned, so a dense city reads as a handful of count bubbles, not a wall.
const GRID_N = 7;

// Only collapse a grid cell into a count bubble once it holds at least this many
// spots — clustering is for when pins would genuinely pile up, not for 2-3 spots
// that fit fine as individual pins. Cells below this return every spot as a pin.
const MIN_CLUSTER_COUNT = 6;

// Safety cap for the non-clustered read (the web map, which fetches every spot
// in the viewport). The clustered read needs no such cap, it's bounded by GRID_N².
const MAP_MARKER_LIMIT = 2000;

// Query-string params arrive as strings; coerce the bbox numbers (the contract
// `SpotsMapQuerySchema` types them as `number` for the OpenAPI doc).
const MapQuerySchema = SpotsMapQuerySchema.extend({
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  // Query strings arrive as text; treat 'true'/'1' as the cluster opt-in.
  cluster: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).optional(),
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

  // Shared filters: public visibility + optional facets + GiST bbox intersection.
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

  // The full per-spot projection (centroid + rating + thumbnail; REGION outline
  // as zoom-simplified GeoJSON). Shared by the non-clustered read and the
  // lone-spot detail pass of the clustered read.
  const detailCols = (tolToken: string) => `
    s."id", s."slug", s."type", s."name", s."categoryId" AS category_id,
    s."status", s."lat", s."lng",
    s."ratingAvg" AS rating_avg, s."ratingCount" AS rating_count,
    s."updatedAt" AS updated_at,
    CASE WHEN s."type" = 'REGION'
      THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(s."geom", ${tolToken}), 5)
      ELSE NULL END AS geojson,
    (
      SELECT p."url" FROM "SpotPhoto" p
      WHERE p."spotId" = s."id" AND p."status" = 'ACTIVE'
      ORDER BY p."sortOrder" ASC
      LIMIT 1
    ) AS photo_url
  `;
  const toItem = (r: SpotRow): MapItem => ({
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
  });

  // --- Non-clustered read (default; used by the web map). ------------------
  // Returns every visible spot in one shot, capped as a safety valve.
  if (!q.cluster) {
    const sql = `
      SELECT ${detailCols(param(simplifyTol))}
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
    return ok({ items: rows.map(toItem), clusters: [] } satisfies SpotsMapResponseDto);
  }

  // --- Clustered read (mobile: cluster=true). -----------------------------
  // Grid cell size in degrees, from the viewport span. Spots are bucketed by
  // their centroid into these cells; degenerate (zero-span) bboxes are floored
  // so the division never blows up.
  const cellLng = Math.max((q.maxLng - q.minLng) / GRID_N, 1e-9);
  const cellLat = Math.max((q.maxLat - q.minLat) / GRID_N, 1e-9);
  // Need a centroid to bucket (every spot mirrors its centroid into lat/lng).
  where.push(`s."lat" IS NOT NULL AND s."lng" IS NOT NULL`);
  const pMinLng = param(q.minLng);
  const pCellLng = param(cellLng);
  const pMinLat = param(q.minLat);
  const pCellLat = param(cellLat);

  // Phase 1: bucket into grid cells, count + centroid per cell.
  const cellSql = `
    WITH visible AS (
      SELECT s."id", s."lat" AS lat, s."lng" AS lng, s."updatedAt" AS updated_at,
        floor((s."lng" - ${pMinLng}) / ${pCellLng}) AS gx,
        floor((s."lat" - ${pMinLat}) / ${pCellLat}) AS gy
      FROM "Spot" s
      WHERE ${where.join(' AND ')}
    )
    SELECT
      count(*)::int AS c,
      avg(lat)::float8 AS clat,
      avg(lng)::float8 AS clng,
      array_agg("id" ORDER BY updated_at DESC) AS ids
    FROM visible
    GROUP BY gx, gy
    LIMIT 1000
  `;

  type CellRow = { c: number; clat: number; clng: number; ids: string[] };
  let cells: CellRow[];
  try {
    cells = await pgQuery<CellRow>(cellSql, args);
  } catch (e) {
    return error('QUERY_FAILED', 'Map query failed.', {
      status: 500,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  // Cells dense enough to collapse become count bubbles; everything below the
  // threshold is returned as individual pins (all of the cell's spots).
  const clusters = cells
    .filter((c) => c.c >= MIN_CLUSTER_COUNT)
    .map((c) => ({ lat: c.clat, lng: c.clng, count: c.c }));
  const singleIds = cells
    .filter((c) => c.c < MIN_CLUSTER_COUNT)
    .flatMap((c) => c.ids)
    .slice(0, MAP_MARKER_LIMIT);

  // Phase 2: full detail for the non-clustered spots.
  let items: MapItem[] = [];
  if (singleIds.length > 0) {
    const dargs: unknown[] = [];
    const dparam = (v: unknown) => {
      dargs.push(v);
      return `$${dargs.length}`;
    };
    const detailSql = `
      SELECT ${detailCols(dparam(simplifyTol))}
      FROM "Spot" s
      WHERE s."id" = ANY(${dparam(singleIds)}::uuid[])
    `;
    let rows: SpotRow[];
    try {
      rows = await pgQuery<SpotRow>(detailSql, dargs);
    } catch (e) {
      return error('QUERY_FAILED', 'Map query failed.', {
        status: 500,
        details: process.env.NODE_ENV === 'production' ? undefined : String(e),
      });
    }
    items = rows.map(toItem);
  }

  return ok({ items, clusters } satisfies SpotsMapResponseDto);
}
