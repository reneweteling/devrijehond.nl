'use client';

/**
 * Google Maps map backend. Uses `@vis.gl/react-google-maps`. Markers are
 * classic `Marker`s with a coloured SVG data-URI pin, so this works with a
 * plain Maps JavaScript API key (no Map ID / vector map setup). Clicking a pin
 * opens an info balloon (InfoWindow) with the spot name + a link, instead of
 * navigating away immediately.
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { SpotSummaryDto } from '@devrijehond/types';
import {
  type Bbox,
  type ClusterItem,
  type MapViewProps,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  markerColor,
  spotHref,
} from './map-shared';

/**
 * Asks the browser for the visitor's location once and recenters the map there
 * (that's where they walk). Renders nothing; runs inside the Map context so it
 * can drive the live map instance via useMap().
 */
function RecenterOnUser() {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || done.current || typeof navigator === 'undefined' || !navigator.geolocation) return;
    done.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(13);
      },
      () => {
        /* denied / unavailable: keep the default NL view */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [map]);
  return null;
}

function pinIcon(s: SpotSummaryDto): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='8' fill='${markerColor(s)}' stroke='white' stroke-width='2'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function clusterIcon(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='17' fill='#41481f' stroke='white' stroke-width='2.5'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Cluster count bubbles; clicking one zooms in to resolve it. Runs inside the
 *  Map context so it can drive the live map via useMap(). */
function ClusterMarkers({ clusters }: { clusters: ClusterItem[] }) {
  const map = useMap();
  return (
    <>
      {clusters.map((c, i) => (
        <Marker
          key={`cluster-${i}-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}`}
          position={{ lat: c.lat, lng: c.lng }}
          icon={clusterIcon()}
          label={{ text: String(c.count), color: '#fff', fontSize: '12px', fontWeight: '700' }}
          onClick={() => {
            if (!map) return;
            map.panTo({ lat: c.lat, lng: c.lng });
            map.setZoom(Math.min((map.getZoom() ?? DEFAULT_ZOOM) + 3, 16));
          }}
        />
      ))}
    </>
  );
}

export function GoogleMapView({
  apiKey,
  spots,
  clusters = [],
  onBoundsChange,
}: MapViewProps & { apiKey: string }) {
  const [selected, setSelected] = useState<SpotSummaryDto | null>(null);
  const verified = selected?.status === 'VERIFIED';

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelected(null)}
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
        <RecenterOnUser />
        <ClusterMarkers clusters={clusters} />
        {spots
          .filter((s) => s.lat != null && s.lng != null)
          .map((s) => (
            <Marker
              key={s.id}
              position={{ lat: s.lat as number, lng: s.lng as number }}
              title={s.name}
              icon={pinIcon(s)}
              onClick={() => setSelected(s)}
            />
          ))}

        {selected && selected.lat != null && selected.lng != null ? (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
            headerDisabled
          >
            <div
              style={{
                font: '14px/1.4 system-ui, sans-serif',
                minWidth: 160,
                padding: '2px 2px 4px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: '#232a1b' }}>{selected.name}</div>
              <div
                style={{
                  marginTop: 4,
                  marginBottom: 8,
                  fontSize: 12.5,
                  color: verified ? '#47521f' : '#9a4f1b',
                }}
              >
                {verified ? '✓ Geverifieerd' : '◌ Nog niet geverifieerd'}
              </div>
              <a
                href={spotHref(selected)}
                style={{
                  color: '#47521f',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: 13.5,
                }}
              >
                Bekijk plek →
              </a>
            </div>
          </InfoWindow>
        ) : null}
      </Map>
    </APIProvider>
  );
}
