import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema } from './common';
import '../registry';

/**
 * Dogs — the user's dog profiles. Public-readable, owner/admin-writable.
 * Full CRUD under `/me/dogs`.
 */
export const DogSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    breed: z.string().nullable(),
    birthYear: z.number().int().nullable(),
    photoUrl: z.string().url().nullable(),
    note: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .openapi('Dog', { description: 'A dog profile.' });
export type DogDto = z.infer<typeof DogSchema>;

/** GET /api/v1/me/dogs */
export const DogsResponseSchema = z
  .object({ items: z.array(DogSchema) })
  .openapi('DogsResponse', { description: "The signed-in user's dogs." });
export type DogsResponseDto = z.infer<typeof DogsResponseSchema>;

/** POST /api/v1/me/dogs — create. */
export const CreateDogRequestSchema = z
  .object({
    name: z.string().min(1).max(60),
    breed: z.string().max(80).optional(),
    birthYear: z
      .number()
      .int()
      .min(1990)
      .max(new Date().getFullYear())
      .optional()
      .openapi({ description: 'Year of birth.', example: 2021 }),
    photoUrl: z.string().url().optional(),
    note: z.string().max(500).optional(),
  })
  .openapi('CreateDogRequest', { description: 'Body for `POST /api/v1/me/dogs`.' });
export type CreateDogRequestDto = z.infer<typeof CreateDogRequestSchema>;

/** PATCH /api/v1/me/dogs/:id — update. All fields optional. */
export const UpdateDogRequestSchema = CreateDogRequestSchema.partial().openapi('UpdateDogRequest', {
  description: 'Body for `PATCH /api/v1/me/dogs/:id`.',
});
export type UpdateDogRequestDto = z.infer<typeof UpdateDogRequestSchema>;

/** Path params for the per-dog endpoints. */
export const DogParamsSchema = z
  .object({ id: UuidSchema })
  .openapi({ description: 'Path parameters for `/api/v1/me/dogs/:id`.' });
export type DogParamsDto = z.infer<typeof DogParamsSchema>;
