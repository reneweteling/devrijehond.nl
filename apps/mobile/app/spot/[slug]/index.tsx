/**
 * S5/S6, Spot detail. Real screen.
 *   - Photo hero (user photo → stock fallback) with a warm palette overlay.
 *   - Title + verified/unverified badge + rating aggregate.
 *   - Community-check block: net score + progress toward +5, "Klopt deze plek?"
 *     confirm / deny buttons (POST /api/v1/me/spots/:id/vote), with an
 *     eligibility line. The submitter can't vote on their own spot.
 *   - Amenity icon grid (signature amenity highlighted).
 *   - Reviews list + a "write review" CTA (auth-gated).
 *   - Region detail leads with the geofence on a small map.
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  useCastVote,
  useMe,
  useModerateSpot,
  useSpotDetail,
  useSpotReviews,
  useSubmitReport,
  type Amenity,
  type Review,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { amenitySymbol } from '@/lib/icons';
import { colors, font, radius, space } from '@/lib/theme';
import { AmenityTile, Banner, Button, Stars, VerifiedBadge } from '@/components/ui';
import { RichText } from '@/components/rich-text';

function polygonCoords(geometry: unknown): { latitude: number; longitude: number }[] {
  const g = geometry as { type?: string; coordinates?: number[][][] } | null;
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates?.[0])) return [];
  return g.coordinates[0]
    .filter((pt): pt is [number, number] => pt.length >= 2)
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

const NL_MONTHS = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

/** Compact Dutch date for a review (e.g. "19 jun 2026"). */
function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${NL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const REPORT_REASONS = [
  { value: 'DUPLICATE', label: 'Dubbele plek' },
  { value: 'WRONG_INFO', label: 'Verkeerde informatie' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'INAPPROPRIATE', label: 'Ongepast' },
  { value: 'OTHER', label: 'Anders' },
] as const;

export default function SpotDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { isAuthenticated } = useAuth();
  const { data: spot, isLoading, isError, error, refetch } = useSpotDetail(slug);
  const { data: reviewsData } = useSpotReviews(slug);
  const { data: me, isLoading: meLoading } = useMe(isAuthenticated);
  const castVote = useCastVote();
  const submitReport = useSubmitReport();
  const moderateSpot = useModerateSpot();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [moderateResult, setModerateResult] = useState<'success' | 'error' | null>(null);

  const reviews = reviewsData?.items ?? [];
  const region = useMemo(() => polygonCoords(spot?.geometry), [spot?.geometry]);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }

  if (isError || !spot) {
    const is404 = (error as { status?: number } | null)?.status === 404;
    return (
      <View style={[styles.root, styles.center, { padding: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { position: 'relative', top: 0, left: 0, marginBottom: space.lg },
          ]}
          hitSlop={10}
        >
          <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
        </Pressable>
        <Text style={styles.errorText}>
          {is404 ? 'Deze plek bestaat niet meer.' : 'Geen verbinding. Probeer het opnieuw.'}
        </Text>
        {!is404 && <Button label="Opnieuw proberen" onPress={() => void refetch()} />}
      </View>
    );
  }

  const v = spot.verification;
  const progress = Math.max(0, Math.min(1, v.netScore / 5));
  const isOwner = me?.id === spot.submittedBy.id;
  const isStaff = (me?.role as string) === 'MODERATOR' || me?.role === 'ADMIN';
  const canVote = !!me && !isOwner && v.status === 'UNVERIFIED';
  // Buttons stay tappable for anonymous users on an open spot, the tap routes
  // to sign-in. Only an owner / already-resolved spot disables them.
  // While the authenticated user's profile is still loading we disable to avoid
  // a silent no-op when `canVote` is false only because `me` hasn't resolved.
  const canInteractVote = !isOwner && v.status === 'UNVERIFIED' && !meLoading;

  const eligibilityLine = !me
    ? 'Log in om deze plek te bevestigen.'
    : isOwner
      ? 'Dit is jouw inzending, je kunt niet op je eigen plek stemmen.'
      : v.status !== 'UNVERIFIED'
        ? 'Deze plek is al door de community geverifieerd.'
        : 'Ben je hier geweest? Dan telt jouw stem mee.';

  const vote = async (value: 'CONFIRM' | 'DENY') => {
    // Anonymous tap → route to sign-in rather than silently doing nothing.
    if (!isAuthenticated) {
      router.push('/(auth)/sign-in');
      return;
    }
    if (!canVote) return;
    // Attach a proximity proof so the server can run the nearby-radius gate and
    // weight the vote. Best-effort: if permission is denied we still submit and
    // let the server decide (it may 422, which the Banner surfaces).
    let proof: { lat: number; lng: number } | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        proof = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      /* location unavailable: submit without proof */
    }
    castVote.mutate(
      { spotId: spot.id, value, proof },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ['spot', slug] });
          void qc.invalidateQueries({ queryKey: ['spots'] });
          void qc.invalidateQueries({ queryKey: ['spots-map'] });
          void qc.invalidateQueries({ queryKey: ['my-spots'] });
        },
        onError: () => {
          // castVote.isError will be true; the Banner below renders the message.
        },
      },
    );
  };

  const moderate = (status: 'VERIFIED' | 'UNVERIFIED' | 'HIDDEN' | 'REMOVED') => {
    setModerateResult(null);
    moderateSpot.mutate(
      { spotId: spot.id, status },
      {
        onSuccess: () => {
          setModerateResult('success');
          void qc.invalidateQueries({ queryKey: ['spot', slug] });
          void qc.invalidateQueries({ queryKey: ['spots'] });
          void qc.invalidateQueries({ queryKey: ['spots-map'] });
        },
        onError: () => setModerateResult('error'),
      },
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

          {spot.description ? <RichText html={spot.description} /> : null}

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
                    disabled={!canInteractVote || castVote.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Klopt niet"
                    variant="secondary"
                    icon="hand.thumbsdown.fill"
                    onPress={() => vote('DENY')}
                    disabled={!canInteractVote || castVote.isPending}
                  />
                </View>
              </View>
              {castVote.isError && (
                <Banner kind="error">
                  {(castVote.error as { status?: number } | null)?.status === 409
                    ? 'Je hebt al gestemd op deze plek.'
                    : (castVote.error as { status?: number } | null)?.status === 422
                      ? 'Je moet hier in de buurt zijn om te stemmen.'
                      : 'Stemmen mislukt, probeer opnieuw.'}
                </Banner>
              )}
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
                  <Text style={styles.reviewMeta}>
                    {formatReviewDate(r.createdAt)}
                    {r.helpfulCount > 0 ? ` · ${r.helpfulCount}× nuttig` : ''}
                  </Text>
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
            onPress={() => (isAuthenticated ? setReportOpen(true) : router.push('/(auth)/sign-in'))}
          >
            <SymbolView name="flag" size={14} tintColor={colors.ink3} />
            <Text style={styles.reportText}>Probleem melden</Text>
          </Pressable>

          {/* Moderation card — staff only */}
          {isStaff ? (
            <View style={styles.moderateBlock}>
              <Text style={styles.moderateTitle}>Moderatie</Text>
              {moderateResult === 'success' ? (
                <Banner kind="success">Status bijgewerkt.</Banner>
              ) : moderateResult === 'error' ? (
                <Banner kind="error">Bijwerken mislukt. Probeer opnieuw.</Banner>
              ) : null}
              <View style={styles.moderateGrid}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Verifieer"
                    icon="checkmark.seal.fill"
                    onPress={() => moderate('VERIFIED')}
                    disabled={moderateSpot.isPending || v.status === 'VERIFIED'}
                    loading={moderateSpot.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Herstel"
                    variant="secondary"
                    icon="arrow.uturn.left"
                    onPress={() => moderate('UNVERIFIED')}
                    disabled={moderateSpot.isPending || v.status === 'UNVERIFIED'}
                    loading={moderateSpot.isPending}
                  />
                </View>
              </View>
              <View style={styles.moderateGrid}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Verberg"
                    variant="secondary"
                    icon="eye.slash.fill"
                    onPress={() => moderate('HIDDEN')}
                    disabled={moderateSpot.isPending || v.status === 'HIDDEN'}
                    loading={moderateSpot.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Verwijder"
                    variant="accent"
                    icon="trash.fill"
                    onPress={() => moderate('REMOVED')}
                    disabled={moderateSpot.isPending || v.status === 'REMOVED'}
                    loading={moderateSpot.isPending}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Report sheet */}
      <Modal
        visible={reportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitReport.isPending && setReportOpen(false)}
      >
        <Pressable
          style={styles.modalScrim}
          onPress={() => !submitReport.isPending && setReportOpen(false)}
        >
          <Pressable style={[styles.reportSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.reportTitle}>Wat is er mis met deze plek?</Text>
            {reportError && (
              <Banner kind="error" onRetry={() => setReportError(false)}>
                Melden mislukt, probeer opnieuw.
              </Banner>
            )}
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.reportOption, submitReport.isPending && { opacity: 0.5 }]}
                disabled={submitReport.isPending}
                onPress={() => {
                  setReportError(false);
                  submitReport.mutate(
                    { targetType: 'SPOT', targetId: spot.id, reason: r.value },
                    {
                      onSuccess: () => {
                        setReportOpen(false);
                        Alert.alert('Bedankt', 'We kijken ernaar.');
                      },
                      onError: () => {
                        setReportError(true);
                      },
                    },
                  );
                }}
              >
                {submitReport.isPending ? (
                  <ActivityIndicator size="small" color={colors.moss} />
                ) : (
                  <>
                    <Text style={styles.reportOptionText}>{r.label}</Text>
                    <SymbolView name="chevron.right" size={15} tintColor={colors.ink3} />
                  </>
                )}
              </Pressable>
            ))}
            <Pressable
              style={[styles.reportCancel, submitReport.isPending && { opacity: 0.5 }]}
              disabled={submitReport.isPending}
              onPress={() => setReportOpen(false)}
            >
              <Text style={styles.reportCancelText}>Annuleren</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  title: { flex: 1, fontFamily: font.heading, fontSize: 24, lineHeight: 31, color: colors.ink },
  category: { fontFamily: font.body, fontSize: 13, color: colors.ink2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontFamily: font.body, fontSize: 12, color: colors.ink2 },
  mapBox: { height: 180, borderRadius: radius.card, overflow: 'hidden', marginTop: space.sm },
  checkBlock: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: space.lg,
    gap: 8,
    marginTop: space.sm,
  },
  checkTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
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
  sectionTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
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
  reviewMeta: { fontFamily: font.body, fontSize: 11, color: colors.ink3, marginTop: 6 },
  placeholder: { fontFamily: font.body, fontSize: 13, color: colors.ink3 },
  provenance: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.ink3,
    marginTop: space.md,
    lineHeight: 18,
  },
  errorText: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: space.lg,
    lineHeight: 21,
  },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  reportText: { fontFamily: font.body, fontSize: 12, color: colors.ink3 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(30,28,18,0.35)', justifyContent: 'flex-end' },
  reportSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: space.md,
  },
  reportTitle: {
    fontFamily: font.heading,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
    marginBottom: space.sm,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reportOptionText: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.ink },
  reportCancel: { alignItems: 'center', paddingVertical: 14, marginTop: space.sm },
  reportCancelText: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.ink2 },
  moderateBlock: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
    marginTop: space.sm,
  },
  moderateTitle: { fontFamily: font.heading, fontSize: 14, lineHeight: 19, color: colors.ink },
  moderateGrid: { flexDirection: 'row', gap: 10 },
});
