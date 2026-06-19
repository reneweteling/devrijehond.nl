import type { NextRequest } from 'next/server';
import { authDb, type JsonValue } from '@devrijehond/db';
import { pgQuery, requireAuth } from '@devrijehond/server';
import { SubmitSpotRequestSchema, type SubmitSpotResponseDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';
import { uniqueSlug } from '@/lib/slug';
import { normaliseGeometry } from '@/lib/geo';
import { loadSpotDetail } from '@/lib/spot-detail';

/**
 * POST /api/v1/me/spots — submit a new spot (REGION polygon or POI point).
 *
 * Flow:
 *   1. requireAuth → policy-bound `authDb(user)`.
 *   2. Validate the submit DTO; normalise the geometry (GeoJSON | point |
 *      polygon) into GeoJSON + centroid.
 *   3. Create the Spot row through `authDb` (status UNVERIFIED, slugified name,
 *      lat/lng centroid). The `@@allow('create', auth().id == submittedById)`
 *      policy enforces ownership.
 *   4. Set the PostGIS `geom` column via a raw UPDATE with
 *      `ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)` (ZenStack can't write the
 *      `Unsupported` column).
 *   5. Link amenityIds via `authDb` (the `SpotAmenity` create policy also
 *      checks ownership).
 *   6. Return the freshly-loaded SpotDetail.
 *
 * `/me/*` → CDN-bypass, `Cache-Control: no-store`.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }

  const parsed = SubmitSpotRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Submission did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const dto = parsed.data;

  let geom;
  try {
    geom = normaliseGeometry(dto);
  } catch (e) {
    return error('INVALID_GEOMETRY', e instanceof Error ? e.message : 'Invalid geometry.', {
      status: 400,
    });
  }
  if (!geom) {
    return error('INVALID_GEOMETRY', 'A spot requires geometry.', { status: 400 });
  }

  const db = authDb({ id: user.id, role: user.role });
  const slug = uniqueSlug(dto.name);

  // 3. Create the row (policy-enforced).
  let spotId: string;
  try {
    const created = await db.spot.create({
      data: {
        slug,
        type: dto.type,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        status: 'UNVERIFIED',
        lat: geom.lat,
        lng: geom.lng,
        address: dto.type === 'POI' ? (dto.address ?? null) : null,
        phone: dto.type === 'POI' ? (dto.phone ?? null) : null,
        website: dto.type === 'POI' ? (dto.website ?? null) : null,
        hours: dto.type === 'POI' ? (dto.hours as JsonValue | undefined) : undefined,
        submittedById: user.id,
      },
      select: { id: true },
    });
    spotId = created.id;
  } catch (e) {
    return error('CREATE_FAILED', 'Could not create the spot.', {
      status: 400,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  // 4. Write the PostGIS geometry (raw — the geom column is Unsupported in ZenStack).
  try {
    await pgQuery(
      `UPDATE "Spot"
         SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
       WHERE "id" = $2`,
      [JSON.stringify(geom.geojson), spotId],
    );
  } catch (e) {
    // Best-effort cleanup so we don't leave a geometry-less spot behind.
    await db.spot.delete({ where: { id: spotId } }).catch(() => undefined);
    return error('GEOMETRY_WRITE_FAILED', 'Could not store the spot geometry.', {
      status: 400,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  // 5. Link amenities (policy-enforced create on SpotAmenity).
  if (dto.amenityIds.length > 0) {
    try {
      await db.spotAmenity.createMany({
        data: dto.amenityIds.map((amenityId) => ({ spotId, amenityId })),
        skipDuplicates: true,
      });
    } catch {
      // Non-fatal: the spot exists; a bad amenity id shouldn't 500 the submit.
    }
  }

  // 5b. Attach submitted photo URLs (the client uploaded to S3 first).
  if (dto.photos.length > 0) {
    try {
      await db.spotPhoto.createMany({
        data: dto.photos.map((url, i) => ({
          spotId,
          url,
          uploadedById: user.id,
          sortOrder: i,
        })),
      });
    } catch {
      // Non-fatal.
    }
  }

  // 6. Return the full detail.
  const detail = await loadSpotDetail(slug);
  if (!detail) {
    return error('CREATE_FAILED', 'Spot created but could not be re-read.', { status: 500 });
  }

  const body: SubmitSpotResponseDto = detail;
  return ok(body, { status: 201, cacheControl: NO_STORE_CACHE_CONTROL });
}
