/**
 * S1, Map (home). The heavy interactive surface is a native map
 * (`react-native-maps`). It draws:
 *   - REGION spots as circular moss centroid markers,
 *   - POI spots as teardrop pins coloured by category, solid when VERIFIED and
 *     outlined/terracotta when UNVERIFIED,
 *   - a floating search pill + category chip row,
 *   - a legend explaining verified vs unverified,
 *   - a bottom-sheet peek card on pin/region tap that links to the detail.
 *
 * Markers are loaded for the current viewport via GET /api/v1/spots/map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, type Region } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCategories,
  useSpotDetail,
  useSpotsInViewport,
  type Amenity,
  type Bbox,
  type Category,
  type MapCluster,
  type SpotSummary,
} from '@/lib/api';
import { useUserLocation, haversineMeters, type LatLng } from '@/lib/location';
import { amenitySymbol } from '@/lib/icons';
import { categoryColors, colors, font, radius, space } from '@/lib/theme';
import { Button, Chip, VerifiedBadge, Stars } from '@/components/ui';

// Horizontal inset that lines the floating chrome (search pill, chip row, bottom
// control strip) up with the native tab bar's width, so they share one edge.
const TAB_BAR_INSET = 20;

// Amsterdam-centre default region (covers the seeded spots from the Bos in the
// south to the NDSM in the north). The map recentres on the user when location
// is granted.
const INITIAL_REGION: Region = {
  latitude: 52.365,
  longitude: 4.89,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

// Round to ~3 decimals (~100m) so tiny region jitter (the map settling, the
// user dot updating) doesn't churn the query key and restart the fetch forever.
const r3 = (n: number) => Math.round(n * 1000) / 1000;
function regionToBbox(r: Region): Bbox {
  return {
    minLng: r3(r.longitude - r.longitudeDelta / 2),
    minLat: r3(r.latitude - r.latitudeDelta / 2),
    maxLng: r3(r.longitude + r.longitudeDelta / 2),
    maxLat: r3(r.latitude + r.latitudeDelta / 2),
  };
}

function catColor(category: Category | undefined): string {
  if (category?.color) return category.color;
  if (category) return categoryColors[category.slug] ?? colors.moss;
  return colors.moss;
}

// REGION spots carry a GeoJSON Polygon outline (the geofence) on the map DTO.
// Convert its rings ([lng, lat] pairs) to react-native-maps coordinates.
type LngLat = [number, number];
function regionRings(s: SpotSummary): { latitude: number; longitude: number }[][] | null {
  const geom = (s as unknown as { geometry?: { type: string; coordinates: LngLat[][] } }).geometry;
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
  return geom.coordinates.map((ring) =>
    ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  );
}

// Ray-casting point-in-polygon. react-native-maps Marker/Polygon onPress is
// unreliable on Apple Maps + the New Architecture, so geofence taps are handled
// via MapView.onPress (which always reports the tapped coordinate) + this test.
type Ring = { latitude: number; longitude: number }[];
function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!pi || !pj) continue;
    const intersect =
      pi.latitude > lat !== pj.latitude > lat &&
      lng <
        ((pj.longitude - pi.longitude) * (lat - pi.latitude)) / (pj.latitude - pi.latitude) +
          pi.longitude;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * A single map pin. react-native-maps re-rasterises a custom marker view on
 * every render while `tracksViewChanges` is true, which makes pins flicker and
 * "jump" when the spot list changes on pan/zoom. We rasterise once on mount,
 * then switch tracking off so the pin stays put. Reused markers (same key/id)
 * keep tracking off, so only genuinely new pins ever redraw.
 */
function SpotMarker({
  spot,
  color,
  isRegion,
  onPress,
}: {
  spot: SpotSummary;
  color: string;
  isRegion: boolean;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (spot.lat == null || spot.lng == null) return null;
  const verified = spot.status === 'VERIFIED';
  return (
    <Marker
      coordinate={{ latitude: spot.lat, longitude: spot.lng }}
      onPress={onPress}
      tracksViewChanges={tracks}
    >
      <View style={styles.pinWrap}>
        <View
          style={[
            isRegion ? styles.regionDot : styles.pin,
            verified
              ? { backgroundColor: color, borderColor: '#fff' }
              : { backgroundColor: '#fff', borderColor: colors.terra, borderStyle: 'dashed' },
          ]}
        />
      </View>
    </Marker>
  );
}

/**
 * A cluster bubble: a moss circle with the number of spots it stands for. Like
 * SpotMarker it rasterises once then turns tracking off so it doesn't flicker on
 * pan/zoom. Tapping it (resolved via the MapView hit-test) zooms in to split it.
 */
function ClusterMarker({
  lat,
  lng,
  count,
  onPress,
}: {
  lat: number;
  lng: number;
  count: number;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, [count]);

  const size = count >= 100 ? 52 : count >= 25 ? 46 : count >= 10 ? 42 : 38;
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  );
}

/**
 * The user's current location as the conventional iOS blue dot (white ring +
 * system-blue core), so it reads as "you are here" and never as a spot marker.
 * Rasterised once then tracking off, like the other custom markers.
 */
function UserDot({ lat, lng }: { lat: number; lng: number }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.userDotRing}>
        <View style={styles.userDotCore} />
      </View>
    </Marker>
  );
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Bottom peek sheet for a selected spot/region. Slides up from the bottom on
 * mount, can be flicked down to dismiss, and lazy-loads the spot detail to add a
 * description snippet + amenities + distance on top of the summary fields. Keyed
 * by spot id in the parent so picking a different spot replays the slide-in.
 */
function PeekSheet({
  spot,
  category,
  userLocation,
  onClose,
  onOpen,
}: {
  spot: SpotSummary;
  category: Category | undefined;
  userLocation: LatLng | null;
  onClose: () => void;
  onOpen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: detail } = useSpotDetail(spot.slug);
  // Lazy useState (not useRef().current) so the value is created once without
  // reading a ref during render (the React Compiler healthcheck forbids that).
  const [translateY] = useState(() => new Animated.Value(600));

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 3,
    }).start();
  }, [translateY]);

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          Animated.timing(translateY, { toValue: 600, duration: 180, useNativeDriver: true }).start(
            () => onClose(),
          );
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18 }).start();
        }
      },
    }),
  );

  const dismiss = () =>
    Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() =>
      onClose(),
    );

  const summary = stripHtml(detail?.description);
  const amenities = detail?.amenities ?? [];
  const distance =
    userLocation && spot.lat != null && spot.lng != null
      ? haversineMeters(userLocation, { lat: spot.lat, lng: spot.lng })
      : null;

  return (
    <Animated.View
      style={[styles.sheet, { paddingBottom: insets.bottom + 78, transform: [{ translateY }] }]}
      {...pan.panHandlers}
    >
      <View style={styles.sheetHandle} />
      <Pressable
        style={({ pressed }) => [styles.sheetClose, { opacity: pressed ? 0.5 : 1 }]}
        onPress={dismiss}
        hitSlop={12}
      >
        <SymbolView name="xmark" size={13} tintColor={colors.ink3} />
      </Pressable>

      <View style={styles.sheetRow}>
        <View style={styles.thumb}>
          {spot.photoUrl ? (
            <Image source={{ uri: spot.photoUrl }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <SymbolView name="photo.fill" size={20} tintColor={colors.ink3} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {spot.name}
          </Text>
          <Text style={styles.sheetMeta} numberOfLines={1}>
            {category?.label ?? ''}
          </Text>
          <View style={styles.sheetMetaRow}>
            <VerifiedBadge status={spot.status} />
            {spot.rating.count > 0 ? (
              <View style={styles.ratingInline}>
                <Stars value={spot.rating.average} size={11} />
                <Text style={styles.ratingText}>
                  {spot.rating.average.toFixed(1).replace('.', ',')} ({spot.rating.count})
                </Text>
              </View>
            ) : null}
            {distance != null ? (
              <View style={styles.ratingInline}>
                <SymbolView name="location.fill" size={10} tintColor={colors.ink3} />
                <Text style={styles.ratingText}>{formatDistance(distance)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {summary ? (
        <Text style={styles.sheetDesc} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}

      {amenities.length > 0 ? (
        <View style={styles.sheetAmenities}>
          {amenities.slice(0, 4).map((a: Amenity) => (
            <View key={a.id} style={styles.sheetAmenity}>
              <SymbolView
                name={amenitySymbol(a.icon ?? a.slug)}
                size={12}
                tintColor={colors.mossDark}
              />
              <Text style={styles.sheetAmenityText} numberOfLines={1}>
                {a.label}
              </Text>
            </View>
          ))}
          {amenities.length > 4 ? (
            <Text style={styles.sheetAmenityMore}>+{amenities.length - 4}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: space.md }}>
        <Button label="Bekijk plek" onPress={onOpen} />
      </View>
    </Animated.View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  // Search can hand us a location to fly to (e.g. "Hilversum"); see lib/geocode.
  const params = useLocalSearchParams<{ lat?: string; lng?: string; t?: string }>();
  const [bbox, setBbox] = useState<Bbox>(() => regionToBbox(INITIAL_REGION));
  // Multi-select category filter. Empty = "Alles" (show everything). Tapping a
  // category toggles it; tapping "Alles" clears back to everything.
  const [activeCats, setActiveCats] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<SpotSummary | null>(null);
  const [satellite, setSatellite] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Current visible latitude span, used to scale the tap hit-test radius.
  const regionDeltaRef = useRef(INITIAL_REGION.latitudeDelta);
  // Becomes true once the native map is laid out, so fly-to / centre calls
  // aren't issued before the map can honour them (they'd be no-ops).
  const [mapReady, setMapReady] = useState(false);
  // Once we've centred (on the user or a search target) we don't auto-recentre.
  const centredOnUser = useRef(false);

  const userLocation = useUserLocation();

  // onMapReady is unreliable on iOS / Apple Maps (it can fail to fire), which
  // would leave the map stuck on the default region. Flip mapReady on a short
  // timeout as a fallback so centring + fly-to always happen.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => setMapReady(true), 1200);
    return () => clearTimeout(t);
  }, [mapReady]);

  // (C) Search fly-to has priority: when search hands us lat/lng (with a nonce
  // 't' so the same place re-triggers), fly there once the map is ready, mark
  // "centred" so the boot-centre effect can't yank it back, refetch the
  // viewport, and consume the params so a later remount doesn't re-fly.
  useEffect(() => {
    const lat = params.lat ? Number(params.lat) : NaN;
    const lng = params.lng ? Number(params.lng) : NaN;
    if (!mapReady || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    centredOnUser.current = true;
    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
    mapRef.current?.animateToRegion(region, 600);
    setTimeout(() => {
      setBbox(regionToBbox(region));
      router.setParams({ lat: undefined, lng: undefined, t: undefined });
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, params.lat, params.lng, params.t]);

  // (B) Centre on the user once, after the map is ready and location resolves,
  // unless a search target is pending (search wins). That's where they walk.
  useEffect(() => {
    if (!mapReady || centredOnUser.current || !userLocation || params.lat) return;
    centredOnUser.current = true;
    const region: Region = {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
    mapRef.current?.animateToRegion(region, 600);
    setTimeout(() => setBbox(regionToBbox(region)), 0);
  }, [mapReady, userLocation, params.lat]);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  const { data: spotsData, isLoading, isError, refetch } = useSpotsInViewport(bbox);
  // Client-side category filter so multiple categories can be active at once
  // (the viewport endpoint takes a single categoryId).
  const spots = useMemo(() => {
    const all = spotsData?.items ?? [];
    return activeCats.size === 0 ? all : all.filter((s) => activeCats.has(s.categoryId));
  }, [spotsData, activeCats]);

  // The map endpoint already clusters server-side: lone spots come back in
  // `items` (the `spots` above, filtered here by the active categories) and dense
  // areas as `clusters` (count bubbles). So the payload stays bounded no matter
  // how far out you zoom, instead of streaming every spot. Category filters
  // refine the lone spots; clusters show overall density and resolve into the
  // filtered spots once you tap/zoom into them.
  const singles = spots;
  const clusters: MapCluster[] = useMemo(() => spotsData?.clusters ?? [], [spotsData]);

  const toggleCat = (id: string) =>
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // First-load spinner: only before the very first response ever lands.
  // `spotsData` is undefined only until the first success (keepPreviousData
  // keeps it set afterwards), so this can't stay stuck once anything loaded.
  // Safety net: if a first load is still pending after 12s (e.g. a flaky
  // connection), stop blocking the UI with a spinner — the map stays usable.
  const [spinnerTimedOut, setSpinnerTimedOut] = useState(false);
  const pendingFirstLoad = isLoading && spotsData === undefined;
  useEffect(() => {
    if (!pendingFirstLoad) return;
    const t = setTimeout(() => setSpinnerTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, [pendingFirstLoad]);
  const isFirstLoad = pendingFirstLoad && !spinnerTimedOut;

  const onRegionChange = (r: Region) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setBbox(regionToBbox(r)), 350);
    regionDeltaRef.current = r.latitudeDelta;
  };

  // Tapping the map. Marker/Polygon onPress is unreliable on Apple Maps + the
  // New Architecture, so we resolve the tap ourselves from the coordinate:
  //   1. inside a geofence (and not a hole) -> that region;
  //   2. else the nearest pin within a finger-sized radius (scaled to the zoom),
  //      so POIs and geometry-less region dots are tappable too;
  //   3. else deselect.
  const onMapPress = (e: {
    nativeEvent: { coordinate?: { latitude: number; longitude: number } };
  }) => {
    const c = e.nativeEvent.coordinate;
    if (!c) {
      setSelected(null);
      return;
    }
    const region = regionPolygons.find(
      (p) =>
        pointInRing(c.latitude, c.longitude, p.coordinates) &&
        !p.holes.some((h) => pointInRing(c.latitude, c.longitude, h)),
    );
    if (region) {
      setSelected(region.spot);
      return;
    }
    // Nearest marker within ~a marker's reach. lng is compressed by cos(lat).
    const cosLat = Math.cos((c.latitude * Math.PI) / 180);
    const reach = regionDeltaRef.current * 0.05;
    const distTo = (lat: number, lng: number) => {
      const dLat = lat - c.latitude;
      const dLng = (lng - c.longitude) * cosLat;
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };
    // Nearest cluster bubble (tapping one zooms in to split it).
    let bestCluster: { lat: number; lng: number } | null = null;
    let bestClusterDist = Infinity;
    for (const cl of clusters) {
      const d = distTo(cl.lat, cl.lng);
      if (d < bestClusterDist) {
        bestClusterDist = d;
        bestCluster = cl;
      }
    }
    // Nearest non-clustered spot (tapping one selects it).
    let best: SpotSummary | null = null;
    let bestDist = Infinity;
    for (const s of singles) {
      if (s.lat == null || s.lng == null) continue;
      const d = distTo(s.lat, s.lng);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    if (bestCluster && bestClusterDist <= reach && bestClusterDist <= bestDist) {
      zoomIntoCluster(bestCluster.lat, bestCluster.lng);
      return;
    }
    setSelected(best && bestDist <= reach ? best : null);
  };

  // Stable geofence polygons: recompute only when spots/categories change, not
  // on every render, so react-native-maps keeps the same coordinate refs and
  // doesn't redraw (flicker) the outlines on a select/pan re-render. The React
  // Compiler isn't enabled in this app, so this manual memo is doing real work;
  // its preserve-memoization healthcheck is a false positive here.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const regionPolygons = useMemo(
    () =>
      singles.flatMap((s) => {
        const rings = regionRings(s);
        if (!rings || !rings[0]) return [];
        return [
          {
            id: s.id,
            spot: s,
            coordinates: rings[0],
            holes: rings.slice(1),
            color: catColor(catById.get(s.categoryId)),
            verified: s.status === 'VERIFIED',
          },
        ];
      }),
    [singles, catById],
  );
  // Region spots that already render as an outlined polygon, so we don't also
  // drop a redundant centre dot on top of them.
  const polygonIds = useMemo(() => new Set(regionPolygons.map((p) => p.id)), [regionPolygons]);

  // Memoise the map children. Without this, every re-render (select, zoom, or a
  // refetch returning the same data) rebuilds the Polygon/Marker elements, and
  // react-native-maps redraws them — the "keeps redrawing while dragging" bug.
  // They rebuild only when the underlying data changes. The React Compiler would
  // do this automatically but isn't enabled here, so the manual memo is needed;
  // its preserve-memoization healthcheck is a false positive in that case.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const polygonEls = useMemo(
    () =>
      regionPolygons.map((p) => (
        <Polygon
          key={`poly-${p.id}`}
          coordinates={p.coordinates}
          holes={p.holes}
          strokeColor={p.verified ? p.color : colors.terra}
          strokeWidth={p.verified ? 2.5 : 2}
          lineDashPattern={p.verified ? undefined : [7, 6]}
          fillColor={p.verified ? `${p.color}40` : `${colors.terra}1f`}
          tappable
          onPress={() => setSelected(p.spot)}
        />
      )),
    [regionPolygons],
  );
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const regionMarkerEls = useMemo(
    () =>
      regionPolygons.map((p) => (
        <SpotMarker
          key={`region-${p.id}`}
          spot={p.spot}
          color={p.color}
          isRegion
          onPress={() => setSelected(p.spot)}
        />
      )),
    [regionPolygons],
  );
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const pinEls = useMemo(
    () =>
      singles
        .filter((s) => !(s.type === 'REGION' && polygonIds.has(s.id)))
        .map((s) => (
          <SpotMarker
            key={s.id}
            spot={s}
            color={catColor(catById.get(s.categoryId))}
            isRegion={s.type === 'REGION'}
            onPress={() => setSelected(s)}
          />
        )),
    [singles, polygonIds, catById],
  );

  // Zoom in on a cluster so it breaks apart into its members (or smaller
  // clusters). Tighten the viewport around the cluster centroid.
  const zoomIntoCluster = useCallback((lat: number, lng: number) => {
    const delta = Math.max(regionDeltaRef.current / 2.5, 0.01);
    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    mapRef.current?.animateToRegion(region, 350);
    setBbox(regionToBbox(region));
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const clusterEls = useMemo(
    () =>
      clusters.map((c) => (
        <ClusterMarker
          key={`cluster-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}`}
          lat={c.lat}
          lng={c.lng}
          count={c.count}
          onPress={() => zoomIntoCluster(c.lat, c.lng)}
        />
      )),
    [clusters, zoomIntoCluster],
  );

  const recenterOnUser = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        mapType={satellite ? 'hybrid' : 'standard'}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={onRegionChange}
        onPress={onMapPress}
      >
        {/*
          REGION geofences: a verification-styled outline (solid when verified,
          dashed terracotta when not). Tapping inside the area selects it via the
          MapView.onPress hit-test above; the region also drops a compact dot.
          POIs render as a teardrop pin; pins don't redraw thanks to each
          marker's tracksViewChanges=false. Dense areas collapse into clusters.
        */}
        {polygonEls}
        {regionMarkerEls}
        {pinEls}
        {clusterEls}
        {/* Own location as the conventional blue dot (custom, so it's never
            mistaken for a spot marker). */}
        {userLocation && <UserDot lat={userLocation.lat} lng={userLocation.lng} />}
      </MapView>

      {/* (A) Floating status pill: subtle spinner on first load, tappable error on failure */}
      {(isFirstLoad || isError) && (
        <View
          style={[styles.statusPill, { top: insets.top + 72 }, isError && styles.statusPillError]}
          pointerEvents={isError ? 'box-none' : 'none'}
        >
          {isFirstLoad ? (
            <ActivityIndicator size="small" color={colors.mossDark} />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.statusPillRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => refetch()}
            >
              <SymbolView
                name="exclamationmark.triangle.fill"
                size={13}
                tintColor={colors.terraDark}
              />
              <Text style={styles.statusPillText}>Kon plekken niet laden. Opnieuw</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Floating chrome: wordmark + search pill + category chips */}
      <View style={[styles.chrome, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.searchPill}>
          <Pressable style={styles.searchTap} onPress={() => router.push('/search')}>
            <SymbolView name="magnifyingglass" size={16} tintColor={colors.ink3} />
            <Text style={styles.searchPlaceholder}>Zoek een plek, gebied of adres</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="Alles"
            active={activeCats.size === 0}
            onPress={() => setActiveCats(new Set())}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={activeCats.has(c.id)}
              color={catColor(c)}
              onPress={() => toggleCat(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* (D) Bottom control strip: legend + satellite/locate toggles on one
          glass line just above the tab bar. Hidden while a spot is selected. */}
      {!selected && (
        <BlurView
          intensity={60}
          tint="systemChromeMaterialLight"
          style={[styles.controlBar, { bottom: insets.bottom + 10 }]}
        >
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.moss }]} />
            <Text style={styles.legendText}>Geverifieerd</Text>
          </View>
          <View style={styles.legendRow}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: '#fff', borderColor: colors.terra, borderStyle: 'dashed' },
              ]}
            />
            <Text style={styles.legendText}>Niet geverifieerd</Text>
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => setSatellite((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.ctrlBtn,
              satellite && styles.ctrlBtnActive,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <SymbolView
              name="globe.europe.africa.fill"
              size={20}
              tintColor={satellite ? '#fff' : colors.mossDark}
            />
          </Pressable>
          {userLocation && (
            <Pressable
              onPress={recenterOnUser}
              hitSlop={8}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <SymbolView name="location.fill" size={20} tintColor={colors.mossDark} />
            </Pressable>
          )}
        </BlurView>
      )}

      {/* Bottom peek sheet: slides up on select, flick down to dismiss, "Bekijk
          plek" opens the full detail page. Keyed by id so a new pick replays it. */}
      {selected && (
        <PeekSheet
          key={selected.id}
          spot={selected}
          category={catById.get(selected.categoryId)}
          userLocation={userLocation}
          onClose={() => setSelected(null)}
          onOpen={() => router.push(`/spot/${selected.slug}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moss,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: colors.mossDark,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  clusterText: { fontFamily: font.bodyMedium, fontSize: 15, color: '#fff' },
  chrome: { position: 'absolute', left: 0, right: 0, top: 0, gap: space.sm },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: TAB_BAR_INSET,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchPlaceholder: { flex: 1, fontFamily: font.body, fontSize: 13, color: colors.ink3 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { gap: 8, paddingHorizontal: TAB_BAR_INSET, paddingVertical: 4 },
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
    borderBottomLeftRadius: 2,
  },
  regionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  legendText: { fontFamily: font.body, fontSize: 11, color: colors.ink2 },
  // Bottom control strip (glass): legend + satellite/locate on one line, just
  // above the tab bar.
  controlBar: {
    position: 'absolute',
    left: TAB_BAR_INSET,
    right: TAB_BAR_INSET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
    paddingHorizontal: 12,
    borderRadius: 26,
    overflow: 'hidden',
    // A faint white wash over the blur to brighten it toward the tab bar's
    // light Liquid-Glass look, plus a hairline highlight on the edge.
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  ctrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: colors.moss },
  // Own-location blue dot: white ring + system-blue core.
  userDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  userDotCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0A84FF' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: space.md,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: 56, height: 56 },
  sheetTitle: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  sheetMeta: { fontFamily: font.body, fontSize: 12, color: colors.ink2, marginTop: 1 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  sheetDesc: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink2,
    marginTop: space.sm,
  },
  sheetAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    marginTop: space.sm,
  },
  sheetAmenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.mossSoft,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  sheetAmenityText: {
    fontFamily: font.bodyMedium,
    fontSize: 11.5,
    color: colors.mossDark,
    maxWidth: 110,
  },
  sheetAmenityMore: { fontFamily: font.bodyMedium, fontSize: 11.5, color: colors.ink3 },
  statusPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  statusPillError: { backgroundColor: colors.terraSoft },
  statusPillRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusPillText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: colors.terraDark },
  sheetClose: {
    position: 'absolute',
    top: 10,
    right: space.lg,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
