'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bbox, ClusterItem, MapItem } from './map-shared';

/**
 * Shared map data source for both the homepage island and the full /kaart page.
 * Fetches the public viewport endpoint with server-side clustering: dense cells
 * come back as count bubbles, sparse cells as individual spots, so a wide view
 * loads a few dozen markers instead of thousands.
 *
 * Pass a single `categoryId` to push that filter to the server (so cluster
 * counts respect it); multi-category selection stays client-side on `spots`.
 */
export function useViewportSpots(categoryId?: string) {
  const [spots, setSpots] = useState<MapItem[]>([]);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const lastKey = useRef('');
  const lastBbox = useRef<Bbox | null>(null);

  const load = useCallback(
    (bbox: Bbox) => {
      lastBbox.current = bbox;
      const params = new URLSearchParams({
        minLng: String(bbox.minLng),
        minLat: String(bbox.minLat),
        maxLng: String(bbox.maxLng),
        maxLat: String(bbox.maxLat),
        cluster: 'true',
      });
      if (categoryId) params.set('categoryId', categoryId);

      setLoading(true);
      fetch(`/api/v1/spots/map?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { items: [], clusters: [] }))
        .then((data: { items?: MapItem[]; clusters?: ClusterItem[] }) => {
          setSpots(data.items ?? []);
          setClusters(data.clusters ?? []);
        })
        .catch(() => {
          setSpots([]);
          setClusters([]);
        })
        .finally(() => setLoading(false));
    },
    [categoryId],
  );

  // Bbox changes from the map; skip when it settles on the same (rounded) box.
  const handleBounds = useCallback(
    (bbox: Bbox) => {
      const key = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
        .map((n) => n.toFixed(3))
        .join(',');
      if (key === lastKey.current) return;
      lastKey.current = key;
      load(bbox);
    },
    [load],
  );

  // Re-fetch the current viewport when the category filter changes.
  useEffect(() => {
    if (lastBbox.current) load(lastBbox.current);
  }, [load]);

  return { spots, clusters, loading, handleBounds };
}
