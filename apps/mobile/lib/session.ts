/**
 * Session persistence for the De Vrije Hond mobile app.
 *
 * The bearer is a long-lived credential (BetterAuth session, 30-day sliding
 * window), so it lives in `expo-secure-store` (Keychain on iOS,
 * EncryptedSharedPreferences on Android), never AsyncStorage (plain text).
 *
 * We store the server's `expiresAt` alongside the token so we can decide
 * locally whether to proactively refresh without a round-trip on every
 * foreground. The server stays the source of truth; this is a cache.
 */

import * as SecureStore from 'expo-secure-store';

import { AUTH_URL } from './config';

const TOKEN_KEY = 'dvh.session.token';
const EXPIRES_KEY = 'dvh.session.expiresAt';

/** Refresh aggressively when <= 6 days of runway remain. */
const REFRESH_THRESHOLD_MS = 6 * 24 * 60 * 60 * 1000;

export type PersistedSession = {
  token: string;
  expiresAt: Date;
};

export async function saveSession(token: string, expiresAt: Date): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(EXPIRES_KEY, expiresAt.toISOString()),
  ]);
}

export async function loadSession(): Promise<PersistedSession | null> {
  const [token, expiresAtRaw] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(EXPIRES_KEY),
  ]);
  if (!token || !expiresAtRaw) return null;
  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime())) return null;
  if (expiresAt.getTime() <= Date.now()) {
    await clearSession();
    return null;
  }
  return { token, expiresAt };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(EXPIRES_KEY),
  ]);
}

/**
 * Hit BetterAuth's `/api/auth/get-session` and rotate the refreshed token into
 * SecureStore when the sliding window advances. Returns the (possibly
 * refreshed) session, or `null` when the server says it is no longer valid.
 */
export async function refreshSessionIfNeeded(
  current: PersistedSession,
): Promise<PersistedSession | null> {
  const remaining = current.expiresAt.getTime() - Date.now();
  if (remaining > REFRESH_THRESHOLD_MS) return current;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${current.token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (response.status === 401) {
      await clearSession();
      return null;
    }
    if (!response.ok) return current;

    const body = (await response.json()) as {
      session?: { token?: string; expiresAt?: string };
    } | null;

    const nextToken = extractTokenFromResponse(response) ?? body?.session?.token;
    const nextExpiresAt = body?.session?.expiresAt ? new Date(body.session.expiresAt) : null;

    if (nextToken && nextExpiresAt && !Number.isNaN(nextExpiresAt.getTime())) {
      const next: PersistedSession = { token: nextToken, expiresAt: nextExpiresAt };
      await saveSession(next.token, next.expiresAt);
      return next;
    }
    return current;
  } catch {
    return current;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse a BetterAuth session token out of an HTTP response.
 *
 * Primary channel: the `set-auth-token` header emitted by BetterAuth's
 * `bearer()` plugin whenever a session cookie would be set, a reliable way to
 * extract the token in RN, where HttpOnly `Set-Cookie` is opaque to JS.
 * Fallback: parse `Set-Cookie` for `*session_token=...`.
 */
export function extractTokenFromResponse(response: Response): string | null {
  const direct = response.headers.get('set-auth-token') ?? response.headers.get('x-auth-token');
  if (direct) return direct;

  const setCookie = response.headers.get('set-cookie') ?? response.headers.get('Set-Cookie');
  if (!setCookie) return null;

  const match = setCookie.match(/(?:^|,\s*|;\s*)([^=;\s]*session_token)=([^;]+)/i);
  if (match?.[2]) return decodeURIComponent(match[2]);
  return null;
}
