/**
 * S14c — Add or edit a dog. Name, breed, birth date and photo. Auth required.
 * Add creates via POST /api/v1/me/dogs; passing `?id=` switches to edit mode,
 * prefilled from the profile, saving via PATCH and offering delete. Refreshes
 * the profile and pops back.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useCreateDog, useUpdateDog, useDeleteDog, useMe, type Dog } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { pickAndUploadImage } from '@/lib/upload';
import { colors, font, radius, space } from '@/lib/theme';
import { Button, ListState } from '@/components/ui';

export default function AddDogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) router.replace('/(auth)/sign-in');
  }, [status, isAuthenticated, router]);

  // `?id=` switches the screen to edit mode for that dog.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const create = useCreateDog();
  const update = useUpdateDog();
  const del = useDeleteDog();
  const { data: me } = useMe(isAuthenticated);
  const existing: Dog | undefined = isEdit ? me?.dogs?.find((d) => d.id === id) : undefined;

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Prefill once, when editing and the dog has loaded from the profile.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isEdit || prefilled.current || !existing) return;
    prefilled.current = true;
    setName(existing.name ?? '');
    setBreed(existing.breed ?? '');
    setPhotoUrl(existing.photoUrl ?? null);
    if (existing.birthDate) {
      const d = new Date(existing.birthDate);
      if (!Number.isNaN(d.getTime())) setBirthDate(d);
    }
  }, [isEdit, existing]);

  if (status === 'loading' || !isAuthenticated) return <ListState loading />;

  const canSave = name.trim().length >= 1;
  const saving = create.isPending || update.isPending;

  const onPickPhoto = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage();
      if (url) setPhotoUrl(url);
    } catch (e) {
      Alert.alert('Foto', e instanceof Error ? e.message : 'Uploaden mislukt.');
    } finally {
      setUploading(false);
    }
  };

  const onSave = () => {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      breed: breed.trim() || undefined,
      // Date-only ISO (YYYY-MM-DD) from the picker's local date.
      birthDate: birthDate
        ? `${birthDate.getFullYear()}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`
        : undefined,
      photoUrl: photoUrl ?? undefined,
    };
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      router.back();
    };
    if (isEdit && id) update.mutate({ id, dog: payload }, { onSuccess });
    else create.mutate(payload, { onSuccess });
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert(
      'Hond verwijderen',
      `Weet je zeker dat je ${name.trim() || 'deze hond'} wilt verwijderen?`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () =>
            del.mutate(id, {
              onSuccess: () => {
                qc.invalidateQueries({ queryKey: ['me'] });
                router.back();
              },
            }),
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <SymbolView name="chevron.left" size={20} tintColor={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Hond bewerken' : 'Hond toevoegen'}</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={styles.dogHero}>
          <Pressable onPress={onPickPhoto} disabled={uploading} style={styles.dogAvatarWrap}>
            <View style={styles.dogAvatar}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.dogAvatarImg} />
              ) : (
                <SymbolView name="pawprint.fill" size={28} tintColor={colors.mossDark} />
              )}
              {uploading ? (
                <View style={styles.dogAvatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            {/* Camera badge sits on the (non-clipping) wrap so it isn't cut off
                by the avatar's circular clip. */}
            {!uploading && (
              <View style={styles.dogAvatarBadge}>
                <SymbolView name="camera.fill" size={12} tintColor="#fff" />
              </View>
            )}
          </Pressable>
          <Pressable onPress={onPickPhoto} disabled={uploading} hitSlop={8}>
            <Text style={styles.dogPhotoAction}>
              {photoUrl ? 'Foto wijzigen' : 'Foto toevoegen'}
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Naam</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Hoe heet je hond?"
            placeholderTextColor={colors.ink3}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Ras (optioneel)</Text>
          <TextInput
            style={styles.input}
            value={breed}
            onChangeText={setBreed}
            placeholder="Bijv. Labrador, kruising"
            placeholderTextColor={colors.ink3}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>Geboortedatum (optioneel)</Text>
          <View style={styles.dateRow}>
            <Host matchContents>
              <DatePicker
                selection={birthDate ?? undefined}
                displayedComponents={['date']}
                onDateChange={setBirthDate}
              />
            </Host>
          </View>
        </View>

        <Button
          label={isEdit ? 'Wijzigingen opslaan' : 'Hond toevoegen'}
          onPress={onSave}
          loading={saving}
          disabled={!canSave}
        />
        {create.isError || update.isError ? (
          <Text style={styles.error}>Opslaan mislukt. Probeer opnieuw.</Text>
        ) : null}

        {isEdit ? (
          <Pressable
            onPress={onDelete}
            disabled={del.isPending}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          >
            <SymbolView name="trash" size={16} tintColor={colors.rust} />
            <Text style={styles.deleteBtnText}>Hond verwijderen</Text>
          </Pressable>
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
  headerTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  dogHero: { alignItems: 'center', marginTop: space.sm, gap: 8 },
  // Non-clipping wrapper so the camera badge can sit on the avatar's edge
  // without being cut off by the avatar's circular clip.
  dogAvatarWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  dogAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dogAvatarImg: { width: 84, height: 84 },
  dogAvatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dogAvatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.moss,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogPhotoAction: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.moss },
  label: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  dateRow: { alignSelf: 'flex-start' },
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
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust, textAlign: 'center' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteBtnText: { fontFamily: font.bodyMedium, fontSize: 14, color: colors.rust },
});
