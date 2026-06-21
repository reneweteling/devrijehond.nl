import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireAuth } from '@devrijehond/server';
import { uploadObject } from '@devrijehond/s3';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * POST /api/v1/me/uploads — upload an image. Auth required.
 *
 * The bytes are sent to us (multipart `file`), resized + JPEG-compressed
 * server-side with sharp, then stored on S3. We return the public (CloudFront)
 * URL to persist (e.g. as a spot photo). Processing server-side means clients
 * can't store huge originals and every stored image is a sane, uniform JPEG.
 */
export const runtime = 'nodejs';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB raw input cap
const MAX_DIM = 1600; // longest edge after resize
const JPEG_QUALITY = 80;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return error('INVALID_BODY', 'Verwacht multipart/form-data met een "file".', { status: 400 });
  }
  if (!file) return error('NO_FILE', 'Geen bestand ontvangen.', { status: 400 });
  if (file.type && !ACCEPTED.has(file.type)) {
    return error('UNSUPPORTED_TYPE', 'Alleen JPEG, PNG, WebP of HEIC is toegestaan.', {
      status: 400,
    });
  }
  if (file.size > MAX_BYTES) {
    return error('TOO_LARGE', 'De afbeelding is te groot (max 25 MB).', { status: 400 });
  }

  let jpeg: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    jpeg = await sharp(input)
      .rotate() // honour EXIF orientation before stripping metadata
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    return error('BAD_IMAGE', 'De afbeelding kon niet worden verwerkt.', { status: 400 });
  }

  const key = `spots/${ctx.user.id}/${randomUUID()}.jpg`;
  const { publicUrl } = await uploadObject(key, jpeg, 'image/jpeg');

  return ok({ publicUrl, key }, { cacheControl: NO_STORE_CACHE_CONTROL });
}
