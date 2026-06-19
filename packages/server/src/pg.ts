import pg, { Pool, type QueryResultRow } from 'pg';

/**
 * Raw PostGIS query pool.
 *
 * `schema.zmodel` types the spot `geom` column as
 * `Unsupported("geometry(Geometry, 4326)")`, so PostGIS reads/writes (viewport
 * bbox via `ST_MakeEnvelope`/`&&`, `ST_GeomFromGeoJSON`, `ST_MakePoint`,
 * proximity gate) run as raw SQL through this dedicated `pg` Pool rather than
 * through the ZenStack client (which can't model the geometry type).
 *
 * Policy note: this pool BYPASSES ZenStack access policies. Use it for the
 * spatial pieces only (geometry insert + bbox filtering) and pull the rest of
 * the row through `authDb` / `anonDb` so the policy layer still governs what a
 * caller may read/write. The bbox read handlers compensate by adding an
 * explicit `status NOT IN ('HIDDEN','REMOVED')` predicate in SQL.
 *
 * Matches the connection/SSL/type-parser config in `@devrijehond/db`'s client
 * so timestamps come back as UTC `Date`s consistently across both clients.
 */

pg.types.setTypeParser(1114, (str: string) => new Date(str + 'Z'));
pg.types.setTypeParser(1082, (str: string) => new Date(str + 'T00:00:00Z'));

const globalForPg = globalThis as unknown as { dvhPgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL ?? '';
  const useSsl =
    process.env.DATABASE_SSL === 'true' ||
    (process.env.DATABASE_SSL !== 'false' && process.env.NODE_ENV === 'production');
  const poolMax = Number(process.env.DATABASE_POOL_MAX);
  return new Pool({
    connectionString,
    ...(Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
    ...(useSsl && { ssl: { rejectUnauthorized: false } }),
  });
}

/** Process-wide singleton pool (one per Node process, reused across requests). */
export const pgPool: Pool =
  globalForPg.dvhPgPool ??
  (process.env.NODE_ENV === 'production'
    ? createPool()
    : (globalForPg.dvhPgPool = createPool()));

/** Run a parameterised raw query and return the typed rows. */
export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const result = await pgPool.query<T>(text, params as unknown[]);
  return result.rows;
}
