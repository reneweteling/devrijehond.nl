#!/usr/bin/env bash
set -euo pipefail

# Build, sign and upload the iOS app to TestFlight from your Mac (faster + free
# than the GitHub macOS runners). Mirrors .github/workflows/mobile-ios.yml.
#
# Prerequisites (already in place for the maintainer):
#   - .env.local with ASC_KEY_ID, ASC_ISSUER_ID, APPLE_TEAM_ID
#   - secrets/AuthKey_<ASC_KEY_ID>.p8  (the App Store Connect API key)
#   - the Apple Distribution certificate in your login keychain
#   - Xcode, CocoaPods, fastlane, jq
#
# Run:  pnpm ios:release   (from apps/mobile, or: pnpm --filter mobile ios:release)

BUNDLE_ID="nl.devrijehond.app"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT/apps/mobile"

for tool in xcodebuild pod fastlane jq; do
  command -v "$tool" >/dev/null || {
    echo "✗ Missing '$tool'. Install it first (pod: 'gem install cocoapods', fastlane: 'brew install fastlane')." >&2
    exit 1
  }
done

# --- credentials from .env.local + secrets/ ---
set -a
# shellcheck disable=SC1091
. "$ROOT/.env.local"
set +a
: "${ASC_KEY_ID:?ASC_KEY_ID missing in .env.local}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID missing in .env.local}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID missing in .env.local}"
: "${APPLE_DIST_CERT_PASSWORD:?APPLE_DIST_CERT_PASSWORD missing in .env.local}"

# --- dedicated signing keychain so codesign never shows a GUI prompt ---
# Imports the distribution cert+key from secrets/Certificates.p12 into a
# throwaway keychain whose password we control, and grants codesign access via
# the partition list. Mirrors apple-actions/import-codesign-certs in CI.
echo "▸ Signing keychain"
KEYCHAIN="$HOME/Library/Keychains/devrijehond-signing.keychain-db"
KEYCHAIN_PWD="devrijehond-signing"
security delete-keychain "$KEYCHAIN" 2>/dev/null || true
security create-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN" # don't auto-lock for 6h
security unlock-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security import "$ROOT/secrets/Certificates.p12" -k "$KEYCHAIN" \
  -P "$APPLE_DIST_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
# Apple WWDR intermediates: without them the cert chain can't be built when the
# search list is the signing keychain alone, so the cert reads as an INVALID
# identity and fastlane/codesign find "0 valid identities".
for g in G3 G6; do
  curl -fsSL "https://www.apple.com/certificateauthority/AppleWWDRCA${g}.cer" \
    -o "/tmp/AppleWWDRCA${g}.cer" 2>/dev/null &&
    security import "/tmp/AppleWWDRCA${g}.cer" -k "$KEYCHAIN" 2>/dev/null || true
done
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PWD" "$KEYCHAIN" >/dev/null
# Search ONLY the signing keychain during the build, so codesign can't fall back
# to the login keychain's copy of the cert (which would pop a GUI prompt and
# hang a non-interactive build). The original search list is restored on exit.
ORIG_KEYCHAINS="$(security list-keychains -d user | sed 's/[" ]//g' | tr '\n' ' ')"
security list-keychains -d user -s "$KEYCHAIN"
# shellcheck disable=SC2064
trap "security list-keychains -d user -s $ORIG_KEYCHAINS 2>/dev/null; security delete-keychain '$KEYCHAIN' 2>/dev/null || true" EXIT

KEYFILE="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
mkdir -p "$(dirname "$KEYFILE")"
cp "$ROOT/secrets/AuthKey_${ASC_KEY_ID}.p8" "$KEYFILE"
jq -n --arg kid "$ASC_KEY_ID" --arg iss "$ASC_ISSUER_ID" --arg key "$(cat "$KEYFILE")" \
  '{key_id:$kid, issuer_id:$iss, key:$key, in_house:false}' >/tmp/asc_api_key.json

# The committed apps/mobile/.env carries these EXPO_PUBLIC_* values, so the Xcode
# "Bundle React Native" phase inlines them deterministically (it loads .env even
# without NODE_ENV, and never the gitignored .env.development.local localhost
# URL). The exports below are a belt-and-suspenders default. NOTE: do NOT set
# NODE_ENV=production here, it breaks `expo prebuild`'s Info.plist mods.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.devrijehond.nl}"
export EXPO_PUBLIC_AUTH_URL="${EXPO_PUBLIC_AUTH_URL:-https://api.devrijehond.nl}"
# Google web OAuth client id (public, not a secret) for native Google Sign-In.
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-762592672284-cr47iv5jq6d0p2ghvmrcrf1lar90vpiq.apps.googleusercontent.com}"
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-762592672284-8atreoupa0ic702gnrg61bds9h88qrmp.apps.googleusercontent.com}"

# Wipe the Metro transform cache so a stale dev transform (e.g. config.ts with
# EXPO_PUBLIC_API_URL=localhost from a prior `expo run:ios`) can NEVER leak its
# inlined local URL into the release bundle.
echo "▸ Clear Metro / Expo caches"
rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* node_modules/.cache 2>/dev/null || true

echo "▸ Prebuild (regenerate ios/)"
pnpm exec expo prebuild -p ios --no-install

echo "▸ Pods"
(cd ios && pod install)

# Archive WITHOUT signing (no cert needed, no keychain prompt, no dev-cert
# requirement). All signing happens at export with the distribution cert + App
# Store profile.
echo "▸ Archive (unsigned)"
(cd ios && xcodebuild \
  -workspace DeVrijeHond.xcworkspace \
  -scheme DeVrijeHond \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/DeVrijeHond.xcarchive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  archive)

echo "▸ App Store profile + export (manual signing)"
(cd ios
  fastlane sigh \
    --api_key_path /tmp/asc_api_key.json \
    --app_identifier "$BUNDLE_ID" \
    --platform ios \
    --output_path /tmp/profiles
  PROFILE_PATH="$(ls /tmp/profiles/*.mobileprovision | head -1)"
  PROFILE_NAME="$(security cms -D -i "$PROFILE_PATH" | plutil -extract Name raw -)"
  echo "  profile: $PROFILE_NAME"
  cat >ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict><key>${BUNDLE_ID}</key><string>${PROFILE_NAME}</string></dict>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
  xcodebuild -exportArchive \
    -archivePath build/DeVrijeHond.xcarchive \
    -exportOptionsPlist ExportOptions.plist \
    -exportPath build/ipa)

echo "▸ Upload to TestFlight"
(cd ios && xcrun altool --upload-app --type ios \
  -f "$(ls build/ipa/*.ipa | head -1)" \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID")

echo "✓ Uploaded to TestFlight. It appears under TestFlight after Apple finishes processing."
