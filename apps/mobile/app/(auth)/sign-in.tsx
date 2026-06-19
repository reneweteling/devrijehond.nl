/**
 * S9, Sign in / up. Three entry points:
 *   - Email magic link (requestMagicLink → "check your inbox" state),
 *   - Native Sign in with Apple (iOS),
 *   - Native Google Sign-In (Android picker).
 *
 * Magic link and the native flows all converge on a persisted bearer in
 * SecureStore; on a native success we route straight to the map.
 */

import { Platform } from 'react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAuthToken } from '@devrijehond/api-client';

import { requestMagicLink, signInWithAppleNative, signInWithGoogleNative } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button } from '@/components/ui';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dismiss back to wherever this was pushed from, or fall back to the map so
  // the user is never trapped on the auth screen.
  const onClose = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const CloseButton = () => (
    <Pressable onPress={onClose} hitSlop={12} style={[styles.close, { top: insets.top + 8 }]}>
      <SymbolView name="xmark" size={17} tintColor={colors.ink2} />
    </Pressable>
  );

  const onMagicLink = async () => {
    setError(null);
    if (!/.+@.+\..+/.test(email)) {
      setError('Vul een geldig e-mailadres in.');
      return;
    }
    setSending(true);
    const result = await requestMagicLink(email.trim());
    setSending(false);
    if (result.ok) {
      setSent(true);
    } else if (result.code === 'rate_limited') {
      setError('Te veel pogingen. Wacht even en probeer opnieuw.');
    } else if (result.code === 'invalid_email') {
      setError('Dit e-mailadres lijkt niet te kloppen.');
    } else {
      setError('Er ging iets mis. Probeer het opnieuw.');
    }
  };

  const onApple = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithAppleNative();
    setBusy(false);
    if (result.ok) {
      setAuthToken(result.session.token);
      setAuthenticated(true);
      router.replace('/(tabs)');
    } else if (result.code !== 'cancelled') {
      setError('Inloggen met Apple is niet gelukt.');
    }
  };

  const onGoogle = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithGoogleNative();
    setBusy(false);
    if (result.ok) {
      setAuthToken(result.session.token);
      setAuthenticated(true);
      router.replace('/(tabs)');
    } else if (result.code !== 'cancelled') {
      setError('Inloggen met Google is niet gelukt.');
    }
  };

  if (sent) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <CloseButton />
        <SymbolView name="envelope.badge.fill" size={48} tintColor={colors.moss} />
        <Text style={styles.title}>Check je inbox</Text>
        <Text style={styles.sub}>
          We hebben een inloglink gestuurd naar {email}. Open hem op dit toestel om verder te gaan.
        </Text>
        <Pressable onPress={() => setSent(false)}>
          <Text style={styles.link}>Ander e-mailadres gebruiken</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CloseButton />
      <View
        style={[styles.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.brand}>
          <SymbolView name="pawprint.fill" size={28} tintColor={colors.moss} />
          <Text style={styles.wordmark}>De Vrije Hond</Text>
          <Text style={styles.tagline}>Vind de fijnste hondenplekken bij jou in de buurt.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-mailadres</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="jij@voorbeeld.nl"
            placeholderTextColor={colors.ink3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
          />
          <Button label="Stuur inloglink" onPress={onMagicLink} loading={sending} />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>of</Text>
            <View style={styles.line} />
          </View>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.button}
              style={styles.appleBtn}
              onPress={onApple}
            />
          )}
          <Button
            label="Doorgaan met Google"
            variant="secondary"
            icon="g.circle.fill"
            onPress={onGoogle}
            disabled={busy}
          />
        </View>

        <Text style={styles.legal}>
          Door verder te gaan ga je akkoord met onze voorwaarden en privacyverklaring.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  close: {
    position: 'absolute',
    left: space.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  inner: { flex: 1, paddingHorizontal: space.lg, justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: 40 },
  brand: { alignItems: 'center', gap: space.sm },
  wordmark: { fontFamily: font.heading, fontSize: 26, lineHeight: 34, color: colors.moss },
  tagline: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 2,
  },
  form: { gap: space.md },
  label: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  error: { fontFamily: font.body, fontSize: 12, color: colors.rust },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { fontFamily: font.body, fontSize: 12, color: colors.ink3 },
  appleBtn: { height: 48, width: '100%' },
  title: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginTop: space.sm,
  },
  sub: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 21,
  },
  link: { fontFamily: font.bodyMedium, fontSize: 13, color: colors.mossDark, marginTop: space.md },
  legal: {
    fontFamily: font.body,
    fontSize: 11,
    color: colors.ink3,
    textAlign: 'center',
    lineHeight: 16,
  },
});
