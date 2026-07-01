#!/usr/bin/env bash
set -euo pipefail

# Build + sign + upload the native Android app to Google Play (internal testing track).
# The Android counterpart of apps/ios-native/scripts/release-native.sh: one command,
# no console clicking. Uses the Gradle Play Publisher plugin, which reads the signing
# key from keystore.properties and the upload credentials from a Play service account.
#
# Prerequisites (one-time):
#   - apps/android/upload-keystore.jks + apps/android/keystore.properties (signing)
#   - secrets/play-service-account.json (a Play Console service account with the
#     "Release to testing tracks" permission), or PLAY_SERVICE_ACCOUNT_JSON pointing
#     at it.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT/apps/android"

CREDS="${PLAY_SERVICE_ACCOUNT_JSON:-$ROOT/secrets/play-service-account.json}"
if [ ! -f "$CREDS" ]; then
  echo "✗ Play service account JSON not found at: $CREDS" >&2
  echo "  Create one in Play Console (Users and permissions → invite a service" >&2
  echo "  account with release rights) and save the key there, or set" >&2
  echo "  PLAY_SERVICE_ACCOUNT_JSON to its path." >&2
  exit 1
fi
export PLAY_SERVICE_ACCOUNT_JSON="$CREDS"

if [ ! -f keystore.properties ] || [ ! -f upload-keystore.jks ]; then
  echo "✗ Missing upload-keystore.jks / keystore.properties (release signing)." >&2
  exit 1
fi

# Play requires a strictly higher versionCode on every upload; bump it before building.
CURRENT="$(sed -n -E 's/^VERSION_CODE=([0-9]+)$/\1/p' gradle.properties)"
: "${CURRENT:?VERSION_CODE missing in gradle.properties}"
NEXT=$((CURRENT + 1))
sed -i '' -E "s/^VERSION_CODE=.*/VERSION_CODE=$NEXT/" gradle.properties
echo "▸ versionCode $CURRENT → $NEXT"

echo "▸ Build + upload app bundle to Google Play (internal track)"
./gradlew publishReleaseBundle

VERSION_NAME="$(sed -n -E 's/^VERSION_NAME=(.+)$/\1/p' gradle.properties)"
echo "✓ Uploaded $VERSION_NAME ($NEXT) to the internal testing track."
