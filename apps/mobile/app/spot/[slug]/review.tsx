/**
 * S7 — Write review. A 0–5 star selector + comment. Distinct from the
 * community-check vote (that answers "does this place exist / is the info
 * right?"; a review rates the experience). Auth required.
 *
 * The review POSTs to /api/v1/me/spots/:id/reviews, so we need the spot id,
 * which we read from the spot detail (cached by slug).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useSpotDetail, useSubmitReview } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Note } from '@/components/ui';
import { colors, font, radius, space } from '@/lib/theme';

export default function WriteReviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();

  // Writing a review needs an account (wireframe S7). Guard direct/deep-link
  // access — the detail's "Schrijf review" CTA already gates, this covers the rest.
  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) router.replace('/(auth)/sign-in');
  }, [status, isAuthenticated, router]);

  const { data: spot } = useSpotDetail(slug);
  const submit = useSubmitReview();

  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');

  const onSubmit = () => {
    if (!spot || stars === 0) return;
    submit.mutate(
      { spotId: spot.id, stars, body: body || undefined },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['spot-reviews', slug] });
          qc.invalidateQueries({ queryKey: ['spot', slug] });
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
        <Text style={styles.headerTitle}>Review schrijven</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.body}>
        {spot ? <Text style={styles.spotName}>{spot.name}</Text> : null}

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
              <SymbolView
                name={n <= stars ? 'star.fill' : 'star'}
                size={36}
                tintColor={colors.terra}
              />
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Hoe was het hier met je hond?"
          placeholderTextColor={colors.ink3}
          multiline
        />

        <Note>
          Een review gaat over jouw ervaring. Of een plek echt bestaat en de info klopt, bevestig je
          met de community-check op de detailpagina.
        </Note>

        <Button
          label="Review plaatsen"
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={stars === 0}
        />
        {submit.isError ? (
          <Text style={styles.error}>Plaatsen mislukt. Probeer opnieuw.</Text>
        ) : null}
      </View>
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
    marginBottom: space.lg,
  },
  headerTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  body: { paddingHorizontal: space.lg, gap: space.lg },
  spotName: { fontFamily: font.heading, fontSize: 18, lineHeight: 23, color: colors.ink },
  starRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: space.sm },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: 12,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust, textAlign: 'center' },
});
