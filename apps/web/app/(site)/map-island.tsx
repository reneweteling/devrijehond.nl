'use client';

/**
 * Client map island. Renders an interactive MapLibre map over free
 * OpenStreetMap raster tiles (no API key), and hydrates markers from the same
 * public viewport endpoint the mobile app uses (`GET /api/v1/spots/map`). The
 * server shell stays crawlable (the `<ul>` of spot links is real SSR-friendly
 * markup); the heavy map loads client-side only.
 *
 * MapLibre is imported dynamically inside an effect so its `window`-touching
 * module code never runs during SSR.
 */

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import type { SpotSummaryDto } from '@devrijehond/types';
import 'maplibre-gl/dist/maplibre-gl.css';

// Amsterdam-ish default viewport.
const DEFAULT_CENTER: [number, number] = [4.89, 52.37];
const DEFAULT_ZOOM = 11;

// Brand palette (docs/design/brand-direction.md).
const MOSS = '#6E7B33';
const SAND = '#C9A24B';

function spotHref(s: SpotSummaryDto): string {
  return `${s.type === 'REGION' ? '/gebied' : '/plek'}/${s.slug}`;
}

/** Free OpenStreetMap raster style — no API key required. */
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

function markerEl(verified: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'width:18px',
    'height:18px',
    'border-radius:50%',
    `background:${verified ? MOSS : SAND}`,
    'border:2px solid #fff',
    'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
    'cursor:pointer',
  ].join(';');
  return el;
}

export function MapIsland() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [spots, setSpots] = useState<SpotSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    let onMoveEnd: (() => void) | null = null;

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      const refresh = async () => {
        const b = map.getBounds();
        const params = new URLSearchParams({
          minLng: String(b.getWest()),
          minLat: String(b.getSouth()),
          maxLng: String(b.getEast()),
          maxLat: String(b.getNorth()),
        });
        try {
          const res = await fetch(`/api/v1/spots/map?${params.toString()}`);
          const data: { items?: SpotSummaryDto[] } = res.ok ? await res.json() : {};
          if (!cancelled) setSpots(data.items ?? []);
        } catch {
          if (!cancelled) setSpots([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      onMoveEnd = refresh;
      map.on('load', refresh);
      map.on('moveend', refresh);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current && onMoveEnd) mapRef.current.off('moveend', onMoveEnd);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers whenever the spot set changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = spots
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => {
          const el = markerEl(s.status === 'VERIFIED');
          el.title = s.name;
          el.addEventListener('click', () => {
            window.location.href = spotHref(s);
          });
          return new maplibre.Marker({ element: el })
            .setLngLat([s.lng as number, s.lat as number])
            .addTo(map);
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [spots]);

  return (
    <section aria-label="Kaart met hondvriendelijke plekken">
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ height: 420, borderRadius: 12, overflow: 'hidden', backgroundColor: '#dfe7df' }}
        />
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
