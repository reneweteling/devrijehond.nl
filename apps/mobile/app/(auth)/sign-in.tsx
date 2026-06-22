/**
 * S9, Sign in / up. Three entry points:
 *   - Email magic link (requestMagicLink → "check your inbox" state),
 *   - Native Sign in with Apple (iOS),
 *   - Native Google Sign-In (Android picker).
 *
 * Magic link and the native flows all converge on a persisted bearer in
 * SecureStore; on a native success we route straight to the map.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAuthToken } from '@devrijehond/api-client';

import { requestMagicLink, signInWithAppleNative, signInWithGoogleNative } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Button } from '@/components/ui';

// ---------------------------------------------------------------------------
// Coloured Google G – built from plain RN Views (no react-native-svg).
// The G letterform is approximated with a row of coloured blocks behind a
// white mask so we get the four quadrant colours without SVG.
// ---------------------------------------------------------------------------
function GoogleG({ size = 20 }: { size?: number }) {
  // Four quadrant colours of the official Google logo.
  const blue = '#4285F4';
  const red = '#EA4335';
  const yellow = '#FBBC05';
  const green = '#34A853';
  const half = size / 2;
  const q = size / 4; // quarter, used for the notch

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {/* top-left: blue */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: half,
          height: half,
          backgroundColor: blue,
        }}
      />
      {/* top-right: red */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: half,
          height: half,
          backgroundColor: red,
        }}
      />
      {/* bottom-left: green */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: half,
          height: half,
          backgroundColor: green,
        }}
      />
      {/* bottom-right: yellow */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: half,
          height: half,
          backgroundColor: yellow,
        }}
      />
      {/* white circle cut-out for the ring */}
      <View
        style={{
          position: 'absolute',
          top: q,
          left: q,
          width: half,
          height: half,
          borderRadius: half / 2,
          backgroundColor: '#fff',
        }}
      />
      {/* white block to open the right side of the G (the notch) */}
      <View
        style={{
          position: 'absolute',
          top: half - q / 2,
          right: 0,
          width: half,
          height: q,
          backgroundColor: '#fff',
        }}
      />
      {/* yellow bar for the horizontal stroke of the G */}
      <View
        style={{
          position: 'absolute',
          top: half - q / 2,
          right: 0,
          width: half + q / 2,
          height: q,
          backgroundColor: yellow,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Uniform social button – same sizing contract as <Button> from ui.tsx.
// ---------------------------------------------------------------------------
function SocialButton({
  onPress,
  disabled,
  loading,
  dark,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** When true: black background + white text (Apple). Otherwise white + border. */
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({ opacity: pressed || disabled || loading ? 0.6 : 1 })}
    >
      <View style={[styles.socialBtn, dark ? styles.socialBtnDark : styles.socialBtnLight]}>
        {loading ? (
          <ActivityIndicator color={dark ? '#fff' : colors.ink} />
        ) : (
          <View style={styles.socialBtnInner}>{children}</View>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------
function CloseButton({ top, onClose }: { top: number; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} hitSlop={12} style={[styles.close, { top }]}>
      <SymbolView name="xmark" size={17} tintColor={colors.ink2} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { setAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // After a successful native sign-in: go where the user originally intended, or
  // back if this screen was pushed without an explicit redirect, or the map as a
  // last resort so the user is never trapped on the auth screen.
  const afterSignIn = () => {
    if (redirect) {
      router.replace(redirect as Parameters<typeof router.replace>[0]);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // Dismiss without signing in.
  const onClose = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

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
      afterSignIn();
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
      afterSignIn();
    } else if (result.code !== 'cancelled') {
      setError('Inloggen met Google is niet gelukt.');
    }
  };

  // -------------------------------------------------------------------------
  // "Check je inbox" confirmation state
  // -------------------------------------------------------------------------
  if (sent) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <CloseButton top={insets.top + 8} onClose={onClose} />
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

  // -------------------------------------------------------------------------
  // Main sign-in form
  // -------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CloseButton top={insets.top + 8} onClose={onClose} />
      <View
        style={[styles.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Wordmark */}
        <View style={styles.brand}>
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 32, height: 29 }}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>De Vrije Hond</Text>
          <Text style={styles.tagline}>Vind de fijnste hondenplekken bij jou in de buurt.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Magic link */}
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
          <Button label="Stuur inloglink" onPress={onMagicLink} loading={sending} disabled={busy} />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerOr}>of</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Apple – iOS only, custom button to match styling */}
          {Platform.OS === 'ios' && (
            <SocialButton onPress={onApple} disabled={busy || sending} loading={busy} dark>
              <SymbolView name="apple.logo" size={18} tintColor="#fff" />
              <Text style={[styles.socialLabel, styles.socialLabelDark]}>Doorgaan met Apple</Text>
            </SocialButton>
          )}

          {/* Google */}
          <SocialButton onPress={onGoogle} disabled={busy || sending} loading={busy}>
            <GoogleG size={20} />
            <Text style={styles.socialLabel}>Doorgaan met Google</Text>
          </SocialButton>
        </View>

        {/* Legal */}
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
  wordmark: {
    fontFamily: font.heading,
    fontSize: 26,
    lineHeight: 34,
    color: colors.moss,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerOr: { fontFamily: font.body, fontSize: 12, color: colors.ink3 },

  // Social buttons
  socialBtn: {
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  socialBtnDark: { backgroundColor: '#000' },
  socialBtnLight: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  socialBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialLabel: {
    fontFamily: font.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
  },
  socialLabelDark: { color: '#fff' },

  // "Check je inbox" state
  title: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginTop: space.sm,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  sub: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    alignSelf: 'stretch',
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
