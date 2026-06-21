'use client';

/**
 * Full-screen interactive map for /kaart. Mirrors what the mobile Kaart tab
 * does: pan/zoom loads spots in view, search flies to a geocoded place, category
 * chips filter visible markers, clicking a marker opens a peek card, region
 * polygons are drawn as filled overlays, and a prominent CTA links to
 * /plek-toevoegen.
 *
 * Floating overlays (search, chips, buttons) sit on top of the Google Map via
 * absolute positioning. The map itself fills its parent 100 % × 100 %.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { CategoryDto } from '@devrijehond/types';
import type { Bbox } from './map-shared';
import { DEFAULT_CENTER, DEFAULT_ZOOM, spotHref } from './map-shared';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// Debounce time for both bbox changes and the search input (ms).
const BOUNDS_DEBOUNCE = 400;
const SEARCH_DEBOUNCE = 350;

// ---- types ------------------------------------------------------------------

type MapItem = {
  id: string;
  slug: string;
  type: 'REGION' | 'POI';
  name: string;
  categoryId: string;
  status: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
  lat: number | null;
  lng: number | null;
  rating: { average: number; count: number };
  photoUrl: string | null;
  updatedAt: string;
  geometry: { type: string; coordinates: unknown } | null;
};

type GeocodeHit = { label: string; lat: number; lng: number };

// ---- SVG pin ----------------------------------------------------------------

function pinIcon(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='8' fill='${color}' stroke='white' stroke-width='2'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ---- Region polygon overlay (runs inside the Map context) -------------------

type LngLat = [number, number];

function RegionPolygons({
  items,
  categoryColors,
  onSelect,
}: {
  items: MapItem[];
  categoryColors: Record<string, string>;
  onSelect: (item: MapItem) => void;
}) {
  const map = useMap();
  // Keep a ref to the polygon objects so we can clean them up on updates.
  const polysRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (!map) return;

    // Remove previous polygons.
    polysRef.current.forEach((p) => p.setMap(null));
    polysRef.current = [];

    const regions = items.filter((s) => s.type === 'REGION' && s.geometry?.type === 'Polygon');

    for (const spot of regions) {
      if (!spot.geometry || spot.geometry.type !== 'Polygon') continue;
      const rings = spot.geometry.coordinates as LngLat[][];
      if (!rings?.length) continue;

      const paths = rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
      const color = categoryColors[spot.categoryId] ?? '#6e7b33';

      const poly = new google.maps.Polygon({
        paths,
        strokeColor: color,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.2,
        clickable: true,
      });
      poly.setMap(map);
      poly.addListener('click', () => onSelect(spot));
      polysRef.current.push(poly);
    }

    return () => {
      polysRef.current.forEach((p) => p.setMap(null));
      polysRef.current = [];
    };
  }, [map, items, categoryColors, onSelect]);

  return null;
}

// ---- Geolocation recenter (runs inside the Map context) ---------------------

function RecenterTrigger({ trigger }: { trigger: number }) {
  const map = useMap();
  const triggeredRef = useRef(0);

  useEffect(() => {
    if (!map || trigger === triggeredRef.current) return;
    triggeredRef.current = trigger;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(14);
      },
      () => {
        /* denied or unavailable */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [map, trigger]);

  return null;
}

// ---- Fly-to trigger (runs inside the Map context) --------------------------

function FlyToTrigger({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  const lastRef = useRef<string>('');

  useEffect(() => {
    if (!map || !target) return;
    const key = `${target.lat},${target.lng}`;
    if (key === lastRef.current) return;
    lastRef.current = key;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(target.zoom ?? 14);
  }, [map, target]);

  return null;
}

// ---- Main component ---------------------------------------------------------

export function FullMap() {
  // Fetched spots for current viewport.
  const [spots, setSpots] = useState<MapItem[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const lastBboxKey = useRef('');

  // Categories for filter chips.
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  // Selected category ids; empty = "Alles".
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());

  // Selected spot for the peek card.
  const [selected, setSelected] = useState<MapItem | null>(null);

  // Search state.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fly-to target (set when the user picks a geocode result).
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );

  // Recenter trigger counter; incrementing it fires the geolocation request.
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Category colors keyed by id for polygon rendering.
  const categoryColors = useRef<Record<string, string>>({});

  // ---- Load categories once -------------------------------------------------

  useEffect(() => {
    fetch('/api/v1/categories')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: CategoryDto[] }) => {
        const cats = data.items ?? [];
        setCategories(cats);
        const map: Record<string, string> = {};
        for (const c of cats) {
          if (c.color) map[c.id] = c.color;
        }
        categoryColors.current = map;
      })
      .catch(() => {});
  }, []);

  // ---- Fetch spots on bounds change ----------------------------------------

  const handleBoundsChange = useCallback((bbox: Bbox) => {
    const key = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
      .map((n) => n.toFixed(3))
      .join(',');
    if (key === lastBboxKey.current) return;
    lastBboxKey.current = key;

    const params = new URLSearchParams({
      minLng: String(bbox.minLng),
      minLat: String(bbox.minLat),
      maxLng: String(bbox.maxLng),
      maxLat: String(bbox.maxLat),
    });

    setLoadingSpots(true);
    fetch(`/api/v1/spots/map?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: MapItem[] }) => setSpots(data.items ?? []))
      .catch(() => setSpots([]))
      .finally(() => setLoadingSpots(false));
  }, []);

  // Timer ref used inside the Map's onIdle to debounce bounds changes.
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Search ---------------------------------------------------------------

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const params = new URLSearchParams({ q });
    fetch(`/api/v1/geocode?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: GeocodeHit[] }) => {
        setSearchResults(data.items ?? []);
        setSearchOpen((data.items ?? []).length > 0);
      })
      .catch(() => {
        setSearchResults([]);
        setSearchOpen(false);
      });
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE);
    },
    [runSearch],
  );

  const handleSelectResult = useCallback((hit: GeocodeHit) => {
    setFlyTarget({ lat: hit.lat, lng: hit.lng, zoom: 14 });
    setSearchQuery(hit.label);
    setSearchOpen(false);
    setSearchResults([]);
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ---- Category filter chips -----------------------------------------------

  const toggleCat = useCallback((id: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearCats = useCallback(() => setActiveCats(new Set()), []);

  // Apply category filter (client-side over the viewport set).
  const visibleSpots =
    activeCats.size === 0 ? spots : spots.filter((s) => activeCats.has(s.categoryId));

  // ---- Marker color from category / status ---------------------------------

  function spotColor(spot: MapItem): string {
    if (spot.status === 'VERIFIED') {
      return categoryColors.current[spot.categoryId] ?? '#6e7b33';
    }
    return '#C9A24B'; // sand — unverified
  }

  // ---- Render ---------------------------------------------------------------

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          color: 'var(--ink-3)',
          fontSize: 15,
        }}
      >
        Kaart is tijdelijk niet beschikbaar.
      </div>
    );
  }

  const selectedVerified = selected?.status === 'VERIFIED';
  const selectedCatColor = selected
    ? (categoryColors.current[selected.categoryId] ?? '#6e7b33')
    : '#6e7b33';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ---- Google Maps --------------------------------------------------- */}
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
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
            if (boundsTimer.current) clearTimeout(boundsTimer.current);
            boundsTimer.current = setTimeout(() => handleBoundsChange(bbox), BOUNDS_DEBOUNCE);
          }}
        >
          <RecenterTrigger trigger={recenterTrigger} />
          <FlyToTrigger target={flyTarget} />

          {/* Region polygons */}
          <RegionPolygons
            items={visibleSpots}
            categoryColors={categoryColors.current}
            onSelect={setSelected}
          />

          {/* POI markers */}
          {visibleSpots
            .filter((s) => s.type === 'POI' && s.lat != null && s.lng != null)
            .map((s) => (
              <Marker
                key={s.id}
                position={{ lat: s.lat as number, lng: s.lng as number }}
                title={s.name}
                icon={pinIcon(spotColor(s))}
                onClick={() => setSelected(s)}
              />
            ))}

          {/* REGION centroid pin (when there's no polygon data) */}
          {visibleSpots
            .filter(
              (s) =>
                s.type === 'REGION' &&
                (!s.geometry || s.geometry.type !== 'Polygon') &&
                s.lat != null &&
                s.lng != null,
            )
            .map((s) => (
              <Marker
                key={s.id}
                position={{ lat: s.lat as number, lng: s.lng as number }}
                title={s.name}
                icon={pinIcon(spotColor(s))}
                onClick={() => setSelected(s)}
              />
            ))}

          {/* Peek card / InfoWindow */}
          {selected && selected.lat != null && selected.lng != null ? (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
              headerDisabled
            >
              <div
                style={{
                  font: '14px/1.45 system-ui, sans-serif',
                  minWidth: 180,
                  maxWidth: 240,
                  padding: '4px 2px 6px',
                }}
              >
                {/* Category colour dot + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      flex: 'none',
                      background: selectedCatColor,
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#6e7b70', fontWeight: 500 }}>
                    {categories.find((c) => c.id === selected.categoryId)?.label ?? ''}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: '#232a1b', marginBottom: 5 }}>
                  {selected.name}
                </div>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12.5,
                    color: selectedVerified ? '#47521f' : '#9a4f1b',
                  }}
                >
                  {selectedVerified ? '✓ Geverifieerd' : '◌ Nog niet geverifieerd'}
                </div>
                <a
                  href={spotHref(selected)}
                  style={{
                    display: 'inline-block',
                    background: '#6e7b33',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    padding: '6px 14px',
                    borderRadius: 999,
                    textDecoration: 'none',
                  }}
                >
                  Bekijk plek →
                </a>
              </div>
            </InfoWindow>
          ) : null}
        </Map>
      </APIProvider>

      {/* ---- Search box (top-center) --------------------------------------- */}
      <div
        ref={searchRef}
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: 'min(420px, calc(100vw - 120px))',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 999,
            boxShadow: '0 2px 12px rgba(35,42,27,0.2)',
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            gap: 9,
          }}
        >
          {/* Search icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            style={{ flex: 'none' }}
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="13" y1="13" x2="18" y2="18" />
          </svg>
          <input
            type="search"
            placeholder="Zoek een plek of adres…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: 'var(--ink)',
              background: 'transparent',
              fontFamily: 'var(--font-body-stack)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Zoekopdracht wissen"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setSearchOpen(false);
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                color: 'var(--ink-3)',
                fontSize: 18,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(35,42,27,0.18)',
              overflow: 'hidden',
            }}
          >
            {searchResults.map((hit, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(hit)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--line)' : 'none',
                  fontFamily: 'var(--font-body-stack)',
                }}
                onMouseOver={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sand)')
                }
                onMouseOut={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = 'none')
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                  style={{ flex: 'none' }}
                >
                  <path d="M12 21s-7-6.686-7-11a7 7 0 0 1 14 0c0 4.314-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                <span style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.35 }}>
                  {hit.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- Category filter chips (top-left on desktop, bottom on mobile) -- */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 14,
          right: 14,
          zIndex: 10,
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 2, // prevent clip of shadow
          // Hide scrollbar but keep functionality.
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* "Alles" chip */}
        <button
          type="button"
          onClick={clearCats}
          className="chip"
          style={{
            cursor: 'pointer',
            background: activeCats.size === 0 ? 'var(--moss)' : '#fff',
            color: activeCats.size === 0 ? '#fff' : 'var(--ink-2)',
            border: activeCats.size === 0 ? '1px solid var(--moss)' : '1px solid var(--line)',
            flex: 'none',
            fontFamily: 'var(--font-body-stack)',
          }}
        >
          Alles
        </button>

        {categories.map((cat) => {
          const active = activeCats.has(cat.id);
          const color = cat.color ?? 'var(--moss)';
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCat(cat.id)}
              className="chip"
              style={{
                cursor: 'pointer',
                flex: 'none',
                fontFamily: 'var(--font-body-stack)',
                background: active ? color : '#fff',
                color: active ? '#fff' : 'var(--ink-2)',
                border: active ? `1px solid ${color}` : '1px solid var(--line)',
              }}
            >
              <span
                className="dot"
                style={{
                  background: active ? '#fff' : color,
                  opacity: active ? 0.85 : 1,
                }}
              />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ---- Right-side floating controls ---------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Recenter on user button */}
        <button
          type="button"
          title="Centreer op mijn locatie"
          aria-label="Centreer op mijn locatie"
          onClick={() => setRecenterTrigger((n) => n + 1)}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#fff',
            border: '1px solid var(--line)',
            boxShadow: '0 2px 10px rgba(35,42,27,0.16)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Crosshair / location target icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--moss-700)"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>

      {/* ---- "Voeg een plek toe" CTA --------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          bottom: 82,
          right: 14,
          zIndex: 10,
        }}
      >
        <a
          href="/plek-toevoegen"
          className="btn btn-primary"
          style={{ boxShadow: '0 4px 16px rgba(110,123,51,0.38)', whiteSpace: 'nowrap' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Voeg een plek toe
        </a>
      </div>

      {/* ---- Spots-in-view counter badge ---------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px',
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 2px 10px rgba(35,42,27,0.16)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-body-stack)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: loadingSpots ? 'var(--terra)' : 'var(--moss)',
            transition: 'background 0.3s',
          }}
        />
        {loadingSpots ? 'Laden…' : `${visibleSpots.length} plekken`}
      </div>
    </div>
  );
}
