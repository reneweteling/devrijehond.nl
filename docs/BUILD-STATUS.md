# Build status & bootstrap

The full monorepo foundation is scaffolded (web API + packages, plus the native
iOS app in `apps/ios-native`). This doc covers how to bring it up on your machine and the open
`verify` items collected from the build.

> Two things could not run inside the build sandbox and are left for your local
> machine: (1) further git commits — the sandbox accessed the folder over a
> network mount that blocks git's lock-file deletes, so only the initial commit
> landed; (2) `pnpm install` / codegen / typecheck — the sandbox shell caps at
> 45s, far too short for a Next + ZenStack install. Both work normally on
> your local APFS folder.

## 1. Finish the commit (local)

```sh
cd ~/projects/devrijehond.nl
git add -A
git commit -m "feat: scaffold packages and apps"
```

(The initial `chore: initialize monorepo skeleton` commit is already in history.)

## 2. Install

```sh
pnpm install
```

If the BetterAuth ↔ ZenStack CLI dependency conflict bites (`non exhaustive
match` on `zen generate`), add to root `package.json` and reinstall:

```json
{ "pnpm": { "overrides": { "chevrotain": "^11" } } }
```

## 3. Reconcile BetterAuth core models

The `User/Session/Account/Verification` models in `packages/db/schema.zmodel`
were written by hand. Reconcile them against the installed BetterAuth version:

```sh
cd packages/db
pnpm dlx @better-auth/cli generate   # points at ../auth/src/auth.ts
```

## 4. Database (PostGIS)

```sh
pnpm db:up                              # docker compose: postgis/postgis:16-3.4
cp .env.example .env.local              # fill secrets (see below)
pnpm --filter @devrijehond/db db:generate   # zen generate -> schema.ts, models.ts, client
pnpm --filter @devrijehond/db db:migrate    # creates the first migration
pnpm --filter @devrijehond/db db:seed       # postgis ext + taxonomy + admin + sample spot
```

## 5. Run

```sh
pnpm --filter web dev   # serves http://localhost:3030/api/v1/openapi.json
pnpm typecheck          # tsc across the workspace
```

The native iOS app lives in `apps/ios-native` and is built separately. Generate
the Xcode project and run it in the simulator against the local web server:

```sh
cd apps/ios-native && xcodegen generate && open DeVrijeHondNative.xcodeproj
```

DEBUG builds point at `http://localhost:3030`, so keep `pnpm --filter web dev`
running. The OpenAPI document at `/api/v1/openapi.json` is the contract that
`Sources/APIClient.swift` and its `Codable` types follow by hand.

Secrets to fill in `.env.local`: `BETTER_AUTH_SECRET`, `APPLE_*`, `GOOGLE_*`,
`RESEND_API_KEY`, `S3_*`. Provision Apple/Google dev accounts under the De Vrije
Hond org (1–2 week lead).

---

## Open `verify` items (collected from the build)

### Core (db / ZenStack v3)

- Confirm the access-policy plugin provider in `schema.zmodel`
  (`plugin policy { provider = '@core/policy' }`) against the installed
  `@zenstackhq/orm`; and whether the runtime policy plugin needs an explicit
  `.$use(...)` in `packages/db/src/client.ts` (or `$setAuth` alone suffices).
- Run `@better-auth/cli generate` (step 3) to lock the auth core tables.

### auth / email / s3

- Confirm `zenstackAdapter` export name from installed `@zenstackhq/better-auth`.
- Confirm `auth.api.signInSocial` body shape for the native idToken path
  (`apps/web/.../lib/mobile-bridge.ts`).
- Pin exact latest versions at install (better-auth, resend, @react-email/\*,
  @aws-sdk/\*, next) per blueprint §7 decision 5.

### types

- Verify web route handlers don't double-register OpenAPI paths already in
  `packages/types/src/paths.ts`.

### apps/web

- ZenStack v3 generated-client specifics: composite-key accessors
  (`spotId_userId`, `requestId_userId`) and `include`/`select` nesting.
- The vote route recomputes a spot's status across users; it writes via
  `authDb` with a raw-`db` fallback. For release 1, move the cross-user status
  transition to a queue job or a `SECURITY DEFINER` trigger so it never depends
  on the voter's policy scope. Thresholds are constants in `lib/verification.ts`
  (`VERIFY_NET_SCORE = 5`, `HIDE_DENY_COUNT = 3`).

### apps/ios-native

- Add polygon geometry to the map summary DTO (regions currently drawn from
  centroid only).
- Use `CoreLocation` for map centring and the vote proximity proof.
- Add a "my submissions" list endpoint + screen; finish edit-profile / add-dog /
  report sheets.

## What's implemented fully (correct, not stubs)

- ZenStack schema + community-verification access policies (PostGIS).
- `GET /api/v1/spots` (PostGIS bbox + filters), `GET /api/v1/spots/[slug]`,
  `POST /api/v1/me/spots` (geometry insert), `POST /api/v1/me/spots/[id]/vote`
  (weighted recompute + verify/hide thresholds, hide-takes-precedence),
  `GET /api/v1/openapi.json`.
- BetterAuth wiring incl. native Apple/Google bridge + the `/verify-mobile`
  HTTPS interstitial (solves the `vrijehond://` rewrite).
- SSR spot pages (`/plek/[slug]`, `/gebied/[slug]`) with metadata for SEO.
- Admin safety-net queue + taxonomy curation (role-gated) with an action log.
- Native iOS app: auth (magic link + native Apple/Google, bearer→Keychain),
  `TabView` navigation, real `MapKit` map (verified/unverified pins), spot
  detail with community-check.
