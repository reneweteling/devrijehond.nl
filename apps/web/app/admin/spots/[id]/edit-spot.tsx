'use client';

/**
 * Edit island for the admin spot detail page. Handles field edits, status
 * transitions, and geometry (POI marker or REGION polygon).
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { updateSpotFields, updateSpotGeometry, setSpotStatus } from '../../actions';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditSpotProps = {
  spotId: string;
  spotType: 'POI' | 'REGION';
  initialName: string;
  initialDescription: string | null;
  initialCategoryId: string;
  initialStatus: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
  lat: number | null;
  lng: number | null;
  polygonCoords: Array<{ lat: number; lng: number }> | null;
};

type Category = { id: string; label: string };

const STATUS_ACTIONS: {
  status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
  label: string;
  variant: 'primary' | 'soft' | 'danger';
}[] = [
  { status: 'VERIFIED', label: 'Verifieer', variant: 'primary' },
  { status: 'UNVERIFIED', label: 'Herstel naar niet-geverifieerd', variant: 'soft' },
  { status: 'HIDDEN', label: 'Verberg', variant: 'soft' },
  { status: 'REMOVED', label: 'Verwijder', variant: 'danger' },
];

// ---------------------------------------------------------------------------
// Editable polygon component (draws on canvas map)
// ---------------------------------------------------------------------------

type LngLat = { lat: number; lng: number };

function EditablePolygon({
  initialCoords,
  onChange,
}: {
  initialCoords: LngLat[];
  onChange: (coords: LngLat[]) => void;
}) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map || !initialCoords.length) return;

    const poly = new google.maps.Polygon({
      paths: initialCoords,
      strokeColor: '#4c5622',
      strokeWeight: 2,
      fillColor: '#6e7b33',
      fillOpacity: 0.28,
      editable: true,
    });
    poly.setMap(map);
    polyRef.current = poly;

    const bounds = new google.maps.LatLngBounds();
    initialCoords.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 32);

    const readCoords = () => {
      const path = poly.getPath();
      const coords: LngLat[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const ll = path.getAt(i);
        coords.push({ lat: ll.lat(), lng: ll.lng() });
      }
      onChange(coords);
    };

    const listeners = [
      poly.getPath().addListener('set_at', readCoords),
      poly.getPath().addListener('insert_at', readCoords),
      poly.getPath().addListener('remove_at', readCoords),
    ];

    return () => {
      poly.setMap(null);
      listeners.forEach((l) => l.remove());
    };
  }, [map]); // polygonCoords is stable (prop from server), no dependency needed

  return null;
}

// ---------------------------------------------------------------------------
// Draggable marker for POI
// ---------------------------------------------------------------------------

function DraggableMarker({
  position,
  onChange,
}: {
  position: LngLat;
  onChange: (pos: LngLat) => void;
}) {
  return (
    <Marker
      position={position}
      draggable
      onDragEnd={(e) => {
        const ll = e.latLng;
        if (ll) onChange({ lat: ll.lat(), lng: ll.lng() });
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fields form
// ---------------------------------------------------------------------------

function FieldsForm({
  spotId,
  initialName,
  initialDescription,
  initialCategoryId,
  initialStatus,
}: {
  spotId: string;
  initialName: string;
  initialDescription: string | null;
  initialCategoryId: string;
  initialStatus: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/categories')
      .then((r) => r.json())
      .then((data: { items?: Category[] }) => setCategories(data.items ?? []))
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await updateSpotFields(spotId, {
        name: name.trim() || undefined,
        description: description.trim() || null,
        categoryId: categoryId || undefined,
      });
      setMsg('Opgeslagen.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Er is iets misgegaan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
      <div>
        <label style={labelStyle}>Naam</label>
        <input
          className="admin-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Beschrijving</label>
        <textarea
          className="admin-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={labelStyle}>Categorie</label>
        <select
          className="admin-input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={inputStyle}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Opslaan…' : 'Velden opslaan'}
        </button>
        {msg ? (
          <span className="muted" style={{ fontSize: 14 }}>
            {msg}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>Status wijzigen:</p>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_ACTIONS.filter((a) => a.status !== initialStatus).map((a) => {
            const cls =
              a.variant === 'primary'
                ? 'btn btn-sm btn-primary'
                : a.variant === 'danger'
                  ? 'btn btn-sm btn-danger'
                  : 'btn btn-sm btn-soft';
            return (
              <form key={a.status} action={setSpotStatus.bind(null, spotId, a.status)}>
                <button type="submit" className={cls}>
                  {a.label}
                </button>
              </form>
            );
          })}
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Geometry editor
// ---------------------------------------------------------------------------

function GeometryEditor({
  spotId,
  spotType,
  lat,
  lng,
  polygonCoords,
}: {
  spotId: string;
  spotType: 'POI' | 'REGION';
  lat: number | null;
  lng: number | null;
  polygonCoords: LngLat[] | null;
}) {
  const defaultCenter = { lat: lat ?? 52.13, lng: lng ?? 5.29 };
  const [markerPos, setMarkerPos] = useState<LngLat>(defaultCenter);
  const [polyCoords, setPolyCoords] = useState<LngLat[]>(polygonCoords ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        Google Maps API-sleutel ontbreekt (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </p>
    );
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      if (spotType === 'POI') {
        await updateSpotGeometry(spotId, { point: markerPos });
      } else {
        await updateSpotGeometry(spotId, { polygon: polyCoords });
      }
      setMsg('Geometrie opgeslagen.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Er is iets misgegaan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          height: 340,
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        <APIProvider apiKey={GOOGLE_MAPS_KEY}>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={spotType === 'REGION' ? 12 : 15}
            gestureHandling="cooperative"
            style={{ width: '100%', height: '100%' }}
          >
            {spotType === 'POI' ? (
              <DraggableMarker position={markerPos} onChange={setMarkerPos} />
            ) : (
              <EditablePolygon initialCoords={polyCoords} onChange={setPolyCoords} />
            )}
          </Map>
        </APIProvider>
      </div>

      {spotType === 'POI' ? (
        <p className="muted" style={{ fontSize: 13 }}>
          Sleep de pin naar de juiste locatie en sla op.
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>
          Sleep de hoekpunten van het gebied en sla op.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? 'Opslaan…' : 'Geometrie opslaan'}
        </button>
        {msg ? (
          <span className="muted" style={{ fontSize: 14 }}>
            {msg}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--ink-3)',
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  fontSize: 15,
  background: '#fff',
  color: 'var(--ink)',
};

export function EditSpot({
  spotId,
  spotType,
  initialName,
  initialDescription,
  initialCategoryId,
  initialStatus,
  lat,
  lng,
  polygonCoords,
}: EditSpotProps) {
  return (
    <div style={{ display: 'grid', gap: 32 }}>
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Velden bewerken</h2>
        <FieldsForm
          spotId={spotId}
          initialName={initialName}
          initialDescription={initialDescription}
          initialCategoryId={initialCategoryId}
          initialStatus={initialStatus}
        />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Locatie bewerken</h2>
        <GeometryEditor
          spotId={spotId}
          spotType={spotType}
          lat={lat}
          lng={lng}
          polygonCoords={polygonCoords}
        />
      </section>
    </div>
  );
}
