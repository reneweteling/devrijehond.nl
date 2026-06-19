import { z } from 'zod';
import { UuidSchema, UserRoleSchema, IsoDateTimeSchema } from './common';
import { DogSchema } from './dogs';
import '../registry';

/**
 * `/me` — the authenticated user's own profile.
 *
 * NOTE: the API serialises every DateTime as an ISO-8601 string at the
 * boundary, so the wire shape uses `string` for timestamps.
 */
export const MeProfileSchema = z
  .object({
    id: UuidSchema,
    email: z.string().email(),
    name: z.string().nullable(),
    handle: z.string().nullable().openapi({ description: '@username.', example: 'maxdehond' }),
    bio: z.string().nullable(),
    image: z.string().url().nullable().openapi({ description: 'Avatar URL.' }),
    role: UserRoleSchema,
    reputation: z.number().int().openapi({ description: 'Contribution reputation score.' }),
    dogs: z.array(DogSchema),
    createdAt: IsoDateTimeSchema,
  })
  .openapi({ description: 'Authenticated user profile (`GET /api/v1/me`).' });
export type MeProfileDto = z.infer<typeof MeProfileSchema>;

/** PATCH /api/v1/me — profile patch. */
export const MeProfilePatchSchema = z
  .object({
    name: z.string().min(1).max(80).nullish(),
    handle: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/, 'Handle may contain lowercase letters, digits and underscores only.')
      .nullish()
      .openapi({ description: 'Unique @username (lowercase, 3–30 chars).' }),
    bio: z.string().max(280).nullish(),
    image: z.string().url().nullish().openapi({ description: 'Avatar URL (uploaded to S3 first).' }),
  })
  .openapi({ description: 'Body for `PATCH /api/v1/me`.' });
export type MeProfilePatchDto = z.infer<typeof MeProfilePatchSchema>;
