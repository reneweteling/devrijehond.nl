import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { setUnauthorizedHandler, setAuthToken } from '@devrijehond/api-client';

import { AppProviders } from '@/lib/providers';
import { bootApiClient } from '@/lib/query';
import { clearSession } from '@/lib/session';
import { colors } from '@/lib/theme';

// Anchor `/` to the tabs group (there is no app/index.tsx). A signed-out boot
// still `router.replace`s to (auth)/sign-in from there.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  /* a reload can race the splash; ignore */
});

export default function RootLayout() {
  // Per the scar: useFonts can NEVER resolve under the new architecture, so we
  // never gate render on its booleans. Fonts hydrate in the background and Text
  // falls back to the system face until they swap.
  useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
  });

  // Gate state. `sessionChecked` flips once boot settles; we keep the Stack
  // mounted from the first render and overlay a black/sand View while pending —
  // NEVER `return null` (that tears the ExpoRoot down in an infinite remount
  // loop) and NEVER swap the root between a non-Stack and a Stack tree.
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // A 401 from an authed request is a sign-out signal: clear the session,
    // drop the bearer, and route to sign-in.
    setUnauthorizedHandler(() => {
      void (async () => {
        await clearSession();
        setAuthToken(null);
        router.replace('/(auth)/sign-in');
      })();
    });

    void (async () => {
      try {
        // If launched via the verify deep link, don't bounce to sign-in — the
        // verify screen will pick up the token and route on success.
        const initialUrl = await Linking.getInitialURL();
        const launchedViaVerify =
          !!initialUrl && /[?&]token=|\/verify(?:\?|$)/.test(initialUrl);

        const { authenticated } = await bootApiClient();
        if (cancelled) return;

        if (!authenticated && !launchedViaVerify) {
          router.replace('/(auth)/sign-in');
        }
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (booted) SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  return (
    <AppProviders>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.sand },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="spot/[slug]/index"
            options={{
              presentation: 'card',
              gestureEnabled: true,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="spot/[slug]/review"
            options={{
              presentation: 'card',
              gestureEnabled: true,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
        </Stack>
        {/* Overlay while gates are pending. Absolute-positioned over the live
            Stack so router.replace always has a navigator to land on. */}
        {!booted && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.sand,
            }}
          />
        )}
      </SafeAreaProvider>
    </AppProviders>
  );
}
