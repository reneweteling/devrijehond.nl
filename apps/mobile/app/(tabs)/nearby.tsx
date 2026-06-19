/**
 * S4 — Nabij (nearby list). The list counterpart to the map, sharing the same
 * category filter. Each row: thumbnail, title, category, distance, rating,
 * verified badge. Tap → spot detail.
 */

import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCategories, useSpots, type SpotSummary } from '@/lib/api';
import { colors, font, radius, space } from '@/lib/theme';
import { Chip, ScreenTitle, Stars, VerifiedBadge } from '@/components/ui';

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const { data, isLoading, refetch, isRefetching } = useSpots({ categoryId: activeCat });
  const spots = data?.items ?? [];

  const renderItem = ({ item }: { item: SpotSummary }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/spot/${item.slug}`)}>
      <View style={styles.thumb}>
        <SymbolView name="photo.fill" size={22} tintColor={colors.ink3} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>{catById.get(item.categoryId)?.label ?? '—'}</Text>
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
        data={spots}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Laden…' : 'Nog geen plekken in dit gebied.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
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
  },
  title: { fontFamily: font.heading, fontSize: 15, color: colors.ink },
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
