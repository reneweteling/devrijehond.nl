/**
 * "Aarde & bos" palette + type tokens. Mirrors docs/design/brand-direction.md
 * and docs/design/hifi-prototype.html. The single source of truth for colour /
 * radius / spacing across the mobile screens.
 */

export const colors = {
  moss: '#6E7B33',
  mossDark: '#4C5622',
  mossSoft: '#E7E9D5',
  terra: '#C2762E',
  terraDark: '#8A4F1B',
  terraSoft: '#F3E3D0',
  sand: '#F3EFE3',
  surface: '#FFFFFF',
  ink: '#2C2A1E',
  ink2: '#5E5A48',
  ink3: '#908B79',
  rust: '#A33B2D',
  line: 'rgba(60,50,20,0.12)',
  /** Warm overlay multiplied over stock photography to unify the palette. */
  photoOverlay: 'rgba(76,86,34,0.10)',
} as const;

/** Category pin colours, muted to sit on the map without shouting. */
export const categoryColors: Record<string, string> = {
  losloop: colors.moss,
  regio: colors.moss,
  horeca: colors.terra,
  wassen: '#4F7A86',
  winkel: '#8A6BA0',
  strand: '#C9A24B',
  drinkpunt: '#6E7A82',
};

export const radius = {
  card: 12,
  button: 10,
  pill: 999,
  sheet: 22,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/**
 * Font families. Poppins for headings / wordmark, Inter for body / UI. The
 * `@expo-google-fonts/*` faces register these exact family names.
 */
export const font = {
  heading: 'Poppins_600SemiBold',
  headingMedium: 'Poppins_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;

/**
 * Height of the floating native tab bar. Add insets.bottom + TAB_BAR_CLEARANCE
 * as bottom padding/contentInset on scrollable screens so content isn't hidden
 * behind the bar. Example: paddingBottom: insets.bottom + TAB_BAR_CLEARANCE
 */
export const TAB_BAR_CLEARANCE = 64;

/** Status → colour, per brand-direction §2. */
export function statusColor(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return colors.moss;
    case 'HIDDEN':
    case 'REMOVED':
      return colors.rust;
    case 'UNVERIFIED':
    default:
      return colors.terra;
  }
}
