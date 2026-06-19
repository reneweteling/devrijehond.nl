# CLAUDE.md

De Vrije Hond — community-driven map of dog-friendly spots in the Netherlands.
Expo (iOS + Android) app + Next.js app that is **both the public website and the
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
- **apps/mobile** — Expo, native-first (`@expo/ui`, native tabs, `expo-symbols`, `react-native-maps`). Consumes the API only via the generated client.
- **packages/db** — ZenStack v3 schema + **access policies** over Prisma, on **PostGIS** Postgres. The heart of the app.
- **packages/auth** — BetterAuth: native Apple/Google + **magic link via HTTPS interstitial**.
- **packages/types** — zod DTOs + OpenAPI registry (the API contract).
- **packages/api-client** — Orval-generated TanStack Query client (consumed by mobile).
- **packages/server** — request context (`getContext`, `requireAuth`, `withContext`), raw PostGIS pool, logger.
- **packages/email** (Resend) · **packages/s3** (uploads).

## Key rules

- **Community verification is the core model.** A spot is published immediately as `UNVERIFIED`. Votes are weighted by voter reputation. `netScore >= +5` → `VERIFIED`; `denyCount >= 3` → `HIDDEN` (**hide takes precedence** if both fire). Auto-removal/hide surfaces to the admin safety-net. Thresholds are constants in `apps/web/.../lib/verification.ts` (`VERIFY_NET_SCORE`, `HIDE_DENY_COUNT`). No moderators in normal operation; the admin only handles hidden/reported/contested.
- **Vote integrity**: one vote per user per spot (DB unique), submitter can't vote on own spot (policy + check), voter must have a proximity proof, weight snapshots reputation at vote time.
- **Policies, not vibes.** All application data access goes through `authDb(user)` / `anonDb()` (ZenStack `$setAuth`). Only the BetterAuth adapter + migrations/seed use the raw `db`. **Mobile never imports the db client** — data only via the HTTP client.
- **Public vs `/me/*` split.** `/api/v1/...` = anonymous, cacheable, no auth at the edge. `/api/v1/me/...` = personalised, CDN-bypass; auth is a per-route decision. Never authenticate a public cache key.
- **Geometry is PostGIS.** `Spot.geom` is `geometry(...,4326)` (Unsupported in Prisma); `lat`/`lng` mirror the centroid. Spatial queries (bbox, nearby-radius proximity gate, duplicate detection) are **raw SQL** via `packages/server`'s pg pool — not the ORM.
- **Taxonomy is data, community-growable, admin-curated.** Categories + amenities are rows with `visible`/`sortOrder`/`status` (`ACTIVE`|`PROPOSED`). New community terms land as `PROPOSED`; admin promotes/merges. Don't hardcode categories.
- **Auth deep-link**: the magic-link email links to an HTTPS `/verify-mobile` interstitial (Gmail won't rewrite it), which hops to the app's `vrijehond://` / `exp://` deep link. Native Apple/Google exchange an idToken at `/api/auth/mobile/{apple,google}-native` for a bearer token stored in SecureStore.
- **Native-first on mobile.** Prefer `@expo/ui` (SwiftUI/Compose), native tabs, `expo-symbols`, native map over hand-rolled RN. Reach for pure RN only when no native component fits.
- **SSR for SEO**: each spot is a crawlable server-rendered URL with `generateMetadata`.

## Commands

```sh
pnpm install
pnpm db:up                                    # PostGIS via docker compose
pnpm --filter @devrijehond/db db:generate     # zen generate
pnpm --filter @devrijehond/db db:migrate
pnpm --filter @devrijehond/db db:seed
pnpm --filter web dev                         # serves /api/v1/openapi.json
pnpm --filter @devrijehond/api-client snapshot # then orval generate
pnpm dev          # turbo: web + mobile
pnpm typecheck    # tsc across the workspace
pnpm lint
```

Mobile dev loop: local Metro + iOS simulator (`cd apps/mobile && pnpm exec expo start --ios`).

## Conventions

- **Commits: English, Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, scoped like `feat(db):`). Enforced by commitlint + husky. Wrap body at 100 chars.
- Imports: `@/` aliases inside apps; import API shapes from `@devrijehond/types`, never redefine them mobile-side.
- Server Components by default in `apps/web`; `"use client"` only when needed. Server actions for admin mutations; route handlers for public/mobile APIs.
- After changing `schema.zmodel`: run `db:generate`, then restart dev.
- `EXPO_PUBLIC_*` via literal `process.env.NAME` access only (Babel inlines literal keys).

## Status & gotchas

- **Scaffolded, not yet installed.** First `pnpm install` + the bootstrap in `docs/BUILD-STATUS.md`, then `pnpm typecheck` and fix the flagged `// TODO(verify):` spots (ZenStack v3 policy-plugin provider name, generated-client composite-key shapes, BetterAuth `signInSocial` body, swap mobile to generated Orval hooks).
- Run `pnpm dlx @better-auth/cli generate` once to reconcile the BetterAuth core models (`User/Session/Account/Verification`) with the installed version.
- The vote recompute crosses users; move it to a queue job / `SECURITY DEFINER` trigger for release 1 (currently authDb with a raw-db fallback).
