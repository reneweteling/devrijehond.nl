import { z } from 'zod';
import { UuidSchema, FeatureStatusSchema, IsoDateTimeSchema, paginatedSchema } from './common';
import '../registry';

/**
 * Feature requests, community product input. Public-readable list, create +
 * upvote under `/me`. `viewerHasVoted` reflects the signed-in user's vote when
 * the read carries a session (anonymous reads omit it / return false).
 */
export const FeatureRequestSchema = z
  .object({
    id: UuidSchema,
    title: z.string(),
    body: z.string().nullable(),
    component: z
      .string()
      .nullable()
      .openapi({ description: 'Area of the app this concerns.', example: 'Kaart' }),
    status: FeatureStatusSchema,
    upvoteCount: z.number().int().nonnegative(),
    viewerHasVoted: z.boolean().openapi({
      description: 'Whether the signed-in user has upvoted. False for anonymous reads.',
    }),
    createdAt: IsoDateTimeSchema,
  })
  .openapi('FeatureRequest', { description: 'A community feature request.' });
export type FeatureRequestDto = z.infer<typeof FeatureRequestSchema>;

/** GET /api/v1/feature-requests, paginated list. */
export const FeatureRequestsResponseSchema = paginatedSchema(FeatureRequestSchema).openapi(
  'FeatureRequestsResponse',
  {
    description: 'Cursor-paginated feature requests.',
  },
);
export type FeatureRequestsResponseDto = z.infer<typeof FeatureRequestsResponseSchema>;

/** GET /api/v1/feature-requests, query parameters. */
export const FeatureRequestsQuerySchema = z
  .object({
    status: FeatureStatusSchema.optional(),
    cursor: z.string().nullish(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .openapi({ description: 'Query parameters for `GET /api/v1/feature-requests`.' });
export type FeatureRequestsQueryDto = z.infer<typeof FeatureRequestsQuerySchema>;

/** POST /api/v1/me/feature-requests, create. */
export const CreateFeatureRequestRequestSchema = z
  .object({
    title: z.string().min(4).max(140),
    body: z.string().max(4000).optional(),
    component: z.string().max(40).optional().openapi({
      description: 'Area of the app: Kaart / Inzenden / Profiel / Anders.',
    }),
  })
  .openapi('CreateFeatureRequest', { description: 'Body for `POST /api/v1/me/feature-requests`.' });
export type CreateFeatureRequestRequestDto = z.infer<typeof CreateFeatureRequestRequestSchema>;

/** Path params for the per-request endpoints (vote). */
export const FeatureRequestParamsSchema = z
  .object({ id: UuidSchema })
  .openapi({ description: 'Path parameters for `/api/v1/me/feature-requests/:id/vote`.' });
export type FeatureRequestParamsDto = z.infer<typeof FeatureRequestParamsSchema>;

/** Response after toggling an upvote. */
export const FeatureVoteResponseSchema = z
  .object({
    requestId: UuidSchema,
    upvoteCount: z.number().int().nonnegative(),
    viewerHasVoted: z.boolean(),
  })
  .openapi('FeatureVoteResponse', {
    description: 'Result of toggling an upvote on a feature request.',
  });
export type FeatureVoteResponseDto = z.infer<typeof FeatureVoteResponseSchema>;
