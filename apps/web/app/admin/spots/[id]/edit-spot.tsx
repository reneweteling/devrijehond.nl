'use client';

/**
 * Admin edit island for spot detail.
 *
 * ONE save button for all editable fields (name, description, category,
 * address, phone, website, amenities, geometry). Only the actions whose values
 * actually changed from the initial props are called. Status transitions and
 * photo management stay as immediate actions.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import {
  updateSpotFields,
  updateSpotContact,
  setSpotAmenities,
  setSpotStatus,
  updateSpotGeometry,
  addSpotPhoto,
  removeSpotPhoto,
} from '../../actions';
import { RichTextEditor } from '../../_components/rich-text-editor';
import { statusLabel } from '../../_components/status-pill';
import { TagInput, type TagOption } from '../../_components/tag-input';
import { createAmenityTag } from './actions';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Point = { lat: number; lng: number };
type Photo = { id: string; url: string };
type Category = { id: string; label: string; type?: string };

export type EditSpotProps = {
  spotId: string;
  spotType: 'POI' | 'REGION';
  initialName: string;
  initialDescription: string | null;
  initialCategoryId: string;
  initialStatus: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
  initialAddress: string | null;
  initialPhone: string | null;
  initialWebsite: string | null;
  initialAmenities: TagOption[];
  initialPhotos: Photo[];
  lat: number | null;
  lng: number | null;
  polygonCoords: Point[] | null;
};

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--ink-3)',
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
  background: '#fff',
  color: 'var(--ink)',
  fontFamily: 'inherit',
};

// Card section heading. Matches the rest of the admin (e.g. the taxonomy page's
// card titles): plain display font, no uppercase / letter-spacing tweaks that
// would make Fraunces read like a different typeface.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, margin: '0 0 14px' }}>{children}</h2>;
}

function Feedback({ msg, ok }: { msg: string | null; ok: boolean }) {
  if (!msg) return null;
  return <span style={{ fontSize: 13, color: ok ? 'var(--moss-700)' : 'var(--rust)' }}>{msg}</span>;
}

// ---------------------------------------------------------------------------
// Dirty tracking helpers
// ---------------------------------------------------------------------------

function pointsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    if (!q) return false;
    return Math.abs(p.lat - q.lat) < 1e-9 && Math.abs(p.lng - q.lng) < 1e-9;
  });
}

function amenityIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

// ---------------------------------------------------------------------------
// Polygon editor inner — runs inside <Map> so useMap() works
// ---------------------------------------------------------------------------

function EditablePolygonInner({
  initialCoords,
  points,
  onPoints,
}: {
  initialCoords: Point[];
  points: Point[];
  onPoints: (p: Point[]) => void;
}) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const externalUpdate = useRef(false);

  // Bootstrap the polygon on mount
  useEffect(() => {
    if (!map) return;

    const poly = new google.maps.Polygon({
      paths: initialCoords.length > 0 ? initialCoords : [],
      editable: true,
      draggable: false,
      strokeColor: '#4c5622',
      strokeWeight: 2,
      fillColor: '#6e7b33',
      fillOpacity: 0.25,
    });
    poly.setMap(map);
    polyRef.current = poly;

    if (initialCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      initialCoords.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 40);
    }

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
      if (e.vertex != null && polyRef.current) {
        polyRef.current.getPath().removeAt(e.vertex);
      }
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
  }, [map]); // intentionally only re-runs when map instance changes

  // Sync toolbar changes (undo / clear) back into the google.maps.Polygon
  useEffect(() => {
    if (!polyRef.current) return;
    const poly = polyRef.current;
    const path = poly.getPath();

    const curLen = path.getLength();
    if (
      curLen === points.length &&
      points.every((p, i) => {
        const ll = path.getAt(i);
        return Math.abs(ll.lat() - p.lat) < 1e-9 && Math.abs(ll.lng() - p.lng) < 1e-9;
      })
    ) {
      return; // already in sync, skip
    }

    externalUpdate.current = true;
    listenersRef.current.forEach((l) => l.remove());

    poly.setPaths(points);

    const newPath = poly.getPath();
    const onPoints_ = onPoints; // stable ref for closure
    function readCoords() {
      if (externalUpdate.current) return;
      const coords: Point[] = [];
      for (let i = 0; i < newPath.getLength(); i++) {
        const ll = newPath.getAt(i);
        coords.push({ lat: ll.lat(), lng: ll.lng() });
      }
      onPoints_(coords);
    }

    const mapEl = (poly as unknown as { map: google.maps.Map }).map;
    const mapClickL =
      mapEl &&
      mapEl.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !polyRef.current) return;
        polyRef.current.getPath().push(e.latLng);
      });
    const rightClickL = poly.addListener('rightclick', (e: google.maps.PolyMouseEvent) => {
      if (e.vertex != null && polyRef.current) {
        polyRef.current.getPath().removeAt(e.vertex);
      }
    });

    listenersRef.current = [
      newPath.addListener('set_at', readCoords),
      newPath.addListener('insert_at', readCoords),
      newPath.addListener('remove_at', readCoords),
      rightClickL,
      ...(mapClickL ? [mapClickL] : []),
    ];

    externalUpdate.current = false;
  }, [points, onPoints]);

  return null;
}

// ---------------------------------------------------------------------------
// Polygon map + toolbar (no save button — just editing controls)
// ---------------------------------------------------------------------------

function PolygonEditor({
  initialCoords,
  points,
  onPoints,
}: {
  initialCoords: Point[];
  points: Point[];
  onPoints: (p: Point[]) => void;
}) {
  const center =
    points.length > 0
      ? {
          lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
          lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
        }
      : { lat: 52.13, lng: 5.29 };

  const tooFew = points.length > 0 && points.length < 3;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
        Tik op de kaart om een punt toe te voegen. Sleep een punt om het te verplaatsen. Rechtsklik
        een punt om het te verwijderen.
      </p>

      <div
        style={{
          height: 380,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        {GOOGLE_MAPS_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <Map
              defaultCenter={center}
              defaultZoom={initialCoords.length > 0 ? 12 : 8}
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <EditablePolygonInner
                initialCoords={initialCoords}
                points={points}
                onPoints={onPoints}
              />
              {points.map((p, i) => (
                <Marker
                  key={i}
                  position={p}
                  label={{
                    text: String(i + 1),
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '12px',
                  }}
                />
              ))}
            </Map>
          </APIProvider>
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              fontSize: 14,
              color: 'var(--ink-3)',
            }}
          >
            Google Maps API-sleutel ontbreekt.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500 }}>
          Punten: {points.length}
        </span>
        {tooFew ? <span style={{ fontSize: 13, color: 'var(--rust)' }}>minimaal 3</span> : null}
        <button
          type="button"
          className="btn btn-sm btn-soft"
          onClick={() => onPoints(points.slice(0, -1))}
          disabled={points.length === 0}
        >
          Ongedaan maken
        </button>
        <button
          type="button"
          className="btn btn-sm btn-soft"
          onClick={() => onPoints([])}
          disabled={points.length === 0}
        >
          Leegmaken
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POI marker (no save button)
// ---------------------------------------------------------------------------

function PoiEditor({ position, onPosition }: { position: Point; onPosition: (p: Point) => void }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
        Sleep de pin naar de juiste locatie.
      </p>
      <div
        style={{
          height: 280,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        {GOOGLE_MAPS_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <Map
              defaultCenter={position}
              defaultZoom={15}
              gestureHandling="cooperative"
              style={{ width: '100%', height: '100%' }}
            >
              <Marker
                position={position}
                draggable
                onDragEnd={(e) => {
                  const ll = e.latLng;
                  if (ll) onPosition({ lat: ll.lat(), lng: ll.lng() });
                }}
              />
            </Map>
          </APIProvider>
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              fontSize: 14,
              color: 'var(--ink-3)',
            }}
          >
            Google Maps API-sleutel ontbreekt.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo section — stays as an immediate action, not part of the bulk save
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function FotosSection({ spotId, initialPhotos }: { spotId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadOk(false);
      setUploadMsg('Bestandstype niet ondersteund (jpeg, png, webp of heic).');
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/me/uploads', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error('Upload mislukt.');
      const { publicUrl } = (await res.json()) as { publicUrl: string };
      await addSpotPhoto(spotId, publicUrl);
      setPhotos((prev) => [...prev, { id: crypto.randomUUID(), url: publicUrl }]);
      setUploadOk(true);
      setUploadMsg('Foto toegevoegd.');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadOk(false);
      setUploadMsg(err instanceof Error ? err.message : 'Er is iets misgegaan.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(photoId: string) {
    setRemovingId(photoId);
    try {
      await removeSpotPhoto(photoId, spotId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      // leave list unchanged on error
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="card" style={{ padding: 20 }}>
      <SectionHeading>{"Foto's"}</SectionHeading>

      {photos.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <img
                src={p.url}
                alt=""
                style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  objectFit: 'cover',
                  borderRadius: 8,
                  display: 'block',
                }}
              />
              <button
                type="button"
                disabled={removingId === p.id}
                onClick={() => handleRemove(p.id)}
                title="Verwijder foto"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(163,59,45,0.92)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {removingId === p.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>Nog geen foto's.</p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 14px',
            borderRadius: 999,
            border: '1.5px solid var(--line)',
            background: uploading ? 'var(--moss-soft)' : '#fff',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--ink-2)',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? 'Uploaden…' : 'Foto toevoegen'}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            disabled={uploading}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        <Feedback msg={uploadMsg} ok={uploadOk} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root: all field state + single save
// ---------------------------------------------------------------------------

export function EditSpot({
  spotId,
  spotType,
  initialName,
  initialDescription,
  initialCategoryId,
  initialStatus,
  initialAddress,
  initialPhone,
  initialWebsite,
  initialAmenities,
  initialPhotos,
  lat,
  lng,
  polygonCoords,
}: EditSpotProps) {
  // --- field state ---
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [website, setWebsite] = useState(initialWebsite ?? '');
  // Selected amenities as full {id,label} tags so the tag input can render
  // labels even for amenities that aren't in the current category's suggestions.
  const [selectedAmenities, setSelectedAmenities] = useState<TagOption[]>(initialAmenities);

  // geometry
  const defaultPoiPos: Point = { lat: lat ?? 52.13, lng: lng ?? 5.29 };
  const [markerPos, setMarkerPos] = useState<Point>(defaultPoiPos);
  const [polyPoints, setPolyPoints] = useState<Point[]>(polygonCoords ?? []);

  // "baseline" — what was last successfully saved. Used for dirty detection.
  const baseline = useRef({
    name: initialName,
    description: initialDescription ?? '',
    categoryId: initialCategoryId,
    address: initialAddress ?? '',
    phone: initialPhone ?? '',
    website: initialWebsite ?? '',
    amenityIds: initialAmenities.map((a) => a.id).sort(),
    markerPos: defaultPoiPos,
    polyPoints: polygonCoords ?? [],
  });

  // --- categories + amenity suggestions (scoped to the spot's category) ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenitySuggestions, setAmenitySuggestions] = useState<TagOption[]>([]);

  useEffect(() => {
    const qs = spotType === 'REGION' ? '?type=REGION' : '?type=POI';
    fetch(`/api/v1/categories${qs}`)
      .then((r) => r.json())
      .then((data: { items?: Category[] }) => setCategories(data.items ?? []))
      .catch(() => {});
  }, [spotType]);

  useEffect(() => {
    if (!categoryId) return;
    fetch(`/api/v1/amenities?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data: { items?: TagOption[] }) => setAmenitySuggestions(data.items ?? []))
      .catch(() => {});
  }, [categoryId]);

  // --- status (immediate action, not part of bulk save) ---
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [statusPending, startStatusTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function handleStatus(status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED') {
    setStatusMsg(null);
    startStatusTransition(async () => {
      try {
        await setSpotStatus(spotId, status);
        setCurrentStatus(status);
        setStatusMsg('Status bijgewerkt.');
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : 'Er is iets misgegaan.');
      }
    });
  }

  // --- single bulk save ---
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    const b = baseline.current;
    const trimName = name.trim();
    const trimDesc = description.trim();
    const trimAddr = address.trim();
    const trimPhone = phone.trim();
    const trimWebsite = website.trim();
    const amenityIds = selectedAmenities.map((a) => a.id).sort();

    const fieldsChanged =
      trimName !== b.name || trimDesc !== b.description || categoryId !== b.categoryId;
    const contactChanged =
      trimAddr !== b.address || trimPhone !== b.phone || trimWebsite !== b.website;
    const amenitiesChanged = !amenityIdsEqual(amenityIds, b.amenityIds);

    const geomChanged =
      spotType === 'POI'
        ? Math.abs(markerPos.lat - b.markerPos.lat) > 1e-9 ||
          Math.abs(markerPos.lng - b.markerPos.lng) > 1e-9
        : !pointsEqual(polyPoints, b.polyPoints);

    if (!fieldsChanged && !contactChanged && !amenitiesChanged && !geomChanged) {
      setSaveOk(true);
      setSaveMsg('Geen wijzigingen.');
      return;
    }

    startTransition(async () => {
      try {
        const jobs: Promise<void>[] = [];

        if (fieldsChanged) {
          jobs.push(
            updateSpotFields(spotId, {
              name: trimName || undefined,
              description: trimDesc || null,
              categoryId: categoryId || undefined,
            }),
          );
        }
        if (contactChanged) {
          jobs.push(
            updateSpotContact(spotId, {
              address: trimAddr || null,
              phone: trimPhone || null,
              website: trimWebsite || null,
            }),
          );
        }
        if (amenitiesChanged) {
          jobs.push(setSpotAmenities(spotId, amenityIds));
        }
        if (geomChanged) {
          if (spotType === 'POI') {
            jobs.push(updateSpotGeometry(spotId, { point: markerPos }));
          } else if (polyPoints.length >= 3) {
            jobs.push(updateSpotGeometry(spotId, { polygon: polyPoints }));
          }
        }

        await Promise.all(jobs);

        // Update baseline to current values
        baseline.current = {
          name: trimName,
          description: trimDesc,
          categoryId,
          address: trimAddr,
          phone: trimPhone,
          website: trimWebsite,
          amenityIds,
          markerPos,
          polyPoints,
        };

        setSaveOk(true);
        setSaveMsg('Wijzigingen opgeslagen.');
      } catch (err) {
        setSaveOk(false);
        setSaveMsg(err instanceof Error ? err.message : 'Er is iets misgegaan.');
      }
    });
  }

  const STATUS_TRANSITIONS: {
    status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
    label: string;
    cls: string;
  }[] = [
    { status: 'VERIFIED', label: 'Verifieer', cls: 'btn btn-sm btn-primary' },
    { status: 'UNVERIFIED', label: 'Niet geverifieerd', cls: 'btn btn-sm btn-soft' },
    { status: 'HIDDEN', label: 'Verberg', cls: 'btn btn-sm btn-soft' },
    { status: 'REMOVED', label: 'Verwijder', cls: 'btn btn-sm btn-danger' },
  ];

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: 24 }}>
      {/* 1 — Kerngegevens */}
      <section className="card" style={{ padding: 20 }}>
        <SectionHeading>Kerngegevens</SectionHeading>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Naam</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Beschrijving</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Wat maakt deze plek bijzonder voor honden?"
            />
          </div>
          <div>
            <label style={labelStyle}>Categorie</label>
            <select
              style={inputStyle}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status — immediate action, separate from the form save */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>
            Status: <strong>{statusLabel(currentStatus)}</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {STATUS_TRANSITIONS.filter((t) => t.status !== currentStatus).map((t) => (
              <button
                key={t.status}
                type="button"
                className={t.cls}
                disabled={statusPending}
                onClick={() => handleStatus(t.status)}
              >
                {t.label}
              </button>
            ))}
            {statusPending ? (
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Bijwerken…</span>
            ) : null}
            <Feedback msg={statusMsg} ok={statusMsg === 'Status bijgewerkt.'} />
          </div>
        </div>
      </section>

      {/* 2 — Contact */}
      <section className="card" style={{ padding: 20 }}>
        <SectionHeading>Contact</SectionHeading>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Adres</label>
            <input
              style={inputStyle}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straat 1, 1234 AB Stad"
            />
          </div>
          <div>
            <label style={labelStyle}>Telefoon</label>
            <input
              style={inputStyle}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="+31 6 12345678"
            />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input
              style={inputStyle}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              type="url"
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      {/* 3 — Voorzieningen */}
      <section className="card" style={{ padding: 20 }}>
        <SectionHeading>Voorzieningen</SectionHeading>
        <TagInput
          value={selectedAmenities}
          onChange={setSelectedAmenities}
          suggestions={amenitySuggestions}
          allowCreate
          onCreate={(label) => createAmenityTag(label, categoryId)}
          placeholder="Voorziening zoeken of toevoegen…"
        />
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '10px 0 0' }}>
          Typ om te zoeken. Bestaat een voorziening nog niet, dan kun je hem hier toevoegen, hij
          komt dan als voorstel op de taxonomiepagina.
        </p>
      </section>

      {/* 4 — Foto's (immediate action — outside the form save flow) */}
      <FotosSection spotId={spotId} initialPhotos={initialPhotos} />

      {/* 5 — Geometrie */}
      <section className="card" style={{ padding: 20 }}>
        <SectionHeading>Geometrie</SectionHeading>
        {spotType === 'REGION' ? (
          <PolygonEditor
            initialCoords={polygonCoords ?? []}
            points={polyPoints}
            onPoints={setPolyPoints}
          />
        ) : (
          <PoiEditor position={markerPos} onPosition={setMarkerPos} />
        )}
        {spotType === 'REGION' && polyPoints.length > 0 && polyPoints.length < 3 ? (
          <p style={{ fontSize: 13, color: 'var(--rust)', marginTop: 8 }}>
            Minimaal 3 punten vereist om geometrie op te slaan.
          </p>
        ) : null}
      </section>

      {/* Single save button */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          padding: '16px 20px',
          background: 'var(--cream)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            isPending || (spotType === 'REGION' && polyPoints.length > 0 && polyPoints.length < 3)
          }
        >
          {isPending ? 'Opslaan…' : 'Wijzigingen opslaan'}
        </button>
        <Feedback msg={saveMsg} ok={saveOk} />
      </div>
    </form>
  );
}
