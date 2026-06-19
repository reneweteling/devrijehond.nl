import { z } from 'zod';
import {
  UserRoleSchema as DbUserRoleSchema,
  SpotTypeSchema as DbSpotTypeSchema,
  SpotStatusSchema as DbSpotStatusSchema,
  VoteValueSchema as DbVoteValueSchema,
  ReportReasonSchema as DbReportReasonSchema,
  FeatureStatusSchema as DbFeatureStatusSchema,
} from '@devrijehond/db/zod';
import '../registry'; // side-effect: extendZodWithOpenApi(z)

/**
 * Re-export generated enum schemas with OpenAPI metadata, plus the hand-rolled
 * primitives shared across DTOs.
 *
 * Pulling the enum schemas from `@devrijehond/db` (which derives them from the
 * ZModel via `@zenstackhq/zod`) prevents drift, any value added in
 * `schema.zmodel` shows up in the API contract automatically.
 */

export const UserRoleSchema = DbUserRoleSchema.openapi('UserRole', {
  description: 'Application role. `USER` = mobile app + website. `ADMIN` = moderation safety-net.',
  example: 'USER',
});

export const SpotTypeSchema = DbSpotTypeSchema.openapi('SpotType', {
  description: 'Kind of spot. `REGION` = polygon area (off-leash zone, swim beach). `POI` = point.',
  example: 'REGION',
});

export const SpotStatusSchema = DbSpotStatusSchema.openapi('SpotStatus', {
  description:
    'Moderation lifecycle. `UNVERIFIED` = live, awaiting community confirmation. `VERIFIED` = net weighted score reached threshold. `HIDDEN`/`REMOVED` = admin-only.',
  example: 'UNVERIFIED',
});

export const VoteValueSchema = DbVoteValueSchema.openapi('VoteValue', {
  description: 'Community verification vote. `CONFIRM` raises the score, `DENY` lowers it.',
  example: 'CONFIRM',
});

export const ReportReasonSchema = DbReportReasonSchema.openapi('ReportReason', {
  description: 'Why a piece of content was reported.',
  example: 'WRONG_INFO',
});

export const FeatureStatusSchema = DbFeatureStatusSchema.openapi('FeatureStatus', {
  description: 'Product-roadmap state of a community feature request.',
  example: 'CONSIDERING',
});

// Enums NOT exported by @devrijehond/db/zod, defined here to match the ZModel.
export const ReportTargetSchema = z.enum(['SPOT', 'PHOTO', 'REVIEW']).openapi('ReportTarget', {
  description: 'What kind of entity a report targets.',
  example: 'SPOT',
});

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

export const UuidSchema = z.string().uuid().openapi({
  description: 'RFC 4122 UUID (v4).',
  example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
});

export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .openapi({ description: 'URL-safe slug (lowercase, hyphenated).', example: 'amsterdamse-bos' });

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .openapi({ description: 'RFC 3339 datetime in UTC.', example: '2026-06-19T12:00:00Z' });

export const LatSchema = z
  .number()
  .min(-90)
  .max(90)
  .openapi({ description: 'Latitude in decimal degrees (WGS84 / EPSG:4326).', example: 52.3006 });

export const LngSchema = z
  .number()
  .min(-180)
  .max(180)
  .openapi({ description: 'Longitude in decimal degrees (WGS84 / EPSG:4326).', example: 4.8368 });

/** Single lat/lng pair (decimal degrees, WGS84). */
export const GeoPointSchema = z
  .object({ lat: LatSchema, lng: LngSchema })
  .openapi('GeoPoint', { description: 'A geographic point, latitude/longitude in WGS84.' });
export type GeoPointDto = z.infer<typeof GeoPointSchema>;

/**
 * Cursor-pagination query, `since` is the delta-sync cursor (the highest
 * `updated_at` the client has already seen). `limit` caps page size.
 */
export const PaginationQuerySchema = z
  .object({
    cursor: z.string().nullish().openapi({
      description:
        'Opaque cursor returned as `nextCursor` from the previous page. Omit for page 1.',
    }),
    since: IsoDateTimeSchema.nullish().openapi({
      description:
        'Delta-sync cursor, return only items changed at or after this timestamp. Drives incremental offline sync on mobile.',
    }),
    limit: z.coerce.number().int().min(1).max(200).default(50).openapi({
      description: 'Maximum number of items to return (1–200).',
      example: 50,
    }),
  })
  .openapi({ description: 'Shared cursor-pagination + delta-sync query parameters.' });
export type PaginationQueryDto = z.infer<typeof PaginationQuerySchema>;

/** Envelope for cursor-paginated list responses. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().openapi({
      description: 'Cursor for the next page, or null when this is the last page.',
    }),
  });
}

/**
 * Viewport bounding-box query for the map. The website + mobile map send the
 * visible viewport; the API returns spots whose geometry intersects the box.
 * `since` enables incremental refresh of a panned viewport.
 */
export const MapBboxQuerySchema = z
  .object({
    minLng: LngSchema.openapi({ description: 'West edge of the viewport.', example: 4.8 }),
    minLat: LatSchema.openapi({ description: 'South edge of the viewport.', example: 52.28 }),
    maxLng: LngSchema.openapi({ description: 'East edge of the viewport.', example: 4.9 }),
    maxLat: LatSchema.openapi({ description: 'North edge of the viewport.', example: 52.34 }),
    since: IsoDateTimeSchema.nullish().openapi({
      description: 'Return only spots changed at or after this timestamp (delta refresh).',
    }),
  })
  .openapi({
    description:
      'Viewport bounding-box query for map reads. Coordinates are WGS84 decimal degrees. Resolved server-side via a PostGIS `ST_Intersects` query against the GiST-indexed `geom` column.',
  });
export type MapBboxQueryDto = z.infer<typeof MapBboxQuerySchema>;

/**
 * Uniform error envelope for every API route. Error responses never cache.
 */
export const ApiErrorSchema = z
  .object({
    error: z.string().openapi({
      description: 'Machine-readable error code in UPPER_SNAKE_CASE.',
      example: 'VALIDATION_FAILED',
    }),
    message: z.string().openapi({
      description: 'Human-readable explanation. Safe to display to end users.',
      example: 'categoryId is not a valid UUID.',
    }),
    details: z.unknown().optional().openapi({
      description:
        'Optional structured detail payload. For validation errors this is the Zod `flatten()` output.',
    }),
  })
  .openapi('ApiError', {
    description: 'Uniform error envelope used by every API endpoint.',
    example: { error: 'VALIDATION_FAILED', message: 'categoryId is required' },
  });
export type ApiErrorDto = z.infer<typeof ApiErrorSchema>;
