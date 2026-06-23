import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

// reactNavigationIntegration hooks into the navigation container to produce
// navigation breadcrumbs and transaction spans. Exported so _layout.tsx can
// register the container ref once it mounts.
export const navigationIntegration = Sentry.reactNavigationIntegration({
  // enableTimeToInitialDisplay requires the native SDK; skip in Expo Go where
  // native modules are not available.
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_APP_SENTRY_DSN,

  // 1.0 = 100% of transactions are traced. Lower this in production if volume
  // becomes a concern (e.g. 0.2 for 20%).
  tracesSampleRate: 1.0,

  integrations: [navigationIntegration],

  // Native frame tracking measures exactly which frames are slow/frozen.
  // Not available in Expo Go.
  enableNativeFramesTracking: !isRunningInExpoGo(),

  // Attach the logged-in user id / email to events so errors are searchable by
  // user in the Sentry dashboard. Call Sentry.setUser(null) on sign-out.
  sendDefaultPii: true,
});
