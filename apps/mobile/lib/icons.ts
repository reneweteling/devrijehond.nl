/**
 * Icon map: the API / mockups carry Tabler names; the native app renders SF
 * Symbols (iOS, via `expo-symbols`) with a Material fallback (Android). Mirrors
 * docs/design/brand-direction.md §6.
 *
 * `sfSymbol(tablerOrSlug)` resolves a category/amenity icon name to an SF Symbol
 * name; unknown names fall back to a neutral tag glyph (matching the curation
 * rule for community-proposed amenities).
 */

import type { SymbolViewProps } from 'expo-symbols';

// What `SymbolView`'s `name` prop expects. `expo-symbols` types this as a fixed
// `SFSymbols7_0` union that lags the real SF Symbols catalogue (it's missing
// valid glyphs like `bowl.fill`, `sun.umbrella.fill`, `spigot.fill`), so the
// icon maps below are plain `string` and the lookups cast on the way out, the
// runtime renders any valid symbol name regardless of the typed union.
type SFName = SymbolViewProps['name'];

/** Category icon → SF Symbol. Keyed by both Tabler name and category slug. */
const CATEGORY_SF: Record<string, string> = {
  'ti-paw': 'pawprint.fill',
  losloop: 'pawprint.fill',
  losloopgebied: 'pawprint.fill',
  'ti-coffee': 'cup.and.saucer.fill',
  horeca: 'cup.and.saucer.fill',
  'ti-droplet': 'drop.fill',
  wassen: 'drop.fill',
  'ti-beach': 'beach.umbrella.fill',
  strand: 'beach.umbrella.fill',
  'ti-building-store': 'bag.fill',
  winkel: 'bag.fill',
  'ti-fountain': 'spigot.fill',
  drinkpunt: 'spigot.fill',
  'ti-scissors': 'scissors',
  trimsalon: 'scissors',
};

/** Amenity icon → SF Symbol. */
const AMENITY_SF: Record<string, string> = {
  'ti-bowl': 'bowl.fill',
  waterbak: 'bowl.fill',
  'ti-bone': 'pawprint.fill',
  treats: 'pawprint.fill',
  'ti-home': 'house.fill',
  'ti-umbrella': 'sun.umbrella.fill',
  terras: 'sun.umbrella.fill',
  'ti-fence': 'square.dashed',
  omheind: 'square.dashed',
  'ti-parking': 'parkingsign',
  parkeren: 'parkingsign',
  'ti-tree': 'tree.fill',
  schaduw: 'tree.fill',
  'ti-currency-euro-off': 'eurosign.circle',
  gratis: 'eurosign.circle',
  'ti-shower': 'shower.fill',
  'ti-bag': 'bag.fill',
  poepzakjes: 'bag.fill',
  'ti-bulb': 'lightbulb.fill',
  verlicht: 'lightbulb.fill',
};

const FALLBACK_SF: SFName = 'tag.fill';

/**
 * Resolve a category/amenity icon to an SF Symbol name. The API stores the icon
 * as an SF Symbol already (e.g. `bowl.fill`), so a value containing a dot passes
 * through untouched. A bare Tabler name / slug (e.g. `ti-bowl`, `waterbak`) is
 * looked up in the map; anything unknown falls back to a neutral tag glyph.
 */
function resolveSymbol(name: string | null | undefined, map: Record<string, string>): SFName {
  if (!name) return FALLBACK_SF;
  if (name.includes('.')) return name as SFName; // already an SF Symbol
  return (map[name] ?? FALLBACK_SF) as SFName;
}

export function categorySymbol(name: string | null | undefined): SFName {
  return resolveSymbol(name, CATEGORY_SF);
}

export function amenitySymbol(name: string | null | undefined): SFName {
  return resolveSymbol(name, AMENITY_SF);
}
