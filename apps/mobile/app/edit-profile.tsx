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
import { Button } from '@/components/ui';

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

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Prefill once the profile loads.
  useEffect(() => {
    if (me && !hydrated) {
      setName(me.name ?? '');
      setHandle(me.handle ?? '');
      setBio(me.bio ?? '');
      setHydrated(true);
    }
  }, [me, hydrated]);

  const onSave = () => {
    update.mutate(
      {
        name: name.trim() || null,
        handle: handle.trim() ? handle.trim().toLowerCase() : null,
        bio: bio.trim() || null,
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
            value={name}
            onChangeText={setName}
            placeholder="Je naam"
            placeholderTextColor={colors.ink3}
          />
        </Field>

        <Field label="Gebruikersnaam">
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
              value={handle}
              onChangeText={setHandle}
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
            value={bio}
            onChangeText={setBio}
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
