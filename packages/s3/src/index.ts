/**
 * @devrijehond/s3 — S3 upload helpers.
 *
 * Exports:
 *   - `createUploadUrl` — presigned PUT URL for direct browser/app uploads.
 *   - `publicUrl`       — resolve a stored object key to its public URL.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3, bucketName, publicBaseUrl } from './client';

export { getS3, bucketName, publicBaseUrl, S3_REGION } from './client';

export interface CreateUploadUrlOptions {
  /** The object key to upload to, e.g. `avatars/<userId>/<uuid>.jpg`. */
  key: string;
  /** The Content-Type the client will PUT with (must match on upload). */
  contentType: string;
  /** Presigned URL lifetime in seconds (default 5 minutes). */
  expiresIn?: number;
}

export interface CreateUploadUrlResult {
  /** The presigned PUT URL the client uploads to. */
  uploadUrl: string;
  /** The object key (echoed for convenience). */
  key: string;
  /** The public URL the object will be readable at once uploaded. */
  publicUrl: string;
}

/**
 * Generate a presigned PUT URL so a browser / mobile client can upload a file
 * directly to S3 without proxying the bytes through our API. The caller decides
 * the `key` (namespacing by user/spot is its responsibility) and pins the
 * `contentType` so the client can't upload arbitrary media types.
 */
export async function createUploadUrl({
  key,
  contentType,
  expiresIn = 5 * 60,
}: CreateUploadUrlOptions): Promise<CreateUploadUrlResult> {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn });
  return { uploadUrl, key, publicUrl: publicUrl(key) };
}

/** Resolve a stored object key to its public (CDN or S3) URL. */
export function publicUrl(key: string): string {
  const normalised = key.replace(/^\/+/, '');
  return `${publicBaseUrl()}/${normalised}`;
}
