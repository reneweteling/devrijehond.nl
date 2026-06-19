/**
 * Force-update support. The app reads `GET /api/v1/app-config` on boot; if its
 * own version is below the server's `minSupportedVersion`, the root renders a
 * blocking "update required" screen. This lets us cut off ancient builds (that
 * may speak an incompatible API) without shipping a new binary, mirroring the
 * dekmantel force-update flow.
 */

import Constants from 'expo-constants';

import { API_URL } from './config';

export interface AppConfig {
  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: { ios: string; android: string };
}

/** The running app's version (app.json `version`, e.g. "0.1.0"). */
export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Numeric semver-ish compare: -1 if a<b, 0 if equal, 1 if a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** True when the current version is older than the minimum the server supports. */
export function isUpdateRequired(config: AppConfig, version = currentAppVersion()): boolean {
  return compareVersions(version, config.minSupportedVersion) < 0;
}

/** Fetch the app config; returns null on any failure (never blocks boot). */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/api/v1/app-config`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as AppConfig;
  } catch {
    return null;
  }
}
