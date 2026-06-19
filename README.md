# De Vrije Hond

Community-driven map of dog-friendly spots in the Netherlands — off-leash zones,
dog-friendly horeca, wash stations, swim beaches, shops and drinking points.
Content is submitted by users and **verified by the community** (no moderators):
a spot goes live immediately as _unverified_ and reaches _verified_ once it
collects a net weighted score of +5; it is auto-hidden after 3 denials and
surfaced to an admin safety-net.

## Stack

- **apps/web** — Next.js (App Router): public SSR website + API for web & mobile + admin section.
- **apps/mobile** — Expo (iOS + Android), native-first (`@expo/ui`).
- **packages/db** — ZenStack v3 schema + access policies over Prisma, on PostGIS Postgres.
- **packages/auth** — BetterAuth (native Apple/Google + magic link via HTTPS interstitial).
- **packages/types** — zod DTOs + OpenAPI registry (the API contract).
- **packages/api-client** — Orval-generated TanStack Query client (consumed by mobile).
- **packages/email**, **packages/s3** — transactional email, object storage.

See `docs/architecture/setup-blueprint.md` for the full architecture and decisions,
`docs/wireframes-mobile.md` for the product spec, and `docs/design/` for the visual
direction and clickable prototypes.

## Getting started

```sh
pnpm install
pnpm db:up                 # start PostGIS
cp .env.example .env.local # fill in secrets
pnpm --filter @devrijehond/db db:migrate
pnpm --filter @devrijehond/db db:seed
pnpm dev                   # turbo runs web + mobile
```

## Conventions

- Commits: **English, Conventional Commits** (enforced by commitlint + husky).
- Imports: `@/` aliases inside apps; import API shapes from `@devrijehond/types`.
- Server Components by default in `apps/web`; `"use client"` only when needed.
- Mobile never imports the db client — all data access via the generated HTTP client.

## Dokku setup

dokku apps:create devrijehond
dokku domains:set devrijehond www.devrijehond.nl devrijehond.nl
dokku ports:add devrijehond http:80:3000
dokku letsencrypt:enable devrijehond
