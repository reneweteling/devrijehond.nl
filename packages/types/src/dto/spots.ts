import { z } from 'zod';
import {
  UuidSchema,
  SlugSchema,
  SpotTypeSchema,
  SpotStatusSchema,
  IsoDateTimeSchema,
  LatSchema,
  LngSchema,
  MapBboxQuerySchema,
  paginatedSchema,
} from './common';
import { CategorySchema } from './categories';
import { AmenitySchema } from './amenities';
import '../registry';

/**
 * Spot DTOs, the core content type. A spot is either a `REGION` (polygon) or
 * a `POI` (point). Geometry crosses the wire as GeoJSON so map clients can
 * render it directly; `lat`/`lng` mirror the centroid for cheap list rendering.
 */

/**
 * GeoJSON geometry, a `Point` (POI) or a `Polygon` (REGION). Coordinates are
 * `[lng, lat]` per the GeoJSON spec (note the order). Loosely typed so the OAS
 * stays renderable; the API validates the concrete shape at the boundary.
 */
export const SpotGeometrySchema = z
  .object({
    type: z.enum(['Point', 'Polygon']).openapi({ description: 'GeoJSON geometry type.' }),
    coordinates: z.unknown().openapi({
      description:
        'GeoJSON coordinates. Point → `[lng, lat]`. Polygon → `[[[lng, lat], …]]` (one or more linear rings, first/last point equal).',
    }),
  })
  .openapi('SpotGeometry', {
    description:
      'GeoJSON geometry (WGS84). Point for a POI, Polygon for a REGION. Coordinate order is [longitude, latitude].',
  });
export type SpotGeometryDto = z.infer<typeof SpotGeometrySchema>;

/** A spot photo as exposed to clients (REMOVED photos are filtered server-side). */
export const SpotPhotoSchema = z
  .object({
    id: UuidSchema,
    url: z.string().url(),
    sortOrder: z.number().int(),
    createdAt: IsoDateTimeSchema,
  })
  .openapi('SpotPhoto', { description: 'One photo attached to a spot.' });
export type SpotPhotoDto = z.infer<typeof SpotPhotoSchema>;

/** Aggregate review rating for a spot. */
export const SpotRatingSchema = z
  .object({
    average: z
      .number()
      .min(0)
      .max(5)
      .openapi({ description: 'Mean star rating (0–5).', example: 4.3 }),
    count: z
      .number()
      .int()
      .nonnegative()
      .openapi({ description: 'Number of reviews.', example: 27 }),
  })
  .openapi('SpotRating', { description: 'Denormalised review aggregate.' });
export type SpotRatingDto = z.infer<typeof SpotRatingSchema>;

/**
 * Community-verification status + score. `netScore` is `confirmScore − denyScore`
 * (weighted); the spot flips to VERIFIED at net ≥ +5 and auto-HIDDEN at ≥ 3
 * denials. Surfaced so the UI can render a "verified" badge + a confidence bar.
 */
export const SpotVerificationSchema = z
  .object({
    status: SpotStatusSchema,
    netScore: z.number().openapi({ description: 'Weighted confirm − deny score.', example: 6.5 }),
    confirmCount: z.number().int().nonnegative(),
    denyCount: z.number().int().nonnegative(),
    verifiedAt: IsoDateTimeSchema.nullable().openapi({
      description: 'When the spot reached VERIFIED, or null.',
    }),
  })
  .openapi('SpotVerification', {
    description: 'Community-verification status + denormalised vote score.',
  });
export type SpotVerificationDto = z.infer<typeof SpotVerificationSchema>;

/**
 * GET /api/v1/spots, list item (lightweight). Drives the map markers + list
 * rows. `lat`/`lng` are the centroid; full geometry is fetched on detail.
 */
export const SpotSummarySchema = z
  .object({
    id: UuidSchema,
    slug: SlugSchema,
    type: SpotTypeSchema,
    name: z.string(),
    categoryId: UuidSchema,
    status: SpotStatusSchema,
    lat: LatSchema.nullable(),
    lng: LngSchema.nullable(),
    rating: SpotRatingSchema,
    photoUrl: z.string().url().nullable().openapi({
      description: 'First photo URL for the list thumbnail, or null.',
    }),
    updatedAt: IsoDateTimeSchema,
  })
  .openapi('SpotSummary', { description: 'Lightweight spot summary for map markers + list rows.' });
export type SpotSummaryDto = z.infer<typeof SpotSummarySchema>;

/** GET /api/v1/spots, paginated list response. */
export const SpotsResponseSchema = paginatedSchema(SpotSummarySchema).openapi('SpotsResponse', {
  description: 'Cursor-paginated list of spots.',
});
export type SpotsResponseDto = z.infer<typeof SpotsResponseSchema>;

/** GET /api/v1/spots, query parameters. */
export const SpotsQuerySchema = z
  .object({
    type: SpotTypeSchema.optional(),
    categoryId: UuidSchema.optional(),
    cursor: z.string().nullish(),
    since: IsoDateTimeSchema.nullish().openapi({
      description: 'Delta-sync cursor, return only spots changed at/after this timestamp.',
    }),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .openapi({ description: 'Query parameters for `GET /api/v1/spots`.' });
export type SpotsQueryDto = z.infer<typeof SpotsQuerySchema>;

/**
 * GET /api/v1/spots/map, bbox map query (extends the shared bbox with an
 * optional category filter).
 */
export const SpotsMapQuerySchema = MapBboxQuerySchema.extend({
  type: SpotTypeSchema.optional(),
  categoryId: UuidSchema.optional(),
}).openapi({ description: 'Viewport query for `GET /api/v1/spots/map`.' });
export type SpotsMapQueryDto = z.infer<typeof SpotsMapQuerySchema>;

/** GET /api/v1/spots/map, response. Markers within the viewport. */
export const SpotsMapResponseSchema = z
  .object({ items: z.array(SpotSummarySchema) })
  .openapi('SpotsMapResponse', {
    description: 'Spots whose geometry intersects the requested viewport.',
  });
export type SpotsMapResponseDto = z.infer<typeof SpotsMapResponseSchema>;

/** Minimal author reference embedded in spot detail. */
export const SpotAuthorSchema = z
  .object({
    id: UuidSchema,
    handle: z.string().nullable(),
    name: z.string().nullable(),
    image: z.string().url().nullable(),
  })
  .openapi('SpotAuthor', { description: 'Public reference to the user who submitted the spot.' });
export type SpotAuthorDto = z.infer<typeof SpotAuthorSchema>;

/**
 * GET /api/v1/spots/:slug, full detail. Includes geometry, amenities, photos,
 * rating + verification, and POI extras (address/hours/phone/website).
 */
export const SpotDetailSchema = z
  .object({
    id: UuidSchema,
    slug: SlugSchema,
    type: SpotTypeSchema,
    name: z.string(),
    description: z.string().nullable(),
    category: CategorySchema,
    status: SpotStatusSchema,

    // Geometry: full GeoJSON for the map + centroid mirror.
    geometry: SpotGeometrySchema.nullable(),
    lat: LatSchema.nullable(),
    lng: LngSchema.nullable(),

    // POI extras (null for REGION spots).
    address: z.string().nullable(),
    hours: z.unknown().nullable().openapi({
      description: 'Opening-hours structure (loose JSON, validated at the API boundary).',
    }),
    phone: z.string().nullable(),
    website: z.string().url().nullable(),

    amenities: z.array(AmenitySchema),
    photos: z.array(SpotPhotoSchema),
    rating: SpotRatingSchema,
    verification: SpotVerificationSchema,

    submittedBy: SpotAuthorSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .openapi('SpotDetail', {
    description: 'Full spot detail. Server-rendered as the crawlable spot page.',
  });
export type SpotDetailDto = z.infer<typeof SpotDetailSchema>;

/** Path params for `GET /api/v1/spots/:slug`. */
export const SpotDetailParamsSchema = z
  .object({ slug: SlugSchema })
  .openapi({ description: 'Path parameters for `GET /api/v1/spots/:slug`.' });
export type SpotDetailParamsDto = z.infer<typeof SpotDetailParamsSchema>;
