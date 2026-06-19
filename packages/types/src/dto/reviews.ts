import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema, paginatedSchema } from './common';
import '../registry';

/**
 * Reviews — 0–5 star ratings + optional body, separate from verification votes.
 */

export const StarsSchema = z
  .number()
  .int()
  .min(0)
  .max(5)
  .openapi({ description: 'Star rating, 0–5.', example: 4 });

/** A review as exposed to clients (REMOVED reviews are filtered server-side). */
export const ReviewSchema = z
  .object({
    id: UuidSchema,
    spotId: UuidSchema,
    stars: StarsSchema,
    body: z.string().nullable(),
    helpfulCount: z.number().int().nonnegative(),
    author: z
      .object({
        id: UuidSchema,
        handle: z.string().nullable(),
        name: z.string().nullable(),
        image: z.string().url().nullable(),
      })
      .openapi({ description: 'Public reference to the review author.' }),
    createdAt: IsoDateTimeSchema,
  })
  .openapi({ description: 'A spot review.' });
export type ReviewDto = z.infer<typeof ReviewSchema>;

/** GET /api/v1/spots/:slug/reviews — paginated list. */
export const ReviewsResponseSchema = paginatedSchema(ReviewSchema).openapi({
  description: 'Cursor-paginated reviews for a spot.',
});
export type ReviewsResponseDto = z.infer<typeof ReviewsResponseSchema>;

/** POST /api/v1/me/spots/:id/reviews — create. */
export const SubmitReviewRequestSchema = z
  .object({
    stars: StarsSchema,
    body: z.string().max(4000).optional(),
  })
  .openapi({ description: 'Body for `POST /api/v1/me/spots/:id/reviews`.' });
export type SubmitReviewRequestDto = z.infer<typeof SubmitReviewRequestSchema>;

/** Path params for the per-spot review endpoints. */
export const SpotReviewParamsSchema = z
  .object({ id: UuidSchema })
  .openapi({ description: 'Path parameters for the spot review endpoints.' });
export type SpotReviewParamsDto = z.infer<typeof SpotReviewParamsSchema>;
