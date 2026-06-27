import { NextResponse } from 'next/server';

/**
 * Apple App Site Association — serves the iOS Universal Links manifest at
 * `/.well-known/apple-app-site-association`.
 *
 * Apple fetches this file WITHOUT following redirects, over HTTPS, from every
 * domain in the app's Associated Domains entitlement (here: apex + www). It must
 * return 200 with `Content-Type: application/json`, no `.json` extension, no
 * redirect. The apex->www redirect in `proxy.ts` is bypassed for this path (see
 * the early pass-through there), so the file is served directly on both hosts.
 *
 * `appID` = "<teamID>.<bundleID>". The `paths` cover the crawlable spot URLs
 * (`/plek/<slug>` = POI, `/gebied/<slug>` = REGION) plus the magic-link
 * interstitial (`/verify-mobile`) so the email sign-in link opens the app
 * directly when installed (instead of the web interstitial hop).
 */
const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'ND82KXRD2Q.nl.devrijehond.app',
        paths: ['/plek/*', '/gebied/*', '/verify-mobile', '/verify-mobile*'],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
