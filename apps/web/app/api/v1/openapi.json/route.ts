import { NextResponse } from 'next/server';
import { buildOpenApiDocument } from '@devrijehond/types';

/**
 * Compiled OpenAPI 3.1 document for the v1 API.
 *
 * The path registry in `@devrijehond/types` is populated by side-effect: its
 * `index.ts` imports `./paths` (which calls `registry.registerPath(...)` for
 * every route). Importing `buildOpenApiDocument` therefore guarantees the
 * registry is fully populated, no per-route preload file is needed here (the
 * contract is centralised in the types package, unlike dekmantel where each
 * handler self-registers).
 *
 * Public, unauthenticated, CDN-cacheable. Consumed by Orval during
 * `@devrijehond/api-client` generation and by the docs UI.
 */

export const runtime = 'nodejs';

const DEFAULT_APP_URL = 'https://devrijehond.local';

export function GET(): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
  const document = buildOpenApiDocument('v1');

  const doc = {
    ...document,
    servers: [{ url: appUrl, description: 'current' }],
  };

  return NextResponse.json(doc, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
