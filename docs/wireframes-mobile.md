# De Vrije Hond — Mobile App Wireframes (Low-Fi)

**Platform:** Expo (iOS + Android)
**Fidelity:** Low-fi — structure, hierarchy, and flow. No final visuals.
**Companion:** clickable prototype at `docs/wireframes/mobile-prototype.html`
**Status:** Draft v2 — community-driven verification model

> This doc is the written spec; the HTML file is the interactive version of the same screens. Annotations call out the data each element needs (relevant for the data model).

---

## 1. Content model in one paragraph

Two primary content types drive everything:

- **Region** — a polygon/geofenced *area*. Off-leash zones and dog-swimming beaches. Has a boundary you can be *inside* or *near*.
- **POI (Point of Interest)** — a single *point*. Dog-friendly horeca, wash/rinse stations, shops, public drinking points.

Both belong to a **category**, both carry **amenities/features**, both are **published immediately** and then move through **community verification** (not a moderator queue).

---

## 2. Core principle: community-driven, self-maintaining

There are no moderators in normal operation. The platform builds and verifies itself:

1. An authenticated user submits a Region or POI → it is **live immediately**, badged **"not verified."**
2. Other users (who have been near the spot) vote **confirm** ("klopt") or **deny** ("klopt niet").
3. Votes are **weighted by contributor reputation**.
4. Thresholds (all configurable in the web admin):

| Trigger | Condition | Result |
|---|---|---|
| Auto-verify | weighted score (confirms − denies) **≥ +5** | status → `verified` (badge) |
| Auto-hide | **≥ 3 denials** | status → `hidden`, removed from public map, admin notified |
| Report | spam/inappropriate flags reach threshold | surfaced to admin |

Open conflict (noted): a spot could reach +5 net *and* 3 denials at once. **Auto-hide takes precedence** (safety first); both thresholds are admin-configurable. → see §9.

**Vote integrity rules:**
- One vote per user per spot.
- Submitter cannot vote on their own spot.
- Voter must have been **physically near** the spot (proximity gate via location).
- Vote weight scales with the voter's reputation (new accounts light, proven contributors heavy).

**Verification vote ≠ review.** The community check answers "does this place really exist / is the info right?" (confirm/deny). A **review** is a separate 0–5 star rating + comment about the *experience* (see §6). They live side by side on the detail screen.

**Admin (web only) can always override:** restore a hidden spot, force-verify, remove permanently, and curate the taxonomy (§7).

---

## 3. Screen inventory

| # | Screen | Flow | Auth |
|---|--------|------|------|
| S0 | Splash / location permission | Onboarding | no |
| S1 | Map (home) | Discovery | no |
| S2 | Filter sheet | Discovery | no |
| S3 | Search | Discovery | no |
| S4 | Nearby list | Discovery | no |
| S5 | Spot detail — Region (verified example) | Detail | no |
| S6 | Spot detail — POI (unverified example, with vote UI) | Detail | no (vote: yes) |
| S7 | Write review | Reviews | yes |
| S8 | Photo viewer | Detail | no |
| S9 | Auth (sign in / up) | Account | — |
| S10 | Submit — choose type | Submission | yes |
| S11 | Submit — place on map (pin / polygon) | Submission | yes |
| S12 | Submit — details form (incl. growable amenities) | Submission | yes |
| S13 | Submit — live & unverified | Submission | yes |
| S14 | Profile / My submissions (avatar, bio, dogs) | Account | yes |
| S14b | Edit profile (avatar upload, bio, dogs) | Account | yes |
| S14c | Add / edit dog (photo, name, breed) | Account | yes |
| S15 | Feature requests (list + vote) | Feature requests | no (vote: yes) |
| S16 | New feature request | Feature requests | yes |
| S17 | Admin — needs attention (queue) | Admin safety-net | admin |
| S18 | Admin — review item | Admin safety-net | admin |

(The clickable prototype currently includes S1, S2, S5, S6, S7, S10–S18.)

---

## 4. Discovery

**S1 Map** — default landing. Published Regions (shaded polygons) + POIs (pins) in viewport. Pins visually distinguish **verified (solid)** vs **unverified (dashed/outline)**; a small legend explains it. Category chips for quick filter; filter button → S2. Tap pin → peek card → detail.

**S2 Filter** — by category, by amenity/feature, by distance, **and by verification** ("only verified" vs "also show unverified"). Live result count on apply.

**S3 Search** — by name + locality, results typed (Region/POI) and categorized.

**S4 Nearby** — list counterpart to the map, shares filter state. Row: thumbnail, title, category, key amenities, distance, rating, verified badge.

*Data:* geometry + bbox query, category, amenity flags, `verification_status`, rating aggregate, thumbnail.

---

## 5. Spot detail + verification

**S5 Region (verified)** — leads with the geofence boundary. Shows verified badge, amenities (water bowl highlighted), rules/hours, reviews, provenance ("submitted by @x · verified by the community, net +9").

**Photo fallback:** since every spot has coordinates, when no user photo is uploaded the hero/thumbnail **falls back to a Google photo of the location** (Places Photo or Street View Static, by lat/lng). A user photo always wins when present. Caveat → §10: Google imagery carries usage terms, mandatory attribution, and API cost; Mapillary or a generated map thumbnail are alternatives.

**S6 POI (unverified)** — leads with photo + dog amenities. Carries the **Community-check block**:

- net score + progress toward +5 ("8 confirm · 1 deny · net +3");
- **"Klopt deze plek?"** → confirm / deny buttons;
- eligibility line ("Je bent hier geweest — jouw stem telt mee"), or disabled with reason if not near / own submission / already voted.

*Data:* geometry, category, amenities, hours/address/contact, photos[], reviews[], `confirm_weight`, `deny_weight`, `net_score`, submitter ref, verification_status, per-user vote record, proximity proof.

---

## 6. Reviews & ratings (Google-style)

Separate from verification. Any authenticated user can leave a **0–5 star rating + comment + optional photos** on a POI or Region.

- Detail screen shows an **aggregate** (e.g. 4,6 ★, 23 reviews) and a list of review cards (avatar, name, stars, text, date, helpful count).
- **S7 Write review**: star selector, comment, photo upload. A note clarifies it's distinct from the community-check.

*Data:* `review { spot_id, user_id, stars 0–5, body, photos[], created_at, helpful_count }`; aggregate (avg, count) on the spot. Reviews can be reported → admin (§7).

---

## 7. Submission + growable taxonomy

**S10 type** (Region vs POI) → **S11 place** (draw polygon / drop pin) → **S12 details** → **S13 live & unverified.**

**S12 details** — name*, category* (select), description, photos, hours/contact (optional), and **amenities/features**:

- A **category-scoped checklist** of common features (e.g. horeca → water bowl, treats, indoor ok, terrace).
- An **"Anders…" autocomplete field**: typing matches against **all existing amenities** in the taxonomy (including ones not shown in the short list), so variants converge instead of multiplying. A genuinely new term is captured as **"proposed"** and routed to the admin — it isn't broadly shown until curated.

**S13** — explicit messaging: "live now as unverified; reaches verified automatically at net +5, no moderator needed."

**Taxonomy curation (web admin):** categories and amenities are data, not hardcoded. Admin controls **which are visible and in what order**, can **merge** proposed/duplicate terms into canonical ones, promote a proposed amenity to a real one, and promote a popular requested category (e.g. *hondentrimsalons*, §8) into a first-class category. This keeps the taxonomy community-grown but curated.

*Data:* `category { id, label, type, visible, sort_order, status: active|proposed }`, `amenity { id, label, applies_to_categories[], visible, sort_order, status }`, plus a `proposed_by` link.

---

## 8. Feature requests

A built-in flow where users shape the product (this is also where "I want to see all dog grooming salons on the map" lives — a request that, once popular, becomes a new category in §7).

- **S15 list** — requests sorted by upvotes, each with a **status tag** (in consideration / planned / done / declined) and an upvote control. Filter by Popular / New / Planned / Done.
- **S16 new request** — title, description, area/component; **autocomplete against existing requests while typing** so duplicates merge.

*Data:* `feature_request { id, title, body, component, status, upvotes, created_by }`, `feature_vote { request_id, user_id }`. Admin sets status from the web admin.

---

## 9. Admin safety-net (web-primary, light mobile view)

Because the community self-governs, the admin is an **exception handler**, not an approver of everything.

**S17 needs-attention queue** — only items that are **hidden** (hit deny threshold), **reported**, or **contested** (mixed votes / near-duplicate). Not every submission.

**S18 review item** — map + duplicate-proximity warning, the **weighted vote breakdown** (who voted, their weights, why it surfaced), photos (individually reportable), internal admin note, and actions: **restore**, **force-verify**, **remove permanently**. Plus taxonomy actions per §7.

*Data:* `verification_status` (`unverified | verified | hidden | removed`), `report { target, reason, reporter }`, vote ledger, admin action log, near-duplicate spatial check.

---

## 10. Open decisions surfaced by the wireframes

1. **Auto-verify vs auto-hide conflict.** Confirmed default: hide wins; both thresholds admin-configurable. Confirm the numbers (+5 / 3).
2. **Reputation model.** How is vote weight computed and capped? (e.g. base 1, +per verified contribution, new accounts 0.5, max 2.) Needs a concrete formula.
3. **Proximity gate.** Foreground-only check at vote time, or a recorded "you were here" (geofence visit) that unlocks voting later? Affects location-permission UX.
4. **Public drinking points** as their own POI category vs only a "has water bowl" amenity — keep both? (Currently: water bowl = amenity; standalone drink point = category candidate.)
5. **Reviews in v1?** Confirmed in scope. Decide moderation of reviews (report-only vs community vote too).
6. **Unverified visibility.** Show unverified spots to everyone by default, or let users opt out via the filter only? (Currently shown by default with a clear badge.)
7. **Editable-before-verify.** Admin can fix fields; should the community also be able to *suggest edits* (wiki-style) that themselves get voted on? (Post-MVP candidate.)
8. **Photo moderation.** Per-photo report/status (not just per-spot).
9. **Hero photo fallback provider.** Google Places Photo / Street View (terms + attribution + cost) vs Mapillary vs a generated map thumbnail. Affects API keys, billing, and attribution UI.

---

## 11. Hand-off to architecture

Load-bearing for the data model:

- **Lifecycle:** `unverified → verified | hidden | removed`, published-on-create.
- **Vote ledger** per spot (confirm/deny, weight, proximity proof, one-per-user, submitter-excluded) → derived `net_score`.
- **Reputation** per user feeding vote weight.
- **Two geometry types** (Point / Polygon) → spatial queries: viewport bbox, nearby-radius (proximity gate + duplicate check).
- **Data-driven taxonomy:** `category` and `amenity` as rows with `visible`, `sort_order`, `status (active|proposed)` and merge support.
- **Reviews** (0–5 + comment + photos, aggregate) as related entities, separate from votes.
- **Feature requests** + upvotes as their own small subsystem.
- **Reports** + **admin action log** for the safety-net.
- **User profile:** uploadable **avatar**, display name, short **bio**, plus one-to-many **dogs** (`dog { id, owner_id, name, breed, birth_year, photo, note }`). Avatars appear on reviews and provenance; dogs personalise the profile. Avatar + dog photos need image upload + storage.
- **Roles:** anonymous (view), authenticated (submit / vote / review / request), admin (web override + taxonomy curation).

→ Next after sign-off: turn §1–§2 + §11 into the concrete schema, then the monorepo + Next.js API/website architecture.
