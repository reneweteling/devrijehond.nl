/**
 * S10–S13, Submit flow as a single screen with three steps:
 *   1. choose type (REGION vs POI),
 *   2. place on the map (drop a pin for a POI; a polygon editor is stubbed),
 *   3. details form (name, category, description, amenities) → submit.
 *
 * A submitted spot goes live immediately as UNVERIFIED. Auth is required; an
 * unauthenticated user is routed to sign-in.
 *
 * TODO(verify): the polygon editor for REGION submissions is a stub, wire a
 * draggable-vertex editor over MapView. The amenity multi-select reads the
 * taxonomy from GET /api/v1/amenities filtered by the chosen category.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAmenities, useCategories, useSubmitSpot, type SpotType } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { categorySymbol } from '@/lib/icons';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, Note, ScreenTitle } from '@/components/ui';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);

  const { data: categoriesData } = useCategories(type ?? undefined);
  const categories = categoriesData?.items ?? [];
  const { data: amenitiesData } = useAmenities(categoryId ?? undefined);
  const amenities = amenitiesData?.items ?? [];

  const submit = useSubmitSpot();

  const reset = () => {
    setStep('type');
    setType(null);
    setPoint(null);
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
        point: type === 'POI' && point ? { lat: point.latitude, lng: point.longitude } : undefined,
        // TODO(verify): for REGION, pass `polygon: [{lat,lng},…]` from the editor.
        amenityIds,
      },
      { onSuccess: () => setStep('done') },
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
          <Text style={styles.gateTitle}>Log in om een plek toe te voegen</Text>
          <Text style={styles.gateSub}>
            Met een account kun je nieuwe hondenplekken inzenden. Ze gaan direct live en worden door
            de community geverifieerd.
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
          <View style={{ gap: space.md }}>
            <Text style={styles.q}>
              {type === 'REGION' ? 'Teken de grens van het gebied' : 'Zet de pin op de plek'}
            </Text>
            <View style={styles.mapBox}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={INITIAL_REGION}
                onPress={(e) => setPoint(e.nativeEvent.coordinate)}
              >
                {point && type === 'POI' ? <Marker coordinate={point} /> : null}
              </MapView>
            </View>
            {type === 'REGION' ? (
              <Note>
                De polygon-editor volgt; tik voor nu op de kaart om het centrum te kiezen.
              </Note>
            ) : (
              <Note>Tik op de kaart om de pin neer te zetten.</Note>
            )}
            <Button
              label="Volgende"
              onPress={() => setStep('details')}
              disabled={type === 'POI' && !point}
            />
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
                      style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

            {amenities.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Voorzieningen</Text>
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
