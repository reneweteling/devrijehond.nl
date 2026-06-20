# CI & builds

All builds run in **GitHub Actions** on the free runners. No EAS / Expo cloud
builds (those cost credits). Three workflows in `.github/workflows`:

| Workflow             | Runner   | Trigger           | What it does                                                      |
| -------------------- | -------- | ----------------- | ----------------------------------------------------------------- |
| `ci.yml`             | ubuntu   | push to main, PR  | install, `pnpm typecheck`, `pnpm lint`, `pnpm --filter web build` |
| `mobile-android.yml` | ubuntu   | manual / `v*` tag | `expo prebuild` + Gradle → release APK artifact                   |
| `mobile-ios.yml`     | macos-26 | manual            | prebuild + pods + signed archive + export + TestFlight upload     |

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

**Variables** (non-secret):

- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_URL` — default to
  `https://www.devrijehond.nl` if unset.

**Secrets** for CI web build (optional):

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — so the built web map isn't a fallback
  notice. The build also works without it.

**Secrets** for a Play Store AAB (Android), when you're ready to ship:

- `ANDROID_KEYSTORE_BASE64` — `base64 -i release.keystore`
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

Then decode the keystore in the workflow, point `android/app/build.gradle`'s
release signingConfig at it, and switch the Gradle task to `bundleRelease`
(outputs `app/build/outputs/bundle/release/app-release.aab`).

**Signed iOS build → TestFlight** (`mobile-ios.yml`, `testflight` job). The
account is active, so wire it up:

1. In App Store Connect, create the app once: New App → iOS → bundle id
   `nl.devrijehond.app` (the app record must exist before the first upload).
2. Create an **App Store Connect API key** (Users and Access → Integrations →
   App Store Connect API, role App Manager). Note the Key ID + Issuer ID and
   download the `.p8` once.
3. Create/download an **Apple Distribution certificate** as a `.p12` (with a
   password). Signing assets/profiles are then managed automatically by
   `-allowProvisioningUpdates` using the API key.
4. Set these GitHub **secrets**:
   - `APPLE_TEAM_ID` — your 10-char Team ID.
   - `APPLE_DIST_CERT_P12` = `base64 -i dist.p12`, `APPLE_DIST_CERT_PASSWORD`.
   - `ASC_KEY_ID`, `ASC_ISSUER_ID`.
   - `ASC_API_KEY_P8` = `base64 -i AuthKey_XXXX.p8`.
5. Set the **variable** `IOS_RELEASE=true` to enable the `testflight` job (it's
   gated so it stays off until then).
6. Run the **iOS build** workflow (Actions → iOS build → Run workflow). It
   archives with automatic signing, exports an `.ipa`, and uploads it to
   TestFlight with `xcrun altool`.

The `compile` job (no-signing build) always runs and needs no secrets.

### Releasing to TestFlight

Working end to end. The fastest path is **local** (your Mac is quicker and the
GitHub macOS runners bill ~6 ct/min):

```sh
pnpm ios:release   # = apps/mobile/scripts/release-ios.sh
```

It prebuilds, pods, archives, creates the App Store provisioning profile via the
App Store Connect API (`fastlane sigh`), exports with **manual signing** using
your imported Apple Distribution certificate, and uploads with `xcrun altool`.
Needs `.env.local` (`ASC_KEY_ID` / `ASC_ISSUER_ID` / `APPLE_TEAM_ID`),
`secrets/AuthKey_<ASC_KEY_ID>.p8`, the distribution cert in your login keychain,
and `fastlane` + `jq`.

The CI fallback is the **iOS build** workflow (`mobile-ios.yml`, one `testflight`
job on `macos-26`), same steps. Why manual signing: an **App Manager** API key
can't drive xcodebuild's automatic cloud distribution signing (that needs
Admin), so `-allowProvisioningUpdates` failed at export with "Cloud signing
permission error / No profiles". Creating the profile via the API and signing
manually with the imported cert works with an App Manager key.

One-time Apple setup that had to be in place (all done): App ID
`nl.devrijehond.app` registered (with Sign In with Apple), the App Store Connect
app record created, and the API key with the App Manager role.

## Bundle identifiers

- iOS bundle id + Android package: `nl.devrijehond.app`
- Expo slug: `de-vrije-hond`, scheme: `vrijehond`
