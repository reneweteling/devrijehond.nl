/**
 * S14c — Add a dog. Name, breed and birth year. Auth required. Creates via
 * POST /api/v1/me/dogs, refreshes the profile and pops back.
 */

import { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useCreateDog } from '@/lib/api';
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

  const create = useCreateDog();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (status === 'loading' || !isAuthenticated) return <ListState loading />;

  const year = parseInt(birthYear, 10);
  const yearValid = !birthYear || (year >= 1990 && year <= new Date().getFullYear());
  const canSave = name.trim().length >= 1 && yearValid;

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
    create.mutate(
      {
        name: name.trim(),
        breed: breed.trim() || undefined,
        birthYear: birthYear && yearValid ? year : undefined,
        photoUrl: photoUrl ?? undefined,
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
        <Text style={styles.headerTitle}>Hond toevoegen</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={styles.dogHero}>
          <Pressable onPress={onPickPhoto} disabled={uploading} style={styles.dogAvatar}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.dogAvatarImg} />
            ) : (
              <SymbolView name="pawprint.fill" size={28} tintColor={colors.mossDark} />
            )}
            {uploading ? (
              <View style={styles.dogAvatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
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
          <Text style={styles.label}>Geboortejaar (optioneel)</Text>
          <TextInput
            style={styles.input}
            value={birthYear}
            onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="2021"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
          />
          {!yearValid ? <Text style={styles.error}>Vul een jaar tussen 1990 en nu in.</Text> : null}
        </View>

        <Button
          label="Hond toevoegen"
          onPress={onSave}
          loading={create.isPending}
          disabled={!canSave}
        />
        {create.isError ? (
          <Text style={styles.error}>Toevoegen mislukt. Probeer opnieuw.</Text>
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
});
