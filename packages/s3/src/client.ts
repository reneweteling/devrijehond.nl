/**
 * S3 client + configuration for De Vrije Hond uploads (eu-west-1).
 *
 * Holds the user-uploaded media: avatars, dog photos, spot photos. The client
 * is constructed lazily so importing this package at build time doesn't require
 * credentials. On ECS the SDK picks up the task-role credentials automatically;
 * locally it falls back to the standard AWS credential chain
 * (env vars / shared profile).
 */

import { S3Client } from '@aws-sdk/client-s3';

export const S3_REGION = process.env.AWS_REGION ?? 'eu-west-1';

/** The bucket holding public user media. */
export function bucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('[s3] S3_BUCKET is not set');
  }
  return bucket;
}

/**
 * The public base URL media is served from — a CloudFront/CDN domain in front
 * of the bucket, or the raw S3 website endpoint. No trailing slash.
 */
export function publicBaseUrl(): string {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return base.replace(/\/$/, '');
  // Fall back to the virtual-hosted S3 URL if no CDN domain is configured.
  return `https://${bucketName()}.s3.${S3_REGION}.amazonaws.com`;
}

let cached: S3Client | undefined;

/** Lazily-constructed singleton S3 client. */
export function getS3(): S3Client {
  if (!cached) {
    cached = new S3Client({ region: S3_REGION });
  }
  return cached;
}
