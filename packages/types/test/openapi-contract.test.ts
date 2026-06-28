/**
 * OpenAPI contract tests.
 *
 * 1. Validity: the live, generated spec is a well-formed OpenAPI 3 document
 *    (version, info, paths, every operation has responses, no dangling $refs).
 * 2. Backwards compatibility: the live spec stays compatible with the latest
 *    frozen snapshot in openapi/<version>.json. Additive changes are allowed
 *    (new endpoints, new optional fields, new enum values); breaking changes
 *    are not (removed endpoints/fields, type changes, newly-required request
 *    fields, removed enum values). This is what guarantees a shipped app that
 *    pins to a snapshot keeps working against the running API.
 *
 * Bumping the contract: only when you intend a new contract version, run
 * `pnpm --filter @devrijehond/types openapi:snapshot <next-version>` and commit
 * the new snapshot. Day-to-day, additive changes must keep this test green
 * against the existing snapshot.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../src/index';

type AnyObj = Record<string, any>;

const here = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(here, '..', 'openapi');

function latestSnapshot(): { version: string; doc: AnyObj } {
  const files = readdirSync(snapshotDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) throw new Error('No OpenAPI snapshot found in openapi/');
  const cmp = (a: string, b: string) => {
    const pa = a.replace('.json', '').split('.').map(Number);
    const pb = b.replace('.json', '').split('.').map(Number);
    for (let i = 0; i < 3; i++)
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    return 0;
  };
  const latest = files.sort(cmp).at(-1)!;
  return {
    version: latest.replace('.json', ''),
    doc: JSON.parse(readFileSync(join(snapshotDir, latest), 'utf8')),
  };
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];
const current = buildOpenApiDocument('v1') as AnyObj;

describe('OpenAPI spec is valid', () => {
  it('declares OpenAPI 3 + info', () => {
    expect(String(current.openapi)).toMatch(/^3\./);
    expect(current.info?.title).toBeTruthy();
    expect(current.info?.version).toBeTruthy();
  });

  it('has paths, and every operation declares responses', () => {
    const paths = current.paths ?? {};
    expect(Object.keys(paths).length).toBeGreaterThan(0);
    for (const [p, ops] of Object.entries<AnyObj>(paths)) {
      for (const m of METHODS) {
        if (ops[m]) {
          expect(ops[m].responses, `${m.toUpperCase()} ${p} must declare responses`).toBeTruthy();
        }
      }
    }
  });

  it('has no dangling component $refs', () => {
    const schemas = current.components?.schemas ?? {};
    const refs = new Set<string>();
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node as AnyObj)) {
        if (k === '$ref' && typeof v === 'string') refs.add(v);
        else walk(v);
      }
    };
    walk(current);
    for (const ref of refs) {
      const m = ref.match(/^#\/components\/schemas\/(.+)$/);
      if (m) expect(schemas[m[1]], `dangling $ref: ${ref}`).toBeTruthy();
    }
  });
});

describe('OpenAPI is backwards-compatible with the latest snapshot', () => {
  const { version, doc: snap } = latestSnapshot();
  const breaks: string[] = [];

  // Compare a schema in the snapshot against the same schema in the current
  // spec. Records a message per breaking change found.
  const compare = (s: AnyObj, c: AnyObj | undefined, path: string) => {
    if (!s || typeof s !== 'object') return;
    if (!c) {
      breaks.push(`${path}: removed`);
      return;
    }
    // $ref: must point at the same component (the component itself is compared
    // separately in the components loop).
    if (s.$ref) {
      if (c.$ref !== s.$ref)
        breaks.push(`${path}: $ref changed ${s.$ref} -> ${c.$ref ?? '(none)'}`);
      return;
    }
    // type (string or array of types, e.g. nullable -> ["string","null"]).
    if (s.type) {
      const st = new Set([s.type].flat());
      const ct = new Set([c.type ?? []].flat());
      for (const t of st) if (!ct.has(t)) breaks.push(`${path}: type dropped "${t}"`);
    }
    // enum: no removed values.
    if (Array.isArray(s.enum)) {
      const cur = new Set(c.enum ?? []);
      for (const v of s.enum) if (!cur.has(v)) breaks.push(`${path}: enum value removed "${v}"`);
    }
    // object properties: none removed, each still compatible.
    if (s.properties) {
      for (const [k, sp] of Object.entries<AnyObj>(s.properties)) {
        compare(sp, c.properties?.[k], `${path}.${k}`);
      }
    }
    // required: the current spec must not require fields the snapshot did not
    // (a newly-required request field breaks old clients).
    const sr = new Set<string>(s.required ?? []);
    for (const r of c.required ?? []) {
      if (!sr.has(r)) breaks.push(`${path}: newly required field "${r}"`);
    }
    // array items.
    if (s.items) compare(s.items, c.items, `${path}[]`);
  };

  it(`has no breaking changes vs snapshot ${version} (additive only)`, () => {
    // 1. Every path + method in the snapshot must still exist.
    const curPaths = current.paths ?? {};
    for (const [p, ops] of Object.entries<AnyObj>(snap.paths ?? {})) {
      for (const m of METHODS) {
        if (ops[m] && !curPaths[p]?.[m]) breaks.push(`operation removed: ${m.toUpperCase()} ${p}`);
      }
    }
    // 2. Every component schema must stay compatible.
    const curSchemas = current.components?.schemas ?? {};
    for (const [name, s] of Object.entries<AnyObj>(snap.components?.schemas ?? {})) {
      compare(s, curSchemas[name], `schema ${name}`);
    }
    expect(breaks, `breaking changes vs snapshot ${version}:\n - ${breaks.join('\n - ')}`).toEqual(
      [],
    );
  });
});
