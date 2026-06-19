import { z } from 'zod';
import { UuidSchema, SpotTypeSchema } from './common';
import '../registry';

/**
 * Categories — the data-driven taxonomy that drives pin colours/icons and the
 * category-scoped submit form. Only `ACTIVE` + `visible` categories are
 * returned to anonymous clients.
 */
export const CategorySchema = z
  .object({
    id: UuidSchema,
    slug: z.string(),
    label: z.string(),
    type: SpotTypeSchema,
    icon: z.string().nullable().openapi({
      description: 'Icon name (Tabler on web, mapped to SF Symbol / Material on mobile).',
    }),
    color: z.string().nullable().openapi({ description: 'Pin colour (hex).', example: '#3F6B4C' }),
    sortOrder: z.number().int(),
  })
  .openapi('Category', { description: 'A spot category.' });
export type CategoryDto = z.infer<typeof CategorySchema>;

/** GET /api/v1/categories */
export const CategoriesResponseSchema = z
  .object({ items: z.array(CategorySchema) })
  .openapi('CategoriesResponse', { description: 'All visible, active categories.' });
export type CategoriesResponseDto = z.infer<typeof CategoriesResponseSchema>;

/** GET /api/v1/categories — query parameters. */
export const CategoriesQuerySchema = z
  .object({
    type: SpotTypeSchema.optional().openapi({
      description: 'Restrict to REGION or POI categories. Omit for all.',
    }),
  })
  .openapi({ description: 'Query parameters for `GET /api/v1/categories`.' });
export type CategoriesQueryDto = z.infer<typeof CategoriesQuerySchema>;
