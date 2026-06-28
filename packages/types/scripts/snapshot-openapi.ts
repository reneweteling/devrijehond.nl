/**
 * Snapshot the current OpenAPI document to packages/types/openapi/<version>.json.
 *
 * Each snapshot is the frozen API contract that a shipped app version pins to.
 * The contract test (test/openapi-contract.test.ts) checks that the live spec
 * stays backwards-compatible with the latest snapshot (additive only). Bump the
 * version and re-snapshot only for a new, intentional contract version.
 *
 * Usage: pnpm --filter @devrijehond/types openapi:snapshot [version]   (default 1.0.0)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/index';

const version = process.argv[2] ?? '1.0.0';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'openapi');
mkdirSync(outDir, { recursive: true });

const doc = buildOpenApiDocument('v1') as Record<string, unknown>;
// Drop `servers`: the snapshot is the environment-independent contract.
delete doc.servers;

const out = join(outDir, `${version}.json`);
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
const pathCount = Object.keys((doc.paths as Record<string, unknown>) ?? {}).length;
// eslint-disable-next-line no-console
console.log(`Wrote ${out} (${pathCount} paths)`);
