import { ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import pg, { Pool } from 'pg';
import { schema, type SchemaType } from '../schema';

/**
 * ZenStack v3 clients for De Vrije Hond.
 *
 *   - `db`       — raw client, policies NOT enforced. Use ONLY for the
 *                  BetterAuth adapter and migrations/seed scripts.
 *   - `authDb(user)` — policy-bound client. ALL application data access goes
 *                  through here. Internally `policyDb.$setAuth({ id, role })`,
 *                  which exposes `auth()` to the @@allow/@@deny rules.
 *
 * `auth()` shape is defined by `type Auth { id; role; @@auth }` in the schema.
 *
 * NOTE (verify pass): the v3 access-policy runtime is a self-contained plugin
 * declared in the ZModel (`plugin policy`). Depending on the installed
 * @zenstackhq/orm version the runtime install may be implicit (just call
 * `$setAuth`) or require `.$use(policyPlugin)`. Confirm against the installed
 * package during `pnpm install` + `zen generate` and adjust `policyDb` below.
 */

pg.types.setTypeParser(1114, (str: string) => new Date(str + 'Z'));
pg.types.setTypeParser(1082, (str: string) => new Date(str + 'T00:00:00Z'));

type DvhClient = ClientContract<SchemaType>;

const globalForDb = globalThis as unknown as { dvhDb?: DvhClient };

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

function createClient(): DvhClient {
  return new ZenStackClient(schema, {
    dialect: new PostgresDialect({ pool: createPool() }),
    log: ['error'],
  });
}

/** Raw client — bypasses policies. BetterAuth adapter + migrations only. */
export const db: DvhClient =
  globalForDb.dvhDb ??
  (process.env.NODE_ENV === 'production'
    ? createClient()
    : (globalForDb.dvhDb = createClient()));

export type Db = DvhClient;

export interface AuthUser {
  id: string;
  role: 'USER' | 'ADMIN';
}

/** Policy-bound client for a given user. Use everywhere in application code. */
export function authDb(user: AuthUser) {
  return db.$setAuth({ id: user.id, role: user.role });
}

/** Anonymous policy-bound client (public reads). `auth()` is null. */
export function anonDb() {
  return db.$setAuth(null);
}
