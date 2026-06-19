'use client';

/**
 * Client map island. Holds the in-view spot set and renders the Google Maps
 * backend, hydrating markers from the same public viewport endpoint the mobile
 * app uses (`GET /api/v1/spots/map`).
 *
 * The crawlable `<ul>` of spot links below the map stays as real SSR-friendly
 * markup for SEO and as a no-JS fallback.
 */

import { useCallback, useRef, useState } from 'react';
import type { SpotSummaryDto } from '@devrijehond/types';
import { type Bbox, spotHref } from './map-shared';
import { GoogleMapView } from './google-map';

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
          style={{
            height: 420,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            backgroundColor: 'var(--moss-soft)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          {GOOGLE_MAPS_KEY ? (
            <GoogleMapView apiKey={GOOGLE_MAPS_KEY} spots={spots} onBoundsChange={handleBounds} />
          ) : (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                height: '100%',
                color: 'var(--ink-3)',
                fontSize: 14,
              }}
            >
              Kaart is tijdelijk niet beschikbaar.
            </div>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 12px',
            borderRadius: 999,
            backgroundColor: '#fff',
            color: 'var(--ink)',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 2px 10px rgba(40,40,20,0.18)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--moss)' }} />
          {loading ? 'Kaart laden…' : `${spots.length} plekken in beeld`}
        </div>
      </div>

      {/* Spots in the current viewport, as a tidy grid of cards (a moss dot =
          verified, terracotta = not yet). Doubles as the no-JS/crawlable list. */}
      {spots.length > 0 ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 10,
            marginTop: 18,
          }}
        >
          {spots.map((s) => (
            <a
              key={s.id}
              href={spotHref(s)}
              className="card card-link"
              style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span
                title={s.status === 'VERIFIED' ? 'Geverifieerd' : 'Nog niet geverifieerd'}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  flex: 'none',
                  background: s.status === 'VERIFIED' ? 'var(--moss)' : 'var(--terra)',
                }}
              />
              <span
                style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.3 }}
              >
                {s.name}
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
