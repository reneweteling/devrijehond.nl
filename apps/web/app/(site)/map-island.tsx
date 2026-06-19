'use client';

/**
 * Client map island. Hydrates over the same public API the mobile app uses
 * (`GET /api/v1/spots?minLng=…&minLat=…&maxLng=…&maxLat=…`). The actual
 * interactive map surface (MapLibre / Leaflet) is wired in a later story — this
 * island is the data-loading + state shell so the server shell stays crawlable
 * while the heavy map hydrates client-side (blueprint §7 decision 4).
 */

import { useEffect, useState } from 'react';
import type { SpotSummaryDto } from '@devrijehond/types';

// Amsterdam-ish default viewport until geolocation resolves.
const DEFAULT_BBOX = { minLng: 4.7, minLat: 52.25, maxLng: 5.05, maxLat: 52.42 };

export function MapIsland() {
  const [spots, setSpots] = useState<SpotSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      minLng: String(DEFAULT_BBOX.minLng),
      minLat: String(DEFAULT_BBOX.minLat),
      maxLng: String(DEFAULT_BBOX.maxLng),
      maxLat: String(DEFAULT_BBOX.maxLat),
      limit: '200',
    });
    fetch(`/api/v1/spots?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items: SpotSummaryDto[] }) => setSpots(data.items ?? []))
      .catch(() => setSpots([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section aria-label="Kaart met hondvriendelijke plekken">
      <div
        style={{
          height: 360,
          borderRadius: 12,
          backgroundColor: '#dfe7df',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3F6B4C',
          fontWeight: 600,
        }}
      >
        {loading ? 'Kaart laden…' : `${spots.length} plekken in beeld`}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'grid', gap: 8 }}>
        {spots.map((s) => (
          <li key={s.id}>
            <a
              href={`${s.type === 'REGION' ? '/gebied' : '/plek'}/${s.slug}`}
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
