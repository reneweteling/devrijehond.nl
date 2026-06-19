/**
 * S14 — Profile / My submissions. Shows avatar, name/handle, bio, reputation,
 * the user's dogs, and a sign-out. Anonymous users see a sign-in prompt.
 *
 * TODO(verify): wire "My submissions" once a GET /api/v1/me/spots (mine) list
 * endpoint exists; the OpenAPI registry currently only exposes create/edit
 * under /me/spots. Edit-profile (S14b) and add/edit-dog (S14c) PATCH/POST
 * /me + /me/dogs are stubbed as CTAs.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthToken } from '@devrijehond/api-client';

import { useMe, type Dog } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button } from '@/components/ui';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, setAuthenticated } = useAuth();
  const { data: me, isLoading } = useMe(isAuthenticated);

  const signOut = async () => {
    await clearSession();
    setAuthToken(null);
    setAuthenticated(false);
    qc.clear();
    router.replace('/(tabs)');
  };

  if (!isAuthenticated || (!isLoading && !me)) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <SymbolView
          name="person.crop.circle.badge.questionmark"
          size={48}
          tintColor={colors.ink3}
        />
        <Text style={styles.signedOutTitle}>Niet ingelogd</Text>
        <Text style={styles.signedOutSub}>
          Log in om plekken toe te voegen, te bevestigen en reviews te schrijven.
        </Text>
        <View style={{ width: '100%', paddingHorizontal: space.lg, gap: space.sm }}>
          <Button label="Inloggen" onPress={() => router.push('/(auth)/sign-in')} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + 110,
      }}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <SymbolView name="person.fill" size={34} tintColor={colors.mossDark} />
        </View>
        <Text style={styles.name}>{me?.name ?? me?.handle ?? 'Hondenbaas'}</Text>
        {me?.handle ? <Text style={styles.handle}>@{me.handle}</Text> : null}
        {me?.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
        <View style={styles.repPill}>
          <SymbolView name="rosette" size={13} tintColor={colors.mossDark} />
          <Text style={styles.repText}>Reputatie {me?.reputation ?? 0}</Text>
        </View>
        <View style={{ width: '100%', paddingHorizontal: space.lg, marginTop: space.md }}>
          <Button
            label="Profiel bewerken"
            variant="secondary"
            icon="pencil"
            onPress={() => {
              /* TODO(verify): route to (modal) edit-profile (S14b). */
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Mijn honden</Text>
          <SymbolView name="plus.circle" size={20} tintColor={colors.mossDark} />
        </View>
        {me?.dogs?.length ? (
          me.dogs.map((d: Dog) => (
            <View key={d.id} style={styles.dogRow}>
              <View style={styles.dogAvatar}>
                <SymbolView name="pawprint.fill" size={18} tintColor={colors.mossDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dogName}>{d.name}</Text>
                <Text style={styles.dogMeta}>
                  {[d.breed, d.birthYear ? `${new Date().getFullYear() - d.birthYear} jr` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Hond'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>Nog geen honden toegevoegd.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mijn inzendingen</Text>
        {/* TODO(verify): list the user's submitted spots once a mine-list
            endpoint is available. */}
        <Text style={styles.placeholder}>Je toegevoegde plekken verschijnen hier.</Text>
      </View>

      <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
        <Button
          label="Uitloggen"
          variant="secondary"
          icon="rectangle.portrait.and.arrow.right"
          onPress={signOut}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  signedOutTitle: {
    fontFamily: font.heading,
    fontSize: 20,
    color: colors.ink,
    marginTop: space.sm,
  },
  signedOutSub: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: space.md,
  },
  header: { alignItems: 'center', paddingHorizontal: space.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginTop: space.md,
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
  repPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mossSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    marginTop: space.md,
  },
  repText: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.mossDark },
  section: {
    marginTop: space.xl,
    marginHorizontal: space.lg,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sectionTitle: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  dogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dogAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogName: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.ink },
  dogMeta: { fontFamily: font.body, fontSize: 12, color: colors.ink2 },
  placeholder: { fontFamily: font.body, fontSize: 13, color: colors.ink3 },
});
