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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, type Region } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCategories,
  useSpotsInViewport,
  type Bbox,
  type Category,
  type SpotSummary,
} from '@/lib/api';
import { useUserLocation } from '@/lib/location';
import { categoryColors, colors, font, radius, space } from '@/lib/theme';
import { Button, Chip, VerifiedBadge, Stars } from '@/components/ui';

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
 * Tappable label at a geofence centroid. react-native-maps Polygon `onPress`
 * doesn't fire on Apple Maps (iOS), so the outline alone isn't tappable and a
 * bare dot didn't say what the area is. This pill shows the name (so you can
 * read what it is straight away) and is a real Marker, which IS tappable on
 * iOS, so it opens the spot. Rasterised once then tracking off, like SpotMarker.
 */
function RegionLabel({
  spot,
  color,
  onPress,
}: {
  spot: SpotSummary;
  color: string;
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
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.regionLabel}>
        <View
          style={[
            styles.regionLabelDot,
            verified
              ? { backgroundColor: color, borderColor: color }
              : { backgroundColor: '#fff', borderColor: colors.terra, borderStyle: 'dashed' },
          ]}
        />
        <Text style={styles.regionLabelText} numberOfLines={1}>
          {spot.name}
        </Text>
      </View>
    </Marker>
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
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  };

  // Stable geofence polygons: recompute only when spots/categories change, not
  // on every render, so react-native-maps doesn't redraw (flicker) them.
  const regionPolygons = useMemo(
    () =>
      spots
        .map((s) => {
          const rings = regionRings(s);
          if (!rings || !rings[0]) return null;
          return {
            id: s.id,
            spot: s,
            coordinates: rings[0],
            holes: rings.slice(1),
            color: catColor(catById.get(s.categoryId)),
            verified: s.status === 'VERIFIED',
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null),
    [spots, catById],
  );
  // Region spots that already render as an outlined polygon, so we don't also
  // drop a redundant centre dot on top of them.
  const polygonIds = useMemo(() => new Set(regionPolygons.map((p) => p.id)), [regionPolygons]);

  // Memoise the map children as stable element arrays. The screen re-renders on
  // every GPS tick (useUserLocation) and on every select; without this the
  // Polygon/Marker elements are rebuilt each time and react-native-maps redraws
  // them, which is the flicker. These only rebuild when the data behind them
  // changes, not on location/selection churn.
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
  const regionLabelEls = useMemo(
    () =>
      regionPolygons.map((p) => (
        <RegionLabel
          key={`label-${p.id}`}
          spot={p.spot}
          color={p.color}
          onPress={() => setSelected(p.spot)}
        />
      )),
    [regionPolygons],
  );
  const markerEls = useMemo(
    () =>
      spots
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
    [spots, polygonIds, catById],
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
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={onRegionChange}
        showsUserLocation
        onPress={() => setSelected(null)}
      >
        {/*
          REGION geofences: a verification-styled outline (solid when verified,
          dashed terracotta when not) plus a tappable RegionLabel pill naming the
          area (the outline isn't reliably tappable on Apple Maps). POIs render
          as a teardrop pin; regions without geometry fall back to a dot. All
          memoised above so location/selection re-renders don't redraw them.
        */}
        {polygonEls}
        {regionLabelEls}
        {markerEls}
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

      {/* (D) Legend — hidden while a spot is selected */}
      {!selected && (
        <View style={[styles.legend, { bottom: insets.bottom + 64 }]} pointerEvents="none">
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
        </View>
      )}

      {/* Recenter on the user's location (iOS has no built-in button) */}
      {userLocation && !selected && (
        <Pressable
          style={({ pressed }) => [
            styles.recenterBtn,
            { bottom: insets.bottom + 64, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={recenterOnUser}
          hitSlop={8}
        >
          <SymbolView name="location.fill" size={20} tintColor={colors.mossDark} />
        </Pressable>
      )}

      {/* Bottom-sheet peek card: tapping a marker/region shows this; the CTA
          opens the full info page. The card itself doesn't navigate. */}
      {selected && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 100 }]}>
          <Pressable
            style={({ pressed }) => [styles.sheetClose, { opacity: pressed ? 0.5 : 1 }]}
            onPress={() => setSelected(null)}
            hitSlop={12}
          >
            <SymbolView name="xmark" size={13} tintColor={colors.ink3} />
          </Pressable>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetRow}>
            <View style={styles.thumb}>
              {selected.photoUrl ? (
                <Image
                  source={{ uri: selected.photoUrl }}
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
              ) : (
                <SymbolView name="photo.fill" size={20} tintColor={colors.ink3} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={styles.sheetMeta} numberOfLines={1}>
                {catById.get(selected.categoryId)?.label ?? ''}
              </Text>
              <View style={styles.sheetMetaRow}>
                <VerifiedBadge status={selected.status} />
                {selected.rating.count > 0 ? (
                  <View style={styles.ratingInline}>
                    <Stars value={selected.rating.average} size={11} />
                    <Text style={styles.ratingText}>
                      {selected.rating.average.toFixed(1).replace('.', ',')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <View style={{ marginTop: space.sm }}>
            <Button label="Bekijk plek" onPress={() => router.push(`/spot/${selected.slug}`)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  chrome: { position: 'absolute', left: 0, right: 0, top: 0, gap: space.sm },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: space.lg,
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
  chipRow: { gap: 8, paddingHorizontal: space.lg, paddingVertical: 4 },
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
  regionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 170,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 9,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  regionLabelDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  regionLabelText: { fontFamily: font.bodyMedium, fontSize: 11.5, color: colors.ink },
  legend: {
    position: 'absolute',
    left: space.lg,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: 10,
    gap: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  recenterBtn: {
    position: 'absolute',
    right: space.lg,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  legendText: { fontFamily: font.body, fontSize: 11, color: colors.ink2 },
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
