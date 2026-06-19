# mobile — De Vrije Hond (Expo)

Native-first Expo / expo-router app consuming the De Vrije Hond API exclusively
through the generated `@devrijehond/api-client`. Earthy "Aarde & bos" skin
(moss / terracotta / sand; Poppins + Inter).

## Dev loop

```sh
# from repo root, once: pnpm install (do not run from here)
cd apps/mobile
cp .env.development.example .env.development.local   # set EXPO_PUBLIC_API_URL
pnpm exec expo start --ios
```

`lib/config.ts` throws at module load if `EXPO_PUBLIC_API_URL` is empty, so a
missing env surfaces at boot. Use `.env.development.local` (NOT `.env.local`) —
`.env.local` is loaded regardless of NODE_ENV and would leak a localhost origin
into shipped bundles.

## Layout

- `app/_layout.tsx` — providers + session-boot gate. Keeps the Stack mounted and
  overlays a sand placeholder while pending (never returns null).
- `app/(tabs)/_layout.tsx` — Native Tabs (Kaart / Nabij / Toevoegen / Profiel).
- `app/(tabs)/index.tsx` — native map: region polygons, POI pins (verified solid
  / unverified dashed-terracotta), category chips, legend, bottom-sheet peek card.
- `app/(tabs)/nearby.tsx` — list counterpart sharing the filter state.
- `app/(tabs)/add.tsx` — submit flow: type → place → details.
- `app/(tabs)/profile.tsx` — avatar / bio / reputation / dogs / submissions.
- `app/spot/[slug]/index.tsx` — detail: hero, community-check vote, amenity grid,
  reviews, provenance.
- `app/spot/[slug]/review.tsx` — write a review (0–5 stars + comment).
- `app/(auth)/sign-in.tsx` + `verify.tsx` — magic link + native Apple/Google.
- `lib/` — `config`, `session` (SecureStore), `auth` (BetterAuth wrappers),
  `query` (QueryClient + `setAuthToken` bridge), `api` (typed `customFetcher`
  wrappers), `theme`, `icons`.

## Outstanding `TODO(verify)` (the verify pass)

- Swap the `lib/api.ts` `customFetcher` wrappers for the generated Orval hooks
  once `pnpm --filter @devrijehond/api-client generate` has run.
- Confirm the `expo-router/unstable-native-tabs` subcomponent API (`NativeTabs`,
  `Icon` `sf`/`drawable`, `Label`) against the installed SDK 55 build.
- Map DTO carries no polygon geometry → region outlines aren't drawn on the home
  map yet; either add geometry to the map DTO or lazy-fetch detail.
- Wire `expo-location` for initial map centring and the vote proximity `proof`.
- Real Google Maps API keys in `app.json` (placeholders flagged).
- Profile "My submissions" needs a mine-list endpoint; edit-profile / add-dog
  CTAs are stubbed. Report sheet on the detail screen is stubbed.
- Replace placeholder PNGs in `assets/` with the real icon / splash.
