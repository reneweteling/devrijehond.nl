import type { SpotSummaryDto } from '@devrijehond/types';

/** Base URL for public API reads from the browser. In production this points at
 * the CDN-fronted api.devrijehond.nl so markers are served from the edge; in dev
 * it's empty (relative), hitting the local Next app. Set via NEXT_PUBLIC_API_BASE
 * (inlined at build time). No trailing slash. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

/** Viewport bounding box (WGS84 degrees) shared by both map backends. */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/** A server-side cluster: a count bubble at a cell centroid. */
export type ClusterItem = { lat: number; lng: number; count: number };

/** A map marker spot. The map endpoint adds a REGION's polygon outline. */
export type MapItem = SpotSummaryDto & {
  geometry?: { type: string; coordinates: unknown } | null;
};

export interface MapViewProps {
  spots: SpotSummaryDto[];
  /** Server-side clusters (count bubbles) for dense cells. */
  clusters?: ClusterItem[];
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
