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

## External accounts

Secrets live in `.env.local` (local) and the deploy secrets, never in git.

| Service                                                             | Purpose                                                  | Account / access                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [AWS](https://identitycenter.amazonaws.com/ssoins-69875f1030ee29e4) | Media hosting: S3 + CloudFront + IAM (`infra/terraform`) | Account `devrijehond` **262517452192**, SSO profile `devrijehond` (`AdministratorAccess`), region `eu-west-1`. |
| [Resend](https://resend.com/)                                       | Magic-link + transactional email (`packages/email`)      | info@devrijehond.nl                                                                                            |
| [TransIP](https://www.transip.nl/cp/)                               | Domain registrar + DNS for `devrijehond.nl`              | TODO (account holder)                                                                                          |
| [Google Cloud](https://console.cloud.google.com/)                   | Google Sign-In (OAuth) + Maps JS API key                 | OAuth project `762592672284`. TODO (owning Google account)                                                     |
| [Apple Developer](https://developer.apple.com/account)              | iOS provisioning, TestFlight, App Store                  | Team `ND82KXRD2Q`, bundle `nl.devrijehond.app`                                                                 |
| [Expo / EAS](https://expo.dev/)                                     | Mobile builds, OTA updates, push                         | TODO (Expo org/project)                                                                                        |
| [GitHub](https://github.com/)                                       | Source repo + CI                                         | TODO (org/repo)                                                                                                |

## Dokku setup

```sh
dokku apps:create devrijehond
dokku domains:set devrijehond www.devrijehond.nl devrijehond.nl
dokku postgres:create devrijehond --image "postgis/postgis" --image-version "17-3.5-alpine"
dokku postgres:link devrijehond devrijehond
dokku ports:add devrijehond http:80:3000
dokku letsencrypt:enable devrijehond
```
