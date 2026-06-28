# CLAUDE.md

De Vrije Hond — community-driven map of dog-friendly spots in the Netherlands.
Native SwiftUI iOS app + Next.js app that is **both the public website and the
API** for web and mobile. Greenfield monorepo, scaffolded but not yet installed
/ typechecked (see `docs/BUILD-STATUS.md`).

## Start here

Read these before changing anything — they are the source of truth:

- `docs/HANDOFF.md` — current state, what's done vs stubbed, next steps.
- `docs/BUILD-STATUS.md` — bootstrap commands + the open `verify` items.
- `docs/architecture/setup-blueprint.md` — architecture + locked decisions.
- `docs/wireframes-mobile.md` — product spec (flows, community-verification rules, data model §11).
- `docs/design/brand-direction.md` — visual identity + icon map. `docs/design/hifi-prototype.html` is the visual target.

## Architecture at a glance

Monorepo (pnpm + Turborepo). Scope `@devrijehond/*`.

- **apps/web** — Next.js App Router. Public SSR site (`/`, `/plek/[slug]`, `/gebied/[slug]`) + API (`/api/v1/...` public, `/api/v1/me/...` personalised) + admin section (`/admin`, ADMIN-role-gated). One deploy.
- **apps/ios-native** — native SwiftUI iOS app (xcodegen project, `MapKit`, SF Symbols). Consumes the API only via a hand-written `APIClient.swift`.
- **packages/db** — ZenStack v3 schema + **access policies** over Prisma, on **PostGIS** Postgres. The heart of the app.
- **packages/auth** — BetterAuth: native Apple/Google + **magic link via HTTPS interstitial**.
- **packages/types** — zod DTOs + OpenAPI registry (the API contract).
- **packages/server** — request context (`getContext`, `requireAuth`, `withContext`), raw PostGIS pool, logger.
- **packages/email** (Resend) · **packages/s3** (uploads).

## Key rules

- **Community verification is the core model.** A spot is published immediately as `UNVERIFIED`. Votes are weighted by voter reputation. `netScore >= +5` → `VERIFIED`; `denyCount >= 3` → `HIDDEN` (**hide takes precedence** if both fire). Auto-removal/hide surfaces to the admin safety-net. Thresholds are constants in `apps/web/.../lib/verification.ts` (`VERIFY_NET_SCORE`, `HIDE_DENY_COUNT`). No moderators in normal operation; the admin only handles hidden/reported/contested.
- **Vote integrity**: one vote per user per spot (DB unique), submitter can't vote on own spot (policy + check), voter must have a proximity proof, weight snapshots reputation at vote time.
- **Policies, not vibes.** All application data access goes through `authDb(user)` / `anonDb()` (ZenStack `$setAuth`). Only the BetterAuth adapter + migrations/seed use the raw `db`. **The native app never touches the db** — data only via the HTTP API.
- **Public vs `/me/*` split.** `/api/v1/...` = anonymous, cacheable, no auth at the edge. `/api/v1/me/...` = personalised, CDN-bypass; auth is a per-route decision. Never authenticate a public cache key.
- **Geometry is PostGIS.** `Spot.geom` is `geometry(...,4326)` (Unsupported in Prisma); `lat`/`lng` mirror the centroid. Spatial queries (bbox, nearby-radius proximity gate, duplicate detection) are **raw SQL** via `packages/server`'s pg pool — not the ORM.
- **Taxonomy is data, community-growable, admin-curated.** Categories + amenities are rows with `visible`/`sortOrder`/`status` (`ACTIVE`|`PROPOSED`). New community terms land as `PROPOSED`; admin promotes/merges. Don't hardcode categories.
- **Auth deep-link**: the magic-link email links to an HTTPS `/verify-mobile` interstitial (Gmail won't rewrite it), which hops to the app's `vrijehond://` deep link. Native Apple/Google exchange an idToken at `/api/auth/mobile/{apple,google}-native` for a bearer token stored in the iOS Keychain.
- **SSR for SEO**: each spot is a crawlable server-rendered URL with `generateMetadata`.
- **Mobile spec is the source of truth.** `docs/mobile-app-spec.md` is the
  canonical, framework-agnostic feature + API-contract spec, the parity board for
  the native iOS app and the native Android (Kotlin/Compose) app. Whenever you add
  or change a mobile feature (`apps/ios-native`) or a `/api/v1` (or `/api/auth`)
  endpoint the apps use, update `docs/mobile-app-spec.md` in the same change. The
  app clients are driven by the OAS3 contract under `packages/types/openapi/`;
  changes to the contract must stay backwards-compatible with the snapshot the
  shipped apps pin to (additive only).

## Commands

```sh
pnpm install
pnpm db:up                                    # PostGIS via docker compose
pnpm --filter @devrijehond/db db:generate     # zen generate
pnpm --filter @devrijehond/db db:migrate
pnpm --filter @devrijehond/db db:seed
pnpm --filter web dev                         # serves /api/v1/openapi.json on :3030
pnpm dev          # turbo: web
pnpm typecheck    # tsc across the workspace
pnpm lint
```

Native iOS dev loop: generate the Xcode project and run in the simulator
(`cd apps/ios-native && xcodegen generate && open DeVrijeHondNative.xcodeproj`).
DEBUG builds talk to `http://localhost:3030`, so run the web app first.

**Deploy + seeding.** Deploy is `git push dokku main`; the Dokku release runs
`db:release` (migrate + seed). The seed is **idempotent**: it skips the
destructive re-seed when the DB already has spots, so a normal deploy does not
wipe community data or re-fetch Street View photos (a Google API cost). When the
seed data itself changes (new scraper output, taxonomy), force a one-time
rebuild: set `SEED_FORCE=1` for that deploy, e.g.
`ssh dokku@weteling.com config:set devrijehond SEED_FORCE=1`, deploy, then
`config:unset devrijehond SEED_FORCE`.

## Infrastructure (AWS)

- **All AWS infra lives in the `devrijehond` account, ID `262517452192`.** Never
  use a personal account. Always operate via the SSO profile `devrijehond`
  (`AdministratorAccess`).
- If you don't have AWS access (expired token / `AccessDenied`), the user must
  run `aws sso login --profile devrijehond`. Ask them to, then verify with
  `aws sts get-caller-identity --profile devrijehond` (must report `262517452192`).
- Media (S3 + CloudFront + IAM users) is Terraform in `infra/terraform`
  (`envs/dev`, `envs/prod`). See `infra/terraform/README.md`. State is local and
  gitignored (holds IAM secret keys).

## Conventions

- **Commits: English, Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, scoped like `feat(db):`). Enforced by commitlint + husky. Wrap body at 100 chars.
- Imports: `@/` aliases inside apps; import API shapes from `@devrijehond/types`, never redefine them. The native app mirrors the API contract in its own Swift `Codable` types.
- Server Components by default in `apps/web`; `"use client"` only when needed. Server actions for admin mutations; route handlers for public/mobile APIs.
- After changing `schema.zmodel`: run `db:generate`, then restart dev.

## Status & gotchas

- **Scaffolded, not yet installed.** First `pnpm install` + the bootstrap in `docs/BUILD-STATUS.md`, then `pnpm typecheck` and fix the flagged `// TODO(verify):` spots (ZenStack v3 policy-plugin provider name, generated-client composite-key shapes, BetterAuth `signInSocial` body).
- Run `pnpm dlx @better-auth/cli generate` once to reconcile the BetterAuth core models (`User/Session/Account/Verification`) with the installed version.
- The vote recompute crosses users; move it to a queue job / `SECURITY DEFINER` trigger for release 1 (currently authDb with a raw-db fallback).
- **API base URL is a compile-time switch, never a leaked dev host.** The native app picks its base URL in `apps/ios-native/Sources/APIClient.swift` via `#if DEBUG`: DEBUG builds talk to `http://localhost:3030` (the simulator shares the Mac network and `http://localhost` is exempt from ATS), release builds talk to `https://api.devrijehond.nl`. Because the production URL is baked into the `#else` branch and `release-native.sh` archives the Release configuration, there is no env-var inlining step that could leak a `*.local` or `localhost` host into a TestFlight build. If a release build ever can't reach the API, check that the archive used the Release config (so `#if DEBUG` is false) before suspecting anything else.
