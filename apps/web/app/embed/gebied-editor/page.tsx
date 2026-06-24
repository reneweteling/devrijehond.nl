'use client';

/**
 * Chrome-less embed of the web's Google Maps editable-polygon editor, meant to
 * be loaded in a React Native WebView so mobile gets the exact same area-drawing
 * UX as the website (drag vertices, drag the midpoint handles to insert, tap the
 * map to add a point). The native react-native-maps / Apple+Google iOS SDKs have
 * no editable polygon, so we reuse this instead of re-building it on the device.
 *
 * Contract with the app (via `window.ReactNativeWebView.postMessage`):
 *   - `{ type: 'done', coordinates: [[lng, lat], …] }` — the GeoJSON ring.
 *   - `{ type: 'cancel' }`.
 * Inputs come from the query string: `lat`, `lng`, `zoom`, and optional `geom`
 * (a JSON `[[lng,lat], …]` ring to edit an existing area).
 *
 * Lives outside the (site) group so it gets none of the site header/footer.
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';

type Point = { lat: number; lng: number };

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEFAULT_CENTER: Point = { lat: 52.37, lng: 4.9 };

function postToApp(message: unknown) {
  const w = window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } };
  w.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

/** Parse the editor inputs from the URL once (client-only, no SSR concern). */
function readParams(): { center: Point; zoom: number; initial: Point[] } {
  if (typeof window === 'undefined') return { center: DEFAULT_CENTER, zoom: 15, initial: [] };
  const p = new URLSearchParams(window.location.search);
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  const zoom = Number(p.get('zoom'));
  let initial: Point[] = [];
  const geom = p.get('geom');
  if (geom) {
    try {
      const ring = JSON.parse(geom) as [number, number][];
      initial = ring.map(([lo, la]) => ({ lat: la, lng: lo }));
    } catch {
      initial = [];
    }
  }
  return {
    center: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : DEFAULT_CENTER,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 15,
    initial,
  };
}

/**
 * The Google Maps editable polygon. Map-tap adds a vertex, vertices drag to
 * adjust, the midpoint ghost handles drag to insert. (Right-click delete is
 * desktop-only; on touch you use Wis laatste / Wis alles.)
 */
function PolygonEditor({ points, onPoints }: { points: Point[]; onPoints: (p: Point[]) => void }) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const externalUpdate = useRef(false);

  useEffect(() => {
    if (!map) return;
    const poly = new google.maps.Polygon({
      editable: true,
      draggable: false,
      strokeColor: '#4c5622',
      strokeWeight: 2,
      fillColor: '#6e7b33',
      fillOpacity: 0.25,
    });
    poly.setPath(points);
    poly.setMap(map);
    polyRef.current = poly;

    function readCoords() {
      if (!polyRef.current || externalUpdate.current) return;
      const path = polyRef.current.getPath();
      const coords: Point[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const ll = path.getAt(i);
        coords.push({ lat: ll.lat(), lng: ll.lng() });
      }
      onPoints(coords);
    }

    const path = poly.getPath();
    const mapClickL = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !polyRef.current) return;
      polyRef.current.getPath().push(e.latLng);
    });
    const rightClickL = poly.addListener('rightclick', (e: google.maps.PolyMouseEvent) => {
      if (e.vertex != null && polyRef.current) polyRef.current.getPath().removeAt(e.vertex);
    });
    listenersRef.current = [
      path.addListener('set_at', readCoords),
      path.addListener('insert_at', readCoords),
      path.addListener('remove_at', readCoords),
      mapClickL,
      rightClickL,
    ];
    return () => {
      poly.setMap(null);
      listenersRef.current.forEach((l) => l.remove());
      listenersRef.current = [];
      polyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Sync toolbar changes (undo / clear) back into the polygon.
  useEffect(() => {
    const poly = polyRef.current;
    if (!poly) return;
    const path = poly.getPath();
    const curLen = path.getLength();
    const same =
      curLen === points.length &&
      points.every((pt, i) => {
        const ll = path.getAt(i);
        return Math.abs(ll.lat() - pt.lat) < 1e-9 && Math.abs(ll.lng() - pt.lng) < 1e-9;
      });
    if (same) return;
    externalUpdate.current = true;
    poly.setPath(points);
    externalUpdate.current = false;
  }, [points]);

  return null;
}

export default function GebiedEditorPage() {
  const [{ center, zoom, initial }] = useState(readParams);
  const [points, setPoints] = useState<Point[]>(initial);

  // Lock body scroll/overscroll so the map owns all gestures inside the WebView.
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overscrollBehavior = 'none';
  }, []);

  const done = () => {
    if (points.length < 3) return;
    postToApp({ type: 'done', coordinates: points.map((p) => [p.lng, p.lat]) });
  };

  if (!GOOGLE_MAPS_KEY) {
    return <div style={S.error}>Google Maps key ontbreekt.</div>;
  }

  return (
    <div style={S.root}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI
          style={{ width: '100%', height: '100%' }}
        >
          <PolygonEditor points={points} onPoints={setPoints} />
          {points.map((p, i) => (
            <Marker
              key={i}
              position={p}
              label={{ text: String(i + 1), color: '#fff', fontWeight: '700', fontSize: '12px' }}
            />
          ))}
        </Map>
      </APIProvider>

      <div style={S.hint}>
        Tik op de kaart om punten te zetten · sleep een punt om bij te stellen · sleep een
        tussenpunt om er een toe te voegen (min. 3).
      </div>

      <div style={S.bar}>
        <button style={S.ghost} onClick={() => setPoints((p) => p.slice(0, -1))}>
          Wis laatste
        </button>
        <button style={S.ghost} onClick={() => setPoints([])}>
          Wis alles
        </button>
        <button style={S.ghost} onClick={() => postToApp({ type: 'cancel' })}>
          Annuleren
        </button>
        <button
          style={{ ...S.primary, opacity: points.length < 3 ? 0.5 : 1 }}
          disabled={points.length < 3}
          onClick={done}
        >
          Klaar ({points.length})
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#e7e9d5' },
  hint: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: '8px 12px',
    fontSize: 12,
    lineHeight: '16px',
    color: '#3a3f2a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ghost: {
    flex: '0 0 auto',
    padding: '12px 14px',
    borderRadius: 999,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'rgba(255,255,255,0.95)',
    color: '#3a3f2a',
    fontSize: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  primary: {
    flex: 1,
    padding: '14px 16px',
    borderRadius: 999,
    border: 'none',
    background: '#6e7b33',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  error: { padding: 24, fontFamily: 'system-ui, sans-serif', color: '#a3331f' },
};
