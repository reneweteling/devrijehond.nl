# CI & builds

All builds run in **GitHub Actions** on the free runners. No EAS / Expo cloud
builds (those cost credits). Three workflows in `.github/workflows`:

| Workflow             | Runner   | Trigger           | What it does                                                      |
| -------------------- | -------- | ----------------- | ----------------------------------------------------------------- |
| `ci.yml`             | ubuntu   | push to main, PR  | install, `pnpm typecheck`, `pnpm lint`, `pnpm --filter web build` |
| `mobile-android.yml` | ubuntu   | manual / `v*` tag | `expo prebuild` + Gradle → release APK artifact                   |
| `mobile-ios.yml`     | macos-15 | manual            | `expo prebuild` + pods + `xcodebuild` (no-signing compile build)  |

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

### iOS build status (handoff)

The CI build now gets all the way through: `pnpm install`, prebuild, `pod
install` (with `use_modular_headers!`), and the signed **Archive** all succeed
on the `macos-26` runner (Xcode 26 / Swift 6.2). Solved along the way: the
Swift-6.2 toolchain (macos-26), Google-Sign-In `AppCheckCore` modular headers,
the distribution `.p12` (cert + key), and `Cannot find module
@expo/config-plugins` (declared as a direct dep of `apps/mobile`).

The only remaining failure is **Export IPA**:

```
error: exportArchive Cloud signing permission error
error: exportArchive No profiles for 'nl.devrijehond.app' were found
```

That is Apple-account setup, do this once in your account:

1. **Register the App ID**: developer.apple.com → Certificates, Identifiers &
   Profiles → Identifiers → `+` → App IDs → bundle id `nl.devrijehond.app`
   (enable the capabilities the app uses: Sign In with Apple, Associated
   Domains if used).
2. **Create the app record**: appstoreconnect.apple.com/apps → `+` → New App →
   iOS → bundle id `nl.devrijehond.app`.
3. **API-key role**: the App Store Connect API key (`ASC_KEY_ID`) must have the
   **App Manager** (or Admin) role so `-allowProvisioningUpdates` can create the
   App Store distribution profile during export. Recreate the key with that role
   if needed and update the `ASC_API_KEY_P8` / `ASC_KEY_ID` / `ASC_ISSUER_ID`
   secrets.

Then re-run the **iOS build** workflow; archive + export + TestFlight upload
should complete.

## Bundle identifiers

- iOS bundle id + Android package: `nl.devrijehond.app`
- Expo slug: `de-vrije-hond`, scheme: `vrijehond`
