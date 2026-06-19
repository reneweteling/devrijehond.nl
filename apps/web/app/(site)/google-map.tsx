'use client';

/**
 * Google Maps map backend (used when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set).
 * Uses `@vis.gl/react-google-maps`. Markers are classic `Marker`s with a
 * coloured SVG data-URI pin, so this works with a plain Maps JavaScript API key
 *, no Map ID / vector map setup required.
 */

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import type { SpotSummaryDto } from '@devrijehond/types';
import {
  type Bbox,
  type MapViewProps,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  markerColor,
  spotHref,
} from './map-shared';

function pinIcon(s: SpotSummaryDto): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='8' fill='${markerColor(s)}' stroke='white' stroke-width='2'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function GoogleMapView({
  apiKey,
  spots,
  onBoundsChange,
}: MapViewProps & { apiKey: string }) {
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
        onIdle={(e) => {
          const b = e.map.getBounds();
          if (!b) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const bbox: Bbox = {
            minLng: sw.lng(),
            minLat: sw.lat(),
            maxLng: ne.lng(),
            maxLat: ne.lat(),
          };
          onBoundsChange(bbox);
        }}
      >
        {spots
          .filter((s) => s.lat != null && s.lng != null)
          .map((s) => (
            <Marker
              key={s.id}
              position={{ lat: s.lat as number, lng: s.lng as number }}
              title={s.name}
              icon={pinIcon(s)}
              onClick={() => {
                window.location.href = spotHref(s);
              }}
            />
          ))}
      </Map>
    </APIProvider>
  );
}
