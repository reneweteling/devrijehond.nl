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

type SFName = SymbolViewProps['name'];

/** Category icon → SF Symbol. Keyed by both Tabler name and category slug. */
const CATEGORY_SF: Record<string, SFName> = {
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
const AMENITY_SF: Record<string, SFName> = {
  'ti-bowl': 'bowl.fill',
  waterbak: 'bowl.fill',
  'ti-bone': 'pawprint.fill',
  treats: 'pawprint.fill',
  'ti-home': 'house.fill',
  'ti-umbrella': 'sun.umbrella.fill',
  terras: 'sun.umbrella.fill',
  'ti-fence': 'fence',
  omheind: 'fence',
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

export function categorySymbol(name: string | null | undefined): SFName {
  if (!name) return FALLBACK_SF;
  return CATEGORY_SF[name] ?? FALLBACK_SF;
}

export function amenitySymbol(name: string | null | undefined): SFName {
  if (!name) return FALLBACK_SF;
  return AMENITY_SF[name] ?? FALLBACK_SF;
}
