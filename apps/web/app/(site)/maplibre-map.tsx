'use client';

/**
 * MapLibre + OpenStreetMap map backend (no API key). Used as the fallback when
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` isn't set.
 *
 * MapLibre is imported dynamically (its module touches `window`, so it must not
 * load during SSR) but the resolved module is cached in a ref, so the marker
 * sync runs synchronously — no per-render `await` racing with React 19's
 * StrictMode double-mount.
 */

import { useEffect, useRef, useState } from 'react';
import type MapLibreModule from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import {
  type Bbox,
  type MapViewProps,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  markerColor,
  spotHref,
} from './map-shared';
import 'maplibre-gl/dist/maplibre-gl.css';

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

function markerEl(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'width:18px',
    'height:18px',
    'border-radius:50%',
    `background:${color}`,
    'border:2px solid #fff',
    'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
    'cursor:pointer',
  ].join(';');
  return el;
}

export function MapLibreMapView({ spots, onBoundsChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modRef = useRef<typeof MapLibreModule | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [ready, setReady] = useState(false);
  // Keep the latest callback without re-running the init effect.
  const onBoundsRef = useRef(onBoundsChange);
  onBoundsRef.current = onBoundsChange;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      modRef.current = mod;

      const map = new mod.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
      map.addControl(new mod.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      const emit = () => {
        const b = map.getBounds();
        const bbox: Bbox = {
          minLng: b.getWest(),
          minLat: b.getSouth(),
          maxLng: b.getEast(),
          maxLat: b.getNorth(),
        };
        onBoundsRef.current(bbox);
      };
      map.on('load', () => {
        if (cancelled) return;
        setReady(true);
        emit();
      });
      map.on('moveend', emit);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers once the map is ready and whenever the spot set changes.
  // Synchronous (module + map come from refs), so there's no async gap.
  useEffect(() => {
    const mod = modRef.current;
    const map = mapRef.current;
    if (!ready || !mod || !map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = spots
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => {
        const el = markerEl(markerColor(s));
        el.title = s.name;
        el.addEventListener('click', () => {
          window.location.href = spotHref(s);
        });
        return new mod.Marker({ element: el })
          .setLngLat([s.lng as number, s.lat as number])
          .addTo(map);
      });
  }, [spots, ready]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
