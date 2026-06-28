import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema } from './common';
import '../registry';

/**
 * Moderator applications, `/api/v1/me/moderator-application`. One per user.
 *
 * A user submits a motivation to apply for the MODERATOR role; an admin later
 * decides. The GET returns the user's own application (or null); the POST files
 * one (409 if it already exists).
 */
export const ModeratorApplicationStatusSchema = z
  .enum(['PENDING', 'APPROVED', 'REJECTED'])
  .openapi('ModeratorApplicationStatus', {
    description: 'Decision state of a moderator application.',
    example: 'PENDING',
  });
export type ModeratorApplicationStatusDto = z.infer<typeof ModeratorApplicationStatusSchema>;

export const ModeratorApplicationSchema = z
  .object({
    id: UuidSchema,
    status: ModeratorApplicationStatusSchema,
    motivation: z.string().openapi({ description: 'Why the user wants to moderate.' }),
    createdAt: IsoDateTimeSchema,
  })
  .openapi('ModeratorApplication', { description: "The signed-in user's moderator application." });
export type ModeratorApplicationDto = z.infer<typeof ModeratorApplicationSchema>;

/** GET /api/v1/me/moderator-application, response (application may be null). */
export const ModeratorApplicationResponseSchema = z
  .object({
    application: ModeratorApplicationSchema.nullable().openapi({
      description: 'The existing application, or null if the user has not applied.',
    }),
  })
  .openapi('ModeratorApplicationResponse', {
    description: "The signed-in user's moderator application, or null.",
  });
export type ModeratorApplicationResponseDto = z.infer<typeof ModeratorApplicationResponseSchema>;

/** POST /api/v1/me/moderator-application, body. */
export const ApplyModeratorRequestSchema = z
  .object({
    motivation: z
      .string()
      .min(10)
      .openapi({ description: 'Motivation (min 10 chars).', example: 'Ik wil graag helpen...' }),
  })
  .openapi('ApplyModeratorRequest', {
    description: 'Body for `POST /api/v1/me/moderator-application`.',
  });
export type ApplyModeratorRequestDto = z.infer<typeof ApplyModeratorRequestSchema>;
