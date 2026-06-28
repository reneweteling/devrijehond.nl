import { z } from 'zod';
import '../registry';

/**
 * Runtime app config, `GET /api/v1/app-config`. Public, anonymous, short-cached.
 *
 * The mobile app reads this on boot to drive the force-update flow: if the
 * running version is below `minSupportedVersion`, it shows a blocking "update
 * required" screen and links to the relevant store.
 */
export const AppConfigSchema = z
  .object({
    minSupportedVersion: z.string().openapi({
      description: 'Lowest app version still allowed to run. Below this, force an update.',
      example: '0.1.0',
    }),
    latestVersion: z.string().openapi({
      description: 'Latest released app version.',
      example: '0.1.0',
    }),
    updateUrl: z
      .object({
        ios: z.string().url().openapi({ description: 'App Store URL.' }),
        android: z.string().url().openapi({ description: 'Play Store URL.' }),
      })
      .openapi({ description: 'Per-platform store URLs for the update prompt.' }),
  })
  .openapi('AppConfig', { description: 'Runtime configuration read by the mobile app on boot.' });
export type AppConfigDto = z.infer<typeof AppConfigSchema>;
