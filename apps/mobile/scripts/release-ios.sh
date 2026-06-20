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

KEYFILE="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
mkdir -p "$(dirname "$KEYFILE")"
cp "$ROOT/secrets/AuthKey_${ASC_KEY_ID}.p8" "$KEYFILE"
jq -n --arg kid "$ASC_KEY_ID" --arg iss "$ASC_ISSUER_ID" --arg key "$(cat "$KEYFILE")" \
  '{key_id:$kid, issuer_id:$iss, key:$key, in_house:false}' >/tmp/asc_api_key.json

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://www.devrijehond.nl}"
export EXPO_PUBLIC_AUTH_URL="${EXPO_PUBLIC_AUTH_URL:-https://www.devrijehond.nl}"

echo "▸ Prebuild (regenerate ios/)"
pnpm exec expo prebuild -p ios --no-install

echo "▸ Pods"
(cd ios && pod install)

echo "▸ Archive"
(cd ios && xcodebuild \
  -workspace DeVrijeHond.xcworkspace \
  -scheme DeVrijeHond \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/DeVrijeHond.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEYFILE" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
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
