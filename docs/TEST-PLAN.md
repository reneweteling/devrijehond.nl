# Test plan — De Vrije Hond

Manual + automated test plan, walked as a real user. Status legend: ✅ pass,
🔧 fixed this round, ⚠️ known/needs account, ⬜ not yet executed.

How it's executed:

- **App**: iOS simulator (deep links via `vrijehond://`, taps via `idb`,
  screenshots) + a multi-lens code-review workflow over `apps/mobile`.
- **Web**: live site + Playwright screenshots (desktop 1440 + mobile 390) +
  a multi-lens design-critique workflow.

## Mobile app

### Map (S1, `(tabs)/index.tsx`)

| #   | Step                   | Expected                                                  | Status |
| --- | ---------------------- | --------------------------------------------------------- | ------ |
| 1   | Launch app             | Map centres on Amsterdam, spots load for the viewport     | ✅     |
| 2   | Pan / zoom             | Markers refetch for the new viewport (debounced)          | ✅     |
| 3   | REGION geofences       | Off-leash / swim areas draw as filled, outlined polygons  | ✅     |
| 4   | Tap a marker / polygon | Peek card slides up with name, category, rating           | ⬜     |
| 5   | Tap the peek card      | Pushes the spot detail                                    | ⬜     |
| 6   | Category chips         | Filter the markers by category                            | ⬜     |
| 7   | Search pill → place    | Map flies to the place AND loads its spots (no empty map) | 🔧     |

### Search (`search.tsx`)

| #   | Step                          | Expected                                       | Status |
| --- | ----------------------------- | ---------------------------------------------- | ------ |
| 1   | Type a spot name              | Matching spots list, debounced                 | ⬜     |
| 2   | Tap a spot result             | Opens the spot detail                          | ⬜     |
| 3   | Type a place (e.g. Hilversum) | A "ga naar op de kaart" geocode result appears | ✅     |
| 4   | Tap the place result          | Returns to the map and flies there             | ✅     |
| 5   | Empty / no results            | Sensible empty copy, no crash                  | ⬜     |

### Nearby (`(tabs)/nearby.tsx`)

| #   | Step                   | Expected                                                 | Status |
| --- | ---------------------- | -------------------------------------------------------- | ------ |
| 1   | Open tab               | List sorted by distance, each row shows distance + badge | ✅     |
| 2   | Search box             | Filters by name / category                               | ⬜     |
| 3   | Tap a row              | Opens the spot detail                                    | ⬜     |
| 4   | No location permission | Graceful state (no distances, still a list)              | ⬜     |

### Spot detail (`spot/[slug]/index.tsx`)

| #   | Step               | Expected                                                 | Status |
| --- | ------------------ | -------------------------------------------------------- | ------ |
| 1   | Open (deep link)   | Hero photo, title, category, verified badge, description | ✅     |
| 2   | Mini map           | Shows the spot location                                  | ✅     |
| 3   | "Klopt deze plek?" | Vote tally + progress to verified; login CTA when anon   | ✅     |
| 4   | Vote while anon    | Routes to sign-in                                        | ⬜     |
| 5   | Amenities          | Listed as chips                                          | ⬜     |
| 6   | Reviews            | List + average; "schrijf review" gated                   | ⬜     |
| 7   | Report             | Report sheet; gated to login                             | ⬜     |
| 8   | Back               | Returns to the previous screen                           | ✅     |

### Add (`(tabs)/add.tsx`) — auth-gated

| #   | Step                 | Expected                                                    | Status |
| --- | -------------------- | ----------------------------------------------------------- | ------ |
| 1   | Open while anon      | "Log in om een plek toe te voegen" + Inloggen (no clipping) | 🔧     |
| 2   | Inloggen             | Opens sign-in                                               | ⬜     |
| 3   | (auth) Pick type     | Region vs POI                                               | ⬜     |
| 4   | (auth) Draw geofence | Polygon editor for a region — TODO, not built yet           | ⬜     |

### Wensen (`(tabs)/requests.tsx`)

| #   | Step              | Expected                                      | Status |
| --- | ----------------- | --------------------------------------------- | ------ |
| 1   | Open tab          | Feature requests with upvotes + status badges | ✅     |
| 2   | Filter chips      | Populair / In overweging / Gepland / Klaar    | ✅     |
| 3   | Upvote while anon | Routes to sign-in                             | ⬜     |
| 4   | New request       | Gated to login                                | ⬜     |

### Profile + auth (`(tabs)/profile.tsx`, `(auth)/*`)

| #   | Step               | Expected                                         | Status    |
| --- | ------------------ | ------------------------------------------------ | --------- |
| 1   | Profile while anon | "Niet ingelogd" + sign-in CTA                    | ✅        |
| 2   | Sign-in screen     | Email magic-link + Apple/Google; close button    | ✅        |
| 3   | Magic link         | Opens the HTTPS interstitial → back into the app | ⚠️ device |
| 4   | Signed-in profile  | Dogs, my submissions, edit profile               | ⬜        |

## Web

| #   | Page                        | Expected                                                    | Status |
| --- | --------------------------- | ----------------------------------------------------------- | ------ |
| 1   | `/`                         | Hero, categories, how-it-works, featured, map, FAQ, app CTA | ✅     |
| 2   | `/` mobile                  | No overflow, tap targets ok, map readable                   | ✅     |
| 3   | `/plek/[slug]`              | SSR detail, photos, map, JSON-LD LocalBusiness              | ✅     |
| 4   | `/gebied/[slug]`            | SSR region detail, JSON-LD Place                            | ✅     |
| 5   | Map island                  | Google map + in-view cards + legend                         | ✅     |
| 6   | Skip link / focus           | Keyboard skip-to-content + visible focus ring               | ✅     |
| 7   | `/privacy`, `/terms`        | Render                                                      | ✅     |
| 8   | `/admin`                    | ADMIN-gated; stats + moderation + taxonomy                  | ⬜     |
| 9   | `robots.txt`, `sitemap.xml` | Present, list spot URLs                                     | ⬜     |

## iOS release

| #   | Step                      | Status                                                  |
| --- | ------------------------- | ------------------------------------------------------- |
| 1   | Compile (no signing)      | ✅                                                      |
| 2   | Pods (modular headers)    | ✅                                                      |
| 3   | Signed archive (macos-26) | ✅                                                      |
| 4   | Export IPA                | ⚠️ needs App ID + app record + API-key role (see CI.md) |
| 5   | Upload to TestFlight      | ⚠️ blocked on #4                                        |
