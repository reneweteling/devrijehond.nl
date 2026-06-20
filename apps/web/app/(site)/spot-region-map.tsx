'use client';

/**
 * Small map on a spot detail page: draws the REGION geofence as a filled
 * polygon (a region's defining feature) or a POI as a single pin. Uses the same
 * keyless-safe Google Maps setup as the homepage map.
 */

import { useEffect } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { SpotGeometryDto } from '@devrijehond/types';

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

type LngLat = [number, number];

function polygonRings(geometry: SpotGeometryDto): google.maps.LatLngLiteral[][] | null {
  if (geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return null;
  const rings = geometry.coordinates as LngLat[][];
  return rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
}

function RegionPolygon({ geometry }: { geometry: SpotGeometryDto }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const rings = polygonRings(geometry);
    if (!rings || !rings[0]) return;
    const poly = new google.maps.Polygon({
      paths: rings,
      strokeColor: '#4c5622',
      strokeWeight: 2,
      fillColor: '#6e7b33',
      fillOpacity: 0.28,
    });
    poly.setMap(map);
    const bounds = new google.maps.LatLngBounds();
    rings[0].forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 24);
    return () => poly.setMap(null);
  }, [map, geometry]);
  return null;
}

export function SpotRegionMap({
  geometry,
  lat,
  lng,
}: {
  geometry: SpotGeometryDto | null;
  lat: number | null;
  lng: number | null;
}) {
  if (!KEY) return null;
  const isPolygon = geometry?.type === 'Polygon';
  const center = lat != null && lng != null ? { lat, lng } : { lat: 52.13, lng: 5.29 };

  return (
    <div
      style={{
        height: 300,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
      }}
    >
      <APIProvider apiKey={KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={isPolygon ? 12 : 15}
          gestureHandling="cooperative"
          disableDefaultUI
          style={{ width: '100%', height: '100%' }}
        >
          {isPolygon && geometry ? (
            <RegionPolygon geometry={geometry} />
          ) : lat != null && lng != null ? (
            <Marker position={{ lat, lng }} />
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}
