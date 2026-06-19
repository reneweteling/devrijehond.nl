import { z } from 'zod';
import { UuidSchema, SpotTypeSchema, GeoPointSchema } from './common';
import { SpotDetailSchema } from './spots';
import '../registry';

/**
 * POST /api/v1/me/spots, community spot submission.
 *
 * Geometry can be supplied two ways:
 *   - `geometry`: a GeoJSON Point (POI) or Polygon (REGION), OR
 *   - `point` (lat/lng) for a POI / `polygon` (array of lat/lng points) for a
 *     REGION, the friendlier shape the mobile map editor emits.
 * The API normalises either form into the PostGIS `geom` column + centroid.
 */

/** GeoJSON geometry the client may post directly. */
export const SubmitGeometrySchema = z
  .object({
    type: z.enum(['Point', 'Polygon']),
    coordinates: z.unknown().openapi({
      description: 'GeoJSON coordinates. Point → `[lng, lat]`; Polygon → `[[[lng, lat], …]]`.',
    }),
  })
  .openapi({ description: 'Raw GeoJSON geometry (WGS84, [lng, lat] order).' });

export const SubmitSpotRequestSchema = z
  .object({
    type: SpotTypeSchema,
    categoryId: UuidSchema.openapi({ description: 'Category the spot belongs to.' }),
    name: z.string().min(2).max(120),
    description: z.string().max(4000).optional(),

    // --- Geometry: GeoJSON OR the friendlier lat/lng forms ---
    geometry: SubmitGeometrySchema.optional().openapi({
      description: 'GeoJSON geometry. Provide this OR `point`/`polygon`.',
    }),
    point: GeoPointSchema.optional().openapi({
      description: 'Single lat/lng for a POI. Alternative to `geometry`.',
    }),
    polygon: z.array(GeoPointSchema).min(3).optional().openapi({
      description:
        'Polygon ring (≥ 3 lat/lng points) for a REGION. Alternative to `geometry`. The API closes the ring.',
    }),

    amenityIds: z
      .array(UuidSchema)
      .default([])
      .openapi({ description: 'Amenities offered at this spot.' }),
    photos: z.array(z.string().url()).max(10).default([]).openapi({
      description:
        'Uploaded photo URLs (the client uploads to S3 first, then submits the resulting URLs).',
    }),

    // POI extras (ignored for REGION).
    address: z.string().max(240).optional(),
    phone: z.string().max(40).optional(),
    website: z.string().url().optional(),
    hours: z.unknown().optional().openapi({
      description: 'Opening-hours structure (loose JSON, validated at the boundary).',
    }),
  })
  .refine((v) => v.geometry || v.point || (v.polygon && v.polygon.length >= 3), {
    message: 'A spot requires geometry: provide `geometry`, `point`, or `polygon`.',
  })
  .openapi('SubmitSpotRequest', {
    description:
      'Body for `POST /api/v1/me/spots`. A submitted spot goes live immediately as UNVERIFIED.',
  });
export type SubmitSpotRequestDto = z.infer<typeof SubmitSpotRequestSchema>;

/** Response: the freshly-created spot detail. */
export const SubmitSpotResponseSchema = SpotDetailSchema.openapi('SubmitSpotResponse', {
  description: 'The created spot (status UNVERIFIED).',
});
export type SubmitSpotResponseDto = z.infer<typeof SubmitSpotResponseSchema>;

/**
 * PATCH /api/v1/me/spots/:id, owner edit while still UNVERIFIED. All fields
 * optional; geometry edits reuse the submit shape.
 */
export const UpdateSpotRequestSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(4000).nullish(),
    categoryId: UuidSchema.optional(),
    amenityIds: z.array(UuidSchema).optional(),
    geometry: SubmitGeometrySchema.optional(),
    point: GeoPointSchema.optional(),
    polygon: z.array(GeoPointSchema).min(3).optional(),
    address: z.string().max(240).nullish(),
    phone: z.string().max(40).nullish(),
    website: z.string().url().nullish(),
    hours: z.unknown().optional(),
  })
  .openapi('UpdateSpotRequest', {
    description: 'Body for `PATCH /api/v1/me/spots/:id` (owner edit while UNVERIFIED).',
  });
export type UpdateSpotRequestDto = z.infer<typeof UpdateSpotRequestSchema>;
