import { z } from 'zod';
import { UuidSchema } from './common';
import '../registry';

/**
 * Amenities — reusable facility tags (water bowl, off-leash, waste bags, …).
 * Which amenities are offered per category drives the category-scoped form;
 * `categoryIds` carries that mapping (from `AmenityOnCategory`).
 */
export const AmenitySchema = z
  .object({
    id: UuidSchema,
    slug: z.string(),
    label: z.string(),
    icon: z.string().nullable().openapi({ description: 'Icon name (Tabler / SF Symbol / Material).' }),
    sortOrder: z.number().int(),
    categoryIds: z.array(UuidSchema).openapi({
      description:
        'Categories this amenity applies to (from `AmenityOnCategory`). Empty = applicable everywhere.',
    }),
  })
  .openapi({ description: 'A spot amenity / facility tag.' });
export type AmenityDto = z.infer<typeof AmenitySchema>;

/** GET /api/v1/amenities */
export const AmenitiesResponseSchema = z
  .object({ items: z.array(AmenitySchema) })
  .openapi({ description: 'All visible, active amenities with their category mapping.' });
export type AmenitiesResponseDto = z.infer<typeof AmenitiesResponseSchema>;

/** GET /api/v1/amenities — query parameters. */
export const AmenitiesQuerySchema = z
  .object({
    categoryId: UuidSchema.optional().openapi({
      description: 'Restrict to amenities offered by this category.',
    }),
  })
  .openapi({ description: 'Query parameters for `GET /api/v1/amenities`.' });
export type AmenitiesQueryDto = z.infer<typeof AmenitiesQuerySchema>;
