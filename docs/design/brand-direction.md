# De Vrije Hond — Brand Direction

**Direction:** B · "Aarde & bos" — natural, earthy, outdoors. Calm and grounded, with warmth. Photo-forward.

---

## 1. Photography first

The product leans **heavily on free stock photography**. Every spot, category and empty state should feel rich with real imagery rather than flat color.

- **Sources:** Unsplash and Pexels (both free for commercial use, no attribution required). Subject: dogs outdoors, parks, beaches, dog-friendly cafés, nature.
- **Hero fallback chain:** user photo → relevant stock photo for the category → Google photo of the location (last resort, per architecture). A spot is never imageless.
- **Treatment:** full-bleed, `object-fit: cover`, radius to match the card. A subtle warm overlay (`rgba(76,86,34,.10)` multiply) unifies mismatched stock into the palette.
- Mockup note: the clickable HTML prototype pulls live photos (place.dog with a picsum fallback) so the layout reads true; production swaps in curated Unsplash/Pexels assets.

---

## 2. Color palette

Earthy core: moss green + warm sand, with a terracotta accent.

| Token | Hex | Use |
|---|---|---|
| `--moss` (primary) | `#6E7B33` | primary actions, wordmark, verified, region fills |
| `--moss-dark` | `#4C5622` | text on light, hovers, headings on sand |
| `--moss-soft` | `#E7E9D5` | chip / badge backgrounds, soft surfaces |
| `--terracotta` (accent) | `#C2762E` | highlights, unverified marker, secondary CTA, ratings stars |
| `--terracotta-dark` | `#8A4F1B` | accent text on light |
| `--sand` (app bg) | `#F3EFE3` | warm off-white page background |
| `--ink` | `#2C2A1E` | primary text (warm near-black) |
| `--ink-2` | `#5E5A48` | secondary text |
| `--ink-3` | `#908B79` | hints, captions |
| `--rust` | `#A33B2D` | hidden / rejected / danger |

**Category pin colors** (muted to sit on the map without shouting):

- Losloop / regio → moss `#6E7B33`
- Horeca → terracotta `#C2762E`
- Wassen → muted teal-blue `#4F7A86`
- Winkel → muted plum `#8A6BA0`
- Strand → sandy gold `#C9A24B`
- Drinkpunt → slate `#6E7A82`

**Status:** verified = moss, unverified = terracotta, hidden = rust, pending = terracotta-soft.

---

## 3. Typography

- **Headings / wordmark:** `Poppins` 500/600 — friendly but grounded, reads well with the earthy palette. (Alternative for more editorial character: `Fraunces` warm serif for the wordmark only — flagged as an option.)
- **Body / UI:** `Inter` 400/500 — neutral, highly legible.
- Two weights per family. Sentence case everywhere. Headlines in `--ink`, secondary in `--ink-2`.

---

## 4. Shape & components

- **Radius:** cards 12px, buttons/inputs 10px, pills/chips full. Slightly less round than the playful direction — grounded, not bubbly.
- **Borders:** hairline `rgba(0,0,0,.10)` on cards; surfaces lean on the sand background + soft-moss tints rather than heavy borders.
- **Buttons:** primary = solid moss, text white; secondary = sand surface with `--ink` text + hairline; accent (sparingly) = terracotta.
- **Badges:** verified = moss pill w/ rosette icon; unverified = terracotta pill w/ help icon.
- **Icons:** Tabler outline, `ti-paw` recurring as the brand motif.

---

## 5. What's applied where

This direction is now applied to the clickable prototype (`docs/wireframes/mobile-prototype.html`): palette tokens swapped to earthy, Poppins/Inter loaded, and real photography in heroes, thumbnails and galleries. The inline preview shows the same skin with photo placeholders (external images are blocked inline; open the HTML file to see the real stock photos).

---

## 6. Icon system

Every category and amenity has a fixed icon. Mockups/web use **Tabler** names; the native app should map each to an **SF Symbol** (iOS, via `expo-symbols`) and a **Material** name (Android) for a native feel — see architecture §6b.

**Categories** (also the map pin glyph):

| Category | Tabler | SF Symbol (iOS) |
|---|---|---|
| Losloopgebied | `ti-paw` | `pawprint.fill` |
| Hondvriendelijke horeca | `ti-coffee` | `cup.and.saucer.fill` |
| Was- / spoelplek | `ti-droplet` | `drop.fill` |
| Zwemstrand | `ti-beach` | `beach.umbrella.fill` |
| Winkel | `ti-building-store` | `bag.fill` |
| Drinkpunt | `ti-fountain` | `spigot.fill` |
| Trimsalon *(toekomst)* | `ti-scissors` | `scissors` |

**Amenities / voorzieningen:**

| Voorziening | Tabler | SF Symbol |
|---|---|---|
| Waterbak | `ti-bowl` | `bowl.fill` |
| Snoepjes / treats | `ti-bone` | `pawprint.fill` |
| Binnen ok | `ti-home` | `house.fill` |
| Terras / buiten | `ti-umbrella` | `sun.umbrella.fill` |
| Omheind | `ti-fence` | `fence` |
| Parkeren | `ti-parking` | `parkingsign` |
| Schaduw | `ti-tree` | `tree.fill` |
| Gratis | `ti-currency-euro-off` | `eurosign.circle` |
| Hondendouche | `ti-shower` | `shower.fill` |
| Poepzakjes | `ti-bag` | `bag.fill` |
| Drinkfontein | `ti-droplet` | `drop.fill` |
| Verlicht | `ti-bulb` | `lightbulb.fill` |

Render rule: amenity icons sit in a soft-moss rounded tile (`--moss-soft` bg, `--moss-dark` glyph); the spot's signature amenity (e.g. waterbak) gets the solid-moss highlight tile. New community-proposed amenities fall back to a neutral `ti-tag` / `tag.fill` until an admin assigns a proper icon during curation.

---

→ Open for later: final logo/wordmark (currently text + `ti-paw`), curated production photo set, and dark-mode variant of the palette.
