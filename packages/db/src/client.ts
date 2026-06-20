import { ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import pg, { Pool } from 'pg';
import { schema, type SchemaType } from '../schema';

/**
 * ZenStack v3 clients for De Vrije Hond.
 *
 *   - `db`      , raw client, policies NOT enforced. Use ONLY for the
 *                  BetterAuth adapter and migrations/seed scripts.
 *   - `authDb(user)`, policy-bound client. ALL application data access goes
 *                  through here. Internally `policyDb.$setAuth({ id, role })`,
 *                  which exposes `auth()` to the @@allow/@@deny rules.
 *
 * `auth()` shape is defined by `type Auth { id; role; @@auth }` in the schema.
 *
 * The access-policy runtime is the `PolicyPlugin` from `@zenstackhq/plugin-policy`
 * (the same package whose `plugin.zmodel` contributes `@@allow`/`@@deny` at
 * `zen generate` time). `$setAuth` only binds the identity exposed to `auth()`;
 * it does NOT enforce on its own. Enforcement is on only for `policyDb`, which
 * has the plugin installed via `$use`. The raw `db` deliberately omits it so the
 * BetterAuth adapter and migrations/seed bypass policies.
 */

pg.types.setTypeParser(1114, (str: string) => new Date(str + 'Z'));
pg.types.setTypeParser(1082, (str: string) => new Date(str + 'T00:00:00Z'));

type DvhClient = ClientContract<SchemaType>;

const globalForDb = globalThis as unknown as {
  dvhDb?: DvhClient;
  dvhPolicyDb?: DvhClient;
};

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

/** Raw client, bypasses policies. BetterAuth adapter + migrations only. */
export const db: DvhClient =
  globalForDb.dvhDb ??
  (process.env.NODE_ENV === 'production' ? createClient() : (globalForDb.dvhDb = createClient()));

/**
 * Policy-enforcing client (no identity bound yet). Application code never uses
 * this directly, it goes through `authDb` / `anonDb`, which bind `auth()`.
 */
const policyDb: DvhClient =
  globalForDb.dvhPolicyDb ??
  (process.env.NODE_ENV === 'production'
    ? db.$use(new PolicyPlugin())
    : (globalForDb.dvhPolicyDb = db.$use(new PolicyPlugin())));

export type Db = DvhClient;

export interface AuthUser {
  id: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

/** Policy-bound client for a given user. Use everywhere in application code. */
export function authDb(user: AuthUser) {
  return policyDb.$setAuth({ id: user.id, role: user.role });
}

/**
 * Anonymous policy-bound client (public reads). Pass `undefined` (not `null`)
 *, the ORM rejects an explicit null. In policy rules `auth()` then reads as
 * null, so `auth() == null` / `auth() != null` behave as intended.
 */
export function anonDb() {
  return policyDb.$setAuth(undefined);
}
