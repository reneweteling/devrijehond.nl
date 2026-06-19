# Handoff

Pick-up point for continuing De Vrije Hond in Claude Code. Read `CLAUDE.md`
first (it auto-loads), then this.

## Where we are

Project arc: **wireframes → design → build**. Wireframes and design are done;
the build foundation is **scaffolded** (8 packages + 2 apps, ~120 source files)
but has **not been installed, code-generated, or typechecked** — that's your
first job locally (the build ran in a sandbox that couldn't `pnpm install`).

Git: only the initial `chore: initialize monorepo skeleton` commit landed (the
sandbox's network mount blocked git locks). Everything else is uncommitted in
the working tree — run `git add -A && git commit -m "feat: scaffold packages and apps"`.

## Immediate next steps (in order)

1. `git add -A && git commit` the scaffold (see above).
2. Follow `docs/BUILD-STATUS.md` §2–§6: `pnpm install`, `@better-auth/cli generate`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, web dev, api-client `snapshot`.
3. `pnpm typecheck` → fix the `// TODO(verify):` markers (grep for them). Most are ZenStack v3 generated-client shapes, the BetterAuth `signInSocial` body, and the access-policy plugin provider name.
4. Once the OpenAPI snapshot + Orval generate succeed, swap `apps/mobile/lib/api.ts` hand-wired calls for the generated hooks.
5. Run web + mobile, smoke-test the gate flows: submit a spot → it's `UNVERIFIED` → vote it to `VERIFIED` (+5) / `HIDDEN` (3 denials).

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
