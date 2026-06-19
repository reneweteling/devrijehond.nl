# @devrijehond/db

ZenStack v3 schema, access policies, generated client, Zod factory and seed.

## Workflow

```sh
pnpm --filter @devrijehond/db db:generate     # zen generate -> schema.ts, models.ts, client
pnpm --filter @devrijehond/db db:migrate       # create/apply migration (dev)
pnpm --filter @devrijehond/db db:seed          # taxonomy + admin + sample spot
```

## Clients

- `db` — raw, policies bypassed. BetterAuth adapter + migrations/seed only.
- `authDb(user)` — policy-bound (`$setAuth({ id, role })`). All app data access.
- `anonDb()` — anonymous policy-bound (public reads).

## PostGIS

`Spot.geom` is `geometry(Geometry, 4326)` (Unsupported in Prisma); `lat`/`lng`
mirror the centroid. The seed runs `CREATE EXTENSION IF NOT EXISTS postgis;`.
Spatial queries (bbox, nearby-radius proximity gate, duplicate detection) run as
raw SQL in `apps/web`.

## Verify-pass TODOs

- Confirm the access-policy plugin provider name in `schema.zmodel`
  (`plugin policy { provider = '...' }`) against the installed @zenstackhq/orm,
  and whether the runtime policy plugin needs an explicit `.$use(...)` in
  `src/client.ts` (see note there).
- Run `npx @better-auth/cli generate` to reconcile the BetterAuth core models
  (User/Session/Account/Verification) with the BetterAuth version in use.
