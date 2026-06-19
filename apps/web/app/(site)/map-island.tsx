'use client';

/**
 * Client map island. Holds the in-view spot set and renders one of two map
 * backends: Google Maps when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set, else the
 * free MapLibre + OpenStreetMap fallback. Both hydrate markers from the same
 * public viewport endpoint the mobile app uses (`GET /api/v1/spots/map`).
 *
 * The crawlable `<ul>` of spot links below the map stays as real SSR-friendly
 * markup for SEO and as a no-JS fallback.
 */

import { useCallback, useRef, useState } from 'react';
import type { SpotSummaryDto } from '@devrijehond/types';
import { type Bbox, spotHref } from './map-shared';
import { GoogleMapView } from './google-map';
import { MapLibreMapView } from './maplibre-map';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export function MapIsland() {
  const [spots, setSpots] = useState<SpotSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  // Skip refetching when the viewport settles on the same box (rounded).
  const lastKey = useRef('');

  const handleBounds = useCallback(async (b: Bbox) => {
    const key = [b.minLng, b.minLat, b.maxLng, b.maxLat].map((n) => n.toFixed(4)).join(',');
    if (key === lastKey.current) return;
    lastKey.current = key;

    const params = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    });
    try {
      const res = await fetch(`/api/v1/spots/map?${params.toString()}`);
      const data: { items?: SpotSummaryDto[] } = res.ok ? await res.json() : {};
      setSpots(data.items ?? []);
    } catch {
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section aria-label="Kaart met hondvriendelijke plekken">
      <div style={{ position: 'relative' }}>
        <div
          style={{ height: 420, borderRadius: 12, overflow: 'hidden', backgroundColor: '#dfe7df' }}
        >
          {GOOGLE_MAPS_KEY ? (
            <GoogleMapView apiKey={GOOGLE_MAPS_KEY} spots={spots} onBoundsChange={handleBounds} />
          ) : (
            <MapLibreMapView spots={spots} onBoundsChange={handleBounds} />
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '4px 10px',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: '#3F6B4C',
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {loading ? 'Kaart laden…' : `${spots.length} plekken in beeld`}
        </div>
      </div>

      {/* Crawlable / no-JS fallback list of the spots in view. */}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'grid', gap: 8 }}>
        {spots.map((s) => (
          <li key={s.id}>
            <a
              href={spotHref(s)}
              style={{ color: '#1f2b22', textDecoration: 'none', fontWeight: 500 }}
            >
              {s.name}
              {s.status !== 'VERIFIED' ? (
                <span style={{ color: '#9a7b3f', fontSize: 13 }}> · niet geverifieerd</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
