#!/usr/bin/env bash
set -euo pipefail

# Build + sign + upload the NATIVE SwiftUI app to TestFlight. Mirrors the proven
# signing flow of apps/mobile/scripts/release-ios.sh (unsigned archive, then sign
# at export with the App Store profile), but for the xcodegen project. Uses the
# existing nl.devrijehond.app App ID + ASC app, so no new provisioning is needed.

BUNDLE_ID="nl.devrijehond.app"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT/apps/ios-native"

for tool in xcodebuild fastlane jq xcodegen; do
  command -v "$tool" >/dev/null || { echo "✗ Missing '$tool'." >&2; exit 1; }
done

set -a
# shellcheck disable=SC1091
. "$ROOT/.env.local"
set +a
: "${ASC_KEY_ID:?ASC_KEY_ID missing in .env.local}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID missing in .env.local}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID missing in .env.local}"
: "${APPLE_DIST_CERT_PASSWORD:?APPLE_DIST_CERT_PASSWORD missing in .env.local}"

echo "▸ Signing keychain"
KEYCHAIN="$HOME/Library/Keychains/devrijehond-signing.keychain-db"
KEYCHAIN_PWD="devrijehond-signing"
security delete-keychain "$KEYCHAIN" 2>/dev/null || true
security create-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security import "$ROOT/secrets/Certificates.p12" -k "$KEYCHAIN" \
  -P "$APPLE_DIST_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
for g in G3 G6; do
  curl -fsSL "https://www.apple.com/certificateauthority/AppleWWDRCA${g}.cer" \
    -o "/tmp/AppleWWDRCA${g}.cer" 2>/dev/null &&
    security import "/tmp/AppleWWDRCA${g}.cer" -k "$KEYCHAIN" 2>/dev/null || true
done
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PWD" "$KEYCHAIN" >/dev/null
ORIG_KEYCHAINS="$(security list-keychains -d user | sed 's/[" ]//g' | tr '\n' ' ')"
security list-keychains -d user -s "$KEYCHAIN"
# shellcheck disable=SC2064
trap "security list-keychains -d user -s $ORIG_KEYCHAINS 2>/dev/null; security delete-keychain '$KEYCHAIN' 2>/dev/null || true" EXIT

KEYFILE="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
mkdir -p "$(dirname "$KEYFILE")"
cp "$ROOT/secrets/AuthKey_${ASC_KEY_ID}.p8" "$KEYFILE"
jq -n --arg kid "$ASC_KEY_ID" --arg iss "$ASC_ISSUER_ID" --arg key "$(cat "$KEYFILE")" \
  '{key_id:$kid, issuer_id:$iss, key:$key, in_house:false}' >/tmp/asc_api_key.json

echo "▸ Generate Xcode project"
xcodegen generate

echo "▸ Archive (unsigned)"
xcodebuild \
  -project DeVrijeHondNative.xcodeproj \
  -scheme DeVrijeHondNative \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/DeVrijeHondNative.xcarchive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  archive

echo "▸ App Store profile + export (manual signing)"
fastlane sigh \
  --api_key_path /tmp/asc_api_key.json \
  --app_identifier "$BUNDLE_ID" \
  --platform ios \
  --output_path /tmp/profiles_native
PROFILE_PATH="$(ls /tmp/profiles_native/*.mobileprovision | head -1)"
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
  -archivePath build/DeVrijeHondNative.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/ipa

echo "▸ Upload to TestFlight"
xcrun altool --upload-app --type ios \
  -f "$(ls build/ipa/*.ipa | head -1)" \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID"

echo "✓ Uploaded native build to TestFlight."
