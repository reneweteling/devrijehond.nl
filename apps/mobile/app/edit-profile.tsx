/**
 * S14b — Edit profile. Name, @handle and bio. Auth required. Saves via
 * PATCH /api/v1/me, then refreshes the cached profile and pops back.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useMe, useUpdateMe } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, ListState } from '@/components/ui';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) router.replace('/(auth)/sign-in');
  }, [status, isAuthenticated, router]);

  const { data: me } = useMe(isAuthenticated);
  const update = useUpdateMe();

  // Derive the form from a local draft, falling back to the loaded profile.
  // (Avoids a prefill effect that would setState synchronously on load.)
  const [draft, setDraft] = useState<{ name: string; handle: string; bio: string } | null>(null);

  if (status === 'loading' || !isAuthenticated) return <ListState loading />;
  const v = draft ?? { name: me?.name ?? '', handle: me?.handle ?? '', bio: me?.bio ?? '' };
  const setField = (patch: Partial<typeof v>) => setDraft({ ...v, ...patch });

  const onSave = () => {
    update.mutate(
      {
        name: v.name.trim() || null,
        handle: v.handle.trim() ? v.handle.trim().toLowerCase() : null,
        bio: v.bio.trim() || null,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['me'] });
          router.back();
        },
      },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <SymbolView name="chevron.left" size={20} tintColor={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Profiel bewerken</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Field label="Naam">
          <TextInput
            style={styles.input}
            value={v.name}
            onChangeText={(t) => setField({ name: t })}
            placeholder="Je naam"
            placeholderTextColor={colors.ink3}
          />
        </Field>

        <Field label="Gebruikersnaam">
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
              value={v.handle}
              onChangeText={(t) => setField({ handle: t })}
              placeholder="gebruikersnaam"
              placeholderTextColor={colors.ink3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </Field>

        <Field label="Bio">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={v.bio}
            onChangeText={(t) => setField({ bio: t })}
            placeholder="Vertel kort iets over jezelf en je hond(en)."
            placeholderTextColor={colors.ink3}
            multiline
            maxLength={280}
          />
        </Field>

        <Button label="Opslaan" onPress={onSave} loading={update.isPending} />
        {update.isError ? (
          <Text style={styles.error}>Opslaan mislukt. Probeer opnieuw.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  headerTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  label: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  at: { fontFamily: font.bodyMedium, fontSize: 15, color: colors.ink3 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust, textAlign: 'center' },
});
