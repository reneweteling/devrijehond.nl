import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Shared OpenAPI registry — the API contract for De Vrije Hond.
 *
 * Every DTO schema in `./dto/**` attaches metadata via `.openapi({...})`.
 * Shared schemas + every path are registered here (see `./paths.ts`), and the
 * compiled document is served at `GET /api/v1/openapi.json` then consumed by
 * Orval to generate `@devrijehond/api-client`.
 *
 * `extendZodWithOpenApi(z)` monkey-patches the zod instance with a `.openapi(...)`
 * method; calling it here — at the module that owns the registry — is the
 * canonical pattern so every downstream `import { z } from "zod"` sees the
 * extension without caring about import order.
 */

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// -----------------------------------------------------------------------------
// Security schemes
// -----------------------------------------------------------------------------
// Session cookies are the canonical auth for the website; the mobile app sends
// `Authorization: Bearer <token>` (BetterAuth bearer plugin). We expose
// `bearerAuth` so (a) the Orval-generated mobile client attaches the bearer,
// and (b) the docs UI renders a "try it out" auth input.
// -----------------------------------------------------------------------------
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'BetterAuth session token',
  description:
    'BetterAuth-issued session token. Session cookies are the canonical auth for the website; the bearer scheme is used by the Expo mobile client and documented here for SDK compatibility.',
});

export type OpenApiVersion = 'v1' | 'v2';

/**
 * Returns a compiled OpenAPI 3.1 document for the requested API version.
 *
 * The route handler at `/api/v1/openapi.json` wraps this in an HTTP response
 * with the right Cache-Control headers. `version` is advisory until we fork
 * `/api/v2`; today both values compile the same registry.
 */
export function buildOpenApiDocument(
  version: OpenApiVersion,
): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'De Vrije Hond API',
      version,
      description:
        'Typed contract between the De Vrije Hond website/API (apps/web) and the Expo mobile app. Generated from Zod schemas in @devrijehond/types. The community-driven map of dog-friendly spots — public reads are anonymous + CDN-cacheable; user-scoped writes live under `/me/*`.',
    },
    servers: [
      { url: 'https://devrijehond.nl', description: 'production' },
      { url: 'https://acc.devrijehond.nl', description: 'accept' },
      { url: 'https://devrijehond.local', description: 'local' },
    ],
  });
}
