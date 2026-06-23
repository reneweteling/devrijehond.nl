/**
 * S10–S13, Submit flow as a single screen with three steps:
 *   1. choose type (REGION vs POI),
 *   2. place on the map — a full-screen editor (Modal) with location search and
 *      a recenter button: drop a draggable pin for a POI, or tap out a polygon
 *      ring for a REGION geofence with draggable vertices + undo / clear,
 *   3. details form (name, category, description, amenities) → submit.
 *
 * A submitted spot goes live immediately as UNVERIFIED. Auth is required; an
 * unauthenticated user is routed to sign-in. The amenity multi-select reads the
 * taxonomy from GET /api/v1/amenities filtered by the chosen category.
 */

import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polygon, type MapPressEvent, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useAmenities, useCategories, useSubmitSpot, type SpotType } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { geocodePlace, type GeoResult } from '@/lib/geocode';
import { useUserLocation } from '@/lib/location';
import { categorySymbol } from '@/lib/icons';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, ListState, Note, ScreenTitle } from '@/components/ui';

type LatLng = { latitude: number; longitude: number };

const INITIAL_REGION: Region = {
  latitude: 52.3006,
  longitude: 4.8368,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type Step = 'type' | 'place' | 'details' | 'done';

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<SpotType | null>(null);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  // REGION geofence: the ring the user taps out vertex by vertex.
  const [polygon, setPolygon] = useState<{ latitude: number; longitude: number }[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);

  // Full-screen map editor (the 'place' step).
  const mapRef = useRef<MapView>(null);
  const userLocation = useUserLocation();
  const [search, setSearch] = useState('');
  const [geo, setGeo] = useState<GeoResult[]>([]);
  // Crosshair editing: the map is moved under a fixed centre target instead of
  // finger-dragging tiny pins (which fights map panning on iOS). `center` tracks
  // the live map centre; `selectedIdx` is the vertex being repositioned, if any.
  const [center, setCenter] = useState<LatLng>(
    userLocation
      ? { latitude: userLocation.lat, longitude: userLocation.lng }
      : { latitude: INITIAL_REGION.latitude, longitude: INITIAL_REGION.longitude },
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Debounced location search inside the editor.
  useEffect(() => {
    const term = search.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      if (term.length < 2) {
        if (!cancelled) setGeo([]);
        return;
      }
      const res = await geocodePlace(term);
      if (!cancelled) setGeo(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const flyTo = (lat: number, lng: number, delta = 0.02) => {
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
      500,
    );
  };
  const onPickGeo = (g: GeoResult) => {
    setSearch('');
    setGeo([]);
    flyTo(g.lat, g.lng);
  };
  // The map centre is the cursor. Keep it in sync; for a POI the point simply IS
  // the centre, so it's always "placed" wherever the map is.
  const onRegionChangeComplete = (r: Region) => {
    const c = { latitude: r.latitude, longitude: r.longitude };
    setCenter(c);
    if (type === 'POI') setPoint(c);
  };
  // Tapping empty map just clears the current vertex selection.
  const onMapPress = (_e: MapPressEvent) => setSelectedIdx(null);
  // Drop a new vertex at the centre target.
  const addVertex = () => {
    setPolygon((prev) => [...prev, center]);
    setSelectedIdx(null);
  };
  // Move the selected vertex to the centre target.
  const moveSelectedToCenter = () => {
    if (selectedIdx == null) return;
    setPolygon((prev) => prev.map((v, idx) => (idx === selectedIdx ? center : v)));
  };
  const removeVertex = (i: number) => {
    setPolygon((prev) => prev.filter((_, idx) => idx !== i));
    setSelectedIdx(null);
  };

  const qc = useQueryClient();

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useCategories(type ?? undefined);
  const categories = categoriesData?.items ?? [];
  const {
    data: amenitiesData,
    isLoading: amenitiesLoading,
    isError: amenitiesError,
    refetch: refetchAmenities,
  } = useAmenities(categoryId ?? undefined);
  const amenities = amenitiesData?.items ?? [];

  const submit = useSubmitSpot();

  // For a REGION the centroid mirrors the polygon (the map marker + nearby use it).
  const centroid =
    polygon.length > 0
      ? {
          latitude: polygon.reduce((s, p) => s + p.latitude, 0) / polygon.length,
          longitude: polygon.reduce((s, p) => s + p.longitude, 0) / polygon.length,
        }
      : null;
  // A POI is always "placed" — its point is wherever the map centre is.
  const placeReady = type === 'REGION' ? polygon.length >= 3 : true;
  const finishPlace = () => {
    if (type === 'POI') setPoint(center);
    setStep('details');
  };

  const reset = () => {
    setStep('type');
    setType(null);
    setPoint(null);
    setPolygon([]);
    setSelectedIdx(null);
    setName('');
    setDescription('');
    setCategoryId(null);
    setAmenityIds([]);
  };

  const onSubmit = () => {
    if (!type || !categoryId || !name) return;
    submit.mutate(
      {
        type,
        categoryId,
        name,
        description: description || undefined,
        point:
          type === 'REGION'
            ? centroid
              ? { lat: centroid.latitude, lng: centroid.longitude }
              : undefined
            : point
              ? { lat: point.latitude, lng: point.longitude }
              : undefined,
        polygon:
          type === 'REGION' && polygon.length >= 3
            ? polygon.map((p) => ({ lat: p.latitude, lng: p.longitude }))
            : undefined,
        amenityIds,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['spots'] });
          qc.invalidateQueries({ queryKey: ['spots-map'] });
          qc.invalidateQueries({ queryKey: ['my-spots'] });
          setStep('done');
        },
      },
    );
  };

  // Submitting requires an account (wireframe S10). Anonymous users get an
  // inline sign-in CTA instead of an abrupt bounce.
  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenTitle sub="Voeg een hondenplek of -gebied toe">Toevoegen</ScreenTitle>
        <View style={styles.gate}>
          <SymbolView name="plus.circle.fill" size={48} tintColor={colors.moss} />
          <Text style={styles.gateTitle}>Even je e-mail om een plek toe te voegen</Text>
          <Text style={styles.gateSub}>
            Je hoeft je niet te registreren. Vul je e-mailadres in, dan maken we automatisch een
            account voor je aan. Je plek gaat direct live en wordt door de community geverifieerd.
          </Text>
          <View style={{ width: '100%' }}>
            <Button label="Inloggen" onPress={() => router.push('/(auth)/sign-in')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenTitle sub="Voeg een hondenplek of -gebied toe">Toevoegen</ScreenTitle>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120 }}>
        {/* Step indicator */}
        <View style={styles.steps}>
          {(['type', 'place', 'details'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepDotWrap}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{i + 1}</Text>
              </View>
            </View>
          ))}
        </View>

        {step === 'type' && (
          <View style={{ gap: space.md }}>
            <Text style={styles.q}>Wat wil je toevoegen?</Text>
            <Pressable
              style={[styles.typeCard, type === 'REGION' && styles.typeCardActive]}
              onPress={() => setType('REGION')}
            >
              <SymbolView name="pawprint.fill" size={26} tintColor={colors.moss} />
              <View style={{ flex: 1 }}>
                <Text style={styles.typeTitle}>Gebied</Text>
                <Text style={styles.typeSub}>
                  Losloopgebied of zwemstrand, een vlak met een grens.
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.typeCard, type === 'POI' && styles.typeCardActive]}
              onPress={() => setType('POI')}
            >
              <SymbolView name="mappin.circle.fill" size={26} tintColor={colors.terra} />
              <View style={{ flex: 1 }}>
                <Text style={styles.typeTitle}>Plek</Text>
                <Text style={styles.typeSub}>Horeca, wasplek, winkel of drinkpunt, één punt.</Text>
              </View>
            </Pressable>
            <Button label="Volgende" onPress={() => setStep('place')} disabled={!type} />
          </View>
        )}

        {step === 'place' && (
          <View style={styles.placeHint}>
            <SymbolView name="map.fill" size={20} tintColor={colors.mossDark} />
            <Text style={styles.editBtnText}>De kaart-editor is geopend…</Text>
          </View>
        )}

        {step === 'details' && (
          <View style={{ gap: space.lg }}>
            <View style={styles.field}>
              <Text style={styles.label}>Naam</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Bijv. Amsterdamse Bos – hondenweide"
                placeholderTextColor={colors.ink3}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categorie</Text>
              <ListState
                loading={categoriesLoading}
                error={categoriesError}
                errorText="Categorieën konden niet worden geladen."
                onRetry={() => void refetchCategories()}
              />
              {!categoriesLoading && !categoriesError && (
                <View style={styles.catGrid}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.catChip, categoryId === c.id && styles.catChipActive]}
                      onPress={() => setCategoryId(c.id)}
                    >
                      <SymbolView
                        name={categorySymbol(c.icon ?? c.slug)}
                        size={14}
                        tintColor={categoryId === c.id ? '#fff' : colors.mossDark}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          categoryId === c.id && styles.catChipTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Beschrijving</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Wat moeten andere hondenbazen weten?"
                placeholderTextColor={colors.ink3}
                multiline
              />
            </View>

            {categoryId && (
              <View style={styles.field}>
                <Text style={styles.label}>Voorzieningen</Text>
                <ListState
                  loading={amenitiesLoading}
                  error={amenitiesError}
                  errorText="Voorzieningen konden niet worden geladen."
                  onRetry={() => void refetchAmenities()}
                />
                {!amenitiesLoading && !amenitiesError && amenities.length > 0 && (
                  <View style={styles.catGrid}>
                    {amenities.map((a) => {
                      const on = amenityIds.includes(a.id);
                      return (
                        <Pressable
                          key={a.id}
                          style={[styles.catChip, on && styles.catChipActive]}
                          onPress={() =>
                            setAmenityIds((cur) =>
                              on ? cur.filter((x) => x !== a.id) : [...cur, a.id],
                            )
                          }
                        >
                          <Text style={[styles.catChipText, on && styles.catChipTextActive]}>
                            {a.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <Note>
              Je plek staat meteen live als &quot;niet geverifieerd&quot; en wordt automatisch
              geverifieerd bij netto +5 bevestigingen, geen moderator nodig.
            </Note>

            <Button
              label="Plaatsen"
              onPress={onSubmit}
              loading={submit.isPending}
              disabled={!name || !categoryId}
            />
            {submit.isError ? (
              <Text style={styles.error}>Plaatsen mislukt. Probeer opnieuw.</Text>
            ) : null}
          </View>
        )}

        {step === 'done' && (
          <View style={styles.done}>
            <SymbolView name="checkmark.seal.fill" size={48} tintColor={colors.moss} />
            <Text style={styles.doneTitle}>Live als niet geverifieerd</Text>
            <Text style={styles.doneSub}>
              Bedankt! Je plek staat nu op de kaart. Bij netto +5 bevestigingen van anderen die er
              geweest zijn, krijgt hij automatisch een verificatiebadge.
            </Text>
            <Button label="Nog een plek toevoegen" variant="secondary" onPress={reset} />
            <Button label="Naar de kaart" onPress={() => router.replace('/(tabs)')} />
          </View>
        )}
      </ScrollView>

      {/* Full-screen map editor for the 'place' step */}
      <Modal
        visible={step === 'place'}
        animationType="slide"
        onRequestClose={() => setStep('type')}
      >
        <View style={styles.editor}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={
              userLocation
                ? {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }
                : INITIAL_REGION
            }
            showsUserLocation
            onPress={onMapPress}
            onRegionChangeComplete={onRegionChangeComplete}
          >
            {type === 'REGION' && polygon.length >= 2 ? (
              <Polygon
                coordinates={polygon}
                strokeColor={colors.mossDark}
                strokeWidth={2.5}
                fillColor={`${colors.moss}55`}
              />
            ) : null}
            {type === 'REGION'
              ? polygon.map((v, i) => (
                  <Marker
                    key={i}
                    identifier={`v${i}`}
                    coordinate={v}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={selectedIdx === i}
                    onPress={() => setSelectedIdx((cur) => (cur === i ? null : i))}
                  >
                    {/* Tap to select; selected vertex is highlighted and can be
                        moved to the centre target or deleted from the toolbar. */}
                    <View style={styles.vertexHit}>
                      <View style={[styles.vertex, selectedIdx === i && styles.vertexActive]}>
                        <Text style={styles.vertexNum}>{i + 1}</Text>
                      </View>
                    </View>
                  </Marker>
                ))
              : null}
          </MapView>

          {/* Fixed centre target: the map moves under it, so placing/adjusting a
              point is just panning (no finger-dragging tiny pins). */}
          <View style={styles.crosshairWrap} pointerEvents="none">
            <View style={styles.crosshairRing}>
              <View style={styles.crosshairDot} />
            </View>
          </View>

          {/* Top: back + location search */}
          <View style={[styles.editorTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.editorSearchRow}>
              <Pressable style={styles.editorIconBtn} onPress={() => setStep('type')} hitSlop={8}>
                <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
              </Pressable>
              <View style={styles.editorSearchPill}>
                <SymbolView name="magnifyingglass" size={15} tintColor={colors.ink3} />
                <TextInput
                  style={styles.editorSearchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Zoek een plaats of adres"
                  placeholderTextColor={colors.ink3}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {search.length > 0 ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <SymbolView name="xmark.circle.fill" size={15} tintColor={colors.ink3} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {geo.length > 0 ? (
              <View style={styles.editorResults}>
                {geo.map((g, i) => (
                  <Pressable
                    key={`${g.lat}-${g.lng}-${i}`}
                    style={styles.editorResultRow}
                    onPress={() => onPickGeo(g)}
                  >
                    <SymbolView name="mappin.and.ellipse" size={15} tintColor={colors.mossDark} />
                    <Text style={styles.editorResultText} numberOfLines={1}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Recenter on the user's location */}
          {userLocation ? (
            <Pressable
              style={({ pressed }) => [
                styles.editorRecenter,
                { bottom: insets.bottom + 168, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => flyTo(userLocation.lat, userLocation.lng, 0.02)}
              hitSlop={8}
            >
              <SymbolView name="location.fill" size={20} tintColor={colors.mossDark} />
            </Pressable>
          ) : null}

          {/* Bottom controls */}
          <View style={[styles.editorBottom, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.editorHint}>
              {type === 'REGION'
                ? selectedIdx != null
                  ? `Punt ${selectedIdx + 1} geselecteerd. Beweeg de kaart en tik "Verplaats hierheen", of verwijder 'm.`
                  : `Beweeg de kaart en tik "Punt toevoegen" om de rand te tekenen (min. 3). Tik een punt om het bij te stellen. Punten: ${polygon.length}`
                : 'Beweeg de kaart zodat het kruis op de plek staat en tik "Klaar".'}
            </Text>

            {type === 'REGION' ? (
              selectedIdx != null ? (
                <View style={styles.editRow}>
                  <Pressable style={styles.editBtnPrimary} onPress={moveSelectedToCenter}>
                    <SymbolView name="arrow.up.to.line" size={15} tintColor="#fff" />
                    <Text style={styles.editBtnPrimaryText}>Verplaats hierheen</Text>
                  </Pressable>
                  <Pressable style={styles.editBtn} onPress={() => removeVertex(selectedIdx)}>
                    <SymbolView name="trash" size={14} tintColor={colors.rust} />
                    <Text style={[styles.editBtnText, { color: colors.rust }]}>Verwijder</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Pressable style={styles.editBtnPrimary} onPress={addVertex}>
                    <SymbolView name="plus" size={16} tintColor="#fff" />
                    <Text style={styles.editBtnPrimaryText}>Punt toevoegen</Text>
                  </Pressable>
                  {polygon.length > 0 ? (
                    <View style={[styles.editRow, { marginTop: space.sm }]}>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => setPolygon((prev) => prev.slice(0, -1))}
                      >
                        <SymbolView name="arrow.uturn.backward" size={14} tintColor={colors.ink2} />
                        <Text style={styles.editBtnText}>Wis laatste</Text>
                      </Pressable>
                      <Pressable style={styles.editBtn} onPress={() => setPolygon([])}>
                        <SymbolView name="trash" size={14} tintColor={colors.ink2} />
                        <Text style={styles.editBtnText}>Wis alles</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )
            ) : null}

            <View style={{ marginTop: space.sm }}>
              <Button label="Klaar" onPress={finishPlace} disabled={!placeReady} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: 80,
  },
  gateTitle: {
    fontFamily: font.heading,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
    marginTop: space.sm,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  gateSub: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: space.md,
  },
  steps: { flexDirection: 'row', gap: 8, marginBottom: space.lg },
  stepDotWrap: { flex: 1, alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.moss },
  stepNum: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.mossDark },
  stepNumActive: { color: '#fff' },
  q: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink, marginBottom: 2 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  typeCardActive: { borderColor: colors.moss },
  typeTitle: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  typeSub: { fontFamily: font.body, fontSize: 12, color: colors.ink2, marginTop: 2 },
  mapBox: {
    height: 260,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.mossSoft,
  },
  // Large transparent touch target so a vertex is easy to grab + drag.
  vertexHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  vertex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.moss,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  vertexNum: { fontFamily: font.bodyMedium, fontSize: 11, color: '#fff', lineHeight: 13 },
  // "Lifted" look while being dragged (bigger + terracotta), like Google Maps.
  vertexActive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.terra,
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  editBtnText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: colors.ink2 },
  editRow: { flexDirection: 'row', gap: space.sm },
  editBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.moss,
  },
  editBtnPrimaryText: { fontFamily: font.bodyMedium, fontSize: 14, color: '#fff' },
  // Fixed centre target (the "cursor"): a moss ring with a precise centre dot.
  crosshairWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: colors.mossDark,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mossDark },
  placeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: space.xl,
  },
  // --- full-screen map editor ---
  editor: { flex: 1, backgroundColor: colors.sand },
  editorTop: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg },
  editorSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  editorSearchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 42,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  editorSearchInput: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  editorResults: {
    marginTop: 8,
    marginLeft: 52,
    backgroundColor: '#fff',
    borderRadius: radius.card,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  editorResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  editorResultText: { flex: 1, fontFamily: font.body, fontSize: 14, color: colors.ink },
  editorRecenter: {
    position: 'absolute',
    right: space.lg,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  editorBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.sand,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  editorHint: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.ink2,
    textAlign: 'center',
  },
  field: { gap: 6 },
  label: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 92, paddingTop: 10, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catChipActive: { backgroundColor: colors.moss, borderColor: colors.moss },
  catChipText: { fontFamily: font.body, fontSize: 12, color: colors.ink2 },
  catChipTextActive: { color: '#fff' },
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust, textAlign: 'center' },
  done: { alignItems: 'center', gap: space.md, paddingTop: 40 },
  doneTitle: { fontFamily: font.heading, fontSize: 20, lineHeight: 26, color: colors.ink },
  doneSub: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: space.sm,
  },
});
