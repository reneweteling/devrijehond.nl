import { NextResponse } from 'next/server';

/**
 * GET /api/v1/app-config, runtime config the mobile app reads on boot. Drives
 * the force-update flow: if the running app's version is below
 * `minSupportedVersion`, the app shows a blocking "update required" screen.
 *
 * Values come from env so they can be bumped without an app release:
 *   APP_MIN_SUPPORTED_VERSION, APP_LATEST_VERSION, APP_IOS_URL, APP_ANDROID_URL.
 * Public, anonymous, short-cached.
 */
export const runtime = 'nodejs';

export function GET(): NextResponse {
  const body = {
    minSupportedVersion: process.env.APP_MIN_SUPPORTED_VERSION ?? '0.1.0',
    latestVersion: process.env.APP_LATEST_VERSION ?? '0.1.0',
    updateUrl: {
      ios: process.env.APP_IOS_URL ?? 'https://apps.apple.com/app/de-vrije-hond/id000000000',
      android:
        process.env.APP_ANDROID_URL ??
        'https://play.google.com/store/apps/details?id=nl.devrijehond.app',
    },
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
