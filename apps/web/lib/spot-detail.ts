import { anonDb } from '@devrijehond/db';
import { pgQuery } from '@devrijehond/server';
import type { SpotDetailDto, SpotSummaryDto, CategoryDto, AmenityDto } from '@devrijehond/types';

/**
 * Shared spot read helpers used by the public detail API AND the SSR spot
 * pages (`/plek/[slug]`, `/gebied/[slug]`). Reads go through `anonDb()` so the
 * `@@deny('read', HIDDEN/REMOVED …)` policy is enforced for anonymous callers —
 * a hidden spot returns null. The geometry (PostGIS `geom`) is fetched as
 * GeoJSON via a tiny raw query because ZenStack can't model the `Unsupported`
 * column.
 */

type GeomRow = { geojson: string | null };

async function loadGeometry(spotId: string): Promise<SpotDetailDto['geometry']> {
  const rows = await pgQuery<GeomRow>(
    `SELECT ST_AsGeoJSON("geom") AS geojson FROM "Spot" WHERE "id" = $1`,
    [spotId],
  );
  const raw = rows[0]?.geojson;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotDetailDto['geometry'];
  } catch {
    return null;
  }
}

function toCategoryDto(c: {
  id: string;
  slug: string;
  label: string;
  type: 'REGION' | 'POI';
  icon: string | null;
  color: string | null;
  sortOrder: number;
}): CategoryDto {
  return {
    id: c.id,
    slug: c.slug,
    label: c.label,
    type: c.type,
    icon: c.icon,
    color: c.color,
    sortOrder: c.sortOrder,
  };
}

/**
 * Load full spot detail by slug, or null if not found / not visible.
 * `anonDb()` enforces the read policy, so HIDDEN/REMOVED spots are invisible to
 * the public site + API.
 */
export async function loadSpotDetail(slug: string): Promise<SpotDetailDto | null> {
  const db = anonDb();

  const spot = await db.spot.findUnique({
    where: { slug },
    include: {
      category: true,
      submittedBy: { select: { id: true, handle: true, name: true, image: true } },
      amenities: { include: { amenity: { include: { categories: true } } } },
      photos: { where: { status: 'ACTIVE' }, orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!spot) return null;

  const geometry = await loadGeometry(spot.id);

  const amenities: AmenityDto[] = spot.amenities.map((sa) => ({
    id: sa.amenity.id,
    slug: sa.amenity.slug,
    label: sa.amenity.label,
    icon: sa.amenity.icon,
    sortOrder: sa.amenity.sortOrder,
    categoryIds: sa.amenity.categories.map((c) => c.categoryId),
  }));

  return {
    id: spot.id,
    slug: spot.slug,
    type: spot.type,
    name: spot.name,
    description: spot.description ?? null,
    category: toCategoryDto(spot.category),
    status: spot.status,
    geometry,
    lat: spot.lat ?? null,
    lng: spot.lng ?? null,
    address: spot.address ?? null,
    hours: (spot.hours as unknown) ?? null,
    phone: spot.phone ?? null,
    website: spot.website ?? null,
    amenities,
    photos: spot.photos.map((p) => ({
      id: p.id,
      url: p.url,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    })),
    rating: { average: spot.ratingAvg, count: spot.ratingCount },
    verification: {
      status: spot.status,
      netScore: spot.netScore,
      confirmCount: spot.confirmCount,
      denyCount: spot.denyCount,
      verifiedAt: spot.verifiedAt ? spot.verifiedAt.toISOString() : null,
    },
    submittedBy: {
      id: spot.submittedBy.id,
      handle: spot.submittedBy.handle ?? null,
      name: spot.submittedBy.name ?? null,
      image: spot.submittedBy.image ?? null,
    },
    createdAt: spot.createdAt.toISOString(),
    updatedAt: spot.updatedAt.toISOString(),
  };
}

/** Map a loaded detail down to the lightweight summary (list/marker) shape. */
export function detailToSummary(d: SpotDetailDto): SpotSummaryDto {
  return {
    id: d.id,
    slug: d.slug,
    type: d.type,
    name: d.name,
    categoryId: d.category.id,
    status: d.status,
    lat: d.lat,
    lng: d.lng,
    rating: d.rating,
    photoUrl: d.photos[0]?.url ?? null,
    updatedAt: d.updatedAt,
  };
}
