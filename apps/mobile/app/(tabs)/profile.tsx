/**
 * S14, Profile / My submissions. Shows avatar, name/handle, bio, reputation,
 * the user's dogs, and a sign-out. Anonymous users see a sign-in prompt.
 *
 * TODO(verify): wire "My submissions" once a GET /api/v1/me/spots (mine) list
 * endpoint exists; the OpenAPI registry currently only exposes create/edit
 * under /me/spots. Edit-profile (S14b) and add/edit-dog (S14c) PATCH/POST
 * /me + /me/dogs are stubbed as CTAs.
 */

import { Fragment } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthToken } from '@devrijehond/api-client';

import { useMe, useModeratorApplication, useMySpots, type Dog, type SpotSummary } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, ListState, VerifiedBadge } from '@/components/ui';

/** A card heading: a soft-moss glyph tile + a title, optional trailing action. */
function SectionHead({
  icon,
  title,
  action,
  onAction,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  action?: SymbolViewProps['name'];
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        <View style={styles.sectionIcon}>
          <SymbolView name={icon} size={14} tintColor={colors.mossDark} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <SymbolView name={action} size={24} tintColor={colors.moss} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, setAuthenticated } = useAuth();
  const { data: me, isLoading, isError: meError, refetch: meRefetch } = useMe(isAuthenticated);
  const { data: mySpots, isError: spotsError, refetch: spotsRefetch } = useMySpots(isAuthenticated);
  const { data: modApplication } = useModeratorApplication(isAuthenticated);

  const signOut = async () => {
    await clearSession();
    setAuthToken(null);
    setAuthenticated(false);
    qc.clear();
    router.replace('/(tabs)');
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.signedOutAvatar}>
          <SymbolView name="person.fill" size={40} tintColor={colors.moss} />
        </View>
        <Text style={styles.signedOutTitle}>Niet ingelogd</Text>
        <Text style={styles.signedOutSub}>
          Vul je e-mailadres in om plekken toe te voegen, te bevestigen en reviews te schrijven.
          Geen registratie nodig, we maken automatisch een account voor je aan.
        </Text>
        <View style={{ width: '100%', paddingHorizontal: space.lg, gap: space.sm }}>
          <Button label="Inloggen" onPress={() => router.push('/(auth)/sign-in')} />
          <Button
            label="Over De Vrije Hond"
            variant="secondary"
            icon="info.circle"
            onPress={() => router.push('/about')}
          />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ListState loading />
      </View>
    );
  }

  if (meError) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ListState error errorText="Kon profiel niet laden" onRetry={meRefetch} />
      </View>
    );
  }

  const memberSince = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    : null;
  const isModerator = (me?.role as string) === 'MODERATOR' || me?.role === 'ADMIN';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
      <View style={[styles.headerBand, { paddingTop: insets.top + space.xl }]}>
        <View style={styles.avatarWrap}>
          {me?.image ? (
            <Image source={{ uri: me.image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <SymbolView name="person.fill" size={36} tintColor={colors.mossDark} />
            </View>
          )}
        </View>

        <Text style={styles.name}>{me?.name ?? me?.handle ?? 'Hondenbaas'}</Text>
        {me?.handle ? <Text style={styles.handle}>@{me.handle}</Text> : null}
        {me?.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}

        <View style={styles.metaRow}>
          <View style={styles.repPill}>
            <SymbolView name="rosette" size={13} tintColor={colors.mossDark} />
            <Text style={styles.repText}>Reputatie {me?.reputation ?? 0}</Text>
          </View>
          {isModerator ? (
            <View style={styles.modPill}>
              <SymbolView name="shield.fill" size={12} tintColor={colors.terraDark} />
              <Text style={styles.modPillText}>Moderator</Text>
            </View>
          ) : null}
        </View>

        {memberSince ? <Text style={styles.memberSince}>Lid sinds {memberSince}</Text> : null}

        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.6 }]}
        >
          <SymbolView name="pencil" size={14} tintColor={colors.mossDark} />
          <Text style={styles.editButtonText}>Profiel bewerken</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHead
          icon="pawprint.fill"
          title="Mijn honden"
          action="plus.circle.fill"
          onAction={() => router.push('/add-dog')}
        />
        {me?.dogs?.length ? (
          me.dogs.map((d: Dog, i: number) => (
            <Fragment key={d.id}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <View style={styles.dogRow}>
                <View style={styles.dogAvatar}>
                  <SymbolView name="pawprint.fill" size={18} tintColor={colors.mossDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{d.name}</Text>
                  <Text style={styles.rowMeta}>
                    {[d.breed, d.birthYear ? `${new Date().getFullYear() - d.birthYear} jr` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Hond'}
                  </Text>
                </View>
              </View>
            </Fragment>
          ))
        ) : (
          <Pressable
            onPress={() => router.push('/add-dog')}
            style={({ pressed }) => [styles.emptyRow, pressed && { opacity: 0.6 }]}
          >
            <SymbolView name="plus.circle" size={20} tintColor={colors.moss} />
            <Text style={styles.emptyText}>Voeg je eerste hond toe</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <SectionHead icon="mappin.and.ellipse" title="Mijn inzendingen" />
        {spotsError ? (
          <ListState error errorText="Kon inzendingen niet laden" onRetry={spotsRefetch} />
        ) : mySpots && mySpots.length > 0 ? (
          mySpots.map((s: SpotSummary, i: number) => (
            <Fragment key={s.id}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <Pressable
                style={({ pressed }) => [styles.spotRow, pressed && { opacity: 0.6 }]}
                onPress={() => router.push(`/spot/${s.slug}`)}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <VerifiedBadge status={s.status} />
                </View>
                <SymbolView name="chevron.right" size={15} tintColor={colors.ink3} />
              </Pressable>
            </Fragment>
          ))
        ) : (
          <View style={styles.emptyState}>
            <SymbolView name="map" size={26} tintColor={colors.ink3} />
            <Text style={styles.emptyStateText}>Je toegevoegde plekken verschijnen hier.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHead icon="shield.lefthalf.filled" title="Moderatie" />
        {isModerator ? (
          <View style={styles.modBadgeRow}>
            <SymbolView name="checkmark.shield.fill" size={16} tintColor={colors.mossDark} />
            <Text style={styles.modBadgeText}>Je bent moderator</Text>
          </View>
        ) : modApplication?.status === 'PENDING' ? (
          <View style={styles.modBadgeRow}>
            <SymbolView name="clock.fill" size={16} tintColor={colors.terra} />
            <Text style={[styles.modBadgeText, { color: colors.terraDark }]}>
              Aanmelding in behandeling
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.modHint}>
              Help mee plekken te controleren en de kaart betrouwbaar te houden.
            </Text>
            <Button
              label="Word moderator"
              variant="secondary"
              icon="shield"
              onPress={() => router.push('/moderator-apply')}
            />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/about')}
          style={({ pressed }) => [styles.footerRow, pressed && { opacity: 0.6 }]}
        >
          <SymbolView name="info.circle" size={18} tintColor={colors.ink2} />
          <Text style={styles.footerText}>Over De Vrije Hond</Text>
          <SymbolView name="chevron.right" size={14} tintColor={colors.ink3} />
        </Pressable>
        <Pressable
          onPress={signOut}
          style={({ pressed }) => [styles.signOutRow, pressed && { opacity: 0.6 }]}
        >
          <SymbolView name="rectangle.portrait.and.arrow.right" size={17} tintColor={colors.rust} />
          <Text style={styles.signOutText}>Uitloggen</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  // Signed-out state
  signedOutAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  signedOutTitle: {
    fontFamily: font.heading,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
    marginTop: space.sm,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  signedOutSub: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink2,
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 40,
    marginBottom: space.md,
  },

  // Header band
  headerBand: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    backgroundColor: colors.mossSoft,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mossDark,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.sand },
  name: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginTop: space.md,
    textAlign: 'center',
  },
  handle: { fontFamily: font.body, fontSize: 13, color: colors.ink2, marginTop: 1 },
  bio: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  repPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  repText: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.mossDark },
  modPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.terraSoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  modPillText: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.terraDark },
  memberSince: {
    fontFamily: font.body,
    fontSize: 11.5,
    color: colors.ink3,
    marginTop: space.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: space.lg,
  },
  editButtonText: { fontFamily: font.bodyMedium, fontSize: 13.5, color: colors.mossDark },

  // Section cards
  section: {
    marginTop: space.lg,
    marginHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  separator: { height: 1, backgroundColor: colors.line, marginLeft: 56 },

  // Rows
  dogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dogAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowTitle: { fontFamily: font.bodyMedium, fontSize: 14.5, color: colors.ink },
  rowMeta: { fontFamily: font.body, fontSize: 12, color: colors.ink2, marginTop: 2 },

  // Empty states
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
  },
  emptyText: { fontFamily: font.bodyMedium, fontSize: 13.5, color: colors.moss },
  emptyState: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  emptyStateText: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink3,
    textAlign: 'center',
  },

  // Moderation
  modBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  modBadgeText: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.mossDark },
  modHint: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink2,
    marginBottom: space.md,
  },

  // Footer actions
  footer: {
    marginTop: space.xl,
    marginHorizontal: space.lg,
    gap: space.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  footerText: { flex: 1, fontFamily: font.bodyMedium, fontSize: 14, color: colors.ink },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(163,59,45,0.08)',
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  signOutText: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.rust },
});
