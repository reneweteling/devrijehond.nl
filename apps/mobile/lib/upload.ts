/**
 * Pick an image from the library and upload it to the API, returning the public
 * (CloudFront) URL to persist (avatar, dog photo, spot photo). The server
 * resizes + compresses to a uniform JPEG, so we just send the picked file.
 *
 * Returns null when the user cancels. Throws on permission denial or a failed
 * upload so callers can surface a message.
 */
import * as ImagePicker from 'expo-image-picker';

import { API_URL } from './config';
import { loadSession } from './session';

type UploadResponse = { publicUrl?: string };

export async function pickAndUploadImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Geen toegang tot je foto’s. Sta toegang toe in Instellingen.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const session = await loadSession();
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? 'upload.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/api/v1/me/uploads`, {
    method: 'POST',
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error('Uploaden mislukt. Probeer het opnieuw.');

  const json = (await res.json()) as UploadResponse;
  return json.publicUrl ?? null;
}
