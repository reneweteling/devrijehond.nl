import type { SpotSummaryDto } from '@devrijehond/types';

/** Viewport bounding box (WGS84 degrees) shared by both map backends. */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export interface MapViewProps {
  spots: SpotSummaryDto[];
  /** Called when the viewport settles; the island fetches spots for it. */
  onBoundsChange: (bbox: Bbox) => void;
}

// Brand palette (docs/design/brand-direction.md).
export const MOSS = '#6E7B33';
export const SAND = '#C9A24B';

// Amsterdam-ish default viewport.
export const DEFAULT_CENTER = { lat: 52.37, lng: 4.89 };
export const DEFAULT_ZOOM = 11;

export function spotHref(s: SpotSummaryDto): string {
  return `${s.type === 'REGION' ? '/gebied' : '/plek'}/${s.slug}`;
}

/** Verified spots are moss, everything still in review is sand. */
export function markerColor(s: SpotSummaryDto): string {
  return s.status === 'VERIFIED' ? MOSS : SAND;
}
