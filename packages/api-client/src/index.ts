/**
 * `@devrijehond/api-client` — Orval-generated TypeScript client + TanStack
 * Query hooks for the De Vrije Hond API. Consumed exclusively by `apps/mobile`.
 *
 * Regenerate with: `pnpm --filter @devrijehond/api-client generate`.
 * See `../README.md` for the full workflow (dev server vs snapshot).
 *
 * Orval is configured in `tags-split` mode, so each OpenAPI tag gets its own
 * file under `./generated/<tag>/<tag>.ts`. We re-export the lot so mobile can
 * `import { useGetApiV1Spots } from "@devrijehond/api-client"` without having
 * to know which tag a hook lives under.
 *
 * Before `pnpm generate` has run, the `./generated/**` files do not exist;
 * importers will get a TypeScript "Cannot find module" error. That's
 * intentional — CI fails closed if the client hasn't been regenerated. The
 * `@ts-ignore` lines below keep this barrel itself type-checkable in the
 * pre-generation state.
 */

export {
  customFetcher,
  setAuthToken,
  setUnauthorizedHandler,
  FetcherError,
} from './custom-fetcher';

// Shared schema types (components.schemas) — enums as runtime constants plus
// the TypeScript request / response shapes.
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/client.schemas';

// Per-tag hook + fetcher surfaces.
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/categories/categories';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/amenities/amenities';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/spots/spots';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/reviews/reviews';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/votes/votes';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/reports/reports';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/dogs/dogs';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/me/me';
// @ts-ignore -- generated file; does not exist until `pnpm generate` runs.
export * from './generated/feature-requests/feature-requests';
