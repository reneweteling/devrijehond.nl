/**
 * S4 — Nabij (nearby list). The list counterpart to the map: a name/category
 * search, a category filter, and rows showing thumbnail, title, category,
 * distance (when location is granted), rating and a verified badge. With
 * location the list is sorted nearest-first; otherwise newest-first from the
 * API. Search isn't limited to the viewport — you might be looking elsewhere.
 */

import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCategories, useSpots, type SpotSummary } from '@/lib/api';
import { useUserLocation, haversineMeters, formatDistance } from '@/lib/location';
import { colors, font, radius, space } from '@/lib/theme';
import { Chip, ScreenTitle, Stars, VerifiedBadge } from '@/components/ui';

type Row = SpotSummary & { _distanceM?: number };

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const [q, setQ] = useState('');
  const loc = useUserLocation();

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  // Pull a generous page so search reaches beyond the immediate area.
  const { data, isLoading, refetch, isRefetching } = useSpots({
    categoryId: activeCat,
    limit: 200,
  });

  const query = q.trim().toLowerCase();
  const rows = useMemo<Row[]>(() => {
    let list: Row[] = (data?.items ?? []).map((s) => ({
      ...s,
      _distanceM:
        loc && s.lat != null && s.lng != null
          ? haversineMeters(loc, { lat: s.lat, lng: s.lng })
          : undefined,
    }));
    if (query) {
      list = list.filter((s) => {
        const cat = catById.get(s.categoryId)?.label ?? '';
        return s.name.toLowerCase().includes(query) || cat.toLowerCase().includes(query);
      });
    }
    if (loc) {
      list = [...list].sort((a, b) => (a._distanceM ?? Infinity) - (b._distanceM ?? Infinity));
    }
    return list;
  }, [data, loc, query, catById]);

  const renderItem = ({ item }: { item: Row }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/spot/${item.slug}`)}>
      <View style={styles.thumb}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <SymbolView name="photo.fill" size={22} tintColor={colors.ink3} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          {catById.get(item.categoryId)?.label ?? '—'}
          {item._distanceM != null ? ` · ${formatDistance(item._distanceM)}` : ''}
        </Text>
        <View style={styles.metaRow}>
          <VerifiedBadge status={item.status} />
          {item.rating.count > 0 ? (
            <View style={styles.ratingInline}>
              <Stars value={item.rating.average} size={11} />
              <Text style={styles.ratingText}>
                {item.rating.average.toFixed(1).replace('.', ',')} · {item.rating.count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <SymbolView name="chevron.right" size={16} tintColor={colors.ink3} />
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenTitle sub="Hondenplekken bij jou in de buurt">Nabij</ScreenTitle>

      <FlatList
        data={rows}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        onRefresh={refetch}
        refreshing={isRefetching}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.searchPill}>
              <SymbolView name="magnifyingglass" size={16} tintColor={colors.ink3} />
              <TextInput
                style={styles.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder="Zoek op naam of categorie"
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
                returnKeyType="search"
              />
              {q.length > 0 ? (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <SymbolView name="xmark.circle.fill" size={16} tintColor={colors.ink3} />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              horizontal
              data={[{ id: '__all', label: 'Alles' }, ...categories]}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) =>
                item.id === '__all' ? (
                  <Chip label="Alles" active={!activeCat} onPress={() => setActiveCat(undefined)} />
                ) : (
                  <Chip
                    label={(item as { label: string }).label}
                    active={activeCat === item.id}
                    onPress={() => setActiveCat(item.id)}
                  />
                )
              }
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Laden…' : query ? 'Geen plekken gevonden.' : 'Nog geen plekken hier.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14, color: colors.ink, padding: 0 },
  chipRow: { gap: 8, paddingHorizontal: space.lg, paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: 12,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.card,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: 60, height: 60 },
  title: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  meta: { fontFamily: font.body, fontSize: 12, color: colors.ink2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: font.body, fontSize: 11, color: colors.ink2 },
  empty: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 40,
  },
});
