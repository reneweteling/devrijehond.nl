// Expo's flat ESLint config. `expo lint` reads this.
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat';

export default defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
]);
