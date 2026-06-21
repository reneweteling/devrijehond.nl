/**
 * S15, Feature requests. Community product input: a list sorted by upvotes,
 * each with a status tag and an upvote control. Filter by status. Viewing is
 * anonymous; upvoting + creating need an account (a tap routes to sign-in).
 */

import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFeatureRequests, type FeatureRequest, type FeatureStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { Chip, ListState, ScreenTitle } from '@/components/ui';

const STATUS_META: Record<FeatureStatus, { label: string; bg: string; fg: string }> = {
  CONSIDERING: { label: 'In overweging', bg: colors.sand, fg: colors.ink2 },
  PLANNED: { label: 'Gepland', bg: colors.mossSoft, fg: colors.mossDark },
  DONE: { label: 'Klaar', bg: colors.mossDark, fg: '#fff' },
  DECLINED: { label: 'Afgewezen', bg: colors.terraSoft, fg: colors.rust },
};

const FILTERS: { label: string; status?: FeatureStatus }[] = [
  { label: 'Populair' },
  { label: 'In overweging', status: 'CONSIDERING' },
  { label: 'Gepland', status: 'PLANNED' },
  { label: 'Klaar', status: 'DONE' },
];

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [filter, setFilter] = useState<FeatureStatus | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useFeatureRequests(filter);

  const requests = data?.items ?? [];

  const renderItem = ({ item }: { item: FeatureRequest }) => {
    const meta = STATUS_META[item.status];
    return (
      <Pressable
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}
        onPress={() => router.push(`/request/${item.id}`)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.statusTag, { backgroundColor: meta.bg }]}>
              <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
            </View>
            {item.component ? <Text style={styles.component}>{item.component}</Text> : null}
            <View style={styles.voteCount}>
              <SymbolView name="chevron.up" size={12} tintColor={colors.mossDark} />
              <Text style={styles.voteCountText}>{item.upvoteCount}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // FAB bottom: sits above the tab bar + standard safe-area.
  const fabBottom = insets.bottom + TAB_BAR_CLEARANCE + space.md;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenTitle sub="Help de app beter maken">Wensen</ScreenTitle>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListHeaderComponent={
          <View style={styles.chipRow}>
            {FILTERS.map((f) => (
              <Chip
                key={f.label}
                label={f.label}
                active={filter === f.status}
                onPress={() => setFilter(f.status)}
              />
            ))}
          </View>
        }
        ListEmptyComponent={
          <ListState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="Nog geen wensen hier."
            onRetry={refetch}
          />
        }
        // Extra bottom padding so the last card clears the floating FAB.
        contentContainerStyle={{ paddingBottom: fabBottom + 56 }}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: fabBottom, opacity: pressed ? 0.8 : 1 }]}
        onPress={() =>
          isAuthenticated ? router.push('/request-new') : router.push('/(auth)/sign-in')
        }
      >
        <SymbolView name="plus" size={16} tintColor="#fff" />
        <Text style={styles.fabText}>Nieuw verzoek</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: 14,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  body: { fontFamily: font.body, fontSize: 13, color: colors.ink2, marginTop: 3, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  statusTag: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9 },
  statusText: { fontFamily: font.bodyMedium, fontSize: 11 },
  component: { fontFamily: font.body, fontSize: 11, color: colors.ink3 },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  voteCountText: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.mossDark },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.moss,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 22,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { fontFamily: font.bodyMedium, fontSize: 14, color: '#fff' },
});
