/**
 * Custom fetcher for the Orval-generated client.
 *
 * Responsibilities:
 *   - Resolve the base URL (`globalThis.__DEVRIJEHOND_API_URL__` for React
 *     Native, then `EXPO_PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL` for env).
 *   - Attach `X-Client-Version` and `X-API-Version: v1` on every request.
 *   - Browser: carry the session cookie via `credentials: "include"`.
 *   - React Native: inject the bearer token registered via `setAuthToken`.
 *   - Retry once on 5xx with a 500ms backoff.
 *   - Call the consumer-registered `onUnauthorized` callback on 401, but only
 *     when we actually sent an Authorization header.
 *   - `no-store` caching on `/me/*`; default for everything else.
 *
 * This file is what Orval plugs in as its mutator, every generated hook
 * ultimately calls `customFetcher(...)` instead of `fetch(...)`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type ResolvedConfig = {
  url: string;
  method?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob' | 'text';
  signal?: AbortSignal;
};

// --------------------------------------------------------------------------
// Module state, configurable from the mobile app.
// --------------------------------------------------------------------------

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/**
 * Register/clear the bearer token used in the Authorization header. Mobile
 * calls this after BetterAuth issues a session so subsequent requests carry the
 * token from SecureStore without per-call plumbing. Pass `null` on sign-out.
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Register the handler invoked on a 401 response (e.g. to force sign-out in the
 * mobile app). Pass `null` to unregister.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

// --------------------------------------------------------------------------
// Base URL + client version resolution.
// --------------------------------------------------------------------------

type GlobalWithBaseUrl = typeof globalThis & {
  __DEVRIJEHOND_API_URL__?: string;
};

function resolveBaseUrl(): string {
  const fromGlobal = (globalThis as GlobalWithBaseUrl).__DEVRIJEHOND_API_URL__;
  if (fromGlobal) return fromGlobal;

  if (typeof process !== 'undefined') {
    // Mobile (Expo) bundles inline EXPO_PUBLIC_* at build time. Server/web use
    // NEXT_PUBLIC_API_URL. Reference each by a literal key so the bundler can
    // statically replace it.
    const fromExpo = process.env.EXPO_PUBLIC_API_URL;
    if (fromExpo) return fromExpo;
    const fromNext = process.env.NEXT_PUBLIC_API_URL;
    if (fromNext) return fromNext;
  }

  // No last-resort fallback. A shipped client must have either
  // `__DEVRIJEHOND_API_URL__` (mobile bootstraps it in app/_layout.tsx from
  // EXPO_PUBLIC_API_URL) or one of the env vars above. A hardcoded fallback
  // would silently misroute every fetch when the bootstrap didn't run.
  throw new Error(
    '[api-client] base URL is not configured. Set globalThis.__DEVRIJEHOND_API_URL__ ' +
      '(mobile) or process.env.EXPO_PUBLIC_API_URL / NEXT_PUBLIC_API_URL before the first fetch.',
  );
}

function resolveClientVersion(): string {
  const fromGlobal = (globalThis as typeof globalThis & { __DEVRIJEHOND_CLIENT_VERSION__?: string })
    .__DEVRIJEHOND_CLIENT_VERSION__;
  if (fromGlobal) return fromGlobal;

  if (typeof process !== 'undefined' && typeof process.env['npm_package_version'] === 'string') {
    return process.env['npm_package_version'];
  }

  return '0.0.0';
}

// --------------------------------------------------------------------------
// URL construction.
// --------------------------------------------------------------------------

function buildUrl(path: string, params: Record<string, unknown> | undefined): string {
  const base = resolveBaseUrl();
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// --------------------------------------------------------------------------
// Main fetcher.
// --------------------------------------------------------------------------

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

// Hard cap per attempt so a stalled connection (e.g. a phone on weak cellular)
// fails fast and surfaces a retry instead of spinning forever. Combined with
// the caller's own abort signal.
const REQUEST_TIMEOUT_MS = 12_000;

function isMeRoute(path: string): boolean {
  return path.includes('/me/') || path.startsWith('me/');
}

/** A signal that aborts on the caller's signal OR after REQUEST_TIMEOUT_MS. */
function timeoutSignal(base: AbortSignal | null | undefined): {
  signal: AbortSignal;
  clear: () => void;
} {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (base) {
    if (base.aborted) ctrl.abort();
    else base.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(timer);
      base?.removeEventListener('abort', onAbort);
    },
  };
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const t = timeoutSignal(init.signal);
  try {
    return await fetch(input, { ...init, signal: t.signal });
  } finally {
    t.clear();
  }
}

async function executeFetch(input: string, init: RequestInit): Promise<Response> {
  const first = await fetchWithTimeout(input, init);
  if (!RETRYABLE_STATUS.has(first.status)) return first;

  // One retry on 5xx with a 500ms backoff. Keep it simple, mobile carries its
  // own offline/queue semantics; this is just a short-hop smoother.
  await new Promise((r) => setTimeout(r, 500));
  return fetchWithTimeout(input, init);
}

export async function customFetcher<T>(config: ResolvedConfig): Promise<T> {
  const method = (config.method ?? 'GET').toUpperCase();
  const url = buildUrl(config.url, config.params);

  const headers: Record<string, string> = {
    'X-Client-Version': resolveClientVersion(),
    'X-API-Version': 'v1',
    ...(config.headers ?? {}),
  };

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let body: BodyInit | undefined;
  if (config.data !== undefined && config.data !== null) {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      body = config.data;
    } else {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = JSON.stringify(config.data);
    }
  }

  const init: RequestInit = {
    method,
    headers,
    body,
    // Browser: carry the BetterAuth session cookie. Harmless on RN.
    credentials: 'include',
    signal: config.signal,
    cache: isMeRoute(config.url) ? 'no-store' : 'default',
  };

  const response = await executeFetch(url, init);

  if (response.status === 401) {
    // Only treat a 401 as a session-invalidation signal when we actually sent
    // an Authorization header. A 401 from a /me/* endpoint without a token is
    // just "anonymous denied", expected on the cold-start race window where a
    // /me component mounts before the bearer is loaded from SecureStore.
    if (headers['Authorization']) {
      unauthorizedHandler?.();
    }
    throw new FetcherError('Unauthorized', response.status, await safeBody(response));
  }

  if (!response.ok) {
    throw new FetcherError(
      `Request failed: ${response.status} ${response.statusText}`,
      response.status,
      await safeBody(response),
    );
  }

  // Empty bodies (204, HEAD), return undefined cast to T.
  if (response.status === 204) return undefined as T;

  const responseType = config.responseType ?? 'json';
  if (responseType === 'blob') return (await response.blob()) as T;
  if (responseType === 'text') return (await response.text()) as T;

  const text = await response.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

async function safeBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

// --------------------------------------------------------------------------
// Error type.
// --------------------------------------------------------------------------

export class FetcherError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'FetcherError';
    this.status = status;
    this.body = body;
  }
}

// Orval mutators are commonly imported as default too, provide both.
export default customFetcher;
