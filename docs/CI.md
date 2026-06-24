# CI & builds

The web app builds in **GitHub Actions** on the free runners. The native iOS app
is built and shipped from a Mac with a local script, not in CI. One workflow in
`.github/workflows`:

| Workflow | Runner | Trigger          | What it does                                                      |
| -------- | ------ | ---------------- | ----------------------------------------------------------------- |
| `ci.yml` | ubuntu | push to main, PR | install, `pnpm typecheck`, `pnpm lint`, `pnpm --filter web build` |

pnpm is pinned via `packageManager` in `package.json` (`pnpm@11.8.0`);
`pnpm/action-setup` picks it up. Build-script approval + `minimumReleaseAge`
live in `pnpm-workspace.yaml`, so CI installs match local.

## Web deploy

The web app deploys to **Dokku** (not GitHub Actions): `git push dokku main`.
The release phase resets + re-seeds the DB. See `docs/HANDOFF.md` and the Dokku
command list. The `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` build arg must be set on the
Dokku app (it is inlined at build time).

## Secrets / variables to set in GitHub

Repo → Settings → Secrets and variables → Actions.

**Secrets** for CI web build (optional):

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, so the built web map isn't a fallback
  notice. The build also works without it.

## Native iOS build → TestFlight

The native SwiftUI app (`apps/ios-native`) is built, signed, and uploaded to
TestFlight from a Mac, with no GitHub Actions step. The base URL is a
compile-time `#if DEBUG` switch in `Sources/APIClient.swift` (DEBUG →
`http://localhost:3030`, Release → `https://api.devrijehond.nl`), so there is no
env-var inlining and nothing to wire up in CI.

```sh
cd apps/ios-native && ./scripts/release-native.sh
```

The script generates the Xcode project with xcodegen, archives the Release
configuration, creates the App Store provisioning profile via the App Store
Connect API (`fastlane sigh`), exports with **manual signing** using your
imported Apple Distribution certificate, and uploads with `xcrun altool`.

It needs:

- `.env.local` at the repo root with `ASC_KEY_ID`, `ASC_ISSUER_ID`,
  `APPLE_TEAM_ID`, `APPLE_DIST_CERT_PASSWORD`.
- `secrets/AuthKey_<ASC_KEY_ID>.p8` (App Store Connect API key) and
  `secrets/Certificates.p12` (Apple Distribution cert).
- `xcodebuild`, `fastlane`, `jq`, `xcodegen` on PATH.

Why manual signing: an **App Manager** API key can't drive xcodebuild's
automatic cloud distribution signing (that needs Admin), so
`-allowProvisioningUpdates` failed at export with "Cloud signing permission
error / No profiles". Creating the profile via the API and signing manually with
the imported cert works with an App Manager key.

One-time Apple setup that had to be in place (all done): App ID
`nl.devrijehond.app` registered (with Sign In with Apple), the App Store Connect
app record created, and the API key with the App Manager role.

## Bundle identifiers

- iOS bundle id: `nl.devrijehond.app`
- URL scheme: `vrijehond`
