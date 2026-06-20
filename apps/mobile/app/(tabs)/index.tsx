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
import { Chip, VerifiedBadge, Stars } from '@/components/ui';

// Amsterdam-centre default region (covers the seeded spots from the Bos in the
// south to the NDSM in the north). The map recentres on the user when location
// is granted.
const INITIAL_REGION: Region = {
  latitude: 52.365,
  longitude: 4.89,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

function regionToBbox(r: Region): Bbox {
  return {
    minLng: r.longitude - r.longitudeDelta / 2,
    minLat: r.latitude - r.latitudeDelta / 2,
    maxLng: r.longitude + r.longitudeDelta / 2,
    maxLat: r.latitude + r.latitudeDelta / 2,
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

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  // Search can hand us a location to fly to (e.g. "Hilversum"); see lib/geocode.
  const params = useLocalSearchParams<{ lat?: string; lng?: string; t?: string }>();
  const [bbox, setBbox] = useState<Bbox>(() => regionToBbox(INITIAL_REGION));
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<SpotSummary | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've done the initial user-location fly-to (only once).
  const centredOnUser = useRef(false);

  // (B) Recenter on the user once on mount when permission is granted.
  const userLocation = useUserLocation();
  useEffect(() => {
    if (centredOnUser.current || !userLocation) return;
    centredOnUser.current = true;
    const region: Region = {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    mapRef.current?.animateToRegion(region, 700);
    // Defer the viewport sync out of the synchronous effect body.
    setTimeout(() => setBbox(regionToBbox(region)), 0);
  }, [userLocation]);

  // (C) Fly to a location handed in by search (e.g. "Hilversum"). Runs both on
  // param change (including nonce 't') and once the map is ready, so it never
  // races the map mount. After flying, clear the params so a remount doesn't
  // yank the user back to a stale location.
  const flyToParams = () => {
    const lat = params.lat ? Number(params.lat) : NaN;
    const lng = params.lng ? Number(params.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const region: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
      mapRef.current?.animateToRegion(region, 700);
      // animateToRegion doesn't always fire onRegionChangeComplete, so refetch
      // the viewport spots explicitly (otherwise you land on an empty map).
      // Deferred so it doesn't run setState synchronously in the effect body.
      setTimeout(() => {
        setBbox(regionToBbox(region));
        router.setParams({ lat: undefined, lng: undefined, t: undefined });
      }, 0);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(flyToParams, [params.lat, params.lng, params.t]);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  const {
    data: spotsData,
    isLoading,
    isError,
    refetch,
  } = useSpotsInViewport(bbox, { categoryId: activeCat });
  const spots = spotsData?.items ?? [];
  // True only on the very first load (no data yet and currently fetching).
  const isFirstLoad = isLoading && spots.length === 0;

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
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null),
    [spots, catById],
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
        onMapReady={flyToParams}
        onRegionChangeComplete={onRegionChange}
        showsUserLocation
        onPress={() => setSelected(null)}
      >
        {/* REGION geofences as filled polygons (tap to peek). */}
        {regionPolygons.map((p) => (
          <Polygon
            key={`poly-${p.id}`}
            coordinates={p.coordinates}
            holes={p.holes}
            strokeColor={colors.mossDark}
            strokeWidth={2.5}
            fillColor={`${p.color}59`}
            tappable
            onPress={() => setSelected(p.spot)}
          />
        ))}
        {/*
          The map DTO carries only the centroid (lat/lng), not full geometry, so
          REGION spots render as a circular moss marker and POIs as a teardrop
          pin. Verified = solid category colour; unverified = white with a dashed
          terracotta outline. TODO(verify): add polygon geometry to the map DTO
          (or lazy-fetch detail) to shade REGION outlines as filled polygons.
        */}
        {spots.map((s) => {
          if (s.lat == null || s.lng == null) return null;
          const category = catById.get(s.categoryId);
          const color = catColor(category);
          const verified = s.status === 'VERIFIED';
          const isRegion = s.type === 'REGION';
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => setSelected(s)}
            >
              <View style={styles.pinWrap}>
                <View
                  style={[
                    isRegion ? styles.regionDot : styles.pin,
                    verified
                      ? { backgroundColor: color, borderColor: '#fff' }
                      : {
                          backgroundColor: '#fff',
                          borderColor: colors.terra,
                          borderStyle: 'dashed',
                        },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
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
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.avatar}
            hitSlop={8}
          >
            <SymbolView name="person.fill" size={14} tintColor={colors.mossDark} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Alles" active={!activeCat} onPress={() => setActiveCat(undefined)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={activeCat === c.id}
              onPress={() => setActiveCat(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* (D) Legend — hidden while a spot is selected */}
      {!selected && (
        <View style={[styles.legend, { bottom: insets.bottom + 120 }]} pointerEvents="none">
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
            { bottom: insets.bottom + 120, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={recenterOnUser}
          hitSlop={8}
        >
          <SymbolView name="location.fill" size={20} tintColor={colors.mossDark} />
        </Pressable>
      )}

      {/* Bottom-sheet peek card */}
      {selected && (
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 100 }]}
          onPress={() => router.push(`/spot/${selected.slug}`)}
        >
          {/* (D) Close affordance */}
          <Pressable
            style={({ pressed }) => [styles.sheetClose, { opacity: pressed ? 0.5 : 1 }]}
            onPress={(e) => {
              e.stopPropagation();
              setSelected(null);
            }}
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
            <SymbolView name="chevron.right" size={18} tintColor={colors.ink3} />
          </View>
        </Pressable>
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
