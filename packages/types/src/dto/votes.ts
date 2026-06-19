import { z } from 'zod';
import { UuidSchema, VoteValueSchema, IsoDateTimeSchema, GeoPointSchema } from './common';
import '../registry';

/**
 * Community-verification votes — `POST /api/v1/me/spots/:id/vote`.
 *
 * One vote per user per spot (DB-enforced). The submitter cannot vote on their
 * own spot. A `proof` location lets the API run the proximity gate (the voter
 * must be near the spot); the resulting `proximityVerified` flag weights the
 * vote.
 */
export const SubmitVoteRequestSchema = z
  .object({
    value: VoteValueSchema,
    proof: GeoPointSchema.optional().openapi({
      description:
        "Voter's current location, used for the proximity gate. When present and within range the vote is marked `proximityVerified` and weighted more heavily.",
    }),
  })
  .openapi({ description: 'Body for `POST /api/v1/me/spots/:id/vote`.' });
export type SubmitVoteRequestDto = z.infer<typeof SubmitVoteRequestSchema>;

/** Path params for the vote endpoint. */
export const VoteParamsSchema = z
  .object({ id: UuidSchema })
  .openapi({ description: 'Path parameters for `POST /api/v1/me/spots/:id/vote`.' });
export type VoteParamsDto = z.infer<typeof VoteParamsSchema>;

/** The user's own vote on a spot. */
export const VoteSchema = z
  .object({
    id: UuidSchema,
    spotId: UuidSchema,
    value: VoteValueSchema,
    proximityVerified: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .openapi({ description: "The signed-in user's vote on a spot." });
export type VoteDto = z.infer<typeof VoteSchema>;

/** Response to a cast vote — echoes the vote + the recomputed spot tally. */
export const VoteResponseSchema = z
  .object({
    vote: VoteSchema,
    netScore: z.number().openapi({ description: 'Spot net weighted score after this vote.' }),
    confirmCount: z.number().int().nonnegative(),
    denyCount: z.number().int().nonnegative(),
    status: z.string().openapi({
      description: 'Spot status after recompute (may flip to VERIFIED / HIDDEN).',
      example: 'VERIFIED',
    }),
  })
  .openapi({ description: 'Result of casting a verification vote.' });
export type VoteResponseDto = z.infer<typeof VoteResponseSchema>;
