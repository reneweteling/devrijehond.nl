/**
 * Orval input resolver — picks between the running web dev server and the
 * committed snapshot via the `OPENAPI_SOURCE` env var.
 *
 * Why the snapshot exists: Orval runs in CI (drift-check job) without a running
 * Next.js server. Committing a snapshot of `/api/v1/openapi.json` keeps
 * `pnpm generate` hermetic. `pnpm snapshot` refreshes it locally from the dev
 * server, then regenerates. See `./README.md` for the flow.
 *
 * This module is loaded synchronously by Orval at config time, so the resolver
 * returns a string — runtime HTTP probing is not possible here.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEV_SERVER = 'https://devrijehond.local/api/v1/openapi.json';
const SNAPSHOT = resolve(process.cwd(), 'openapi.snapshot.json');

/**
 * `OPENAPI_SOURCE=dev`                → pulls from the running web dev server.
 * `OPENAPI_SOURCE=snapshot` (default) → uses the committed snapshot file.
 */
export function resolveInput(): string {
  const source = process.env.OPENAPI_SOURCE ?? 'snapshot';
  if (source === 'dev') return DEV_SERVER;

  if (!existsSync(SNAPSHOT)) {
    throw new Error(
      `OPENAPI_SOURCE=${source} requested but ${SNAPSHOT} does not exist. ` +
        `Run \`pnpm --filter @devrijehond/api-client snapshot\` first, or set ` +
        `OPENAPI_SOURCE=dev with the web dev server running.`,
    );
  }
  return SNAPSHOT;
}
