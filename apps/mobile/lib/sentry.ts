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

  integrations: [
    navigationIntegration,
    // In-app User Feedback form (opened from Profiel → "Feedback sturen" via
    // Sentry.showFeedbackWidget()). Name/email prefill from the Sentry user we
    // set on sign-in; neither is required so anonymous users can send too.
    Sentry.feedbackIntegration({
      showName: true,
      showEmail: true,
      isNameRequired: false,
      isEmailRequired: false,
      formTitle: 'Feedback sturen',
      messageLabel: 'Bericht',
      messagePlaceholder: 'Wat kan beter, of wat ging er mis?',
      submitButtonLabel: 'Versturen',
      cancelButtonLabel: 'Annuleren',
      nameLabel: 'Naam',
      namePlaceholder: 'Je naam',
      emailLabel: 'E-mail',
      emailPlaceholder: 'je@email.nl',
      isRequiredLabel: '(verplicht)',
      addScreenshotButtonLabel: 'Screenshot toevoegen',
      removeScreenshotButtonLabel: 'Screenshot verwijderen',
      successMessageText: 'Bedankt voor je feedback!',
    }),
  ],

  // Native frame tracking measures exactly which frames are slow/frozen.
  // Not available in Expo Go.
  enableNativeFramesTracking: !isRunningInExpoGo(),

  // Attach the logged-in user id / email to events so errors are searchable by
  // user in the Sentry dashboard. Call Sentry.setUser(null) on sign-out.
  sendDefaultPii: true,
});
