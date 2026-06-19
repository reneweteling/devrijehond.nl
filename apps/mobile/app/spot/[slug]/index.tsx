/**
 * S5/S6 — Spot detail. Real screen.
 *   - Photo hero (user photo → stock fallback) with a warm palette overlay.
 *   - Title + verified/unverified badge + rating aggregate.
 *   - Community-check block: net score + progress toward +5, "Klopt deze plek?"
 *     confirm / deny buttons (POST /api/v1/me/spots/:id/vote), with an
 *     eligibility line. The submitter can't vote on their own spot.
 *   - Amenity icon grid (signature amenity highlighted).
 *   - Reviews list + a "write review" CTA (auth-gated).
 *   - Region detail leads with the geofence on a small map.
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  useCastVote,
  useMe,
  useSpotDetail,
  useSpotReviews,
  type Amenity,
  type Review,
} from '@/lib/api';
import { amenitySymbol } from '@/lib/icons';
import { colors, font, radius, space } from '@/lib/theme';
import { AmenityTile, Button, Stars, VerifiedBadge } from '@/components/ui';

function polygonCoords(geometry: unknown): { latitude: number; longitude: number }[] {
  const g = geometry as { type?: string; coordinates?: number[][][] } | null;
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates?.[0])) return [];
  return g.coordinates[0]
    .filter((pt): pt is [number, number] => pt.length >= 2)
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export default function SpotDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: spot, isLoading } = useSpotDetail(slug);
  const { data: reviewsData } = useSpotReviews(slug);
  const { data: me } = useMe();
  const castVote = useCastVote();

  const reviews = reviewsData?.items ?? [];
  const region = useMemo(() => polygonCoords(spot?.geometry), [spot?.geometry]);

  if (isLoading || !spot) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }

  const v = spot.verification;
  const progress = Math.max(0, Math.min(1, v.netScore / 5));
  const isOwner = me?.id === spot.submittedBy.id;
  const canVote = !!me && !isOwner && v.status === 'UNVERIFIED';

  const eligibilityLine = !me
    ? 'Log in om deze plek te bevestigen.'
    : isOwner
      ? 'Dit is jouw inzending — je kunt niet op je eigen plek stemmen.'
      : v.status !== 'UNVERIFIED'
        ? 'Deze plek is al door de community geverifieerd.'
        : 'Ben je hier geweest? Dan telt jouw stem mee.';

  const vote = (value: 'CONFIRM' | 'DENY') => {
    if (!canVote) return;
    // TODO(verify): attach a `proof: { lat, lng }` from expo-location so the
    // server can run the proximity gate and weight the vote.
    castVote.mutate(
      { spotId: spot.id, value },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ['spot', slug] }) },
    );
  };

  const heroUrl = spot.photos[0]?.url ?? null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Hero */}
        <View style={styles.hero}>
          {heroUrl ? (
            <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
              <SymbolView name="photo.fill" size={40} tintColor={colors.ink3} />
            </View>
          )}
          <View style={[StyleSheet.absoluteFill, styles.heroOverlay]} />
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 6 }]}
            hitSlop={10}
          >
            <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{spot.name}</Text>
          </View>
          <Text style={styles.category}>{spot.category.label}</Text>

          <View style={styles.badgeRow}>
            <VerifiedBadge status={v.status} />
            {spot.rating.count > 0 ? (
              <View style={styles.ratingInline}>
                <Stars value={spot.rating.average} />
                <Text style={styles.ratingText}>
                  {spot.rating.average.toFixed(1).replace('.', ',')} · {spot.rating.count} reviews
                </Text>
              </View>
            ) : null}
          </View>

          {spot.description ? <Text style={styles.desc}>{spot.description}</Text> : null}

          {/* Region geofence map */}
          {spot.type === 'REGION' && region.length >= 3 ? (
            <View style={styles.mapBox}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: spot.lat ?? region[0]?.latitude ?? 52.3006,
                  longitude: spot.lng ?? region[0]?.longitude ?? 4.8368,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
                pointerEvents="none"
              >
                <Polygon
                  coordinates={region}
                  fillColor="rgba(110,123,51,0.20)"
                  strokeColor={colors.moss}
                  strokeWidth={2}
                />
              </MapView>
            </View>
          ) : spot.lat != null && spot.lng != null ? (
            <View style={styles.mapBox}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: spot.lat,
                  longitude: spot.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                pointerEvents="none"
              >
                <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }} />
              </MapView>
            </View>
          ) : null}

          {/* Community-check block (UNVERIFIED) */}
          {v.status === 'UNVERIFIED' && (
            <View style={styles.checkBlock}>
              <Text style={styles.checkTitle}>Klopt deze plek?</Text>
              <Text style={styles.checkScore}>
                {v.confirmCount} bevestigd · {v.denyCount} afgewezen · netto{' '}
                {v.netScore >= 0 ? `+${v.netScore}` : v.netScore}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressLabel}>Bij netto +5 wordt deze plek geverifieerd</Text>

              <View style={styles.voteRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Klopt"
                    icon="hand.thumbsup.fill"
                    onPress={() => vote('CONFIRM')}
                    disabled={!canVote || castVote.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Klopt niet"
                    variant="secondary"
                    icon="hand.thumbsdown.fill"
                    onPress={() => vote('DENY')}
                    disabled={!canVote || castVote.isPending}
                  />
                </View>
              </View>
              <Text style={styles.eligibility}>{eligibilityLine}</Text>
            </View>
          )}

          {/* Amenities */}
          {spot.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Voorzieningen</Text>
              <View style={styles.amenityGrid}>
                {spot.amenities.map((a: Amenity, i: number) => (
                  <AmenityTile
                    key={a.id}
                    symbol={amenitySymbol(a.icon ?? a.slug)}
                    label={a.label}
                    highlight={i === 0}
                  />
                ))}
              </View>
            </View>
          )}

          {/* POI extras */}
          {spot.type === 'POI' && (spot.address || spot.phone || spot.website) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informatie</Text>
              {spot.address ? <Info icon="mappin.circle.fill" text={spot.address} /> : null}
              {spot.phone ? <Info icon="phone.fill" text={spot.phone} /> : null}
              {spot.website ? <Info icon="globe" text={spot.website} /> : null}
            </View>
          )}

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <Pressable
                onPress={() =>
                  me ? router.push(`/spot/${spot.slug}/review`) : router.push('/(auth)/sign-in')
                }
              >
                <Text style={styles.link}>Schrijf review</Text>
              </Pressable>
            </View>
            {reviews.length ? (
              reviews.map((r: Review) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <View style={styles.reviewAvatar}>
                      <SymbolView name="person.fill" size={13} tintColor={colors.mossDark} />
                    </View>
                    <Text style={styles.reviewName}>
                      {r.author.name ?? r.author.handle ?? 'Anoniem'}
                    </Text>
                    <View style={{ marginLeft: 'auto' }}>
                      <Stars value={r.stars} size={12} />
                    </View>
                  </View>
                  {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={styles.placeholder}>Nog geen reviews. Wees de eerste!</Text>
            )}
          </View>

          {/* Provenance */}
          <Text style={styles.provenance}>
            Ingezonden door{' '}
            {spot.submittedBy.handle ? `@${spot.submittedBy.handle}` : 'een gebruiker'}
            {v.status === 'VERIFIED'
              ? ` · geverifieerd door de community, netto +${v.netScore}`
              : ''}
          </Text>

          <Pressable
            style={styles.reportRow}
            onPress={() => {
              /* TODO(verify): open a report sheet → useSubmitReport. */
            }}
          >
            <SymbolView name="flag" size={14} tintColor={colors.ink3} />
            <Text style={styles.reportText}>Probleem melden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Info({ icon, text }: { icon: SymbolViewProps['name']; text: string }) {
  return (
    <View style={styles.infoRow}>
      <SymbolView name={icon} size={15} tintColor={colors.mossDark} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { height: 260, backgroundColor: colors.mossSoft },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { backgroundColor: colors.photoOverlay },
  backBtn: {
    position: 'absolute',
    left: space.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: space.lg, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontFamily: font.heading, fontSize: 24, color: colors.ink },
  category: { fontFamily: font.body, fontSize: 13, color: colors.ink2, marginTop: -6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontFamily: font.body, fontSize: 12, color: colors.ink2 },
  desc: { fontFamily: font.body, fontSize: 14, color: colors.ink2, lineHeight: 21 },
  mapBox: { height: 180, borderRadius: radius.card, overflow: 'hidden', marginTop: space.sm },
  checkBlock: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: space.lg,
    gap: 8,
    marginTop: space.sm,
  },
  checkTitle: { fontFamily: font.heading, fontSize: 16, color: colors.ink },
  checkScore: { fontFamily: font.body, fontSize: 13, color: colors.ink2 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mossSoft,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: { height: '100%', backgroundColor: colors.moss, borderRadius: 4 },
  progressLabel: { fontFamily: font.body, fontSize: 11, color: colors.ink3 },
  voteRow: { flexDirection: 'row', gap: 10, marginTop: space.sm },
  eligibility: { fontFamily: font.body, fontSize: 12, color: colors.ink2, marginTop: 4 },
  section: { marginTop: space.md, gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: font.heading, fontSize: 16, color: colors.ink },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontFamily: font.body, fontSize: 13, color: colors.ink2, flex: 1 },
  link: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.mossDark },
  reviewCard: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: 12,
    gap: 6,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewName: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.ink },
  reviewBody: { fontFamily: font.body, fontSize: 13, color: colors.ink2, lineHeight: 19 },
  placeholder: { fontFamily: font.body, fontSize: 13, color: colors.ink3 },
  provenance: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.ink3,
    marginTop: space.md,
    lineHeight: 18,
  },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  reportText: { fontFamily: font.body, fontSize: 12, color: colors.ink3 },
});
