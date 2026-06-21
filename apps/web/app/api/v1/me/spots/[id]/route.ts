import type { NextRequest } from 'next/server';
import { authDb, type JsonValue } from '@devrijehond/db';
import { pgQuery, requireAuth } from '@devrijehond/server';
import { UpdateSpotRequestSchema, type SubmitSpotResponseDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';
import { normaliseGeometry } from '@/lib/geo';
import { loadSpotDetail } from '@/lib/spot-detail';
import { sanitizeRichText } from '@/lib/rich-text';

/**
 * PATCH /api/v1/me/spots/:id, owner edit while the spot is still UNVERIFIED.
 *
 * The `@@allow('update', auth().id == submittedById && status == 'UNVERIFIED')`
 * policy enforces ownership + the unverified gate. Geometry edits reuse the
 * submit normalisation + the raw PostGIS write.
 */
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }
  const parsed = UpdateSpotRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Update did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const dto = parsed.data;

  const db = authDb({ id: user.id, role: user.role });

  // Confirm ownership + slug (and give a clean 404 rather than a policy 500).
  const existing = await db.spot.findFirst({
    where: { id, submittedById: user.id, status: 'UNVERIFIED' },
    select: { id: true, slug: true },
  });
  if (!existing) {
    return error('NOT_FOUND', 'Spot not found or not editable.', { status: 404 });
  }

  // Geometry (optional on PATCH).
  let geom = null;
  if (dto.geometry || dto.point || dto.polygon) {
    try {
      geom = normaliseGeometry(dto);
    } catch (e) {
      return error('INVALID_GEOMETRY', e instanceof Error ? e.message : 'Invalid geometry.', {
        status: 400,
      });
    }
  }

  await db.spot.update({
    where: { id },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: sanitizeRichText(dto.description) }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.address !== undefined && { address: dto.address ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
      ...(dto.website !== undefined && { website: dto.website ?? null }),
      ...(dto.hours !== undefined && { hours: dto.hours as JsonValue }),
      ...(geom && { lat: geom.lat, lng: geom.lng }),
    },
  });

  // Re-link amenities if supplied (replace set).
  if (dto.amenityIds) {
    await db.spotAmenity.deleteMany({ where: { spotId: id } });
    if (dto.amenityIds.length > 0) {
      await db.spotAmenity
        .createMany({
          data: dto.amenityIds.map((amenityId) => ({ spotId: id, amenityId })),
          skipDuplicates: true,
        })
        .catch(() => undefined);
    }
  }

  if (geom) {
    await pgQuery(
      `UPDATE "Spot" SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE "id" = $2`,
      [JSON.stringify(geom.geojson), id],
    );
  }

  const detail = await loadSpotDetail(existing.slug);
  if (!detail) {
    return error('UPDATE_FAILED', 'Spot updated but could not be re-read.', { status: 500 });
  }
  const body: SubmitSpotResponseDto = detail;
  return ok(body, { cacheControl: NO_STORE_CACHE_CONTROL });
}
