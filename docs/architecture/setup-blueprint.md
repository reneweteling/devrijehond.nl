# De Vrije Hond — Architecture & Setup Blueprint

**Status:** Draft v1 — mirrors the `dekmantel` stack, adapted for De Vrije Hond.
**Reference project:** `/Users/rene/projects/bravoure/dekmantel`

This captures the setup we mirror from dekmantel, where we deliberately diverge, and the open decisions. Scaffolding follows after wireframes + design sign-off.

---

## 1. The dekmantel blueprint (what we copy)

| Concern | dekmantel | We mirror? |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo (`apps/*`, `packages/*`) | Yes |
| Package manager | pnpm (`onlyBuiltDependencies` for zen/esbuild/sharp) | Yes |
| ORM + policies | ZenStack v3 (`zen` CLI, `@zenstackhq/orm` 3.7) over Prisma + Postgres | Yes — **but use policies from day 1** (see §3) |
| Validation | zod 4 | Yes |
| API | Next.js App Router route handlers under `app/api/v1/*` | Yes |
| OpenAPI | DTOs as zod in `packages/types`, registered, compiled via `@asteasolutions/zod-to-openapi`, served at `/api/v1/openapi.json` | Yes |
| Client gen | Orval `tags-split` → TanStack Query (`react-query`) client + custom fetcher (bearer auth, retry, 401 handling) in `packages/api-client` | Yes |
| Mobile | Expo app consuming the generated client | Yes |
| Auth | Better Auth (Prisma adapter on the ZenStack client, bearer plugin for mobile, native Apple/Google idToken exchange) | Yes — **including magic link via HTTPS interstitial** (see §5) |
| Sessions | 30-day expiry, sliding refresh, role on session, UUID ids, cookie cache | Yes |
| Tooling | husky + lint-staged + commitlint, prettier, vitest, Playwright (`apps/e2e`), Sentry | Yes (adopt as-is) |

---

## 2. Proposed monorepo layout

```
devrijehond.nl/
├─ apps/
│  ├─ web/          Next.js — PUBLIC website + the API (/api/v1/*, /api/auth/*)
│  ├─ mobile/       Expo (iOS + Android)
│  └─ e2e/          Playwright
├─ packages/
│  ├─ db/           ZenStack v3 schema.zmodel + generated client + seed + policies
│  ├─ auth/         Better Auth instance + client
│  ├─ types/        zod DTOs + OpenAPI registry (the API contract)
│  ├─ api-client/   Orval-generated TanStack Query client (consumed by mobile)
│  ├─ server/       shared request context + logger
│  ├─ email/        transactional email (OTP code, notifications)
│  ├─ media/ + s3/  image upload + storage (avatars, dog photos, spot photos)
│  └─ queue/        background jobs (verification recompute, photo processing)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ tsconfig.base.json
```

**Key difference from dekmantel:** dekmantel's Next app is `apps/admin` (a CMS that *also* serves the mobile API). For De Vrije Hond, `apps/web` is the **public website** (the map + spot pages, SEO) *and* the API for both mobile and web. The web admin (moderation safety-net, taxonomy curation) is a protected section of the same `apps/web` (admin-role routes), not a separate app — simpler, one deploy.

---

## 3. Data + policies (ZenStack)

ZenStack v3: `schema.zmodel` is the single source. `zen generate` emits the TypeScript client, the Prisma schema for migrations, and zod schemas via the runtime factory. App code uses the **enhanced client** (`authDb`) that enforces access policies; only the Better Auth adapter + migrations use the raw `db`.

**Divergence:** dekmantel *deferred* `@@allow` / `@@deny` policies. We use them **from the start**, because our entire model is policy-shaped:

- a spot is readable by everyone unless `status = hidden` (then admin-only);
- only authenticated users can create spots;
- a vote is creatable only if the voter is not the submitter, hasn't voted on that spot, and has a proximity proof;
- only admins can restore/force-verify/remove and edit the taxonomy.

These map almost 1:1 onto `@@allow`/`@@deny` rules + `auth()` — exactly why you wanted ZenStack. The verification thresholds (net ≥ +5 → verified, ≥ 3 denials → hidden) run as a derived recompute (DB trigger or a `queue` job on each vote), not as a policy.

**Geo:** regions are polygons, POIs are points; we need viewport-bbox queries, nearby-radius (the vote proximity gate), and duplicate-proximity detection. dekmantel stored a geofence as plain `Json` (lat/lng array) — fine for drawing, weak for spatial queries. Recommendation: **PostGIS** (`geometry`/`geography` columns + GiST index) so proximity and bbox are real indexed queries. Decision flagged in §7.

---

## 4. API + client-generation pipeline

1. Define request/response DTOs as zod schemas in `packages/types/src/dto/*`, register them in an OpenAPI registry.
2. Implement route handlers in `apps/web/app/api/v1/*` validating against those DTOs, calling `authDb`.
3. Serve the compiled spec at `/api/v1/openapi.json`.
4. `packages/api-client` runs Orval against that spec → `react-query` hooks with a custom fetcher (attaches the bearer token, handles 401).
5. The Expo app imports the generated hooks; the public website can use server components hitting `authDb` directly or the same hooks.

Mirror dekmantel's `snapshot` script: `curl …/openapi.json > openapi.snapshot.json && pnpm generate` so CI regenerates the client from a committed contract.

---

## 5. Auth (the deep-link decision)

Provider set (same intent as dekmantel):

- **Apple** — native via `expo-apple-authentication`; idToken POSTed to `/api/auth/mobile/apple-native`, verified against Apple's keys (App Store guideline 4.8 requires it when offering Google).
- **Google** — native via `@react-native-google-signin` (Android needs the native picker); idToken → `/api/auth/mobile/google-native`.
- **Email** — see below.

**Mobile session plumbing** (copy from dekmantel): Better Auth `bearer()` plugin emits a `set-auth-token` header; the Expo app stores it in SecureStore and sends `Authorization: Bearer …`. Mobile is bearer-only (`credentials: 'omit'`); web uses cookies.

### Email: magic link via HTTPS interstitial — DECIDED

We use Better Auth's `magicLink` plugin, mirroring dekmantel. The deep-link fragility (Gmail/Outlook/Yahoo **strip `href` on non-HTTP(S) schemes**, so a raw `vrijehond://verify` link renders as a dead span) is solved the same way dekmantel solved it: the email links to an **HTTPS interstitial** page (e.g. `/verify-mobile`) on our own domain.

This directly addresses the original `vrijehond://` rewriting concern: **the link in the email is plain HTTPS**, which Gmail does not rewrite. The interstitial then detects the platform and either hops to the app's deep link (mobile) or shows an "open on your phone" fallback (desktop). The one-time token is forwarded verbatim; mobile's `verifyMagicLink` captures the bearer token + cookie itself.

Everything else from dekmantel's auth (trusted origins incl. `vrijehond://` and `exp://`, role on session, UUID ids, rate-limit on `/sign-in/*` and `/magic-link/verify`, account linking for Apple/Google onto the same email, the bearer-token mobile path) carries over unchanged.

---

## 6. What we drop from dekmantel

Dekmantel-specific subsystems we do **not** need: Paylogic ticketing + Cognito federation, the shopping/storefront API, festival editions/lineup/schedule. We keep the chassis (monorepo, ZenStack, Orval, Better Auth core, email, media/s3, queue) and replace the domain models with ours (regions, POIs, categories, amenities, votes, reviews, reports, dogs, feature requests).

---

## 6b. Mobile UI — native-first (`@expo/ui`)

Build principle (from experience): **native UI primitives feel and perform better than pure React Native views.** Prefer Expo's native components over hand-rolled RN where one exists.

- **`@expo/ui`** (~SDK 56) renders real **SwiftUI** (iOS) / **Jetpack Compose** (Android) components from React, with a **Universal** cross-platform set and **drop-in replacements** for popular RN community libraries. Use these for inputs, lists, sheets, pickers, segmented controls, switches, etc.
- **Native navigation**: Expo Router's **Native Tabs** (UITabBar / BottomNavigationView) and native Stack — not a JS-drawn tab bar.
- **Icons**: `expo-symbols` (SF Symbols on iOS) for a native feel; Material equivalents on Android. The Tabler names in the design docs are the web/mockup reference — map them to SF Symbol / Material names per platform (see brand-direction §6).
- **Maps**: native map (`react-native-maps`, or Expo `Maps` ALPHA) — the heavy interactive surface must be native.
- Reach for a pure-RN custom view only when no native component fits; keep those the exception. (Note the dekmantel scar: a new native/Expo module needs a dev-client rebuild, so during hot-iteration prefer components already in the build.)

## 7. Decisions

All locked in:

1. **Email auth → magic link via HTTPS interstitial** (mirror dekmantel; HTTPS link in the email so Gmail doesn't rewrite, interstitial hops to the app). §5.
2. **Geo → PostGIS** (`geometry`/`geography` + GiST index) for proximity gate, duplicate detection, and viewport bbox. Adds the PostGIS extension + migration setup.
3. **One `apps/web`** = public site + API + admin-role-gated section. One deploy.
4. **Public website → SSR for SEO.** Each spot (region + POI) is a server-rendered, crawlable URL (e.g. `/plek/<slug>`, `/gebied/<slug>`); the map view can hydrate client-side over the same API. Spot pages render verified content for indexing.
5. **Tool versions → latest at scaffold time** (not pinned to dekmantel's Next 16 / Expo SDK 54 / ZenStack 3.7). Lock exact versions when scaffolding.
6. **Local infra → Docker compose** with a PostGIS Postgres image (mirror dekmantel's compose), plus husky/commitlint/prettier/vitest.

→ Next: finish design, then scaffold `packages/db` (schema + policies) + `apps/web` API + `packages/auth` first, generate the client, then build screens against it.
