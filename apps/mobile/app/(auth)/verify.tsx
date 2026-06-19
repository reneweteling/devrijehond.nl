/**
 * Magic-link landing. Reached two ways:
 *   - cold open: the app was launched by the `vrijehond://verify?token=…` deep
 *     link (or `exp://…/--/verify?token=…` in Expo Go). expo-router parses the
 *     query into `useLocalSearchParams`.
 *   - warm open: a foreground deep link routes here.
 *
 * We redeem the one-time token via `verifyMagicLink`, register the resulting
 * bearer with the api-client, and route to the map on success.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { setAuthToken } from '@devrijehond/api-client';

import { verifyMagicLink } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui';
import { colors, font, space } from '@/lib/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { setAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [state, setState] = useState<'verifying' | 'error'>('verifying');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      if (!token) {
        setState('error');
        return;
      }
      const result = await verifyMagicLink(token);
      if (result.ok) {
        setAuthToken(result.session.token);
        setAuthenticated(true);
        router.replace('/(tabs)');
      } else {
        setState('error');
      }
    })();
  }, [token, router, setAuthenticated]);

  if (state === 'error') {
    return (
      <View style={styles.root}>
        <SymbolView name="exclamationmark.triangle.fill" size={44} tintColor={colors.terra} />
        <Text style={styles.title}>Link verlopen</Text>
        <Text style={styles.sub}>
          Deze inloglink werkt niet meer. Vraag een nieuwe aan om verder te gaan.
        </Text>
        <Button label="Opnieuw inloggen" onPress={() => router.replace('/(auth)/sign-in')} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.moss} size="large" />
      <Text style={styles.sub}>Even inloggen…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: 40,
  },
  title: { fontFamily: font.heading, fontSize: 20, lineHeight: 26, color: colors.ink },
  sub: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 21,
  },
});
