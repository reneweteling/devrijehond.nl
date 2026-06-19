import { defineConfig } from 'orval';
import { resolveInput } from './input';

/**
 * Orval config, generates a TanStack Query client into `src/generated/`.
 *
 * Scope:
 *   - Input: running web dev server OR committed snapshot (see input.ts).
 *   - Output: `src/generated/client.ts`, split by OpenAPI tag.
 *   - Client: `react-query` with useQuery + useSuspenseQuery + AbortSignal.
 *   - Mutator: `src/custom-fetcher.ts#customFetcher`, adds auth, headers,
 *     retry, and 401 handling.
 *
 * See `./README.md` for how mobile consumes the output and how the snapshot
 * flow works in CI.
 */

export default defineConfig({
  devrijehond: {
    input: {
      target: resolveInput(),
    },
    output: {
      target: './src/generated/client.ts',
      mode: 'tags-split',
      client: 'react-query',
      prettier: true,
      clean: true,
      override: {
        mutator: {
          path: './src/custom-fetcher.ts',
          name: 'customFetcher',
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
          signal: true,
        },
      },
    },
  },
});
