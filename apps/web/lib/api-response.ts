import { NextResponse } from 'next/server';

/**
 * Uniform response helpers for the De Vrije Hond API (`app/api/v1/**`).
 *
 * Every response carries `X-API-Version: v1` and a `Cache-Control` header:
 *   - public reads default to a short CDN recipe;
 *   - `/me/*` responses pass `cacheControl: NO_STORE_CACHE_CONTROL`;
 *   - errors are always `no-store`.
 *
 * No route handler under `/api/v1/**` should call `NextResponse.json` directly.
 */

export const API_VERSION_HEADER = 'X-API-Version';
export const API_VERSION = 'v1';

/** Default CDN recipe for a public, anonymous read. */
export const DEFAULT_PUBLIC_CACHE_CONTROL =
  'public, s-maxage=60, stale-while-revalidate=600';

/** Never cache — used by `/me/*` responses and every error. */
export const NO_STORE_CACHE_CONTROL = 'no-store';

type OkOptions = {
  cacheControl?: string;
  status?: number;
  headers?: Record<string, string>;
};

export function ok<T>(body: T, options: OkOptions = {}): NextResponse<T> {
  const { cacheControl = DEFAULT_PUBLIC_CACHE_CONTROL, status = 200, headers = {} } = options;
  return NextResponse.json(body, {
    status,
    headers: {
      [API_VERSION_HEADER]: API_VERSION,
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export type ApiErrorBody = {
  error: string;
  message: string;
  details?: unknown;
};

type ErrorOptions = {
  status?: number;
  details?: unknown;
  headers?: Record<string, string>;
};

export function error(
  code: string,
  message: string,
  options: ErrorOptions = {},
): NextResponse<ApiErrorBody> {
  const { status = 400, details, headers = {} } = options;
  const body: ApiErrorBody = { error: code, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, {
    status,
    headers: {
      [API_VERSION_HEADER]: API_VERSION,
      'Cache-Control': NO_STORE_CACHE_CONTROL,
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}
