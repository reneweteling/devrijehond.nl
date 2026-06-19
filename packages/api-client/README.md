# `@devrijehond/api-client`

Orval-generated TypeScript client + TanStack Query hooks for the De Vrije Hond
API. Consumed exclusively by `apps/mobile`. Web code must **not** import from
this package, it uses `@devrijehond/types` + server actions / route handlers
and `authDb` directly.

## What's in here

- `orval.config.ts`, Orval input/output configuration (tags-split,
  react-query, useQuery + useSuspenseQuery + signal).
- `input.ts`, input resolver: committed `openapi.snapshot.json` by default,
  the running web dev server when `OPENAPI_SOURCE=dev`.
- `src/custom-fetcher.ts`, fetch wrapper injected into every generated hook
  (adds `X-Client-Version` + `X-API-Version`, session cookie / bearer token via
  `setAuthToken`, 5xx retry, 401 → `onUnauthorized`, no-cache for `/me/*`).
- `src/index.ts`, re-exports the generated client + `setAuthToken` +
  `setUnauthorizedHandler` + `FetcherError`.
- `src/generated/`, Orval's output. Do not hand-edit.
- `openapi.snapshot.json`, committed snapshot seed (see below). **Not yet
  generated**, produce it once the web API serves `/api/v1/openapi.json`.

## Generating the client

```bash
# Default: from the committed snapshot (hermetic, CI-friendly).
pnpm --filter @devrijehond/api-client generate

# From the running web dev server:
OPENAPI_SOURCE=dev pnpm --filter @devrijehond/api-client generate
```

## Refreshing the snapshot

Run whenever you land a new route or change a DTO. It pulls the current OAS from
the dev server and regenerates the client in one step.

```bash
# In one terminal:
pnpm --filter web dev

# In another:
pnpm --filter @devrijehond/api-client snapshot
```

Commit the resulting `openapi.snapshot.json` and the regenerated
`src/generated/` together.

## How mobile consumes it

```ts
import { setAuthToken } from '@devrijehond/api-client';
// Base URL: set globalThis.__DEVRIJEHOND_API_URL__ from EXPO_PUBLIC_API_URL in
// app/_layout.tsx before the first fetch, then use the generated hooks.
```

> **TODO:** generate the first `openapi.snapshot.json` once `apps/web` serves
> `GET /api/v1/openapi.json`, then run `pnpm generate` to emit `src/generated/`.
