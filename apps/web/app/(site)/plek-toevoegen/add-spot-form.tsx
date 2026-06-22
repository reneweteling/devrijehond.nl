'use client';

/**
 * Client island for /plek-toevoegen.
 *
 * Supports both spot types:
 *   - POI  ("Plek")    — draggable marker, point geometry
 *   - REGION ("Gebied") — editable polygon, geofence geometry
 *
 * Features: type toggle, address geocode search, map editor (pin / polygon),
 * multiple photo upload, categories filtered by type, amenities, contact fields.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { authClient } from '@devrijehond/auth/client';
import type { CategoryDto, AmenityDto } from '@devrijehond/types';
import { RichTextEditor } from '@/app/admin/_components/rich-text-editor';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEFAULT_CENTER = { lat: 52.37, lng: 4.89 };
const DEFAULT_ZOOM = 9;
const GEOCODE_DEBOUNCE_MS = 350;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

type SpotType = 'POI' | 'REGION';
type Point = { lat: number; lng: number };

/* -------------------------------------------------------------------------- */
/* Inline icon helper (Lucide-style paths)                                     */
/* -------------------------------------------------------------------------- */
function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={d} />
    </svg>
  );
}
const D_PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z';
const D_SEARCH = 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z';
const D_CHECK = 'M20 6 9 17l-5-5';
const D_X = 'M18 6 6 18M6 6l12 12';
const D_IMG = 'M21 15l-5-5L5 21M3 3h18v18H3zM8.5 8.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z';

/* -------------------------------------------------------------------------- */
/* Shared style tokens                                                          */
/* -------------------------------------------------------------------------- */
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6 };
const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink)',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  fontSize: 15,
  background: 'var(--cream)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
};
const hintStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-3)' };

/* -------------------------------------------------------------------------- */
/* Address geocode search                                                       */
/* -------------------------------------------------------------------------- */
type GeocodeItem = { label: string; lat: number; lng: number };

function AddressSearch({ onSelect }: { onSelect: (item: GeocodeItem) => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GeocodeItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setItems([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(val.trim())}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { items: GeocodeItem[] };
        setItems(data.items ?? []);
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, GEOCODE_DEBOUNCE_MS);
  }

  function pick(item: GeocodeItem) {
    setQuery(item.label);
    setOpen(false);
    setItems([]);
    onSelect(item);
  }

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 13,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--ink-3)',
            pointerEvents: 'none',
          }}
        >
          <Ico d={D_SEARCH} size={16} />
        </span>
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Zoek op adres of plaatsnaam…"
          autoComplete="off"
          style={{ ...inputStyle, paddingLeft: 38 }}
        />
        {loading ? (
          <span
            style={{
              position: 'absolute',
              right: 13,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            Zoeken…
          </span>
        ) : null}
      </div>
      {open && items.length > 0 ? (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 100,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--cream)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {items.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(item)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  fontSize: 14,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--moss-soft)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'none';
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* POI pin map                                                                  */
/* -------------------------------------------------------------------------- */
function PinMapInner({
  point,
  onChange,
  panTarget,
}: {
  point: Point | null;
  onChange: (p: Point) => void;
  panTarget: (Point & { zoom: number }) | null;
}) {
  const map = useMap();
  const prevPanTarget = useRef<typeof panTarget>(null);

  useEffect(() => {
    if (!map || !panTarget) return;
    if (prevPanTarget.current === panTarget) return;
    prevPanTarget.current = panTarget;
    map.panTo({ lat: panTarget.lat, lng: panTarget.lng });
    map.setZoom(panTarget.zoom);
  }, [map, panTarget]);

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => {
        if (!e.detail.latLng) return;
        onChange({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
      }}
    >
      {point ? (
        <Marker
          position={point}
          draggable
          onDragEnd={(e) => {
            if (!e.latLng) return;
            onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
          title="Sleep om te verplaatsen"
        />
      ) : null}
    </Map>
  );
}

/* -------------------------------------------------------------------------- */
/* Editable polygon inner — must run inside <Map>                              */
/* -------------------------------------------------------------------------- */
function EditablePolygonInner({
  points,
  onPoints,
}: {
  points: Point[];
  onPoints: (p: Point[]) => void;
}) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const externalUpdate = useRef(false);

  // Bootstrap on mount.
  useEffect(() => {
    if (!map) return;

    const poly = new google.maps.Polygon({
      paths: points.length > 0 ? points : [],
      editable: true,
      draggable: false,
      strokeColor: '#4c5622',
      strokeWeight: 2,
      fillColor: '#6e7b33',
      fillOpacity: 0.25,
    });
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
  }, [map]); // intentionally re-runs only when map instance changes

  // Sync undo / clear / pan back into the google.maps.Polygon.
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
      return;
    }

    externalUpdate.current = true;
    listenersRef.current.forEach((l) => l.remove());

    poly.setPaths(points);

    const newPath = poly.getPath();
    const onPoints_ = onPoints;

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

/* -------------------------------------------------------------------------- */
/* Polygon map + toolbar                                                        */
/* -------------------------------------------------------------------------- */
function PolygonMap({
  points,
  onPoints,
  panTarget,
}: {
  points: Point[];
  onPoints: (p: Point[]) => void;
  panTarget: (Point & { zoom: number }) | null;
}) {
  const map = useMap();
  const prevPanTarget = useRef<typeof panTarget>(null);

  useEffect(() => {
    if (!map || !panTarget) return;
    if (prevPanTarget.current === panTarget) return;
    prevPanTarget.current = panTarget;
    map.panTo({ lat: panTarget.lat, lng: panTarget.lng });
    map.setZoom(panTarget.zoom);
  }, [map, panTarget]);

  return (
    <>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        style={{ width: '100%', height: '100%' }}
      >
        <EditablePolygonInner points={points} onPoints={onPoints} />
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
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Photo upload section                                                         */
/* -------------------------------------------------------------------------- */
type UploadedPhoto = { localId: string; url: string; previewUrl: string };

function PhotoUpload({
  photos,
  onChange,
}: {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadError('');

    const invalid = files.find((f) => !ALLOWED_PHOTO_TYPES.includes(f.type));
    if (invalid) {
      setUploadError('Bestandstype niet ondersteund. Gebruik jpeg, png, webp of heic.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const file of files) {
        const preview = URL.createObjectURL(file);
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/v1/me/uploads', {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!res.ok) throw new Error('Upload mislukt.');
        const { publicUrl } = (await res.json()) as { publicUrl: string };
        uploaded.push({ localId: crypto.randomUUID(), url: publicUrl, previewUrl: preview });
      }
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload mislukt.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function remove(localId: string) {
    const removed = photos.find((p) => p.localId === localId);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(photos.filter((p) => p.localId !== localId));
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>{"Foto's"}</span>
        <p style={{ ...hintStyle, marginTop: 4 }}>
          Meerdere foto's toegestaan. Max 10, jpeg/png/webp/heic.
        </p>
      </div>

      {photos.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {photos.map((p) => (
            <div key={p.localId} style={{ position: 'relative' }}>
              <img
                src={p.previewUrl}
                alt=""
                style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  objectFit: 'cover',
                  borderRadius: 8,
                  display: 'block',
                  border: '1px solid var(--line)',
                }}
              />
              <button
                type="button"
                onClick={() => remove(p.localId)}
                title="Foto verwijderen"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(163,59,45,0.9)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <Ico d={D_X} size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 18px',
          borderRadius: 999,
          border: '1.5px solid var(--line)',
          background: uploading ? 'var(--moss-soft)' : 'var(--cream)',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--ink-2)',
          cursor: uploading || photos.length >= 10 ? 'not-allowed' : 'pointer',
          opacity: photos.length >= 10 ? 0.5 : 1,
        }}
      >
        <Ico d={D_IMG} size={15} />
        {uploading ? 'Uploaden…' : "Foto's toevoegen"}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          disabled={uploading || photos.length >= 10}
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
      </label>

      {uploadError ? (
        <p role="alert" style={{ ...hintStyle, color: 'var(--rust)', marginTop: 8 }}>
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Type toggle                                                                  */
/* -------------------------------------------------------------------------- */
function TypeToggle({ value, onChange }: { value: SpotType; onChange: (v: SpotType) => void }) {
  const opts: { val: SpotType; label: string; hint: string }[] = [
    { val: 'POI', label: 'Plek', hint: 'café, park, strand…' },
    { val: 'REGION', label: 'Gebied', hint: 'losloopgebied, bos…' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}
    >
      {opts.map((o) => {
        const active = value === o.val;
        return (
          <button
            key={o.val}
            type="button"
            onClick={() => onChange(o.val)}
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
              background: active ? 'var(--moss-soft)' : 'var(--cream)',
              color: active ? 'var(--moss-700)' : 'var(--ink-2)',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            {o.label}
            <span
              style={{
                display: 'block',
                fontWeight: 400,
                fontSize: 13,
                color: active ? 'var(--moss-700)' : 'var(--ink-3)',
                marginTop: 3,
              }}
            >
              {o.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Success card                                                                 */
/* -------------------------------------------------------------------------- */
function SuccessCard({ spotSlug, spotName }: { spotSlug: string; spotName: string }) {
  return (
    <div
      className="card"
      style={{ padding: 28, textAlign: 'center', borderTop: '3px solid var(--moss)' }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--moss-soft)',
          color: 'var(--moss-700)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ico d={D_CHECK} size={22} />
      </div>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>Plek toegevoegd!</h2>
      <p style={{ color: 'var(--ink-2)', marginBottom: 20 }}>
        <strong>{spotName}</strong> staat nu op de kaart als nog niet geverifieerd. De community
        helpt hem bevestigen.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={`/plek/${spotSlug}`} className="btn btn-primary">
          Bekijk de plek
        </a>
        <a href="/plek-toevoegen" className="btn btn-ghost">
          Nog een plek toevoegen
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main form                                                                    */
/* -------------------------------------------------------------------------- */
export function AddSpotForm() {
  const { data: session, isPending } = authClient.useSession();

  // Spot type toggle.
  const [spotType, setSpotType] = useState<SpotType>('POI');

  // Taxonomy.
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [amenities, setAmenities] = useState<AmenityDto[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amenityIds, setAmenityIds] = useState<string[]>([]);

  // Geometry.
  const [point, setPoint] = useState<Point | null>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);

  // Pan target shared across both map types.
  const [panTarget, setPanTarget] = useState<(Point & { zoom: number }) | null>(null);

  // Text fields.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Photos.
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // Submit state.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ slug: string; name: string } | null>(null);

  // Load categories whenever the type changes.
  useEffect(() => {
    setCategoryId('');
    setAmenities([]);
    setAmenityIds([]);
    fetch(`/api/v1/categories?type=${spotType}`)
      .then((r) => r.json() as Promise<{ items: CategoryDto[] }>)
      .then((d) => {
        setCategories(d.items ?? []);
        if (d.items?.length) setCategoryId(d.items[0]!.id);
      })
      .catch(() => {});
  }, [spotType]);

  // Load amenities when category changes.
  useEffect(() => {
    if (!categoryId) {
      setAmenities([]);
      return;
    }
    fetch(`/api/v1/amenities?categoryId=${categoryId}`)
      .then((r) => r.json() as Promise<{ items: AmenityDto[] }>)
      .then((d) => {
        setAmenities(d.items ?? []);
        setAmenityIds([]);
      })
      .catch(() => {});
  }, [categoryId]);

  function toggleAmenity(id: string) {
    setAmenityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleTypeChange(t: SpotType) {
    setSpotType(t);
    // Reset geometry when switching types.
    setPoint(null);
    setPolyPoints([]);
    setPanTarget(null);
  }

  function handleGeocodePick(item: GeocodeItem) {
    setPanTarget({ lat: item.lat, lng: item.lng, zoom: 14 });
    // For POI, also place the pin at the geocoded location.
    if (spotType === 'POI') {
      setPoint({ lat: item.lat, lng: item.lng });
    }
    // Pre-fill address field if empty.
    if (!address.trim()) {
      setAddress(item.label);
    }
  }

  const handlePolyPoints = useCallback((p: Point[]) => setPolyPoints(p), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (spotType === 'POI' && !point) {
      setError('Zet eerst een punt op de kaart door erop te klikken.');
      return;
    }
    if (spotType === 'REGION' && polyPoints.length < 3) {
      setError('Teken het gebied in op de kaart (minimaal 3 punten).');
      return;
    }
    if (!categoryId) {
      setError('Kies een categorie.');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type: spotType,
        categoryId,
        name: name.trim(),
        amenityIds,
        photos: photos.map((p) => p.url),
      };

      if (spotType === 'POI' && point) {
        body.point = point;
      } else if (spotType === 'REGION') {
        body.polygon = polyPoints;
      }

      if (description.trim()) body.description = description.trim();
      if (address.trim()) body.address = address.trim();
      if (phone.trim()) body.phone = phone.trim();
      if (website.trim()) body.website = website.trim();

      const res = await fetch('/api/v1/me/spots', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }

      const created = (await res.json()) as { slug?: string; name?: string };
      setSuccess({ slug: created.slug ?? '', name: created.name ?? name.trim() });
    } catch {
      setError('Verbindingsfout. Controleer je internetverbinding en probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  // Auth loading.
  if (isPending) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)' }}>Laden…</div>
    );
  }

  // Not signed in.
  if (!session) {
    return (
      <div
        className="card"
        style={{ padding: 32, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--moss-soft)',
            color: 'var(--moss-700)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ico d={D_PIN} size={22} />
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Even je e-mailadres</h2>
        <p style={{ color: 'var(--ink-2)', marginBottom: 22 }}>
          Je hoeft je niet te registreren. Vul je e-mailadres in, dan maken we automatisch een
          account voor je aan.
        </p>
        <a
          href={`/signin?next=${encodeURIComponent('/plek-toevoegen')}`}
          className="btn btn-primary"
        >
          Inloggen
        </a>
      </div>
    );
  }

  // Success.
  if (success) {
    return <SuccessCard spotSlug={success.slug} spotName={success.name} />;
  }

  const tooFewPoints = spotType === 'REGION' && polyPoints.length > 0 && polyPoints.length < 3;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 32 }}>
      {/* 1 — Type toggle */}
      <div style={fieldStyle}>
        <span style={labelStyle}>Wat wil je toevoegen?</span>
        <TypeToggle value={spotType} onChange={handleTypeChange} />
      </div>

      {/* 2 — Locatie */}
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Locatie</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            {spotType === 'POI'
              ? 'Zoek het adres of klik op de kaart. Sleep de speld om hem te verplaatsen.'
              : 'Zoek het adres om naar het juiste gebied te navigeren, klik dan op de kaart om punten te zetten.'}
          </p>
        </div>

        {/* Address search */}
        <div style={{ marginBottom: 10 }}>
          <AddressSearch onSelect={handleGeocodePick} />
        </div>

        {/* Map */}
        <div
          style={{
            height: 400,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-sm)',
            background: 'var(--moss-soft)',
          }}
        >
          {GOOGLE_MAPS_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_KEY}>
              {spotType === 'POI' ? (
                <PinMapInner point={point} onChange={setPoint} panTarget={panTarget} />
              ) : (
                <PolygonMap points={polyPoints} onPoints={handlePolyPoints} panTarget={panTarget} />
              )}
            </APIProvider>
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

        {/* Map status / polygon toolbar */}
        {spotType === 'POI' ? (
          point ? (
            <p
              style={{ ...hintStyle, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Ico d={D_PIN} size={13} />
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
            </p>
          ) : (
            <p style={{ ...hintStyle, marginTop: 8, color: 'var(--terra-700)' }}>
              Nog geen punt gezet.
            </p>
          )
        ) : (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500 }}>
              Punten: {polyPoints.length}
            </span>
            {tooFewPoints ? (
              <span style={{ fontSize: 13, color: 'var(--rust)' }}>minimaal 3</span>
            ) : null}
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={() => setPolyPoints((p) => p.slice(0, -1))}
              disabled={polyPoints.length === 0}
            >
              Ongedaan maken
            </button>
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={() => setPolyPoints([])}
              disabled={polyPoints.length === 0}
            >
              Leegmaken
            </button>
          </div>
        )}
      </div>

      {/* 3 — Spot details */}
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Category */}
        <div style={fieldStyle}>
          <label htmlFor="categoryId" style={labelStyle}>
            Categorie
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {categories.length === 0 ? (
              <option disabled>Laden…</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Name */}
        <div style={fieldStyle}>
          <label htmlFor="name" style={labelStyle}>
            Naam van de plek
          </label>
          <input
            id="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              spotType === 'POI'
                ? 'bijv. Café Waf, Waterspeelplaats Beatrixpark'
                : 'bijv. Amsterdamse Bos losloopgebied'
            }
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div style={fieldStyle}>
          <label style={labelStyle}>
            Beschrijving <span style={hintStyle}>(optioneel)</span>
          </label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Wat maakt deze plek bijzonder voor honden?"
          />
        </div>
      </div>

      {/* 4 — Amenities */}
      {amenities.length > 0 ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>Voorzieningen</span>
            <p style={{ ...hintStyle, marginTop: 4 }}>Meerdere keuzes mogelijk.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {amenities.map((a) => {
              const selected = amenityIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    border: `1.5px solid ${selected ? 'var(--moss)' : 'var(--line)'}`,
                    background: selected ? 'var(--moss-soft)' : '#fff',
                    color: selected ? 'var(--moss-700)' : 'var(--ink-2)',
                    fontWeight: selected ? 600 : 500,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 5 — Photos */}
      <PhotoUpload photos={photos} onChange={setPhotos} />

      {/* 6 — Optional contact details */}
      <details style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--ink)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            userSelect: 'none',
          }}
        >
          Contactgegevens <span style={hintStyle}>(optioneel)</span>
        </summary>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div style={fieldStyle}>
            <label htmlFor="address" style={labelStyle}>
              Adres
            </label>
            <input
              id="address"
              type="text"
              maxLength={240}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straat 1, 1234 AB Stad"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="phone" style={labelStyle}>
              Telefoon
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+31 20 123 4567"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="website" style={labelStyle}>
              Website
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://voorbeeld.nl"
              style={inputStyle}
            />
          </div>
        </div>
      </details>

      {/* Error */}
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(163,59,45,0.08)',
            color: 'var(--rust)',
            fontSize: 14,
          }}
        >
          {error}
        </p>
      ) : null}

      {/* Submit */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || tooFewPoints}
          style={{ minWidth: 180 }}
        >
          {submitting ? 'Opslaan…' : 'Plek toevoegen'}
        </button>
        <a href="/" className="btn btn-ghost">
          Annuleren
        </a>
      </div>
    </form>
  );
}
