/**
 * S16 — New feature request. Title + description + component (area of the app).
 * Auth required. Created via POST /api/v1/me/feature-requests.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useCreateFeatureRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, Note } from '@/components/ui';

const COMPONENTS = ['Kaart', 'Inzenden', 'Profiel', 'Anders'];

export default function NewRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) router.replace('/(auth)/sign-in');
  }, [status, isAuthenticated, router]);

  const create = useCreateFeatureRequest();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [component, setComponent] = useState<string | null>(null);

  const onSubmit = () => {
    if (title.trim().length < 4) return;
    create.mutate(
      { title: title.trim(), body: body.trim() || undefined, component: component ?? undefined },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['feature-requests'] });
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
        <Text style={styles.headerTitle}>Nieuw verzoek</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Wat zou je graag willen?"
            placeholderTextColor={colors.ink3}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Toelichting (optioneel)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={body}
            onChangeText={setBody}
            placeholder="Beschrijf je idee wat uitgebreider."
            placeholderTextColor={colors.ink3}
            multiline
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Onderdeel</Text>
          <View style={styles.compRow}>
            {COMPONENTS.map((c) => (
              <Pressable
                key={c}
                style={[styles.compChip, component === c && styles.compChipActive]}
                onPress={() => setComponent(c)}
              >
                <Text style={[styles.compText, component === c && styles.compTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Note>
          Tip: zoek eerst of je wens al bestaat en stem die omhoog — dan maken we hem sneller.
        </Note>

        <Button
          label="Verzoek plaatsen"
          onPress={onSubmit}
          loading={create.isPending}
          disabled={title.trim().length < 4}
        />
        {create.isError ? (
          <Text style={styles.error}>Plaatsen mislukt. Probeer opnieuw.</Text>
        ) : null}
      </ScrollView>
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
  headerTitle: { fontFamily: font.heading, fontSize: 16, color: colors.ink },
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
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  compRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compChip: {
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  compChipActive: { backgroundColor: colors.moss, borderColor: colors.moss },
  compText: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.ink2 },
  compTextActive: { color: '#fff' },
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust, textAlign: 'center' },
});
