# API caching & CDN

The API is built to sit behind a CDN with zero code changes: the responses
already carry the right `Cache-Control` headers, so the only thing left is to
point a CDN at the origin.

## What the origin already sends

- Public reads (`/api/v1/spots`, `/spots/:slug`, `/spots/map`, `/categories`,
  `/amenities`, `/feature-requests`, `/geocode`, the SSR spot pages):
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`.
  A CDN caches them for 60s and may serve a stale copy for up to 10 min while it
  revalidates in the background. This is what lets us absorb a traffic spike.
- Personalised / write routes (`/api/v1/me/**`) and every error:
  `Cache-Control: no-store`. These are a straight passthrough, never cached.
- Auth (`/api/auth/**`): passthrough (BetterAuth sets its own no-store headers).

These come from the `ok()` / `error()` helpers in
`apps/web/lib/api-response.ts` (`DEFAULT_PUBLIC_CACHE_CONTROL` /
`NO_STORE_CACHE_CONTROL`). Don't call `NextResponse.json` directly in a v1 route;
go through the helpers so the caching contract stays correct.

## Putting a CDN in front

Any CDN that honours `s-maxage` works. The rule is the same everywhere:

- Cache by default, respecting the origin `Cache-Control` (so `s-maxage=60`
  applies and `no-store` bypasses automatically).
- Bypass the cache for `/api/v1/me/*` and `/api/auth/*` (belt and braces, even
  though they send `no-store`).
- Never cache a response that carries a `Cookie`/`Authorization` request header
  (so a logged-in request is never served someone else's cached body).

### Cloudflare (simplest)

1. Proxy the zone (orange cloud) for `www.devrijehond.nl`.
2. A cache rule: "Eligible for cache" + "Respect origin TTL" for everything,
   with an exception rule "Bypass cache" matching
   `http.request.uri.path starts_with "/api/v1/me/"` or `"/api/auth/"`.
3. Leave "Cache level: Standard"; Cloudflare honours `s-maxage` for the 60s edge
   TTL and `stale-while-revalidate` for background refresh.

### dokku / nginx (if you keep it on the box)

Add an `nginx` `proxy_cache` zone and `proxy_cache_valid` driven by the upstream
headers, with `proxy_cache_bypass`/`proxy_no_cache` set when the path starts
with `/api/v1/me/` or `/api/auth/`, or when an `Authorization`/`Cookie` header is
present. `s-maxage` is already in `Cache-Control`, so `proxy_cache` will use it.

## Caveat

`s-maxage` only affects shared (CDN) caches, not the browser, so a user always
gets fresh-enough data and the CDN shields the origin. If you later need
per-spot purging on edit, add a cache-tag/`purge` call from the admin mutations;
until then the 60s TTL is the bound on staleness.
