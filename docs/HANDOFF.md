# Handoff

Pick-up point for continuing De Vrije Hond in Claude Code. Read `CLAUDE.md`
first (it auto-loads), then this.

## Where we are

Project arc: **wireframes → design → build**. Wireframes and design are done;
the build foundation is **scaffolded, bootstrapped, and green**: it installs,
code-generates, migrates/seeds, typechecks (`pnpm typecheck` → 11/11), and lints
(`pnpm lint` → 9/9). The mobile app is wired to the generated API client and the
verification gate is smoke-tested.

What landed (all the old `TODO(verify)` code markers are resolved):

- Node pinned via `.tool-versions` (24.13.1); `apps/mobile` Expo/RN deps aligned
  to the installed SDK 55 bundle.
- DB: access-policy plugin provider is `@zenstackhq/plugin-policy`; policies are
  enforced by `PolicyPlugin` installed with `$use` on a dedicated `policyDb`
  (raw `db` stays policy-free for BetterAuth + migrations/seed); `anonDb` passes
  `undefined`. Init migration applied + seed run (admin `rene@weteling.com`, 6
  categories, 8 amenities, sample spot `cafe-de-waterbak`).
- OpenAPI: `@asteasolutions/zod-to-openapi` bumped to ^8 (zod 4). Component
  schemas now carry a refId via `.openapi('Name', …)` so nested uses emit
  `$ref` instead of inlining (snapshot 121KB → 39KB). The Orval `api-client`
  has clean types (`items: SpotSummary[]`, …).
- Mobile: `apps/mobile/lib/api.ts` delegates to the generated fetchers and
  re-exports the contract types; no hand-maintained DTO copies.
- Verification gate smoke-tested at the data+policy+logic level: new spot
  UNVERIFIED, owner can't vote own spot, 5 weighted confirms → VERIFIED, one
  vote per user (DB unique), 3 denies → HIDDEN, anon can't read HIDDEN, plus
  the threshold/hide-precedence/REMOVED-sticky logic.
- DB host port is **5544** (not 5432) to avoid local conflicts.

The DB container is up (`docker compose ps`); `.env.local` exists with a
generated `BETTER_AUTH_SECRET` (other secrets still blank — see BUILD-STATUS).

## Immediate next steps (in order)

1. Fill real secrets in `.env.local` (Apple/Google/Resend/S3) + Maps API keys in
   `apps/mobile/app.json`, then do a real end-to-end run: magic-link sign-in
   (needs `RESEND_API_KEY`) → submit a spot → vote it through. The data-layer
   gate is proven; what's untested is the HTTP/auth shell, because a valid
   bearer/session token needs a real better-auth sign-in (a raw `Session` row
   insert does NOT authenticate — better-auth signs the token; `requireAuth`
   correctly 401s an invalid token).
2. Move the cross-user vote recompute off the request path — it's the remaining
   `TODO(verify)` in `apps/web/app/api/v1/me/spots/[id]/vote/route.ts` (queue
   job / `SECURITY DEFINER` trigger for R1).
3. Finish the stubbed/lighter handlers + mobile sheets listed below.

Local toolchain note: Node/pnpm run via asdf. Prefix commands with
`ASDF_NODEJS_VERSION=24.13.1` (or `asdf shell nodejs 24.13.1`) and use
`corepack pnpm`. Generators that need env (`db:migrate`, `db:seed`, the OpenAPI
route) read `.env.local`; the snapshot was taken from `http://localhost:3000`
(the `https://devrijehond.local` host in `package.json`/`input.ts` assumes a
reverse proxy that isn't set up locally).

## What's fully implemented vs stubbed

**Fully (correct, not stubs):** ZenStack schema + community-verification
policies; `GET /api/v1/spots` (PostGIS bbox + filters), `GET spots/[slug]`,
`POST /me/spots` (geometry insert), `POST /me/spots/[id]/vote` (weighted
recompute + verify/hide thresholds), `GET /api/v1/openapi.json`; BetterAuth +
native bridge + `/verify-mobile` interstitial; SSR spot pages; admin queue +
taxonomy with action log; mobile auth + map + spot-detail.

**Stubbed / lighter (finish these):** `categories`/`amenities` filtering edge
cases; `me/reviews`, `me/dogs`, `me` profile, `reports`, `feature-requests`
handlers (working but thin); mobile add-flow details, edit-profile, add-dog and
report sheets; a "my submissions" endpoint + screen; polygon geometry on the map
DTO; `expo-location` for centring + the vote proximity proof; real Maps API keys.

## Open product/design decisions (not blocking)

- Final **logo/wordmark** (currently text + paw icon); curated production photo
  set; **dark-mode** palette variant. (`docs/design/brand-direction.md`.)
- Reputation/vote-weight **formula** + cap; proximity-gate UX (live check vs
  recorded "you were here"); hero photo fallback provider (Google Places vs
  Mapillary vs generated map thumb). (`docs/wireframes-mobile.md` §10.)
- Move the cross-user vote recompute to a queue job / DB trigger for R1.

## Reference

- Architecture + decisions: `docs/architecture/setup-blueprint.md`
- Product spec + data model: `docs/wireframes-mobile.md`
- Visual identity + icons: `docs/design/brand-direction.md`; target UI: `docs/design/hifi-prototype.html`
- Bootstrap + verify items: `docs/BUILD-STATUS.md`
- Reference implementation to mirror patterns from: the sibling `dekmantel` repo
  (`~/projects/bravoure/dekmantel`) — same chassis (pnpm/turbo, ZenStack v3,
  Orval, BetterAuth). Mirror shape; never copy code blindly.
