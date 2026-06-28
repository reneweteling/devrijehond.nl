import { z } from 'zod';
import '../registry';

/**
 * Image upload, `POST /api/v1/me/uploads`. Auth required.
 *
 * The request is `multipart/form-data` with a single `file` field (JPEG / PNG /
 * WebP / HEIC). The bytes are resized + JPEG-compressed server-side and stored
 * on S3; the response carries the public (CloudFront) URL to persist (e.g. as a
 * spot photo or avatar) plus the storage key.
 */
export const UploadResponseSchema = z
  .object({
    publicUrl: z.string().url().openapi({
      description: 'Public CloudFront URL of the stored image.',
      example: 'https://media.devrijehond.nl/spots/3fa85f64/abcd.jpg',
    }),
    key: z.string().openapi({
      description: 'S3 object key of the stored image.',
      example: 'spots/3fa85f64-5717-4562-b3fc-2c963f66afa6/abcd.jpg',
    }),
  })
  .openapi('UploadResponse', { description: 'Result of an image upload.' });
export type UploadResponseDto = z.infer<typeof UploadResponseSchema>;
