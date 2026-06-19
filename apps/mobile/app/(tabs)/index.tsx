/**
 * S1 — Map (home). The heavy interactive surface is a native map
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

import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCategories,
  useSpotsInViewport,
  type Bbox,
  type Category,
  type SpotSummary,
} from '@/lib/api';
import { categoryColors, colors, font, radius, space } from '@/lib/theme';
import { Chip, VerifiedBadge, Wordmark, Stars } from '@/components/ui';

// Amsterdam-centre default region (covers the seeded spots from the Bos in the
// south to the NDSM in the north). The map recentres on the user when location
// is granted (TODO(verify): wire expo-location for initial centring).
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

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [bbox, setBbox] = useState<Bbox>(() => regionToBbox(INITIAL_REGION));
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<SpotSummary | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  const { data: spotsData } = useSpotsInViewport(bbox, { categoryId: activeCat });
  const spots = spotsData?.items ?? [];

  const onRegionChange = (r: Region) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setBbox(regionToBbox(r)), 350);
  };

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={onRegionChange}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => setSelected(null)}
      >
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

      {/* Floating chrome: wordmark + search pill + category chips */}
      <View style={[styles.chrome, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.searchPill}>
          <SymbolView name="magnifyingglass" size={16} tintColor={colors.ink3} />
          <Text style={styles.searchPlaceholder}>Zoek een plek of gebied</Text>
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

      {/* Legend */}
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

      {/* Bottom-sheet peek card */}
      {selected && (
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 100 }]}
          onPress={() => router.push(`/spot/${selected.slug}`)}
        >
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
                {catById.get(selected.categoryId)?.label ?? '—'}
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

      <View style={[styles.topGutter, { top: insets.top + 64 }]} pointerEvents="none">
        <Wordmark />
      </View>
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
  sheetTitle: { fontFamily: font.heading, fontSize: 15, color: colors.ink },
  sheetMeta: { fontFamily: font.body, fontSize: 12, color: colors.ink2, marginTop: 1 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  topGutter: { position: 'absolute', alignSelf: 'center' },
});
