import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getQueryClient } from './query';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
