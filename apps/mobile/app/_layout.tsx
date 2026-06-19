import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { setUnauthorizedHandler, setAuthToken } from '@devrijehond/api-client';

import { AppProviders } from '@/lib/providers';
import { bootApiClient } from '@/lib/query';
import { clearSession } from '@/lib/session';
import { useAuth } from '@/lib/auth-context';
import { fetchAppConfig, isUpdateRequired } from '@/lib/app-version';
import { ForceUpdate } from '@/components/force-update';
import { colors } from '@/lib/theme';

// Anchor `/` to the tabs group (there is no app/index.tsx). The app is
// anonymous-first: a signed-out boot lands on the map; auth-gated screens show
// their own sign-in CTA. No forced redirect to (auth) on boot.
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

  return (
    <AppProviders>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="dark" />
        <RootNav />
      </SafeAreaProvider>
    </AppProviders>
  );
}

/**
 * Lives inside the providers so it can drive the shared auth state. Boots the
 * api-client (loads the persisted bearer), publishes the resulting auth status,
 * and keeps the Stack mounted from the first render, overlaying a sand View
 * while boot settles. NEVER `return null` (that tears ExpoRoot down in a remount
 * loop) and NEVER swap the root between a non-Stack and a Stack tree.
 */
function RootNav() {
  const { setAuthenticated } = useAuth();
  const [booted, setBooted] = useState(false);
  const [updateUrl, setUpdateUrl] = useState<{ ios: string; android: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Force-update check (non-blocking on failure): cut off ancient builds.
    void (async () => {
      const config = await fetchAppConfig();
      if (!cancelled && config && isUpdateRequired(config)) setUpdateUrl(config.updateUrl);
    })();

    // A 401 from an authed request means the session lapsed: clear it and drop
    // to anonymous. No hard redirect, the user stays on the map and auth-gated
    // screens fall back to their sign-in CTA.
    setUnauthorizedHandler(() => {
      void (async () => {
        await clearSession();
        setAuthToken(null);
        if (!cancelled) setAuthenticated(false);
      })();
    });

    void (async () => {
      try {
        // A verify deep link is handled by the verify screen; boot stays out of
        // its way (no routing here either way).
        await Linking.getInitialURL();
        const { authenticated } = await bootApiClient();
        if (cancelled) return;
        setAuthenticated(authenticated);
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, [setAuthenticated]);

  useEffect(() => {
    if (booted) SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  return (
    <>
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
        <Stack.Screen
          name="request-new"
          options={{
            presentation: 'card',
            gestureEnabled: true,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            presentation: 'card',
            gestureEnabled: true,
            animation: 'fade',
            contentStyle: { backgroundColor: colors.sand },
          }}
        />
      </Stack>
      {/* Overlay while boot is pending. Absolute over the live Stack so any
          router action always has a navigator to land on. */}
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
      {/* Blocking force-update gate (above everything) for outdated builds. */}
      {updateUrl && <ForceUpdate url={updateUrl} />}
    </>
  );
}
