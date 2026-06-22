/**
 * TanStack Query client + the bridge that wires the SecureStore bearer into the
 * generated `@devrijehond/api-client` fetcher.
 *
 * `bootApiClient()` runs once at app start: it mirrors `API_URL` into the global
 * the api-client reads (`__DEVRIJEHOND_API_URL__`) and loads the persisted
 * session, calling `setAuthToken` so every generated hook carries the bearer.
 */

import { QueryClient } from '@tanstack/react-query';
import { setAuthToken } from '@devrijehond/api-client';

import { API_URL } from './config';
import { loadSession, verifySession } from './session';

// Mirror the base URL into the global the api-client resolves from. Doing this
// at module load guarantees any hook resolving a URL before first render sees
// the right value.
(globalThis as typeof globalThis & { __DEVRIJEHOND_API_URL__?: string }).__DEVRIJEHOND_API_URL__ =
  API_URL;
// eslint-disable-next-line no-console
console.warn(`[dvh-net] API_URL = ${API_URL}`);

// Clear any stale token from a previous Fast Refresh cycle. The real token is
// loaded in `bootApiClient` below.
setAuthToken(null);

let queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Mobile + poor connectivity: be patient and lean on cache.
          staleTime: 30_000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return queryClient;
}

export type BootResult = { authenticated: boolean };

/**
 * Load the persisted session, refresh it if it's near expiry, and register the
 * bearer with the api-client. Returns whether a valid session was found so the
 * root layout can route to the auth stack when not.
 */
export async function bootApiClient(): Promise<BootResult> {
  try {
    const loaded = await loadSession();
    if (!loaded) {
      setAuthToken(null);
      return { authenticated: false };
    }
    setAuthToken(loaded.token);
    // Always verify the token against the server: a locally-unexpired token can
    // be dead server-side (e.g. after a DB reseed), and we must sign out cleanly
    // instead of letting every authed request 401 in a loop.
    const verified = await verifySession(loaded);
    if (!verified) {
      setAuthToken(null);
      return { authenticated: false };
    }
    setAuthToken(verified.token);
    return { authenticated: true };
  } catch {
    // Best-effort boot, a corrupt SecureStore entry must not wedge the splash.
    setAuthToken(null);
    return { authenticated: false };
  }
}
