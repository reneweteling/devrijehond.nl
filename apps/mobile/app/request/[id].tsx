/**
 * Feature request detail. Shows the full title, body, status, component, who
 * submitted it (username + avatar, never the real name), and the upvote control.
 */

import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useFeatureRequests, useToggleFeatureVote, type FeatureStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { Banner, ListState } from '@/components/ui';

const STATUS_META: Record<FeatureStatus, { label: string; bg: string; fg: string }> = {
  CONSIDERING: { label: 'In overweging', bg: colors.sand, fg: colors.ink2 },
  PLANNED: { label: 'Gepland', bg: colors.mossSoft, fg: colors.mossDark },
  DONE: { label: 'Klaar', bg: colors.mossDark, fg: '#fff' },
  DECLINED: { label: 'Afgewezen', bg: colors.terraSoft, fg: colors.rust },
};

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Re-use the public list query (all statuses) and find by id. This avoids a
  // separate endpoint (which doesn't exist in the generated client). Because the
  // list is small and already in the cache from the previous screen, there is no
  // extra network round-trip in the common path.
  const { data, isLoading, isError, refetch } = useFeatureRequests(undefined);
  const item = data?.items.find((r) => r.id === id);

  const toggleVote = useToggleFeatureVote();

  // Local optimistic state so the button reacts instantly.
  const [optimistic, setOptimistic] = useState<{
    viewerHasVoted: boolean;
    upvoteCount: number;
  } | null>(null);

  const displayVoted = optimistic?.viewerHasVoted ?? item?.viewerHasVoted ?? false;
  const displayCount = optimistic?.upvoteCount ?? item?.upvoteCount ?? 0;

  const onVote = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/sign-in');
      return;
    }
    if (!item || toggleVote.isPending) return;

    const base = optimistic ?? {
      viewerHasVoted: item.viewerHasVoted,
      upvoteCount: item.upvoteCount,
    };
    const next = {
      viewerHasVoted: !base.viewerHasVoted,
      upvoteCount: base.viewerHasVoted ? base.upvoteCount - 1 : base.upvoteCount + 1,
    };
    setOptimistic(next);

    toggleVote.mutate(item.id, {
      onError: () => {
        setOptimistic(null);
      },
      onSettled: () => {
        setOptimistic(null);
        void qc.invalidateQueries({ queryKey: ['feature-requests'] });
      },
    });
  };

  if (isLoading || (!item && !isError)) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <BackButton onPress={() => router.back()} insets={insets} />
        <ListState loading={isLoading} />
      </View>
    );
  }

  if (isError || !item) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, padding: space.lg }]}>
        <BackButton onPress={() => router.back()} insets={insets} />
        <ListState error errorText="Kon het verzoek niet laden." onRetry={refetch} />
      </View>
    );
  }

  const meta = STATUS_META[item.status];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back button floats over the header area */}
      <View style={[styles.headerBar]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Wens
        </Text>
        {/* placeholder to balance the flex row */}
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + 24,
        }}
      >
        {/* Status + component */}
        <View style={styles.tagRow}>
          <View style={[styles.statusTag, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
          {item.component ? (
            <View style={styles.componentTag}>
              <Text style={styles.componentText}>{item.component}</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Who submitted it: username + avatar only (never the real name) */}
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {item.author?.image ? (
              <Image source={{ uri: item.author.image }} style={styles.avatarImg} />
            ) : (
              <SymbolView name="person.fill" size={15} tintColor={colors.mossDark} />
            )}
          </View>
          <Text style={styles.authorName}>
            {item.author?.handle ? `@${item.author.handle}` : 'Een hondenbaas'}
          </Text>
        </View>

        {/* Body */}
        {item.body ? (
          <Text style={styles.body}>{item.body}</Text>
        ) : (
          <Text style={styles.bodyEmpty}>Geen beschrijving toegevoegd.</Text>
        )}

        {/* Upvote control */}
        <View style={styles.voteBlock}>
          <Pressable
            style={({ pressed }) => [
              styles.voteBtn,
              displayVoted && styles.voteBtnActive,
              { opacity: pressed || toggleVote.isPending ? 0.6 : 1 },
            ]}
            onPress={onVote}
            disabled={toggleVote.isPending}
            hitSlop={6}
          >
            <SymbolView
              name="chevron.up"
              size={16}
              tintColor={displayVoted ? '#fff' : colors.mossDark}
            />
            <Text style={[styles.voteCountLabel, displayVoted && styles.voteCountLabelActive]}>
              {displayCount}
            </Text>
            <Text style={[styles.voteBtnLabel, displayVoted && styles.voteBtnLabelActive]}>
              {displayVoted ? 'Gestemd' : 'Stem'}
            </Text>
          </Pressable>
          {!isAuthenticated ? <Text style={styles.voteHint}>Log in om te stemmen.</Text> : null}
        </View>

        {toggleVote.isError ? (
          <Banner kind="error">Stemmen mislukt, probeer opnieuw.</Banner>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BackButton({ onPress, insets }: { onPress: () => void; insets: { top: number } }) {
  // Rendered separately for the loading/error states, which don't have the header bar.
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.backBtn,
        styles.backBtnAbsolute,
        { top: insets.top + 6, opacity: pressed ? 0.6 : 1 },
      ]}
      hitSlop={10}
    >
      <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    fontFamily: font.heading,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
    textAlign: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnAbsolute: {
    position: 'absolute',
    left: space.lg,
  },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: space.md,
    flexWrap: 'wrap',
  },
  statusTag: {
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  statusText: { fontFamily: font.bodyMedium, fontSize: 12 },
  componentTag: {
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'flex-start',
  },
  componentText: { fontFamily: font.body, fontSize: 12, color: colors.ink3 },

  title: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginBottom: space.sm,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.lg },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  authorName: { fontFamily: font.bodyMedium, fontSize: 13.5, color: colors.ink2 },
  body: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink2,
    marginBottom: space.xl,
  },
  bodyEmpty: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    marginBottom: space.xl,
    fontStyle: 'italic',
  },

  voteBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mossSoft,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  voteBtnActive: { backgroundColor: colors.moss },
  voteCountLabel: {
    fontFamily: font.heading,
    fontSize: 15,
    color: colors.mossDark,
  },
  voteCountLabelActive: { color: '#fff' },
  voteBtnLabel: {
    fontFamily: font.bodyMedium,
    fontSize: 14,
    color: colors.mossDark,
  },
  voteBtnLabelActive: { color: '#fff' },
  voteHint: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.ink3,
    flex: 1,
  },
});
