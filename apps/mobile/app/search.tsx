/**
 * S3, Search. A name search over spots (typed + categorized). Reuses the public
 * spots list and filters client-side on name/category as the user types, enough
 * for the dataset size, and keeps reads anonymous + cacheable. Tap a result →
 * spot detail.
 */

import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCategories, useSpots, type SpotSummary } from '@/lib/api';
import { colors, font, radius, space } from '@/lib/theme';
import { Stars, VerifiedBadge } from '@/components/ui';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');

  const { data: categoriesData } = useCategories();
  const catById = useMemo(
    () => new Map((categoriesData?.items ?? []).map((c) => [c.id, c] as const)),
    [categoriesData],
  );

  const { data } = useSpots({ limit: 200 });
  const all = data?.items ?? [];

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return [];
    return all.filter((s) => {
      const cat = catById.get(s.categoryId)?.label ?? '';
      return s.name.toLowerCase().includes(query) || cat.toLowerCase().includes(query);
    });
  }, [all, catById, query]);

  const renderItem = ({ item }: { item: SpotSummary }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/spot/${item.slug}`)}>
      <View style={styles.thumb}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <SymbolView name="photo.fill" size={18} tintColor={colors.ink3} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>{catById.get(item.categoryId)?.label ?? ', '}</Text>
        <View style={styles.metaRow}>
          <VerifiedBadge status={item.status} />
          {item.rating.count > 0 ? (
            <View style={styles.ratingInline}>
              <Stars value={item.rating.average} size={11} />
              <Text style={styles.ratingText}>
                {item.rating.average.toFixed(1).replace('.', ',')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <SymbolView name="chevron.right" size={16} tintColor={colors.ink3} />
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.searchRow}>
        <View style={styles.pill}>
          <SymbolView name="magnifyingglass" size={16} tintColor={colors.ink3} />
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Zoek een plek of gebied"
            placeholderTextColor={colors.ink3}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <SymbolView name="xmark.circle.fill" size={16} tintColor={colors.ink3} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Annuleren</Text>
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? 'Geen plekken gevonden.' : 'Typ om te zoeken op naam of categorie.'}
          </Text>
        }
        contentContainerStyle={{ paddingTop: space.md, paddingBottom: insets.bottom + 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, fontFamily: font.body, fontSize: 14, color: colors.ink, padding: 0 },
  cancel: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.mossDark },
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
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: 52, height: 52 },
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
    paddingHorizontal: 40,
  },
});
